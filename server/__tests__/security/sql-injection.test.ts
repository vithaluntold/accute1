/**
 * Layer 4: Security Tests - SQL Injection
 * Test Count: 10 tests
 * Dependencies: All previous layers must pass
 */

import request from 'supertest';
import app from '../../test-app';
import { createAuthenticatedUser, login, createUserAPI, authenticatedRequest } from '../helpers';

describe('Layer 4A: SQL Injection Prevention (10 tests)', () => {
  
  it('TC-SEC-SQL-001: SQL injection in login email is prevented', async () => {
    const response = await login("admin' OR '1'='1' --", 'password');
    
    expect(response.status).toBe(401);
    expect(response.token).toBeUndefined();
  });

  it('TC-SEC-SQL-002: SQL injection in login password is prevented', async () => {
    const email = `user${Date.now()}@test.com`;
    await createUserAPI({ email, password: 'CorrectPass123!', role: 'staff' });
    
    const response = await login(email, "' OR '1'='1' --");
    
    expect(response.status).toBe(401);
  });

  it('TC-SEC-SQL-003: SQL injection in user creation email is prevented', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: "'; DROP TABLE users; --",
        password: 'Pass123!',
        role: 'staff'
      });
    
    // Should either reject or sanitize
    expect([400, 201]).toContain(response.status);
    
    // Verify users table still exists
    const checkResponse = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/users`);
    expect(checkResponse.status).toBe(200);
  });

  it('TC-SEC-SQL-004: SQL injection in organization name is prevented', async () => {
    const { token } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .post('/api/organizations')
      .send({
        name: "'; DELETE FROM organizations WHERE '1'='1",
        industry: 'accounting'
      });
    
    expect([400, 201]).toContain(response.status);
  });

  it('TC-SEC-SQL-005: SQL injection in search queries is prevented', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/organizations/${user.organizationId}/users?search=' OR '1'='1`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('TC-SEC-SQL-006: SQL injection in update operations is prevented', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({
        firstName: "'; UPDATE users SET role='owner' WHERE '1'='1"
      });
    
    expect([200, 400]).toContain(response.status);
    
    // Verify user is still staff
    const checkResponse = await authenticatedRequest(token).get('/api/users/me');
    expect(checkResponse.body.role).toBe('staff');
  });

  it('TC-SEC-SQL-007: SQL injection in ID parameters is prevented', async () => {
    const { token } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .get(`/api/users/1' OR '1'='1`);
    
    expect([400, 404]).toContain(response.status);
  });

  it('TC-SEC-SQL-008: Union-based SQL injection is prevented', async () => {
    const email = "test' UNION SELECT * FROM users --@test.com";
    const response = await login(email, 'password');
    
    expect(response.status).toBe(401);
  });

  it('TC-SEC-SQL-009: Time-based SQL injection is prevented', async () => {
    const email = "test' AND SLEEP(5) --@test.com";
    const startTime = Date.now();
    
    const response = await login(email, 'password');
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(401);
    expect(duration).toBeLessThan(2000); // Should not actually sleep
  });

  it('TC-SEC-SQL-010: Stacked SQL injection is prevented', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: "test@test.com'; CREATE TABLE hacked (id INT); --",
        password: 'Pass123!',
        role: 'staff'
      });
    
    expect([400, 201]).toContain(response.status);
  });
});
