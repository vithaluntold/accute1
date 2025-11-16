/**
 * LAYER 1A: Foundation - Database Connectivity & Migrations (10 tests)
 * 
 * Validates database infrastructure is production-ready
 * Tests: Connection pooling, schema validation, transaction handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { testDb as db } from '../../test-db';
import { users, organizations, roles, permissions } from '@shared/schema';
import { sql } from 'drizzle-orm';

describe('Layer 1A: Database Connectivity & Migrations (10 tests)', () => {
  
  // ==================== DATABASE CONNECTION (3 tests) ====================
  
  describe('Database Connection', () => {
    it('TC-DB-001: Database connection is established successfully', async () => {
      // Simple query to verify connection
      const result = await db.execute(sql`SELECT 1 as test`);
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('TC-DB-002: Database uses PostgreSQL', async () => {
      const result = await db.execute(sql`SELECT version()`);
      const version = result.rows[0].version as string;
      
      expect(version).toBeDefined();
      expect(version.toLowerCase()).toContain('postgresql');
    });

    it('TC-DB-003: Database connection string is from environment', () => {
      const dbUrl = process.env.DATABASE_URL;
      
      expect(dbUrl).toBeDefined();
      expect(dbUrl).toContain('postgresql');
    });
  });

  // ==================== SCHEMA VALIDATION (4 tests) ====================
  
  describe('Schema Validation', () => {
    it('TC-DB-004: Users table exists with correct schema', async () => {
      // Query users table to verify it exists
      const result = await db.select().from(users).limit(0);
      expect(result).toBeDefined();
      
      // Verify table has expected columns
      const columns = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY column_name
      `);
      
      const columnNames = columns.rows.map((r: any) => r.column_name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('first_name');
      expect(columnNames).toContain('last_name');
      expect(columnNames).toContain('password_hash');
      expect(columnNames).toContain('role_id');
      expect(columnNames).toContain('organization_id');
    });

    it('TC-DB-005: Organizations table exists with correct schema', async () => {
      const result = await db.select().from(organizations).limit(0);
      expect(result).toBeDefined();
      
      const columns = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'organizations'
        ORDER BY column_name
      `);
      
      const columnNames = columns.rows.map((r: any) => r.column_name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('created_at');
    });

    it('TC-DB-006: Roles table exists with correct schema', async () => {
      const result = await db.select().from(roles).limit(0);
      expect(result).toBeDefined();
      
      const columns = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'roles'
        ORDER BY column_name
      `);
      
      const columnNames = columns.rows.map((r: any) => r.column_name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('description');
    });

    it('TC-DB-007: Permissions table exists with correct schema', async () => {
      const result = await db.select().from(permissions).limit(0);
      expect(result).toBeDefined();
      
      const columns = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'permissions'
        ORDER BY column_name
      `);
      
      const columnNames = columns.rows.map((r: any) => r.column_name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('resource');
      expect(columnNames).toContain('action');
    });
  });

  // ==================== TRANSACTION SUPPORT (2 tests) ====================
  
  describe('Transaction Support', () => {
    it('TC-DB-008: Database supports transactions (commit)', async () => {
      const timestamp = Date.now();
      const testOrgName = `Transaction Test Org ${timestamp}`;
      
      // Execute transaction
      const result = await db.transaction(async (tx) => {
        const [org] = await tx.insert(organizations)
          .values({ name: testOrgName })
          .returning();
        
        return org;
      });
      
      expect(result).toBeDefined();
      expect(result.name).toBe(testOrgName);
      
      // Verify data was committed
      const orgs = await db.select()
        .from(organizations)
        .where(sql`${organizations.name} = ${testOrgName}`);
      
      expect(orgs.length).toBe(1);
      
      // Cleanup
      await db.delete(organizations)
        .where(sql`${organizations.name} = ${testOrgName}`);
    });

    it('TC-DB-009: Database supports transaction rollback on error', async () => {
      const timestamp = Date.now();
      const testOrgName = `Rollback Test Org ${timestamp}`;
      
      // Attempt transaction that should fail
      try {
        await db.transaction(async (tx) => {
          await tx.insert(organizations)
            .values({ name: testOrgName })
            .returning();
          
          // Force error (insert duplicate email should fail)
          throw new Error('Intentional rollback');
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBe('Intentional rollback');
      }
      
      // Verify data was NOT committed (rolled back)
      const orgs = await db.select()
        .from(organizations)
        .where(sql`${organizations.name} = ${testOrgName}`);
      
      expect(orgs.length).toBe(0);
    });
  });

  // ==================== DATABASE CONSTRAINTS (1 test) ====================
  
  describe('Database Constraints', () => {
    it('TC-DB-010: Unique constraints are enforced', async () => {
      const timestamp = Date.now();
      const uniqueEmail = `unique-test-${timestamp}@test.com`;
      
      // First insert should succeed
      const [org] = await db.insert(organizations)
        .values({ name: `Unique Test Org ${timestamp}` })
        .returning();
      
      const [role] = await db.select().from(roles).limit(1);
      
      const [user1] = await db.insert(users)
        .values({
          email: uniqueEmail,
          firstName: 'First',
          lastName: 'User',
          passwordHash: 'hash1',
          roleId: role.id,
          organizationId: org.id,
          isActive: true
        })
        .returning();
      
      expect(user1.email).toBe(uniqueEmail);
      
      // Second insert with same email should fail
      try {
        await db.insert(users)
          .values({
            email: uniqueEmail, // Duplicate!
            firstName: 'Second',
            lastName: 'User',
            passwordHash: 'hash2',
            roleId: role.id,
            organizationId: org.id,
            isActive: true
          });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('unique');
      }
      
      // Cleanup
      await db.delete(users).where(sql`${users.email} = ${uniqueEmail}`);
      await db.delete(organizations).where(sql`${organizations.id} = ${org.id}`);
    });
  });
});
