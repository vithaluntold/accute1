// Replit provides environment variables automatically - no dotenv needed

// Helper: Validate ENCRYPTION_KEY has proper byte entropy
function validateEncryptionKey(key: string): boolean {
  // Accept base64 encoded 32+ bytes (44+ chars for 32 bytes in base64)
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (base64Regex.test(key) && key.length >= 44) {
    try {
      const decoded = Buffer.from(key, 'base64');
      return decoded.length >= 32; // At least 32 bytes
    } catch {
      return false;
    }
  }
  
  // Accept hex encoded 32+ bytes (64+ chars for 32 bytes in hex)
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (hexRegex.test(key) && key.length >= 64) {
    return true; // Valid hex with 32+ bytes
  }
  
  // For backwards compatibility: accept any string >= 32 chars
  // (SHA-256 hashing in auth.ts normalizes it to 32 bytes)
  return key.length >= 32;
}

// CRITICAL: Validate required environment variables BEFORE any imports
// This prevents cryptic crashes from missing database or auth configuration
function validateEnvironment() {
  const requiredVars = [
    { name: 'DATABASE_URL', critical: true },
    { name: 'JWT_SECRET', critical: true },
    { name: 'SESSION_SECRET', critical: true },
  ];

  const optionalVars: Array<{ name: string; critical: boolean; minLength?: number }> = [];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const { name, critical, minLength } of requiredVars) {
    if (!process.env[name]) {
      if (critical) {
        missing.push(`${name} (required)`);
      }
    } else if (minLength && process.env[name]!.length < minLength) {
      missing.push(`${name} (too short - minimum ${minLength} characters)`);
    }
  }
  
  // Special validation for ENCRYPTION_KEY (requires proper entropy)
  if (!process.env.ENCRYPTION_KEY) {
    missing.push('ENCRYPTION_KEY (required)');
  } else if (!validateEncryptionKey(process.env.ENCRYPTION_KEY)) {
    missing.push('ENCRYPTION_KEY (invalid format - must be base64/hex encoded 32+ bytes, or 32+ character string)');
  }

  // Check optional variables with warnings
  for (const { name, critical, minLength } of optionalVars) {
    if (!process.env[name]) {
      warnings.push(`${name} not set - related features will be disabled`);
    } else if (minLength && process.env[name]!.length < minLength) {
      warnings.push(`${name} is too short (minimum ${minLength} characters) - related features may not work`);
    }
  }

  // Report issues - but DON'T exit, let server start for health checks
  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missing.forEach(name => console.error(`   - ${name}`));
    console.error('\n💡 To fix this:');
    console.error('   1. Set these variables in Railway dashboard');
    console.error('   2. Or in your .env file for local development\n');
    
    // Store error for health check - but DON'T exit
    // Server will start in degraded mode to respond to health checks
    (global as any).__envValidationError = `Missing: ${missing.join(', ')}`;
  }

  // Show warnings for optional variables
  if (warnings.length > 0) {
    console.warn('⚠️  Optional configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }

  // CRITICAL: Production safety check for test endpoints
  // Prevent accidental enablement of test-only MFA endpoints in production
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TEST_TOTP_ENDPOINT === 'true') {
    console.error('❌ CRITICAL SECURITY ERROR: ENABLE_TEST_TOTP_ENDPOINT is enabled in production!');
    console.error('');
    console.error('This test-only endpoint MUST NOT be enabled in production.');
    console.error('It allows unauthenticated TOTP generation and bypasses MFA security.');
    console.error('');
    console.error('💡 To fix this:');
    console.error('   1. Remove ENABLE_TEST_TOTP_ENDPOINT from production environment');
    console.error('   2. Or set ENABLE_TEST_TOTP_ENDPOINT=false in production');
    console.error('   3. This flag should ONLY be enabled in development/test environments\n');
    
    // Exit immediately - this is a critical security issue
    process.exit(1);
  }
}

// Run validation before any imports that might use these variables
validateEnvironment();

// Add global error handlers for better crash diagnostics
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error('Error stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED PROMISE REJECTION at:', promise);
  console.error('Reason:', reason);
  // In production, log but don't crash for database timeouts or connection errors
  // This allows the app to recover from temporary network issues
  const reasonStr = String(reason);
  if (process.env.NODE_ENV === 'production' && 
      (reasonStr.includes('ECONNRESET') || 
       reasonStr.includes('timeout') || 
       reasonStr.includes('Connection terminated'))) {
    console.warn('⚠️ Non-fatal database error - app will continue running');
  } else {
    process.exit(1);
  }
});

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { registerRoutes, setInitializationStatus } from "./routes";
import { setupVite, log } from "./vite";
import { initializeSystem } from "./init";
import {
  loginRateLimiter,
  organizationCreationRateLimiter,
  userCreationRateLimiter,
} from "./rate-limit";
// Lazy WebSocket loader for user-to-user real-time communication
import { setupLazyWebSocketLoader, cleanupLazyWebSockets } from "./websocket-lazy-loader";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Node ESM compatible directory resolution (works in production after bundling)
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Explicitly set Express environment from NODE_ENV
// This ensures app.get("env") works correctly in production
app.set("env", process.env.NODE_ENV || "development");

// CRITICAL: Enable trust proxy for rate limiters to work correctly
// Replit and other platforms run behind reverse proxies
// Trust only the first proxy (Replit's reverse proxy) for security
// This prevents IP spoofing while allowing rate limiters to work
app.set("trust proxy", 1);

app.use(cookieParser());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// SECURITY: HTTPS Enforcement in Production for API routes only
// Prevents man-in-the-middle attacks on payment data
app.use('/api', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.status(403).json({ 
      error: 'HTTPS required for secure payment processing',
      code: 'HTTPS_REQUIRED' 
    });
  }
  next();
});

// SECURITY: Comprehensive Security Headers for API routes only
// Protects against XSS, clickjacking, MIME sniffing, and other attacks
// Only applied to /api/* routes to avoid interfering with Vite dev server
app.use('/api', (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS - Force HTTPS in production for 1 year with preload
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy - Balance security with Razorpay checkout
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    isDev 
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com"
      : "script-src 'self' https://checkout.razorpay.com",
    isDev
      ? "style-src 'self' 'unsafe-inline'"
      : "style-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com ws: wss:",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  
  // Permissions Policy - Restrict powerful features
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
});

// SECURITY: Rate limiting for payment endpoints
// Prevents brute-force attacks and payment fraud attempts
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15-minute window
  message: { 
    error: 'Too many payment attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

// Apply rate limiting to payment-related routes
app.use('/api/payment-methods', paymentLimiter);
app.use('/api/subscription-invoices/:id/pay', paymentLimiter);
app.use('/api/subscription-invoices/:id/complete-payment', paymentLimiter);

// SECURITY: P0 Rate Limiting for Authentication Endpoints
// Prevents brute-force attacks and account enumeration
app.post('/api/auth/login', loginRateLimiter); // Login attempts
// Note: organizationCreationRateLimiter will be applied by routes.ts on POST /api/organizations
// Note: userCreationRateLimiter will be applied by routes.ts on POST /api/organizations/:id/users
console.log('✅ [SECURITY] P0 authentication rate limiting enabled (login endpoint)');

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

// Export startServer function - called by start.ts at runtime only
export async function startServer() {
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = '0.0.0.0';
  
  console.log(`🚀 Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  console.log(`   Port: ${port}, Host: ${host}`);
  
  // CRITICAL FOR RAILWAY: Start HTTP server IMMEDIATELY with minimal health endpoint
  const { createServer } = await import('http');
  const httpServer = createServer(app);
  
  // Register health endpoint FIRST - before any other routes
  app.get('/api/health', (req, res) => {
    const envError = (global as any).__envValidationError;
    res.status(200).json({ 
      status: envError ? 'degraded' : 'ok', 
      timestamp: new Date().toISOString(),
      initialized: initializationComplete,
      initError: initializationError || envError || null
    });
  });
  
  // START LISTENING IMMEDIATELY - within first 1-2 seconds
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, host, () => {
      console.log(`✅ Server listening on ${host}:${port}`);
      console.log(`   Health endpoint ready at /api/health`);
      resolve();
    }).on('error', reject);
  });
  
  // ALL heavy work happens AFTER server is listening (background)
  (async () => {
    try {
      console.log('🔧 [Background] Registering routes...');
      await registerRoutes(app);
      console.log('✅ [Background] Routes registered');
      
      // WebSocket setup
      try {
        setupLazyWebSocketLoader(httpServer);
        console.log('✅ [Background] WebSocket ready');
      } catch (e) {
        console.warn('⚠️ [Background] WebSocket failed:', e);
      }
      
      // Database warmup with retry
      console.log('🔧 [Background] Connecting to database...');
      const { pool } = await import('./db');
      let dbConnected = false;
      
      for (let attempt = 1; attempt <= 15; attempt++) {
        try {
          const client = await pool.connect();
          await client.query('SELECT 1');
          client.release();
          console.log(`✅ [Background] Database connected (attempt ${attempt})`);
          dbConnected = true;
          break;
        } catch (dbError: any) {
          console.log(`   [Background] DB attempt ${attempt}/15: ${dbError.message}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      if (!dbConnected) {
        console.error('❌ [Background] Database connection failed');
        setInitializationStatus(false, 'Database connection failed');
        setLocalInitStatus(false, 'Database connection failed');
        return;
      }
      
      // System initialization
      console.log('🔧 [Background] Running system initialization...');
      await initializeSystem(app);
      console.log('✅ [Background] System initialized');
      setInitializationStatus(true, null);
      setLocalInitStatus(true, null);
      
      // Register agent routes
      console.log('🔧 [Background] Registering agent routes...');
      const { registerAllAgentRoutes, getAvailableAgents } = await import("./agents-static.js");
      const { registerAgentSessionRoutes } = await import("./agent-sessions");
      const agentSlugs = getAvailableAgents();
      registerAllAgentRoutes(agentSlugs, app);
      for (const slug of agentSlugs) {
        registerAgentSessionRoutes(app, slug);
      }
      console.log(`✅ [Background] ${agentSlugs.length} agent routes registered`);
      
      // Load automation triggers
      try {
        const { getEventTriggersEngine } = await import('./event-triggers');
        const { storage } = await import('./storage');
        const eventEngine = getEventTriggersEngine(storage);
        await eventEngine.loadTriggersFromDatabase();
        console.log('✅ [Background] Automation triggers loaded');
      } catch (e) {
        console.warn('⚠️ [Background] Automation triggers failed');
      }
      
      // Start scheduler
      try {
        const { schedulerService } = await import('./scheduler-service');
        schedulerService.start();
        console.log('✅ [Background] Scheduler started');
      } catch (e) {
        console.warn('⚠️ [Background] Scheduler failed');
      }
      
      // Setup Vite/static serving AFTER routes registered
      const distPath = path.resolve(moduleDir, "public");
      const isDevelopment = app.get("env") === "development";
      
      if (isDevelopment) {
        try {
          console.log('🔧 [Background] Setting up Vite dev server...');
          await setupVite(app, httpServer);
          console.log('✅ [Background] Vite dev server ready');
        } catch (viteError) {
          console.warn('⚠️ [Background] Vite setup failed:', viteError);
        }
      } else {
        // PRODUCTION: Serve static files
        try {
          if (fs.existsSync(distPath)) {
            app.use(express.static(distPath));
            app.use("*", (_req, res) => {
              res.sendFile(path.resolve(distPath, "index.html"));
            });
            console.log('✅ [Background] Static files ready');
          }
        } catch (e) {
          console.warn('⚠️ [Background] Static file setup failed');
        }
      }
      
      // Serve uploads
      const uploadsPath = path.resolve(process.cwd(), "uploads");
      app.use("/uploads", express.static(uploadsPath, { fallthrough: false }));
      console.log('✅ [Background] Uploads ready');
      
      console.log('🎉 [Background] All initialization complete!');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ [Background] Initialization failed:', errorMsg);
      setInitializationStatus(false, errorMsg);
      setLocalInitStatus(false, errorMsg);
    }
  })();
}

// Initialization tracking - shared with start.ts
let initializationComplete = false;
let initializationError: string | null = null;

export function getInitializationStatus() {
  return { complete: initializationComplete, error: initializationError };
}

export function setLocalInitStatus(complete: boolean, error: string | null) {
  initializationComplete = complete;
  initializationError = error;
}

// NOTE: startServer() is called by server/start.ts at runtime only.
// This file is bundled by esbuild but should NOT auto-execute.
