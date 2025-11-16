/**
 * LAYER 3C: RBAC - Manager Role Permissions (30 tests)
 * 
 * Validates Manager role has 5/12 permissions
 * 
 * Manager Permissions (5 total):
 * - users.view (can view all org users)
 * - users.edit (SELF-EDIT ONLY - enforced at endpoint level)
 * - clients.view, clients.create, clients.edit
 * 
 * Manager CANNOT:
 * - users.create, users.delete
 * - clients.delete
 * - organization.edit, organization.billing, organization.delete, organization.transfer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../test-app';
import { createTestContext, createUserInOrg, login } from '../helpers';
import { PERMISSION_MATRICES } from '../test-automation-toolkit';
import { resetRateLimiters } from '../../rate-limit';

describe('Layer 3C: Manager Role RBAC (30 tests)', () => {
  let testContext: any;
  let managerToken: string;
  let managerUser: any;
  let testOrg: any;
  let staffUser: any;
  let otherManagerUser: any;

  beforeEach(async () => {
    resetRateLimiters();
    
    testContext = await createTestContext();
    testOrg = testContext.testOrg;
    
    // Create manager user
    managerUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `manager-${Date.now()}@test.com`,
      password: 'ManagerPass123!',
      role: 'manager'
    });
    
    managerToken = (await login(managerUser.email, 'ManagerPass123!')).token;
    
    // Create other test users
    staffUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `staff-${Date.now()}@test.com`,
      password: 'StaffPass123!',
      role: 'staff'
    });
    
    otherManagerUser = await createUserInOrg({
      organizationId: testOrg.id,
      email: `other-manager-${Date.now()}@test.com`,
      password: 'ManagerPass123!',
      role: 'manager'
    });
    
    resetRateLimiters();
  });

  // ==================== ALLOWED: USER VIEWING (2 tests) ====================
  
  describe('ALLOWED: User Viewing', () => {
    it('TC-MANAGER-001: CAN view users list (users.view)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-MANAGER-002: Verify users.view in permission matrix', () => {
      const managerPermissions = PERMISSION_MATRICES.manager.permissions.allowed;
      expect(managerPermissions).toContain('users.view');
    });
  });

  // ==================== ALLOWED: SELF-EDIT ONLY (4 tests) ====================
  
  describe('ALLOWED: Self-Edit Only (users.edit)', () => {
    it('TC-MANAGER-003: CAN edit own profile (users.edit - self-edit)', async () => {
      const response = await request(app)
        .patch(`/api/users/${managerUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ firstName: 'Updated' });
      
      expect(response.status).not.toBe(403);
      expect([200, 201]).toContain(response.status);
    });

    it('TC-MANAGER-004: Verify users.edit in permission matrix', () => {
      const managerPermissions = PERMISSION_MATRICES.manager.permissions.allowed;
      expect(managerPermissions).toContain('users.edit');
    });

    it('TC-MANAGER-005: CANNOT edit other staff users (self-edit enforcement)', async () => {
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ firstName: 'Hacked' });
      
      // Should be forbidden due to self-edit restriction
      expect([403, 400]).toContain(response.status);
    });

    it('TC-MANAGER-006: CANNOT edit other managers (self-edit enforcement)', async () => {
      const response = await request(app)
        .patch(`/api/users/${otherManagerUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ firstName: 'Hacked' });
      
      expect([403, 400]).toContain(response.status);
    });
  });

  // ==================== ALLOWED: CLIENT MANAGEMENT (6 tests) ====================
  
  describe('ALLOWED: Client Management (Limited)', () => {
    it('TC-MANAGER-007: CAN view clients (clients.view)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).not.toBe(403);
    });

    it('TC-MANAGER-008: CAN create clients (clients.create)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/clients`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'New Client' });
      
      expect(response.status).not.toBe(403);
    });

    it('TC-MANAGER-009: CAN edit clients (clients.edit)', async () => {
      const response = await request(app)
        .patch(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Updated' });
      
      expect(response.status).not.toBe(403);
    });

    it('TC-MANAGER-010: Verify clients.view in permission matrix', () => {
      const managerPermissions = PERMISSION_MATRICES.manager.permissions.allowed;
      expect(managerPermissions).toContain('clients.view');
    });

    it('TC-MANAGER-011: Verify clients.create in permission matrix', () => {
      const managerPermissions = PERMISSION_MATRICES.manager.permissions.allowed;
      expect(managerPermissions).toContain('clients.create');
    });

    it('TC-MANAGER-012: Verify clients.edit in permission matrix', () => {
      const managerPermissions = PERMISSION_MATRICES.manager.permissions.allowed;
      expect(managerPermissions).toContain('clients.edit');
    });
  });

  // ==================== DENIED: USER MANAGEMENT (6 tests) ====================
  
  describe('DENIED: User Management', () => {
    it('TC-MANAGER-013: CANNOT create users (users.create)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email: `hacker-${Date.now()}@test.com`,
          firstName: 'Hacker',
          lastName: 'User',
          roleId: testOrg.staffRoleId
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-MANAGER-014: CANNOT delete users (users.delete)', async () => {
      const response = await request(app)
        .delete(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-MANAGER-015: CANNOT change user roles', async () => {
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ roleId: testOrg.managerRoleId });
      
      expect([403, 400]).toContain(response.status);
    });

    it('TC-MANAGER-016: Verify users.create is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.manager.permissions.denied;
      expect(deniedPermissions).toContain('users.create');
    });

    it('TC-MANAGER-017: Verify users.delete is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.manager.permissions.denied;
      expect(deniedPermissions).toContain('users.delete');
    });

    it('TC-MANAGER-018: Verify manager has 5 allowed permissions', () => {
      const allowedPermissions = PERMISSION_MATRICES.manager.permissions.allowed;
      expect(allowedPermissions.length).toBe(5);
    });
  });

  // ==================== DENIED: CLIENT DELETION (2 tests) ====================
  
  describe('DENIED: Client Deletion', () => {
    it('TC-MANAGER-019: CANNOT delete clients (clients.delete)', async () => {
      const response = await request(app)
        .delete(`/api/clients/test-client-id`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-MANAGER-020: Verify clients.delete is denied in matrix', () => {
      const deniedPermissions = PERMISSION_MATRICES.manager.permissions.denied;
      expect(deniedPermissions).toContain('clients.delete');
    });
  });

  // ==================== DENIED: ORGANIZATION MANAGEMENT (6 tests) ====================
  
  describe('DENIED: Organization Management', () => {
    it('TC-MANAGER-021: CANNOT edit organization (organization.edit)', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Hacked' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('TC-MANAGER-022: CANNOT access billing (organization.billing)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/billing`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).toBe(403);
    });

    it('TC-MANAGER-023: CANNOT delete organization (organization.delete)', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).toBe(403);
    });

    it('TC-MANAGER-024: CANNOT transfer organization (organization.transfer)', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/transfer`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ newOwnerId: staffUser.id });
      
      expect(response.status).toBe(403);
    });

    it('TC-MANAGER-025: Verify all organization.* permissions are denied', () => {
      const deniedPermissions = PERMISSION_MATRICES.manager.permissions.denied;
      
      expect(deniedPermissions).toContain('organization.edit');
      expect(deniedPermissions).toContain('organization.billing');
      expect(deniedPermissions).toContain('organization.delete');
      expect(deniedPermissions).toContain('organization.transfer');
    });

    it('TC-MANAGER-026: Verify manager has 7 denied permissions', () => {
      const deniedPermissions = PERMISSION_MATRICES.manager.permissions.denied;
      expect(deniedPermissions.length).toBe(7);
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

    it('TC-MANAGER-027: CANNOT view users from other organization', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}/users`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-MANAGER-028: CANNOT edit users from other organization', async () => {
      const response = await request(app)
        .patch(`/api/users/${otherOrgUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ firstName: 'Hacked' });
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-MANAGER-029: CANNOT view clients from other organization', async () => {
      const response = await request(app)
        .get(`/api/organizations/${otherOrg.id}/clients`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    it('TC-MANAGER-030: CANNOT create clients in other organization', async () => {
      const response = await request(app)
        .post(`/api/organizations/${otherOrg.id}/clients`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Hacker Client' });
      
      expect([403, 404]).toContain(response.status);
    });
  });
});
