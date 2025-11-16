/**
 * Layer 3: RBAC Tests - Staff Role
 * Test Count: 10 tests
 * Dependencies: Layer 1 (Foundation), Layer 2 (Authentication) must pass
 */

import request from 'supertest';
import app from '../../index';
import { createAuthenticatedUser, authenticatedRequest } from '../helpers';

describe('Layer 3D: Staff Role Permissions (10 tests)', () => {
  
  it('TC-RBAC-STAFF-001: Staff can view their own profile', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/users/${user.id}`);
    
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(user.id);
  });

  it('TC-RBAC-STAFF-002: Staff can update their own profile', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: 'Updated' });
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-STAFF-003: Staff cannot view other users', async () => {
    const staff1 = await createAuthenticatedUser({ role: 'staff' });
    const staff2 = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: staff1.user.organizationId
    });
    
    const response = await authenticatedRequest(staff1.token)
      .get(`/api/users/${staff2.user.id}`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-STAFF-004: Staff cannot modify other users', async () => {
    const staff1 = await createAuthenticatedUser({ role: 'staff' });
    const staff2 = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: staff1.user.organizationId
    });
    
    const response = await authenticatedRequest(staff1.token)
      .patch(`/api/users/${staff2.user.id}`)
      .send({ firstName: 'Unauthorized' });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-STAFF-005: Staff cannot delete users', async () => {
    const staff1 = await createAuthenticatedUser({ role: 'staff' });
    const staff2 = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: staff1.user.organizationId
    });
    
    const response = await authenticatedRequest(staff1.token)
      .delete(`/api/users/${staff2.user.id}`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-STAFF-006: Staff cannot create new users', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: `newuser${Date.now()}@test.com`,
        password: 'NewUser123!',
        role: 'staff'
      });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-STAFF-007: Staff cannot view all organization users', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/users`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-STAFF-008: Staff cannot modify organization settings', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/organizations/${user.organizationId}`)
      .send({ name: 'Unauthorized Change' });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-STAFF-009: Staff cannot change their own role', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({ role: 'admin' });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-STAFF-010: Staff cannot access other organizations', async () => {
    const staff1 = await createAuthenticatedUser({ role: 'staff' });
    const staff2 = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(staff1.token)
      .get(`/api/organizations/${staff2.user.organizationId}`);
    
    expect(response.status).toBe(403);
  });
});
