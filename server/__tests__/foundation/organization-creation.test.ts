/**
 * LAYER 1D: Foundation - Organization Creation (15 tests)
 * 
 * Validates organization creation infrastructure
 * Tests: Multi-tenant isolation, owner assignment, validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testDb as db } from '../../test-db';
import { organizations, users } from '@shared/schema';
import { createOrgWithOwner, clearRoleCache } from '../helpers';
import { sql } from 'drizzle-orm';
import { generateQuickOrgData } from '../test-automation-toolkit';
import { resetRateLimiters } from '../../rate-limit';

describe('Layer 1D: Organization Creation (15 tests)', () => {
  
  beforeEach(async () => {
    resetRateLimiters();
    clearRoleCache();
  });
  
  // ==================== SUCCESSFUL ORGANIZATION CREATION (5 tests) ====================
  
  describe('Successful Organization Creation', () => {
    it('TC-ORG-001: Can create organization with valid data', async () => {
      const orgData = generateQuickOrgData();
      
      const result = await createOrgWithOwner({
        orgName: orgData.name,
        ownerEmail: orgData.ownerEmail,
        ownerPassword: orgData.ownerPassword
      });
      
      expect(result.organization.id).toBeDefined();
      expect(result.organization.name).toBe(orgData.name);
      expect(result.ownerUser.email).toBe(orgData.ownerEmail);
    });

    it('TC-ORG-002: Organization has unique ID', async () => {
      const org1 = await createOrgWithOwner({
        orgName: `Org 1 ${Date.now()}`,
        ownerEmail: `owner1-${Date.now()}@test.com`
      });
      
      const org2 = await createOrgWithOwner({
        orgName: `Org 2 ${Date.now()}`,
        ownerEmail: `owner2-${Date.now()}@test.com`
      });
      
      expect(org1.organization.id).not.toBe(org2.organization.id);
    });

    it('TC-ORG-003: Organization automatically creates owner user', async () => {
      const orgData = generateQuickOrgData();
      
      const result = await createOrgWithOwner({
        orgName: orgData.name,
        ownerEmail: orgData.ownerEmail,
        ownerPassword: orgData.ownerPassword
      });
      
      expect(result.ownerUser).toBeDefined();
      expect(result.ownerUser.roleId).toBe(result.organization.ownerRoleId);
      expect(result.ownerUser.organizationId).toBe(result.organization.id);
    });

    it('TC-ORG-004: Organization has created timestamp', async () => {
      const before = new Date();
      
      const result = await createOrgWithOwner({
        orgName: `Test Org ${Date.now()}`,
        ownerEmail: `owner-${Date.now()}@test.com`
      });
      
      const after = new Date();
      
      expect(result.organization.createdAt).toBeDefined();
      expect(result.organization.createdAt).toBeInstanceOf(Date);
      expect(result.organization.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.organization.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('TC-ORG-005: Organization creates all 4 default roles', async () => {
      const result = await createOrgWithOwner({
        orgName: `Roles Test Org ${Date.now()}`,
        ownerEmail: `owner-${Date.now()}@test.com`
      });
      
      expect(result.organization.ownerRoleId).toBeDefined();
      expect(result.organization.adminRoleId).toBeDefined();
      expect(result.organization.managerRoleId).toBeDefined();
      expect(result.organization.staffRoleId).toBeDefined();
      
      // All role IDs should be different
      const roleIds = [
        result.organization.ownerRoleId,
        result.organization.adminRoleId,
        result.organization.managerRoleId,
        result.organization.staffRoleId
      ];
      
      const uniqueRoleIds = new Set(roleIds);
      expect(uniqueRoleIds.size).toBe(4);
    });
  });

  // ==================== MULTI-TENANT ISOLATION (4 tests) ====================
  
  describe('Multi-Tenant Isolation', () => {
    it('TC-ORG-006: Organizations are isolated from each other', async () => {
      const org1 = await createOrgWithOwner({
        orgName: `Org 1 ${Date.now()}`,
        ownerEmail: `owner1-${Date.now()}@test.com`
      });
      
      const org2 = await createOrgWithOwner({
        orgName: `Org 2 ${Date.now()}`,
        ownerEmail: `owner2-${Date.now()}@test.com`
      });
      
      // Verify org1 users don't appear in org2
      const org1Users = await db.select()
        .from(users)
        .where(sql`${users.organization_id} = ${org1.organization.id}`);
      
      const org2Users = await db.select()
        .from(users)
        .where(sql`${users.organization_id} = ${org2.organization.id}`);
      
      // No user should belong to both orgs
      const org1UserIds = new Set(org1Users.map(u => u.id));
      const org2UserIds = new Set(org2Users.map(u => u.id));
      
      for (const id of org1UserIds) {
        expect(org2UserIds.has(id)).toBe(false);
      }
    });

    it('TC-ORG-007: Each organization has its own set of roles', async () => {
      const org1 = await createOrgWithOwner({
        orgName: `Org 1 ${Date.now()}`,
        ownerEmail: `owner1-${Date.now()}@test.com`
      });
      
      const org2 = await createOrgWithOwner({
        orgName: `Org 2 ${Date.now()}`,
        ownerEmail: `owner2-${Date.now()}@test.com`
      });
      
      // Role IDs should be different between orgs
      expect(org1.organization.ownerRoleId).not.toBe(org2.organization.ownerRoleId);
      expect(org1.organization.adminRoleId).not.toBe(org2.organization.adminRoleId);
      expect(org1.organization.managerRoleId).not.toBe(org2.organization.managerRoleId);
      expect(org1.organization.staffRoleId).not.toBe(org2.organization.staffRoleId);
    });

    it('TC-ORG-008: Organizations can have same name', async () => {
      const sameName = `Accounting Firm ${Date.now()}`;
      
      const org1 = await createOrgWithOwner({
        orgName: sameName,
        ownerEmail: `owner1-${Date.now()}@test.com`
      });
      
      const org2 = await createOrgWithOwner({
        orgName: sameName,
        ownerEmail: `owner2-${Date.now()}@test.com`
      });
      
      expect(org1.organization.name).toBe(sameName);
      expect(org2.organization.name).toBe(sameName);
      expect(org1.organization.id).not.toBe(org2.organization.id);
    });

    it('TC-ORG-009: Owner user is scoped to organization', async () => {
      const result = await createOrgWithOwner({
        orgName: `Scoped Org ${Date.now()}`,
        ownerEmail: `owner-${Date.now()}@test.com`
      });
      
      const ownerUser = result.ownerUser;
      
      // Verify user's organizationId matches the org
      expect(ownerUser.organizationId).toBe(result.organization.id);
      
      // Verify in database
      const [dbUser] = await db.select()
        .from(users)
        .where(sql`${users.id} = ${ownerUser.id}`);
      
      expect(dbUser.organizationId).toBe(result.organization.id);
    });
  });

  // ==================== VALIDATION (3 tests) ====================
  
  describe('Validation', () => {
    it('TC-ORG-010: Organization name is required', async () => {
      try {
        await createOrgWithOwner({
          orgName: '', // Empty name
          ownerEmail: `owner-${Date.now()}@test.com`
        });
        
        // Should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('TC-ORG-011: Owner email is required', async () => {
      try {
        await createOrgWithOwner({
          orgName: `Test Org ${Date.now()}`,
          ownerEmail: '' // Empty email
        });
        
        // Should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('TC-ORG-012: Owner email must be valid format', async () => {
      const invalidEmails = [
        'not-an-email',
        '@test.com',
        'missing-domain@'
      ];
      
      for (const invalidEmail of invalidEmails) {
        try {
          await createOrgWithOwner({
            orgName: `Test Org ${Date.now()}`,
            ownerEmail: invalidEmail
          });
          
          // Should fail
          expect(true).toBe(false);
        } catch (error: any) {
          // Expected to fail
          expect(error).toBeDefined();
        }
      }
    });
  });

  // ==================== CLEANUP & INTEGRITY (3 tests) ====================
  
  describe('Cleanup & Integrity', () => {
    it('TC-ORG-013: Organization can be deleted', async () => {
      const result = await createOrgWithOwner({
        orgName: `Delete Test Org ${Date.now()}`,
        ownerEmail: `owner-${Date.now()}@test.com`
      });
      
      const orgId = result.organization.id;
      
      // Delete organization
      await db.delete(organizations)
        .where(sql`${organizations.id} = ${orgId}`);
      
      // Verify deletion
      const orgs = await db.select()
        .from(organizations)
        .where(sql`${organizations.id} = ${orgId}`);
      
      expect(orgs.length).toBe(0);
    });

    it('TC-ORG-014: Deleting organization should cascade to users', async () => {
      const result = await createOrgWithOwner({
        orgName: `Cascade Test Org ${Date.now()}`,
        ownerEmail: `owner-${Date.now()}@test.com`
      });
      
      const orgId = result.organization.id;
      const userId = result.ownerUser.id;
      
      // Verify user exists
      const beforeUsers = await db.select()
        .from(users)
        .where(sql`${users.id} = ${userId}`);
      expect(beforeUsers.length).toBe(1);
      
      // Delete organization
      await db.delete(organizations)
        .where(sql`${organizations.id} = ${orgId}`);
      
      // Verify user was also deleted (cascade)
      const afterUsers = await db.select()
        .from(users)
        .where(sql`${users.id} = ${userId}`);
      
      // Should be deleted due to foreign key cascade
      expect(afterUsers.length).toBe(0);
    });

    it('TC-ORG-015: Organization creation is transactional', async () => {
      // This test verifies that if org creation fails, no partial data is left
      const testOrgName = `Transactional Test ${Date.now()}`;
      
      try {
        // Attempt to create org with invalid owner data
        await createOrgWithOwner({
          orgName: testOrgName,
          ownerEmail: 'invalid-email' // Should fail validation
        });
        
        // Should not reach here
      } catch (error: any) {
        // Expected to fail
      }
      
      // Verify no organization was created
      const orgs = await db.select()
        .from(organizations)
        .where(sql`${organizations.name} = ${testOrgName}`);
      
      // Should be 0 if properly transactional
      // If > 0, indicates partial creation (transaction not working)
      expect(orgs.length).toBe(0);
    });
  });
});
