import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

/**
 * Test Database Configuration
 * 
 * Uses the same database as development but with strict safety checks.
 * Test data is cleaned up between tests to ensure isolation.
 * 
 * SAFETY MEASURES:
 * 1. NODE_ENV must be 'test'
 * 2. All test data is cleaned between tests
 * 3. Test transactions can be rolled back if needed
 */

// CRITICAL: Verify test environment
if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    '🚨 CRITICAL: test-db.ts can only be imported in NODE_ENV=test! ' +
    `Current NODE_ENV: ${process.env.NODE_ENV}`
  );
}

function getTestDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error("DATABASE_URL must be set for tests");
  }
  
  console.log('🧪 Test database configured (same as dev, with cleanup)');
  
  return dbUrl;
}

// Create test database connection pool
const testPool = new Pool({ 
  connectionString: getTestDatabaseUrl(),
  max: 5, // Fewer connections for tests
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

// Create test database instance with schema
export const testDb = drizzle({ client: testPool, schema });

// Export pool for manual cleanup if needed
export const pool = testPool;

// Helper to close test database connections
export async function closeTestDb() {
  await testPool.end();
}

// Helper to verify we're in test mode (runtime check)
export function ensureTestMode() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('This operation can only be performed in test mode!');
  }
}
