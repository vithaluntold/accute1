import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeSystem } from "./init";
import { setupWebSocket } from "./websocket";
import { setupRoundtableWebSocket } from "./roundtable-websocket";
import path from "path";

// Security check: Warn if encryption key is not set
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  console.warn('⚠️  WARNING: ENCRYPTION_KEY not configured. LLM features will be disabled.');
  console.warn('   To enable AI agents, set ENCRYPTION_KEY (32+ characters).');
  console.warn('   Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"');
}

const app = express();

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
  try {
    // Initialize system roles and permissions on startup
    console.log('🔧 Initializing system...');
    await initializeSystem();
    console.log('✅ System initialized successfully');
    
    const server = await registerRoutes(app);
    
    // Setup WebSocket server for streaming AI agents
    const wss = setupWebSocket(server);
    console.log('🔌 WebSocket server initialized at /ws/ai-stream');
    
    // Setup WebSocket server for AI Roundtable collaboration
    const roundtableWss = setupRoundtableWebSocket(server);
    console.log('🔌 Roundtable WebSocket server initialized at /ws/roundtable');

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
    }, () => {
      log(`serving on port ${port}`);
    }).on('error', (err: Error) => {
      console.error('❌ Server failed to start:', err);
      console.error('Error details:', err.message);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
