/**
 * Runtime entry point for the server.
 * Uses static imports so esbuild can bundle everything together.
 */

// EARLY LOGGING - before any imports that might fail
console.log('🚀 [START] Server entry point loaded');
console.log('🔧 [START] NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 [START] PORT:', process.env.PORT || '5000');
console.log('🔧 [START] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('🔧 [START] JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('🔧 [START] SESSION_SECRET exists:', !!process.env.SESSION_SECRET);
console.log('🔧 [START] ENCRYPTION_KEY exists:', !!process.env.ENCRYPTION_KEY);

console.log('🔧 [START] Loading server module...');

// Static import - esbuild will bundle this
import { startServer } from './index.js';

console.log('✅ [START] Server module loaded successfully');

// Start the server
startServer()
  .then(() => {
    console.log('✅ [START] Server started successfully');
  })
  .catch((err) => {
    console.error('❌ [START] Fatal error:', err);
    console.error('❌ [START] Stack trace:', err.stack);
    process.exit(1);
  });
