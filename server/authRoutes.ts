import type { Express } from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import { insertUserSchema, updateUserPasswordSchema } from "@shared/schema";
import type { IStorage } from "./storage";

export function registerAuthRoutes(app: Express, storage: IStorage) {
  // Register new user
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email } = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
      });

      // Log the user in
      req.login(
        { id: user.id, username: user.username, email: user.email },
        (err) => {
          if (err) {
            return res.status(500).json({ message: "Failed to login after registration" });
          }
          res.json({ 
            id: user.id, 
            username: user.username, 
            email: user.email 
          });
        }
      );
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  // Special admin account creation endpoint
  app.post("/api/auth/create-admin", async (req, res) => {
    try {
      const { username, password, email, adminKey } = req.body;

      // Validate admin creation key (must be set via environment variable)
      const ADMIN_CREATION_KEY = process.env.ADMIN_CREATION_KEY;
      if (!ADMIN_CREATION_KEY) {
        return res.status(503).json({ message: "Admin creation is not configured. Set ADMIN_CREATION_KEY environment variable." });
      }
      if (adminKey !== ADMIN_CREATION_KEY) {
        return res.status(403).json({ message: "Invalid admin creation key" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if an admin already exists
      const existingAdmin = await storage.getUserByAdmin();
      if (existingAdmin) {
        return res.status(400).json({ message: "Admin account already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin user with free tier
      const user = await storage.createAdminUser({
        username,
        password: hashedPassword,
        email,
      });

      // Log the user in
      req.login(
        { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin },
        (err) => {
          if (err) {
            return res.status(500).json({ message: "Failed to login after admin creation" });
          }
          res.json({ 
            id: user.id, 
            username: user.username, 
            email: user.email,
            isAdmin: user.isAdmin
          });
        }
      );
    } catch (error: any) {
      console.error("Admin creation error:", error);
      res.status(400).json({ message: error.message || "Admin creation failed" });
    }
  });

  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to login" });
        }
        res.json({ id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Change password
  app.post("/api/auth/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { currentPassword, newPassword } = updateUserPasswordSchema.parse(req.body);
      const userId = (req.user as any).id;

      // Get user from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password - we'll implement this method in storage
      await storage.updateUserPassword(userId, hashedPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Password change error:", error);
      res.status(400).json({ message: error.message || "Failed to change password" });
    }
  });
}
