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

  // Report issues
  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missing.forEach(name => console.error(`   - ${name}`));
    console.error('\n💡 To fix this:');
    console.error('   1. Create a .env file in your project root');
    console.error('   2. Add the required variables (see .env.example)');
    console.error('   3. For production, set these in your deployment platform\n');
    console.error('Example .env file:');
    console.error('   DATABASE_URL="postgresql://user:pass@host:5432/dbname"');
    console.error('   JWT_SECRET="your-random-secret-key-here"');
    console.error('   SESSION_SECRET="another-random-secret-key-here"');
    console.error('   ENCRYPTION_KEY="generate-with: node -e \\"console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))\\""\n');
    
    // Exit immediately - don't try to start the server
    process.exit(1);
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

(async () => {
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = '0.0.0.0';
  
  try {
    console.log(`🚀 Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
    console.log(`   Port: ${port}`);
    console.log(`   Host: ${host}`);
    
    // CRITICAL FOR AUTOSCALE: Create HTTP server and start listening IMMEDIATELY
    // All heavy initialization must happen AFTER the server is listening
    const server = await registerRoutes(app);
    
    // START LISTENING FIRST - Server must bind to port within 1-2 seconds for health checks
    await new Promise<void>((resolve, reject) => {
      server.listen(port, host, () => {
        console.log(`✅ Server listening on ${host}:${port}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🌐 Access your app at: https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`);
        log(`serving on port ${port}`);
        resolve();
      }).on('error', (err: Error) => {
        console.error('❌ Server failed to start:', err);
        reject(err);
      });
    });
    
    // Initialize WebSocket servers for user-to-user real-time communication
    console.log('🔧 Initializing WebSocket servers...');
    try {
      setupLazyWebSocketLoader(server);
    } catch (wsError) {
      console.error('❌ WebSocket server initialization failed:', wsError);
    }
    
    // CRITICAL: Run ALL database-dependent initialization in background
    // This ensures health checks respond immediately while DB work continues
    console.log('🔧 Starting background initialization...');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    
    // Background initialization - does NOT block health checks
    (async () => {
      try {
        // Warmup database connection with retry
        console.log('🔧 [Background] Warming up database connection...');
        const { pool } = await import('./db');
        let dbConnected = false;
        const maxAttempts = 10;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log(`✅ [Background] Database connected (attempt ${attempt})`);
            dbConnected = true;
            break;
          } catch (dbError: any) {
            console.log(`   [Background] DB attempt ${attempt}/${maxAttempts}: ${dbError.message}`);
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (!dbConnected) {
          console.error('❌ [Background] Database connection failed after all attempts');
          setInitializationStatus(false, 'Database connection failed');
          return;
        }
        
        // System initialization
        console.log('🔧 [Background] Running system initialization...');
        await initializeSystem(app);
        console.log('✅ [Background] System initialized');
        setInitializationStatus(true, null);
        
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
          console.warn('⚠️ [Background] Automation triggers failed:', e);
        }
        
        // Start scheduler
        try {
          const { schedulerService } = await import('./scheduler-service');
          schedulerService.start();
          console.log('✅ [Background] Scheduler started');
        } catch (e) {
          console.warn('⚠️ [Background] Scheduler failed:', e);
        }
        
        console.log('🎉 [Background] All initialization complete!');
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ [Background] Initialization failed:', errorMsg);
        setInitializationStatus(false, errorMsg);
      }
    })();
    
    // CRITICAL: Setup Vite/static serving AFTER agent routes are registered
    // This prevents Vite's catch-all from intercepting agent endpoints
    const distPath = path.resolve(moduleDir, "public");
    const isDevelopment = app.get("env") === "development";
    
    // ALWAYS use Vite in development, even if dist exists
    if (isDevelopment) {
      try {
        console.log('🔧 Setting up Vite dev server...');
        await setupVite(app, server);
        console.log('✅ Vite dev server initialized - routes ready');
      } catch (viteError) {
        console.error('❌ Vite setup failed:', viteError);
        console.error('Error stack:', viteError instanceof Error ? viteError.stack : 'N/A');
        console.warn('⚠️  Continuing without Vite dev server');
      }
    } else {
      // PRODUCTION: Serve static files from dist/public
      try {
        if (!fs.existsSync(distPath)) {
          throw new Error(
            `Could not find the build directory: ${distPath}, make sure to build the client first`,
          );
        }

        app.use(express.static(distPath));
        
        // SPA fallback: serve index.html for all non-API routes
        app.use("*", (_req, res) => {
          res.sendFile(path.resolve(distPath, "index.html"));
        });
        
        console.log('✅ Static file serving initialized (production mode) - routes ready');
        console.log(`   Serving from: ${distPath}`);
      } catch (staticError) {
        console.error('❌ Static file setup failed:', staticError);
        console.warn('⚠️  Continuing without static file serving');
      }
    }
    
    // Serve uploaded files from /uploads directory
    const uploadsPath = path.resolve(process.cwd(), "uploads");
    app.use("/uploads", express.static(uploadsPath, {
      fallthrough: false,
      setHeaders: (res) => {
        // Allow browser to determine content type from file extension
      }
    }));
    console.log('✅ Upload serving initialized');
    console.log(`   Serving from: ${uploadsPath}`);
    
  } catch (error) {
    console.error('❌ Fatal error during application startup:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'N/A');
    
    if (error && typeof error === 'object') {
      console.error('Additional error properties:', JSON.stringify(error, null, 2));
    }
    
    process.exit(1);
  }
})();
