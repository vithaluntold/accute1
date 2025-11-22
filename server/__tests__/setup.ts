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
    
    // Seed billing data directly using test database
    const schema = await import('@shared/schema');
    const existingPlans = await db.select().from(schema.subscriptionPlans).limit(1);
    
    if (existingPlans.length === 0) {
      console.log('📦 Seeding billing data into test database...');
      
      // Seed subscription plans
      const plans = [
        { name: 'Core', slug: 'core', description: 'Essential practice management', displayOrder: 1, 
          features: JSON.stringify(['Client management', 'Basic workflows']),
          featureIdentifiers: JSON.stringify(['clients', 'workflows']),
          basePriceMonthly: '9.00', basePriceYearly: '8.00', perSeatPriceMonthly: '9.00', perSeatPriceYearly: '8.00',
          maxUsers: 5, maxClients: 50, maxStorage: 10, maxWorkflows: 25, maxAIAgents: 0,
          includedSeats: 1, trialDays: 14, isActive: true, isPublic: true },
        { name: 'AI', slug: 'ai', description: 'AI-powered practice management', displayOrder: 2,
          features: JSON.stringify(['Everything in Core', '11 AI agents']),
          featureIdentifiers: JSON.stringify(['clients', 'workflows', 'ai_agents']),
          basePriceMonthly: '23.00', basePriceYearly: '21.00', perSeatPriceMonthly: '23.00', perSeatPriceYearly: '21.00',
          maxUsers: 25, maxClients: 250, maxStorage: 50, maxWorkflows: 100, maxAIAgents: 11,
          includedSeats: 1, trialDays: 14, isActive: true, isPublic: true },
        { name: 'Edge', slug: 'edge', description: 'Enterprise-grade practice management', displayOrder: 3,
          features: JSON.stringify(['Everything in AI', 'Unlimited AI']),
          featureIdentifiers: JSON.stringify(['clients', 'workflows', 'ai_agents', 'custom_ai_training']),
          basePriceMonthly: '38.00', basePriceYearly: '35.00', perSeatPriceMonthly: '38.00', perSeatPriceYearly: '35.00',
          maxUsers: 999, maxClients: 9999, maxStorage: 500, maxWorkflows: 999, maxAIAgents: 11,
          includedSeats: 1, trialDays: 14, isActive: true, isPublic: true },
      ];
      for (const plan of plans) {
        await db.insert(schema.subscriptionPlans).values(plan).onConflictDoNothing();
      }
      
      // Seed pricing regions (10 regions)
      const regions = [
        { name: 'United States', code: 'US', description: 'Baseline market', countryCodes: JSON.stringify(['US']),
          currency: 'USD', currencySymbol: '$', priceMultiplier: '1.000', stripeCurrency: 'usd', isActive: true, displayOrder: 1 },
        { name: 'India', code: 'IN', description: 'Emerging market', countryCodes: JSON.stringify(['IN']),
          currency: 'INR', currencySymbol: '₹', priceMultiplier: '0.350', stripeCurrency: 'inr', isActive: true, displayOrder: 2 },
        { name: 'UAE', code: 'AE', description: 'Premium GCC market', countryCodes: JSON.stringify(['AE', 'SA']),
          currency: 'AED', currencySymbol: 'د.إ', priceMultiplier: '1.000', stripeCurrency: 'aed', isActive: true, displayOrder: 3 },
        { name: 'Turkey', code: 'TR', description: 'Emerging market', countryCodes: JSON.stringify(['TR']),
          currency: 'TRY', currencySymbol: '₺', priceMultiplier: '0.400', stripeCurrency: 'try', isActive: true, displayOrder: 4 },
        { name: 'United Kingdom', code: 'GB', description: 'European premium market', countryCodes: JSON.stringify(['GB']),
          currency: 'GBP', currencySymbol: '£', priceMultiplier: '0.790', stripeCurrency: 'gbp', isActive: true, displayOrder: 5 },
        { name: 'European Union', code: 'EU', description: 'European market', countryCodes: JSON.stringify(['DE', 'FR']),
          currency: 'EUR', currencySymbol: '€', priceMultiplier: '0.930', stripeCurrency: 'eur', isActive: true, displayOrder: 6 },
        { name: 'Australia', code: 'AU', description: 'Asia-Pacific premium', countryCodes: JSON.stringify(['AU', 'NZ']),
          currency: 'AUD', currencySymbol: 'A$', priceMultiplier: '1.520', stripeCurrency: 'aud', isActive: true, displayOrder: 7 },
        { name: 'Canada', code: 'CA', description: 'North American market', countryCodes: JSON.stringify(['CA']),
          currency: 'CAD', currencySymbol: 'C$', priceMultiplier: '1.390', stripeCurrency: 'cad', isActive: true, displayOrder: 8 },
        { name: 'Singapore', code: 'SG', description: 'Asia premium market', countryCodes: JSON.stringify(['SG']),
          currency: 'SGD', currencySymbol: 'S$', priceMultiplier: '1.350', stripeCurrency: 'sgd', isActive: true, displayOrder: 9 },
        { name: 'Rest of World', code: 'GLOBAL', description: 'Catch-all for other markets', countryCodes: JSON.stringify([]),
          currency: 'USD', currencySymbol: '$', priceMultiplier: '0.700', stripeCurrency: 'usd', isActive: true, displayOrder: 10 },
      ];
      for (const region of regions) {
        await db.insert(schema.pricingRegions).values(region).onConflictDoNothing();
      }
      
      console.log('✅ Billing data seeded (3 plans + 10 regions)');
    } else {
      console.log('✅ Billing data already exists (plans + regions)');
    }
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
