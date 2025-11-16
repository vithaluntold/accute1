/**
 * Layer 4: Security Tests - XSS (Cross-Site Scripting)
 * Test Count: 10 tests
 * Dependencies: All previous layers must pass
 */

import request from 'supertest';
import app from '../../test-app';
import { createAuthenticatedUser, createUserAPI, authenticatedRequest } from '../helpers';

describe('Layer 4B: XSS Prevention (10 tests)', () => {
  
  it('TC-SEC-XSS-001: XSS in user firstName is sanitized', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const xssPayload = "<script>alert('xss')</script>";
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: `user${Date.now()}@test.com`,
        password: 'Pass123!',
        firstName: xssPayload,
        lastName: 'User',
        role: 'staff'
      });
    
    if (response.status === 201) {
      expect(response.body.firstName).not.toContain('<script>');
    }
  });

  it('TC-SEC-XSS-002: XSS in user lastName is sanitized', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: `user${Date.now()}@test.com`,
        password: 'Pass123!',
        firstName: 'Test',
        lastName: "<img src=x onerror=alert('xss')>",
        role: 'staff'
      });
    
    if (response.status === 201) {
      expect(response.body.lastName).not.toContain('<img');
    }
  });

  it('TC-SEC-XSS-003: XSS in organization name is sanitized', async () => {
    const { token } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .post('/api/organizations')
      .send({
        name: "<script>document.cookie='hacked'</script>",
        industry: 'accounting'
      });
    
    if (response.status === 201) {
      expect(response.body.name).not.toContain('<script>');
    }
  });

  it('TC-SEC-XSS-004: XSS in email field is rejected', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .post(`/api/organizations/${user.organizationId}/users`)
      .send({
        email: "<script>alert('xss')</script>@test.com",
        password: 'Pass123!',
        role: 'staff'
      });
    
    expect([400, 403]).toContain(response.status);
  });

  it('TC-SEC-XSS-005: XSS via SVG payload is sanitized', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const svgPayload = "<svg onload=alert('xss')>";
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: svgPayload });
    
    if (response.status === 200) {
      expect(response.body.firstName).not.toContain('<svg');
    }
  });

  it('TC-SEC-XSS-006: XSS via event handler attributes is sanitized', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({ 
        firstName: "John",
        lastName: "<div onmouseover=alert('xss')>Hacker</div>"
      });
    
    if (response.status === 200) {
      expect(response.body.lastName).not.toContain('onmouseover');
    }
  });

  it('TC-SEC-XSS-007: XSS via encoded payload is prevented', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const encodedXSS = "%3Cscript%3Ealert('xss')%3C%2Fscript%3E";
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: encodedXSS });
    
    if (response.status === 200) {
      expect(response.body.firstName).not.toContain('script');
    }
  });

  it('TC-SEC-XSS-008: XSS in error messages is sanitized', async () => {
    const xssEmail = "<script>alert('xss')</script>@test.com";
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: xssEmail, password: 'pass' });
    
    expect(response.status).toBe(401);
    const responseText = JSON.stringify(response.body);
    expect(responseText).not.toContain('<script>');
  });

  it('TC-SEC-XSS-009: XSS via JavaScript protocol is prevented', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'staff' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: "javascript:alert('xss')" });
    
    if (response.status === 200) {
      expect(response.body.firstName).not.toContain('javascript:');
    }
  });

  it('TC-SEC-XSS-010: XSS via iframe injection is prevented', async () => {
    const { token, user } = await createAuthenticatedUser({ role: 'owner' });
    
    const response = await authenticatedRequest(token)
      .patch(`/api/organizations/${user.organizationId}`)
      .send({ 
        name: "<iframe src='http://evil.com'></iframe>"
      });
    
    if (response.status === 200) {
      expect(response.body.name).not.toContain('<iframe');
    }
  });
});
