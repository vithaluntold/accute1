import { testDb as db, closeTestDb } from '../test-db';
import { 
  users, 
  organizations, 
  sessions,
  clients,
  agentSessions,
  agentMessages
} from '@shared/schema';
import { sql } from 'drizzle-orm';
import { beforeEach, afterAll } from 'vitest';
import { clearRoleCache } from './helpers';

// CRITICAL SAFETY CHECK: Only allow tests to run in test environment
if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    '🚨 CRITICAL: Tests can only run in NODE_ENV=test to prevent data loss! ' +
    `Current NODE_ENV: ${process.env.NODE_ENV}`
  );
}

console.log('✅ Test environment verified - using development database with test cleanup');

// Clean up database before each test
beforeEach(async () => {
  try {
    // SAFETY: Triple-check we're in test mode
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Cannot clean database outside of test environment!');
    }

    // Delete in REVERSE dependency order to respect foreign key constraints
    // Use CASCADE to automatically handle dependencies
    await db.execute(sql`
      TRUNCATE TABLE 
        users,
        organizations,
        clients,
        agent_sessions,
        agent_messages,
        sessions
      CASCADE
    `);
    
    // Clear role cache so ensureRolesExist() re-checks the database
    clearRoleCache();
    
    console.log('🧹 Test database cleaned');
  } catch (error) {
    console.error('❌ Error cleaning test database:', error);
    throw error;
  }
});

// Close database connection after all tests
afterAll(async () => {
  try {
    // Give time for pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Close test database connection pool
    await closeTestDb();
    console.log('✅ Test database connections closed');
  } catch (error) {
    console.error('❌ Error in afterAll:', error);
  }
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});
