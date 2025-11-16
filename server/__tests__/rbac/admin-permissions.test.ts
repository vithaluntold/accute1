/**
 * LAYER 3B: RBAC - Admin Role Permissions (30 tests)
 * 
 * Validates Admin role has 10/12 permissions (missing org.delete, org.transfer)
 * 
 * Admin Permissions (10 total):
 * - users.view, users.create, users.edit, users.delete
 * - clients.view, clients.create, clients.edit, clients.delete
 * - organization.edit, organization.billing
 * 
 * Admin CANNOT:
 * - organization.delete, organization.transfer
 * - Promote users to admin/owner roles
 * - Delete other admins or owners
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../test-app';
import { createTestContext, createUserInOrg, login } from '../helpers';
import { PERMISSION_MATRICES } from '../test-automation-toolkit';
import { resetRateLimiters } from '../../rate-limit';

describe('Layer 3B: Admin Role RBAC (30 tests)', () => {
  let testContext: any;
  let adminToken: string;
  let adminUser: any;
  let testOrg: any;
  let staffUser: any;
  let managerUser: any;
  let ownerUser: any;

  beforeEach(async () => {
    resetRateLimiters();
    
    testContext = await createTestContext();
    testOrg = testContext.testOrg;
    ownerUser = testContext.ownerUser;
    
    // Create admin user
    adminUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `admin-${Date.now()}@test.com`,
      password: 'AdminPass123!',
      role: 'admin'
    });
    
    adminToken = (await login(adminUser.email, 'AdminPass123!')).token;
    
    // Create test users
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

  // ==================== ALLOWED: USER MANAGEMENT (8 tests) ====================
  
  describe('ALLOWED: User Management Permissions', () => {
    it('TC-ADMIN-001: CAN view users list (users.view)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-ADMIN-002: CAN create new staff users (users.create)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `newstaff-${Date.now()}@test.com`,
          firstName: 'New',
          lastName: 'Staff',
          roleId: testOrg.staffRoleId
        });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-ADMIN-003: CAN edit staff users (users.edit)', async () => {
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Updated' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-ADMIN-004: CAN edit manager users (users.edit)', async () => {
      const response = await request(app)
        .patch(`/api/users/${managerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Updated' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-ADMIN-005: CAN delete staff users (users.delete)', async () => {
      const tempUser = await createUserInOrg({
        organizationId: testOrg.id,
        email: `temp-${Date.now()}@test.com`,
        password: 'TempPass123!',
        role: 'staff'
      });
      
      const response = await request(app)
        .delete(`/api/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 204]).toContain(response.status);
    });

    it('TC-ADMIN-006: CAN delete manager users (users.delete)', async () => {
      const tempManager = await createUserInOrg({
        organizationId: testOrg.id,
        email: `temp-manager-${Date.now()}@test.com`,
        password: 'TempPass123!',
        role: 'manager'
      });
      
      const response = await request(app)
        .delete(`/api/users/${tempManager.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 204]).toContain(response.status);
    });

    it('TC-ADMIN-007: Verify admin has users.* permissions in matrix', () => {
      const adminPermissions = PERMISSION_MATRICES.admin.permissions.allowed;
      
      expect(adminPermissions).toContain('users.view');
      expect(adminPermissions).toContain('users.create');
      expect(adminPermissions).toContain('users.edit');
      expect(adminPermissions).toContain('users.delete');
    });

    it('TC-ADMIN-008: Verify admin has 10 allowed permissions total', () => {
      const adminPermissions = PERMISSION_MATRICES.admin.permissions.allowed;
      expect(adminPermissions.length).toBe(10);
    });
  });

  // ==================== ALLOWED: CLIENT MANAGEMENT (4 tests) ====================
  
  describe('ALLOWED: Client Management Permissions', () => {
    it('TC-ADMIN-009: CAN view clients (clients.view)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).not.toBe(403);
    });

    it('TC-ADMIN-010: CAN create clients (clients.create)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Client' });
      
      expect(response.status).not.toBe(403);
    });

    it('TC-ADMIN-011: CAN edit clients (clients.edit)', async () => {
      const response = await request(app)
        .patch(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });
      
      expect(response.status).not.toBe(403);
    });

    it('TC-ADMIN-012: CAN delete clients (clients.delete)', async () => {
      const response = await request(app)
        .delete(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).not.toBe(403);
    });
  });

  // ==================== ALLOWED: ORGANIZATION MANAGEMENT (2 tests) ====================
  
  describe('ALLOWED: Organization Management (Limited)', () => {
    it('TC-ADMIN-013: CAN edit organization settings (organization.edit)', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Org' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-ADMIN-014: CAN access billing (organization.billing)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/billing`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).not.toBe(403);
    });
  });

  // ==================== DENIED: ORGANIZATION CRITICAL OPERATIONS (4 tests) ====================
  
  describe('DENIED: Organization Critical Operations', () => {
    it('TC-ADMIN-015: CANNOT delete organization (organization.delete)', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Must be forbidden
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-ADMIN-016: CANNOT transfer organization (organization.transfer)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newOwnerId: staffUser.id });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-ADMIN-017: Verify organization.delete is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.admin.permissions.denied;
      expect(deniedPermissions).toContain('organization.delete');
    });

    it('TC-ADMIN-018: Verify organization.transfer is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.admin.permissions.denied;
      expect(deniedPermissions).toContain('organization.transfer');
    });
  });

  // ==================== DENIED: ROLE ESCALATION (6 tests) ====================
  
  describe('DENIED: Role Escalation & Privilege Management', () => {
    it('TC-ADMIN-019: CANNOT promote users to admin role', async () => {
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: testOrg.adminRoleId });
      
      // Should be forbidden or fail with business logic error
      expect([403, 400]).toContain(response.status);
    });

    it('TC-ADMIN-020: CANNOT promote users to owner role', async () => {
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: testOrg.ownerRoleId });
      
      expect([403, 400]).toContain(response.status);
    });

    it('TC-ADMIN-021: CANNOT delete owner users', async () => {
      const response = await request(app)
        .delete(`/api/users/${ownerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([403, 400]).toContain(response.status);
    });

    it('TC-ADMIN-022: CANNOT delete other admin users', async () => {
      const otherAdmin = await createUserInOrg({
        organizationId: testOrg.id,
        email: `other-admin-${Date.now()}@test.com`,
        password: 'AdminPass123!',
        role: 'admin'
      });
      
      const response = await request(app)
        .delete(`/api/users/${otherAdmin.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([403, 400]).toContain(response.status);
    });

    it('TC-ADMIN-023: Verify admin has 2 denied permissions', () => {
      const deniedPermissions = PERMISSION_MATRICES.admin.permissions.denied;
      expect(deniedPermissions.length).toBe(2);
    });

    it('TC-ADMIN-024: Verify admin permissions total 10 allowed + 2 denied = 12 total', () => {
      const allowed = PERMISSION_MATRICES.admin.permissions.allowed.length;
      const denied = PERMISSION_MATRICES.admin.permissions.denied.length;
      expect(allowed + denied).toBe(12);
    });
  });

  // ==================== CROSS-ORGANIZATION PROTECTION (6 tests) ====================
  
  describe('Cross-Organization Protection', () => {
    let otherOrg: any;
    let otherOrgUser: any;

    beforeEach(async () => {
      const otherContext = await createTestContext();
      otherOrg = otherContext.testOrg;
      otherOrgUser = otherContext.ownerUser;
    });

    it('TC-ADMIN-025: CANNOT view users from other organization', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}/users`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-ADMIN-026: CANNOT create users in other organization', async () => {
      const response = await request(app)
        .post(`/api/organizations/${otherOrg.id}/users`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `hacker-${Date.now()}@test.com`,
          firstName: 'Hacker',
          lastName: 'User',
          roleId: otherOrg.staffRoleId
        });
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-ADMIN-027: CANNOT edit users from other organization', async () => {
      const response = await request(app)
        .patch(`/api/users/${otherOrgUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Hacked' });
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-ADMIN-028: CANNOT delete users from other organization', async () => {
      const response = await request(app)
        .delete(`/api/users/${otherOrgUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-ADMIN-029: CANNOT edit other organization settings', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${otherOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Hacked Org' });
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-ADMIN-030: CANNOT access billing from other organization', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}/billing`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect([403, 404]).toContain(response.status);
    });
  });
});
