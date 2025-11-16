/**
 * Test-friendly Express app export
 * This file exports the Express app WITHOUT starting the HTTP server
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

// Register routes synchronously
// Note: registerRoutes returns a Promise<Server> but we don't await it here
// because Supertest creates its own server. We just need the routes registered.
// The HTTP server creation inside registerRoutes is not used by tests.
let routesInitialized = false;
let initPromise: Promise<any> | null = null;

// Initialize routes once
if (!routesInitialized) {
  initPromise = registerRoutes(app)
    .then(() => {
      routesInitialized = true;
      console.log('✅ Test app routes initialized');
    })
    .catch((error) => {
      console.error('❌ Failed to initialize test app routes:', error);
      throw error;
    });
}

// Export the app - Supertest will handle server creation
export default app;

// Export initialization promise for tests that need to wait
export { initPromise };
