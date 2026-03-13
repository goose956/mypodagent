import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import bcrypt from "bcrypt";

function preflightEnvCheck() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const requiredVars = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "OPENAI_API_KEY",
    "KIE_AI_API_KEY",
    "PRINTFUL_API_TOKEN",
    "STORAGE_DIR",
  ];

  const missing = requiredVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;
    console.error(message);
    throw new Error(message);
  }

  if (!process.env.APP_URL) {
    console.warn("APP_URL is not set. Public asset URLs may be incorrect.");
  }
}

const app = express();

preflightEnvCheck();

// Trust proxy when deployed (Replit uses reverse proxy)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: '50mb' })); // Increased limit for canvas attachments
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Session store configuration
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  pool: new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  tableName: 'session', // Use 'session' table for sessions
  createTableIfMissing: true,
});

// Session configuration
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("SESSION_SECRET must be set in production"); })() : "dev-only-session-secret"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax", // Protect against CSRF
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  })
);

// Initialize Passport
setupAuth(app);

// Bot detection patterns
const BOT_PATTERNS = /bot|crawl|spider|slurp|bingbot|googlebot|yandex|baidu|duckduckbot|semrush|ahrefs|mj12bot|dotbot|rogerbot|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegrambot|discordbot|applebot|pinterestbot|redditbot|bytespider|gptbot|claudebot|anthropic|petalbot|amazonbot|ccbot|dataforseo|serpstat|zoominfobot|headlesschrome|phantomjs|wget|curl|python-requests|go-http-client|java\/|httpx|scrapy|nutch/i;

function parseUserAgent(ua: string | null): { browser: string; os: string; isBot: boolean } {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', isBot: false };
  
  const isBot = BOT_PATTERNS.test(ua);
  if (isBot) {
    const botMatch = ua.match(/(googlebot|bingbot|yandex|baidu|duckduckbot|semrush|ahrefs|facebookexternalhit|linkedinbot|twitterbot|gptbot|claudebot|applebot|pinterestbot|amazonbot|bytespider)/i);
    return { browser: botMatch ? botMatch[1] : 'Bot', os: 'Bot', isBot: true };
  }
  
  let browser = 'Unknown';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'IE';
  
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('CrOS')) os = 'ChromeOS';
  
  return { browser, os, isBot };
}

// Page visit tracking middleware - track non-API page loads
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    const referrer = req.get('referer') || req.get('referrer') || null;
    const userAgent = req.get('user-agent') || null;
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const parsed = parseUserAgent(userAgent);
    
    storage.createPageVisit({
      path: req.path,
      referrer,
      userAgent,
      ipAddress,
      isBot: parsed.isBot ? 'true' : 'false',
      browser: parsed.browser,
      os: parsed.os,
    }).catch(err => {
      console.error('Error tracking page visit:', err);
    });
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Auto-create admin account on first startup if configured
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    try {
      const existingAdmin = await storage.getUserByAdmin();
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        await storage.createAdminUser({
          username: process.env.ADMIN_USERNAME,
          password: hashedPassword,
          email: process.env.ADMIN_EMAIL || "",
        });
        log("Admin account created successfully");
      }
    } catch (err) {
      console.error("Failed to auto-create admin:", err);
    }
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
