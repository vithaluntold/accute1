/**
 * LAYER 3D: RBAC - Staff Role Permissions (30 tests)
 * 
 * Validates Staff role has MINIMAL permissions (2/12)
 * 
 * Staff Permissions (2 total):
 * - users.edit (SELF-EDIT ONLY - enforced at endpoint level)
 * - clients.view
 * 
 * Staff CANNOT:
 * - users.view (cannot view org user list)
 * - users.create, users.delete
 * - clients.create, clients.edit, clients.delete
 * - organization.edit, organization.billing, organization.delete, organization.transfer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../test-app';
import { createTestContext, createUserInOrg, login } from '../helpers';
import { PERMISSION_MATRICES } from '../test-automation-toolkit';
import { resetRateLimiters } from '../../rate-limit';

describe('Layer 3D: Staff Role RBAC (30 tests)', () => {
  let testContext: any;
  let staffToken: string;
  let staffUser: any;
  let testOrg: any;
  let otherStaffUser: any;
  let managerUser: any;

  beforeEach(async () => {
    resetRateLimiters();
    
    testContext = await createTestContext();
    testOrg = testContext.testOrg;
    
    // Create staff user
    staffUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `staff-${Date.now()}@test.com`,
      password: 'StaffPass123!',
      role: 'staff'
    });
    
    staffToken = (await login(staffUser.email, 'StaffPass123!')).token;
    
    // Create other test users
    otherStaffUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `other-staff-${Date.now()}@test.com`,
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

  // ==================== ALLOWED: SELF-VIEW & SELF-EDIT (4 tests) ====================
  
  describe('ALLOWED: Self-View & Self-Edit Only', () => {
    it('TC-STAFF-001: CAN view own profile (self-view)', async () => {
      const response = await request(app)
        .get(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-STAFF-002: CAN edit own profile (users.edit - self-edit)', async () => {
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ firstName: 'Updated' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-STAFF-003: Verify users.edit in permission matrix', () => {
      const staffPermissions = PERMISSION_MATRICES.staff.permissions.allowed;
      expect(staffPermissions).toContain('users.edit');
    });

    it('TC-STAFF-004: Verify staff has only 2 allowed permissions', () => {
      const staffPermissions = PERMISSION_MATRICES.staff.permissions.allowed;
      expect(staffPermissions.length).toBe(2);
    });
  });

  // ==================== ALLOWED: CLIENT VIEWING ONLY (2 tests) ====================
  
  describe('ALLOWED: Client Viewing Only', () => {
    it('TC-STAFF-005: CAN view clients (clients.view)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(response.status).not.toBe(403);
    });

    it('TC-STAFF-006: Verify clients.view in permission matrix', () => {
      const staffPermissions = PERMISSION_MATRICES.staff.permissions.allowed;
      expect(staffPermissions).toContain('clients.view');
    });
  });

  // ==================== DENIED: USER VIEWING (6 tests) ====================
  
  describe('DENIED: User Viewing & Management', () => {
    it('TC-STAFF-007: CANNOT view organization user list (users.view)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-STAFF-008: CANNOT view other user profiles', async () => {
      const response = await request(app)
        .get(`/api/users/${otherStaffUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      // Should be forbidden or require self-view restriction
      expect([403, 400]).toContain(response.status);
    });

    it('TC-STAFF-009: CANNOT edit other users (self-edit enforcement)', async () => {
      const response = await request(app)
        .patch(`/api/users/${otherStaffUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ firstName: 'Hacked' });
      
      expect([403, 400]).toContain(response.status);
    });

    it('TC-STAFF-010: CANNOT create users (users.create)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          email: `hacker-${Date.now()}@test.com`,
          firstName: 'Hacker',
          lastName: 'User',
          roleId: testOrg.staffRoleId
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-STAFF-011: CANNOT delete users (users.delete)', async () => {
      const response = await request(app)
        .delete(`/api/users/${otherStaffUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-STAFF-012: Verify users.view is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.staff.permissions.denied;
      expect(deniedPermissions).toContain('users.view');
    });
  });

  // ==================== DENIED: CLIENT MANAGEMENT (6 tests) ====================
  
  describe('DENIED: Client Management', () => {
    it('TC-STAFF-013: CANNOT create clients (clients.create)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Hacker Client' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-STAFF-014: CANNOT edit clients (clients.edit)', async () => {
      const response = await request(app)
        .patch(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Hacked' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-STAFF-015: CANNOT delete clients (clients.delete)', async () => {
      const response = await request(app)
        .delete(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-STAFF-016: Verify clients.create is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.staff.permissions.denied;
      expect(deniedPermissions).toContain('clients.create');
    });

    it('TC-STAFF-017: Verify clients.edit is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.staff.permissions.denied;
      expect(deniedPermissions).toContain('clients.edit');
    });

    it('TC-STAFF-018: Verify clients.delete is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.staff.permissions.denied;
      expect(deniedPermissions).toContain('clients.delete');
    });
  });

  // ==================== DENIED: ORGANIZATION MANAGEMENT (6 tests) ====================
  
  describe('DENIED: Organization Management', () => {
    it('TC-STAFF-019: CANNOT edit organization (organization.edit)', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Hacked' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-STAFF-020: CANNOT access billing (organization.billing)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/billing`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(response.status).toBe(403);
    });

    it('TC-STAFF-021: CANNOT delete organization (organization.delete)', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(response.status).toBe(403);
    });

    it('TC-STAFF-022: CANNOT transfer organization (organization.transfer)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/transfer`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newOwnerId: managerUser.id });
      
      expect(response.status).toBe(403);
    });

    it('TC-STAFF-023: Verify all organization.* permissions are denied', () => {
      const deniedPermissions = PERMISSION_MATRICES.staff.permissions.denied;
      
      expect(deniedPermissions).toContain('organization.edit');
      expect(deniedPermissions).toContain('organization.billing');
      expect(deniedPermissions).toContain('organization.delete');
      expect(deniedPermissions).toContain('organization.transfer');
    });

    it('TC-STAFF-024: Verify staff has 10 denied permissions', () => {
      const deniedPermissions = PERMISSION_MATRICES.staff.permissions.denied;
      expect(deniedPermissions.length).toBe(10);
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

    it('TC-STAFF-025: CANNOT view own profile in other organization', async () => {
      // Staff user should not be able to query their profile via another org's path
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}/users`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-STAFF-026: CANNOT edit users from other organization', async () => {
      const response = await request(app)
        .patch(`/api/users/${otherOrgUser.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ firstName: 'Hacked' });
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-STAFF-027: CANNOT view clients from other organization', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}/clients`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-STAFF-028: CANNOT access other organization settings', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-STAFF-029: Cannot perform any action in another organization', async () => {
      // Comprehensive check - staff should be completely isolated
      const endpoints = [
        { method: 'get', path: `/api/organizations/${otherOrg.id}/users` },
        { method: 'post', path: `/api/organizations/${otherOrg.id}/users` },
        { method: 'patch', path: `/api/organizations/${otherOrg.id}` },
        { method: 'get', path: `/api/organizations/${otherOrg.id}/billing` }
      ];
      
      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({});
        
        expect([403, 404]).toContain(response.status);
      }
    });

    it('TC-STAFF-030: Verify staff permissions total 2 allowed + 10 denied = 12 total', () => {
      const allowed = PERMISSION_MATRICES.staff.permissions.allowed.length;
      const denied = PERMISSION_MATRICES.staff.permissions.denied.length;
      expect(allowed + denied).toBe(12);
    });
  });
});
