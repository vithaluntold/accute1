/**
 * Layer 3: RBAC Tests - Admin Role
 * Test Count: 10 tests
 * Dependencies: Layer 1 (Foundation), Layer 2 (Authentication) must pass
 */

import request from 'supertest';
import app from '../../test-app';
import { createAuthenticatedUser, authenticatedRequest, getRoleId } from '../helpers';

describe('Layer 3B: Admin Role Permissions (10 tests)', () => {
  
  it('TC-RBAC-ADMIN-001: Admin can create new staff users', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'admin' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: `newstaff${Date.now()}@test.com`,
        password: 'NewStaff123!',
        firstName: 'New',
        lastName: 'Staff',
        role: 'staff'
      });
    
    expect([200, 201]).toContain(response.status);
  });

  it('TC-RBAC-ADMIN-002: Admin can view all users in organization', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'admin' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/users`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('TC-RBAC-ADMIN-003: Admin can update staff user information', async () => {
    const admin = await createAuthenticatedUser({ role: 'admin' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: admin.user.organizationId
    });
    
    const response = await authenticatedRequest(admin.token)
      .patch(`/api/users/${staff.user.id}`)
      .send({ firstName: 'Updated' });
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-ADMIN-004: Admin can delete staff users', async () => {
    const admin = await createAuthenticatedUser({ role: 'admin' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: admin.user.organizationId
    });
    
    const response = await authenticatedRequest(admin.token)
      .delete(`/api/users/${staff.user.id}`);
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-ADMIN-005: Admin cannot promote users to admin', async () => {
    const admin = await createAuthenticatedUser({ role: 'admin' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: admin.user.organizationId
    });
    
    const adminRoleId = await getRoleId('admin');
    
    const response = await authenticatedRequest(admin.token)
      .patch(`/api/users/${staff.user.id}`)
      .send({ roleId: adminRoleId });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-ADMIN-006: Admin cannot modify organization settings', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'admin' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/organizations/${user.organizationId}`)
      .send({ name: 'Unauthorized Change' });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-ADMIN-007: Admin cannot delete the organization', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'admin' });
    
    const response = await authenticatedRequest(token)
      .delete(`/api/organizations/${user.organizationId}`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-ADMIN-008: Admin cannot access other organizations', async () => {
    const admin1 = await createAuthenticatedUser({ role: 'admin' });
    const admin2 = await createAuthenticatedUser({ role: 'admin' });
    
    const response = await authenticatedRequest(admin1.token)
      .get(`/api/organizations/${admin2.user.organizationId}/users`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-ADMIN-009: Admin can view organization details', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'admin' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}`);
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-ADMIN-010: Admin cannot delete owner or other admins', async () => {
    const admin = await createAuthenticatedUser({ role: 'admin' });
    const owner = await createAuthenticatedUser({ 
      role: 'owner',
      organizationId: admin.user.organizationId
    });
    
    const response = await authenticatedRequest(admin.token)
      .delete(`/api/users/${owner.user.id}`);
    
    expect(response.status).toBe(403);
  });
});
