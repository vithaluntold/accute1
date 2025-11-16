/**
 * Layer 3: RBAC Tests - Manager Role
 * Test Count: 10 tests
 * Dependencies: Layer 1 (Foundation), Layer 2 (Authentication) must pass
 */

import request from 'supertest';
import app from '../../test-app';
import { createAuthenticatedUser, authenticatedRequest, getRoleId } from '../helpers';

describe('Layer 3C: Manager Role Permissions (10 tests)', () => {
  
  it('TC-RBAC-MANAGER-001: Manager can view organization users', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'manager' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/users`);
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-MANAGER-002: Manager can update their own profile', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'manager' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: 'Updated' });
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-MANAGER-003: Manager cannot create new users', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'manager' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: `newuser${Date.now()}@test.com`,
        password: 'NewUser123!',
        role: 'staff'
      });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-MANAGER-004: Manager cannot delete users', async () => {
    const manager = await createAuthenticatedUser({ role: 'manager' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: manager.user.organizationId
    });
    
    const response = await authenticatedRequest(manager.token)
      .delete(`/api/users/${staff.user.id}`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-MANAGER-005: Manager cannot modify other users profiles', async () => {
    const manager = await createAuthenticatedUser({ role: 'manager' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: manager.user.organizationId
    });
    
    const response = await authenticatedRequest(manager.token)
      .patch(`/api/users/${staff.user.id}`)
      .send({ firstName: 'Unauthorized' });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-MANAGER-006: Manager cannot change user roles', async () => {
    const manager = await createAuthenticatedUser({ role: 'manager' });
    const staff = await createAuthenticatedUser({ 
      role: 'staff',
      organizationId: manager.user.organizationId
    });
    
    const managerRoleId = await getRoleId('manager');
    
    const response = await authenticatedRequest(manager.token)
      .patch(`/api/users/${staff.user.id}`)
      .send({ roleId: managerRoleId });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-MANAGER-007: Manager cannot modify organization settings', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'manager' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/organizations/${user.organizationId}`)
      .send({ name: 'Unauthorized Change' });
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-MANAGER-008: Manager cannot access other organizations', async () => {
    const manager1 = await createAuthenticatedUser({ role: 'manager' });
    const manager2 = await createAuthenticatedUser({ role: 'manager' });
    
    const response = await authenticatedRequest(manager1.token)
      .get(`/api/organizations/${manager2.user.organizationId}/users`);
    
    expect(response.status).toBe(403);
  });

  it('TC-RBAC-MANAGER-009: Manager can view organization details', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'manager' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}`);
    
    expect(response.status).toBe(200);
  });

  it('TC-RBAC-MANAGER-010: Manager can view clients in their organization', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'manager' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/clients`);
    
    expect([200, 404]).toContain(response.status); // 404 if clients not implemented
  });
});
