import { testDb as db, closeTestDb } from '../test-db';
import { 
  users, 
  organizations, 
  sessions,
  clients,
  agentSessions,
  agentMessages,
  roles,
  permissions,
  rolePermissions
} from '@shared/schema';
import { sql } from 'drizzle-orm';
import { beforeEach, afterAll, beforeAll } from 'vitest';
import { clearRoleCache } from './helpers';
import { clearRateLimitMap } from '../auth';

// CRITICAL SAFETY CHECK: Only allow tests to run in test environment
if (process.env.NODE_ENV !== 'test') {
  throw new Error(
    '🚨 CRITICAL: Tests can only run in NODE_ENV=test to prevent data loss! ' +
    `Current NODE_ENV: ${process.env.NODE_ENV}`
  );
}

console.log('🧪 Test database configured (same as dev, with cleanup)');

// ONE-TIME SETUP: Seed roles/permissions/billing data before ALL tests
beforeAll(async () => {
  try {
    // Import ensureRolesExist to seed roles/permissions once
    const { ensureRolesExist } = await import('./helpers');
    await ensureRolesExist();
    console.log('✅ Test roles and permissions seeded');
    
    // Import and seed billing data (subscription plans + pricing regions)
    const { seedBillingData } = await import('../seed-billing');
    await seedBillingData();
    console.log('✅ Test billing data seeded (plans + regions)');
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  }
});

// Clean up database before each test
beforeEach(async () => {
  try {
    // SAFETY: Triple-check we're in test mode
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Cannot clean database outside of test environment!');
    }

    // CRITICAL FIX: Do NOT truncate roles/permissions/role_permissions
    // These are static system data that should persist across tests
    // Only truncate dynamic test data
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
    
    // Clear role cache so tests can re-fetch if needed
    clearRoleCache();
    
    // Clear rate limit map to prevent test interference
    clearRateLimitMap();
    
    // Log cleanup (reduce noise)
    // console.log('🧹 Test data cleaned');
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
