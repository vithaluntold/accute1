/**
 * Runtime entry point for the server.
 * 
 * This file is the ONLY place where startServer() is called.
 * It is executed at runtime via: tsx server/start.ts (dev) or node dist/start.js (prod)
 * 
 * This separation prevents esbuild from executing server initialization
 * during the build phase when DATABASE_URL is not available.
 */

import { startServer } from './index.js';

// Start the server when this module is executed
startServer().catch((err) => {
  console.error('❌ Fatal: Server failed to start:', err);
  process.exit(1);
});
