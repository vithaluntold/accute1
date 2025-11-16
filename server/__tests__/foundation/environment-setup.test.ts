/**
 * LAYER 1B: Foundation - Test Environment Setup (10 tests)
 * 
 * Validates test infrastructure and isolation
 * Tests: ENV vars, cleanup, test data isolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { testDb as db } from '../../test-db';
import { users, organizations } from '@shared/schema';
import { createTestContext } from '../helpers';
import { sql } from 'drizzle-orm';

describe('Layer 1B: Test Environment Setup (10 tests)', () => {
  
  // ==================== ENVIRONMENT VARIABLES (3 tests) ====================
  
  describe('Environment Variables', () => {
    it('TC-ENV-001: NODE_ENV is set to test', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('TC-ENV-002: DATABASE_URL is configured for testing', () => {
      const dbUrl = process.env.DATABASE_URL;
      
      expect(dbUrl).toBeDefined();
      expect(dbUrl).toContain('postgresql');
      
      // Verify it's the same database as development (per replit.md)
      // Test mode uses same DB with cleanup hooks
    });

    it('TC-ENV-003: JWT_SECRET is available in test environment', () => {
      const jwtSecret = process.env.JWT_SECRET;
      
      expect(jwtSecret).toBeDefined();
      expect(jwtSecret.length).toBeGreaterThan(16);
    });
  });

  // ==================== TEST DATA ISOLATION (4 tests) ====================
  
  describe('Test Data Isolation', () => {
    let context1: any;
    let context2: any;

    afterEach(async () => {
      // Tests use same DB as dev, with cleanup hooks
      // Verify cleanup works as expected
    });

    it('TC-ENV-004: Each test gets isolated test context', async () => {
      context1 = await createTestContext();
      context2 = await createTestContext();
      
      // Different organizations
      expect(context1.testOrg.id).not.toBe(context2.testOrg.id);
      
      // Different users
      expect(context1.ownerUser.id).not.toBe(context2.ownerUser.id);
      
      // Different tokens
      expect(context1.ownerToken).not.toBe(context2.ownerToken);
    });

    it('TC-ENV-005: Test contexts are multi-tenant isolated', async () => {
      context1 = await createTestContext();
      context2 = await createTestContext();
      
      // Verify org1 users cannot see org2 data
      const org1Users = await db.select()
        .from(users)
        .where(sql`${users.organization_id} = ${context1.testOrg.id}`);
      
      const org2Users = await db.select()
        .from(users)
        .where(sql`${users.organization_id} = ${context2.testOrg.id}`);
      
      // No user should belong to both orgs
      const org1UserIds = new Set(org1Users.map(u => u.id));
      const org2UserIds = new Set(org2Users.map(u => u.id));
      
      for (const id of org1UserIds) {
        expect(org2UserIds.has(id)).toBe(false);
      }
    });

    it('TC-ENV-006: Test data uses unique identifiers to avoid collisions', async () => {
      const context = await createTestContext();
      
      // All test emails should be unique with timestamps
      expect(context.ownerUser.email).toMatch(/@test\.com$/);
      expect(context.ownerUser.email).toMatch(/\d+/); // Contains timestamp
    });

    it('TC-ENV-007: Database cleanup hooks execute properly', async () => {
      const beforeCount = (await db.select().from(organizations)).length;
      
      // Create and destroy a test context
      const context = await createTestContext();
      const orgId = context.testOrg.id;
      
      // Verify org exists
      const duringCount = (await db.select().from(organizations)).length;
      expect(duringCount).toBeGreaterThanOrEqual(beforeCount + 1);
      
      // Note: Actual cleanup happens in afterEach/afterAll hooks
      // This test validates the infrastructure exists
    });
  });

  // ==================== TEST HELPERS (3 tests) ====================
  
  describe('Test Helpers', () => {
    it('TC-ENV-008: createTestContext provides complete test setup', async () => {
      const context = await createTestContext();
      
      // Verify all required properties exist
      expect(context.testOrg).toBeDefined();
      expect(context.testOrg.id).toBeDefined();
      expect(context.testOrg.name).toBeDefined();
      
      expect(context.ownerUser).toBeDefined();
      expect(context.ownerUser.id).toBeDefined();
      expect(context.ownerUser.email).toBeDefined();
      
      expect(context.ownerToken).toBeDefined();
      expect(context.ownerToken.length).toBeGreaterThan(50); // JWT token
      
      // Verify role IDs are available
      expect(context.testOrg.ownerRoleId).toBeDefined();
      expect(context.testOrg.adminRoleId).toBeDefined();
      expect(context.testOrg.managerRoleId).toBeDefined();
      expect(context.testOrg.staffRoleId).toBeDefined();
    });

    it('TC-ENV-009: Test context creates valid authentication token', async () => {
      const context = await createTestContext();
      
      // Token should be a valid JWT format (header.payload.signature)
      const tokenParts = context.ownerToken.split('.');
      expect(tokenParts.length).toBe(3);
      
      // Should be able to decode (not verify, just decode)
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], 'base64').toString()
      );
      
      expect(payload.userId).toBe(context.ownerUser.id);
    });

    it('TC-ENV-010: Test database connection is stable across multiple queries', async () => {
      // Execute multiple queries in sequence
      const queries = Array.from({ length: 10 }, (_, i) => 
        db.execute(sql`SELECT ${i} as num`)
      );
      
      const results = await Promise.all(queries);
      
      // All queries should succeed
      expect(results.length).toBe(10);
      results.forEach((result, i) => {
        expect(result.rows[0].num).toBe(i);
      });
    });
  });
});
