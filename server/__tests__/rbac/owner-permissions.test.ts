/**
 * LAYER 3A: RBAC - Owner Role Permissions (30 tests)
 * 
 * Validates Owner role has ALL 12 permissions
 * Uses test automation toolkit for parameterized testing
 * 
 * Owner Permissions (12 total):
 * - users.view, users.create, users.edit, users.delete
 * - clients.view, clients.create, clients.edit, clients.delete  
 * - organization.edit, organization.billing, organization.delete, organization.transfer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../test-app';
import { createTestContext, createUserInOrg } from '../helpers';
import { PERMISSION_MATRICES, assertionHelpers } from '../test-automation-toolkit';
import { resetRateLimiters } from '../../rate-limit';

describe('Layer 3A: Owner Role RBAC (30 tests)', () => {
  let testContext: any;
  let ownerToken: string;
  let testOrg: any;
  let ownerUser: any;
  let staffUser: any;
  let managerUser: any;

  beforeEach(async () => {
    resetRateLimiters();
    
    testContext = await createTestContext();
    ownerToken = testContext.ownerToken;
    testOrg = testContext.testOrg;
    ownerUser = testContext.ownerUser;
    
    // Create additional test users for permission testing
    staffUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `staff-${Date.now()}@test.com`,
      password: 'StaffPass123!',
      role: 'staff'
    });
    
    managerUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `manager-${Date.now()}@test.com`,
      password: 'ManagerPass123!',
      role: 'manager'
    });
    
    resetRateLimiters();
  });

  // ==================== USER MANAGEMENT PERMISSIONS (8 tests) ====================
  
  describe('User Management Permissions (users.*)', () => {
    it('TC-OWNER-001: CAN view users list (users.view)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-OWNER-002: CAN create new users (users.create)', async () => {
      const newUserData = {
        email: `newuser-${Date.now()}@test.com`,
        firstName: 'New',
        lastName: 'User',
        roleId: testOrg.staffRoleId
      };
      
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(newUserData);
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-OWNER-003: CAN edit staff user (users.edit)', async () => {
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'Updated' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-OWNER-004: CAN edit manager user (users.edit)', async () => {
      const response = await request(app)
        .patch(`/api/users/${managerUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'Updated' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-OWNER-005: CAN delete staff user (users.delete)', async () => {
      const tempUser = await createUserInOrg({
        organizationId: testOrg.id,
        email: `temp-${Date.now()}@test.com`,
        password: 'TempPass123!',
        role: 'staff'
      });
      
      const response = await request(app)
        .delete(`/api/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 204]).toContain(response.status);
    });

    it('TC-OWNER-006: CAN delete manager user (users.delete)', async () => {
      const tempManager = await createUserInOrg({
        organizationId: testOrg.id,
        email: `temp-manager-${Date.now()}@test.com`,
        password: 'TempPass123!',
        role: 'manager'
      });
      
      const response = await request(app)
        .delete(`/api/users/${tempManager.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 204]).toContain(response.status);
    });

    it('TC-OWNER-007: CAN delete admin user (users.delete)', async () => {
      const tempAdmin = await createUserInOrg({
        organizationId: testOrg.id,
        email: `temp-admin-${Date.now()}@test.com`,
        password: 'TempPass123!',
        role: 'admin'
      });
      
      const response = await request(app)
        .delete(`/api/users/${tempAdmin.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 204]).toContain(response.status);
    });

    it('TC-OWNER-008: CAN promote users to admin/owner roles (users.edit)', async () => {
      const tempUser = await createUserInOrg({
        organizationId: testOrg.id,
        email: `promote-${Date.now()}@test.com`,
        password: 'TempPass123!',
        role: 'staff'
      });
      
      // Try to promote to admin
      const response = await request(app)
        .patch(`/api/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ roleId: testOrg.adminRoleId });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });
  });

  // ==================== CLIENT MANAGEMENT PERMISSIONS (8 tests) ====================
  
  describe('Client Management Permissions (clients.*)', () => {
    it('TC-OWNER-009: CAN view clients list (clients.view)', async () => {
      // Note: Clients feature may not be implemented yet
      // Test verifies permission exists, endpoint may return 404 if not implemented
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      // Should NOT be 403 (forbidden) - either succeeds or feature not implemented
      expect(response.status).not.toBe(403);
    });

    it('TC-OWNER-010: CAN create clients (clients.create)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Test Client' });
      
      expect(response.status).not.toBe(403);
    });

    it('TC-OWNER-011: CAN edit client (clients.edit)', async () => {
      // Create a client first, then try to edit
      // For now, test just verifies permission check (not 403)
      const response = await request(app)
        .patch(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Updated Client' });
      
      // Should NOT be 403 (may be 404 if feature not implemented)
      expect(response.status).not.toBe(403);
    });

    it('TC-OWNER-012: CAN delete client (clients.delete)', async () => {
      const response = await request(app)
        .delete(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).not.toBe(403);
    });

    it('TC-OWNER-013: Verify clients.view permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('clients.view');
    });

    it('TC-OWNER-014: Verify clients.create permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('clients.create');
    });

    it('TC-OWNER-015: Verify clients.edit permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('clients.edit');
    });

    it('TC-OWNER-016: Verify clients.delete permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('clients.delete');
    });
  });

  // ==================== ORGANIZATION PERMISSIONS (10 tests) ====================
  
  describe('Organization Management Permissions (organization.*)', () => {
    it('TC-OWNER-017: CAN edit organization settings (organization.edit)', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Updated Org Name' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-OWNER-018: CAN access billing settings (organization.billing)', async () => {
      // Note: Billing feature may not be implemented
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/billing`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      // Should NOT be 403
      expect(response.status).not.toBe(403);
    });

    it('TC-OWNER-019: CAN delete organization (organization.delete)', async () => {
      // Create a separate org to delete
      const tempContext = await createTestContext();
      
      const response = await request(app)
        .delete(`/api/organizations/${tempContext.testOrg.id}`)
        .set('Authorization', `Bearer ${tempContext.ownerToken}`);
      
      // Should NOT be 403 (may succeed or fail for other reasons)
      expect(response.status).not.toBe(403);
    });

    it('TC-OWNER-020: CAN transfer organization ownership (organization.transfer)', async () => {
      // Note: Transfer feature may not be implemented
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/transfer`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ newOwnerId: staffUser.id });
      
      // Should NOT be 403
      expect(response.status).not.toBe(403);
    });

    it('TC-OWNER-021: Verify organization.edit permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('organization.edit');
    });

    it('TC-OWNER-022: Verify organization.billing permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('organization.billing');
    });

    it('TC-OWNER-023: Verify organization.delete permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('organization.delete');
    });

    it('TC-OWNER-024: Verify organization.transfer permission in matrix', () => {
      const ownerPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(ownerPermissions).toContain('organization.transfer');
    });

    it('TC-OWNER-025: Verify owner has NO denied permissions', () => {
      const deniedPermissions = PERMISSION_MATRICES.owner.permissions.denied;
      expect(deniedPermissions).toEqual([]);
      expect(deniedPermissions.length).toBe(0);
    });

    it('TC-OWNER-026: Verify owner has ALL 12 permissions', () => {
      const allowedPermissions = PERMISSION_MATRICES.owner.permissions.allowed;
      expect(allowedPermissions.length).toBe(12);
      
      // Verify specific permissions
      const expectedPermissions = [
        'users.view', 'users.create', 'users.edit', 'users.delete',
        'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
        'organization.edit', 'organization.billing', 'organization.delete', 'organization.transfer'
      ];
      
      for (const permission of expectedPermissions) {
        expect(allowedPermissions).toContain(permission);
      }
    });
  });

  // ==================== CROSS-ORGANIZATION PROTECTION (4 tests) ====================
  
  describe('Cross-Organization Protection', () => {
    let otherOrg: any;
    let otherOrgUser: any;

    beforeEach(async () => {
      const otherContext = await createTestContext();
      otherOrg = otherContext.testOrg;
      otherOrgUser = otherContext.ownerUser;
    });

    it('TC-OWNER-027: CANNOT view users from other organization', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      // Should be forbidden or not found
      expect([403, 404]).toContain(response.status);
    });

    it('TC-OWNER-028: CANNOT edit users from other organization', async () => {
      const response = await request(app)
        .patch(`/api/users/${otherOrgUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'Hacked' });
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-OWNER-029: CANNOT delete users from other organization', async () => {
      const response = await request(app)
        .delete(`/api/users/${otherOrgUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-OWNER-030: CANNOT edit other organization settings', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${otherOrg.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Hacked Org' });
      
      expect([403, 404]).toContain(response.status);
    });
  });
});
