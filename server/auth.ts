import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Express } from "express";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

export type User = {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
};

export function setupAuth(app: Express) {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Try to find user by username OR email
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        // If not found by username, try email
        let foundUser = user;
        if (!foundUser) {
          const [emailUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, username))
            .limit(1);
          foundUser = emailUser;
        }

        if (!foundUser) {
          return done(null, false, { message: "Invalid credentials" });
        }

        const isValidPassword = await bcrypt.compare(password, foundUser.password);
        if (!isValidPassword) {
          return done(null, false, { message: "Invalid credentials" });
        }

        const isAdmin = foundUser.isAdmin === "true";
        console.log("[AUTH] Login - username:", foundUser.username, "isAdmin field:", foundUser.isAdmin, "isAdmin result:", isAdmin);

        return done(null, {
          id: foundUser.id,
          username: foundUser.username,
          email: foundUser.email,
          isAdmin,
        });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return done(null, false);
      }

      const isAdmin = user.isAdmin === "true";
      console.log("[AUTH] Deserialize - username:", user.username, "isAdmin field:", user.isAdmin, "isAdmin result:", isAdmin);

      done(null, {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin,
      });
    } catch (err) {
      done(err);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}

export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

export function requireAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user && req.user.isAdmin === true) {
    return next();
  }
  res.status(403).json({ message: "Admin access required" });
}
