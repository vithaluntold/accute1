// CRITICAL: Validate required environment variables BEFORE any imports
// This prevents cryptic crashes from missing database or auth configuration
function validateEnvironment() {
  const requiredVars = [
    { name: 'DATABASE_URL', critical: true },
    { name: 'JWT_SECRET', critical: true },
    { name: 'SESSION_SECRET', critical: true },
  ];

  const optionalVars = [
    { name: 'ENCRYPTION_KEY', critical: false, minLength: 32 },
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const { name, critical } of requiredVars) {
    if (!process.env[name]) {
      if (critical) {
        missing.push(name);
      }
    }
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
    console.error('   SESSION_SECRET="another-random-secret-key-here"\n');
    
    // Exit immediately - don't try to start the server
    process.exit(1);
  }

  // Show warnings for optional variables
  if (warnings.length > 0) {
    console.warn('⚠️  Optional configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }
}

// Run validation before any imports that might use these variables
validateEnvironment();

import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { registerRoutes, setInitializationStatus } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeSystem } from "./init";
import { setupWebSocket } from "./websocket";
import { setupRoundtableWebSocket } from "./roundtable-websocket";
import { setupTeamChatWebSocket } from "./team-chat-websocket";
import path from "path";
import fs from "fs";

const app = express();

// Explicitly set Express environment from NODE_ENV
// This ensures app.get("env") works correctly in production
app.set("env", process.env.NODE_ENV || "development");

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
    
    // Create HTTP server first
    const server = await registerRoutes(app);
    
    // Start listening IMMEDIATELY to respond to health checks
    // Do this BEFORE heavy initialization to pass deployment health checks
    // Wrap in try-catch to handle any synchronous listen errors
    try {
      await new Promise<void>((resolve, reject) => {
        server.listen(port, host, () => {
          console.log(`✅ Server listening on ${host}:${port}`);
          console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
          log(`serving on port ${port}`);
          resolve();
        }).on('error', (err: Error) => {
          console.error('❌ Server failed to start:', err);
          console.error('Error name:', err.name);
          console.error('Error message:', err.message);
          console.error('Error stack:', err.stack);
          
          if ('code' in err) {
            console.error('Error code:', (err as any).code);
          }
          if ('syscall' in err) {
            console.error('System call:', (err as any).syscall);
          }
          
          reject(err);
        });
      });
    } catch (listenError) {
      console.error('❌ Failed to bind to port:', listenError);
      throw listenError;
    }
    
    // Now do heavy initialization AFTER server is listening
    // This allows health checks to pass while initialization completes
    console.log('🔧 Initializing system...');
    
    try {
      await initializeSystem();
      console.log('✅ System initialized successfully');
      setInitializationStatus(true, null);
    } catch (initError) {
      const errorMsg = initError instanceof Error ? initError.message : String(initError);
      console.error('❌ System initialization failed:', initError);
      console.error('Stack trace:', initError instanceof Error ? initError.stack : 'N/A');
      setInitializationStatus(false, errorMsg);
      // Don't exit - server can still handle health checks
      console.warn('⚠️  Server running with limited functionality');
    }
    
    // Setup WebSocket server for streaming AI agents
    try {
      const wss = setupWebSocket(server);
      console.log('🔌 WebSocket server initialized at /ws/ai-stream');
    } catch (wsError) {
      console.error('❌ WebSocket initialization failed:', wsError);
      console.warn('⚠️  Continuing without WebSocket support');
    }
    
    // Setup WebSocket server for AI Roundtable collaboration
    try {
      const roundtableWss = setupRoundtableWebSocket(server);
      console.log('🔌 Roundtable WebSocket server initialized at /ws/roundtable');
    } catch (wsError) {
      console.error('❌ Roundtable WebSocket initialization failed:', wsError);
      console.warn('⚠️  Continuing without Roundtable WebSocket support');
    }
    
    // Setup WebSocket server for Team Chat
    try {
      const teamChatWss = setupTeamChatWebSocket(server);
      console.log('🔌 Team Chat WebSocket server initialized at /ws/team-chat');
    } catch (wsError) {
      console.error('❌ Team Chat WebSocket initialization failed:', wsError);
      console.warn('⚠️  Continuing without Team Chat WebSocket support');
    }

    // Setup Vite (dev) or static file serving (production) BEFORE error handler
    // This ensures the catch-all route for the SPA works correctly
    // Check if dist/public exists to determine production vs development
    const distPath = path.resolve(import.meta.dirname, "public");
    const isProduction = fs.existsSync(distPath);
    
    if (!isProduction && app.get("env") === "development") {
      try {
        await setupVite(app, server);
        console.log('✅ Vite dev server initialized');
      } catch (viteError) {
        console.error('❌ Vite setup failed:', viteError);
        console.warn('⚠️  Continuing without Vite dev server');
      }
    } else {
      try {
        serveStatic(app);
        console.log('✅ Static file serving initialized (production mode)');
      } catch (staticError) {
        console.error('❌ Static file setup failed:', staticError);
        console.warn('⚠️  Continuing without static file serving');
      }
    }

    // Error handler MUST be registered AFTER static file serving
    // so it only catches actual errors, not SPA routes
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      // Log the error for debugging
      console.error('Request error:', {
        status,
        message,
        path: _req.path,
        method: _req.method,
        stack: err.stack
      });

      res.status(status).json({ message });
      // Don't throw - just log and respond
    });
    
    console.log('🎉 Application fully initialized and ready!');
    
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
