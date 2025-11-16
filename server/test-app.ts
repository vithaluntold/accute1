/**
 * Test-friendly Express app export
 * This file exports the Express app without starting the HTTP server
 * Used by Jest/Supertest for API testing
 */

import express, { type Express } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";

// SAFETY: Ensure we're in test mode
if (process.env.NODE_ENV !== 'test') {
  console.warn(`⚠️  test-app.ts loaded in ${process.env.NODE_ENV} mode - should only be used in tests`);
}

// Create Express app
const app: Express = express();

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration (minimal for tests)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "test-session-secret-key-minimum-32-chars",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Disable secure cookies for tests
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize routes (this returns a Server but we only need app for testing)
// The registerRoutes function registers all routes on the app
// We don't actually start the server - Supertest will handle that
registerRoutes(app).catch(error => {
  console.error('Failed to register routes in test app:', error);
});

export default app;
