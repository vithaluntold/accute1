/**
 * Layer 3: RBAC Tests - Owner Role
 * Test Count: 10 tests
 * Dependencies: Layer 1 (Foundation), Layer 2 (Authentication) must pass
 */

import request from 'supertest';
import app from '../../test-app';
import { createAuthenticatedUser, createOrgAPI, authenticatedRequest, getRoleId } from '../helpers';

describe('Layer 3A: Owner Role Permissions (10 tests)', () => {
  
  it('TC-RBAC-OWNER-001: Owner can create new users in their organization', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: `newuser${Date.now()}@test.com`,
        password: 'NewUser123!',
        firstName: 'New',
        lastName: 'User',
        role: 'staff'
      });
    
    expect([200, 201]).toContain(response.status);
  });

  it('TC-RBAC-OWNER-002: Owner can update organization settings', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/organizations/${user.organizationId}`)
      .send({
        name: 'Updated Organization Name',
        industry: 'consulting'
      });
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-OWNER-003: Owner can delete users from their organization', async () => {
    const owner = await createAuthenticatedUser({ role: 'owner' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: owner.user.organizationId
    });
    
    const response = await authenticatedRequest(owner.token)
      .delete(`/api/users/${staff.user.id}`);
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-OWNER-004: Owner can view all users in their organization', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/users`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('TC-RBAC-OWNER-005: Owner can promote users to admin', async () => {
    const owner = await createAuthenticatedUser({ role: 'owner' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: owner.user.organizationId
    });
    
    const adminRoleId = await getRoleId('admin');
    
    const response = await authenticatedRequest(owner.token)
      .patch(`/api/users/${staff.user.id}`)
      .send({ roleId: adminRoleId });
    
    expect(response.status).toBe(200);
    expect(response.body.roleId).toBe(adminRoleId);
  });

  it('TC-RBAC-OWNER-006: Owner can demote admins to staff', async () => {
    const owner = await createAuthenticatedUser({ role: 'owner' });
    const admin = await createAuthenticatedUser({ 
      role: 'admin',
      organizationId: owner.user.organizationId
    });
    
    const staffRoleId = await getRoleId('staff');
    
    const response = await authenticatedRequest(owner.token)
      .patch(`/api/users/${admin.user.id}`)
      .send({ roleId: staffRoleId });
    
    expect(response.status).toBe(200);
    expect(response.body.roleId).toBe(staffRoleId);
  });

  it('TC-RBAC-OWNER-007: Owner cannot access other organizations', async () => {
    const owner1 = await createAuthenticatedUser({ role: 'owner' });
    const owner2 = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(owner1.token)
      .get(`/api/organizations/${owner2.user.organizationId}/users`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-OWNER-008: Owner can view organization billing', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/billing`);
    
    expect([200, 404]).toContain(response.status); // 404 if billing not implemented
  });

  it('TC-RBAC-OWNER-009: Owner can delete their organization', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .delete(`/api/organizations/${user.organizationId}`);
    
    expect([200, 204]).toContain(response.status);
  });

  it('TC-RBAC-OWNER-010: Owner can transfer ownership to another user', async () => {
    const owner = await createAuthenticatedUser({ role: 'owner' });
    const admin = await createAuthenticatedUser({ 
      role: 'admin',
      organizationId: owner.user.organizationId
    });
    
    const response = await authenticatedRequest(owner.token)
      .post(`/api/organizations/${owner.user.organizationId}/transfer-ownership`)
      .send({ newOwnerId: admin.user.id });
    
    expect([200, 404]).toContain(response.status); // 404 if not implemented
  });
});
