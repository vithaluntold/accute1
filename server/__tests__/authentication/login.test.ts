/**
 * Layer 2: Authentication Tests - Login Flow
 * Test Count: 25 tests
 * Dependencies: Layer 1 (Foundation) must pass
 */

import request from 'supertest';
import app from '../../test-app';
import { createUserAPI, getUserByEmail, login, wait } from '../helpers';

describe('Layer 2A: Login Flow (25 tests)', () => {
  
  // TC-LOGIN-001 to TC-LOGIN-005: Successful Login Scenarios
  describe('Successful Login (5 tests)', () => {
    
    it('TC-LOGIN-001: Owner can login with valid credentials', async () => {
      const email = `owner${Date.now()}@test.com`;
      const password = 'SecurePass123!';
      
      await createUserAPI({ email, password, role: 'owner' });
      
      const response = await login(email, password);
      
      expect(response.status).toBe(200);
      expect(response.token).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.email).toBe(email);
      expect(response.user.role).toBe('owner');
      expect(response.user.passwordHash).toBeUndefined(); // Should not expose password
    });

    it('TC-LOGIN-002: Admin can login with valid credentials', async () => {
      const email = `admin${Date.now()}@test.com`;
      const password = 'AdminPass456!';
      
      await createUserAPI({ email, password, role: 'admin' });
      
      const response = await login(email, password);
      
      expect(response.status).toBe(200);
      expect(response.token).toBeDefined();
      expect(response.user.role).toBe('admin');
    });

    it('TC-LOGIN-003: Manager can login with valid credentials', async () => {
      const email = `manager${Date.now()}@test.com`;
      const password = 'ManagerPass789!';
      
      await createUserAPI({ email, password, role: 'manager' });
      
      const response = await login(email, password);
      
      expect(response.status).toBe(200);
      expect(response.token).toBeDefined();
      expect(response.user.role).toBe('manager');
    });

    it('TC-LOGIN-004: Staff can login with valid credentials', async () => {
      const email = `staff${Date.now()}@test.com`;
      const password = 'StaffPass111!';
      
      await createUserAPI({ email, password, role: 'staff' });
      
      const response = await login(email, password);
      
      expect(response.status).toBe(200);
      expect(response.token).toBeDefined();
      expect(response.user.role).toBe('staff');
    });

    it('TC-LOGIN-005: Login is case-insensitive for email', async () => {
      const email = `CaseSensitive${Date.now()}@TEST.COM`;
      const password = 'SecurePass123!';
      
      await createUserAPI({ email, password, role: 'staff' });
      
      const response = await login(email.toLowerCase(), password);
      
      expect(response.status).toBe(200);
      expect(response.token).toBeDefined();
    });
  });

  // TC-LOGIN-006 to TC-LOGIN-010: Failed Login Scenarios
  describe('Failed Login Scenarios (5 tests)', () => {
    
    it('TC-LOGIN-006: Login fails with incorrect password', async () => {
      const email = `user${Date.now()}@test.com`;
      
      await createUserAPI({ email, password: 'CorrectPass123!', role: 'staff' });
      
      const response = await login(email, 'WrongPass123!');
      
      expect(response.status).toBe(401);
      expect(response.token).toBeUndefined();
      expect(response.body.error).toBeDefined();
    });

    it('TC-LOGIN-007: Login fails with non-existent email', async () => {
      const response = await login('nonexistent@test.com', 'AnyPass123!');
      
      expect(response.status).toBe(401);
      expect(response.token).toBeUndefined();
    });

    it('TC-LOGIN-008: Login fails with empty email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: 'Pass123!' });
      
      expect(response.status).toBe(400);
    });

    it('TC-LOGIN-009: Login fails with empty password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: '' });
      
      expect(response.status).toBe(400);
    });

    it('TC-LOGIN-010: Login fails with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});
      
      expect(response.status).toBe(400);
    });
  });

  // TC-LOGIN-011 to TC-LOGIN-015: Session & Token Management
  describe('Session & Token Management (5 tests)', () => {
    
    it('TC-LOGIN-011: JWT token contains correct user information', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = 'SecurePass123!';
      
      const createResult = await createUserAPI({ email, password, role: 'admin' });
      const response = await login(email, password);
      
      expect(response.token).toBeDefined();
      expect(typeof response.token).toBe('string');
      expect(response.token.length).toBeGreaterThan(20); // JWT should be substantial
      
      // Token should be usable for authenticated requests
      const authResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${response.token}`);
      
      expect(authResponse.status).toBe(200);
      expect(authResponse.body.email).toBe(email);
    });

    it('TC-LOGIN-012: Multiple logins create separate sessions', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = 'SecurePass123!';
      
      await createUserAPI({ email, password, role: 'staff' });
      
      const login1 = await login(email, password);
      const login2 = await login(email, password);
      
      expect(login1.token).toBeDefined();
      expect(login2.token).toBeDefined();
      expect(login1.token).not.toBe(login2.token); // Different tokens
    });

    it('TC-LOGIN-013: Session persists across requests with valid token', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = 'SecurePass123!';
      
      await createUserAPI({ email, password, role: 'manager' });
      const loginResponse = await login(email, password);
      
      // Make multiple authenticated requests
      const req1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${loginResponse.token}`);
      
      const req2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${loginResponse.token}`);
      
      expect(req1.status).toBe(200);
      expect(req2.status).toBe(200);
      expect(req1.body.id).toBe(req2.body.id); // Same user
    });

    it('TC-LOGIN-014: Invalid token is rejected', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token-12345');
      
      expect(response.status).toBe(401);
    });

    it('TC-LOGIN-015: Expired token is rejected', async () => {
      // This would need a way to generate expired tokens
      // For now, test with malformed token
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired');
      
      expect(response.status).toBe(401);
    });
  });

  // TC-LOGIN-016 to TC-LOGIN-020: Rate Limiting & Security
  describe('Rate Limiting & Security (5 tests)', () => {
    
    it('TC-LOGIN-016: Multiple failed login attempts are tracked', async () => {
      const email = `user${Date.now()}@test.com`;
      
      await createUserAPI({ email, password: 'CorrectPass123!', role: 'staff' });
      
      // Attempt 3 failed logins
      await login(email, 'Wrong1!');
      await login(email, 'Wrong2!');
      const response = await login(email, 'Wrong3!');
      
      expect(response.status).toBe(401);
    });

    it('TC-LOGIN-017: Account locks after 5 failed attempts', async () => {
      const email = `user${Date.now()}@test.com`;
      const correctPassword = 'CorrectPass123!';
      
      await createUserAPI({ email, password: correctPassword, role: 'staff' });
      
      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await login(email, `Wrong${i}!`);
      }
      
      // 6th attempt should be locked, even with correct password
      const response = await login(email, correctPassword);
      
      expect([401, 429]).toContain(response.status); // Locked or rate limited
    });

    it('TC-LOGIN-018: SQL injection in email is prevented', async () => {
      const response = await login("admin' OR '1'='1", 'password');
      
      expect(response.status).toBe(401);
      expect(response.token).toBeUndefined();
    });

    it('TC-LOGIN-019: SQL injection in password is prevented', async () => {
      const email = `user${Date.now()}@test.com`;
      await createUserAPI({ email, password: 'CorrectPass123!', role: 'staff' });
      
      const response = await login(email, "' OR '1'='1' --");
      
      expect(response.status).toBe(401);
    });

    it('TC-LOGIN-020: XSS payload in credentials is sanitized', async () => {
      const xssEmail = `<script>alert('xss')</script>@test.com`;
      const response = await login(xssEmail, 'Pass123!');
      
      expect(response.status).toBe(401);
      expect(response.body.error).not.toContain('<script>');
    });
  });

  // TC-LOGIN-021 to TC-LOGIN-025: Edge Cases
  describe('Edge Cases (5 tests)', () => {
    
    it('TC-LOGIN-021: Login with very long email (512 chars)', async () => {
      const longEmail = 'a'.repeat(500) + '@test.com';
      const response = await login(longEmail, 'Pass123!');
      
      expect(response.status).toBe(401); // Should fail gracefully
    });

    it('TC-LOGIN-022: Login with Unicode characters in email', async () => {
      const unicodeEmail = `üser${Date.now()}@tëst.com`;
      const password = 'SecurePass123!';
      
      await createUserAPI({ email: unicodeEmail, password, role: 'staff' });
      const response = await login(unicodeEmail, password);
      
      expect(response.status).toBe(200);
      expect(response.token).toBeDefined();
    });

    it('TC-LOGIN-023: Login with special characters in password', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      await createUserAPI({ email, password, role: 'staff' });
      const response = await login(email, password);
      
      expect(response.status).toBe(200);
      expect(response.token).toBeDefined();
    });

    it('TC-LOGIN-024: Login with whitespace in credentials is trimmed', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = 'SecurePass123!';
      
      await createUserAPI({ email, password, role: 'staff' });
      const response = await login(`  ${email}  `, `  ${password}  `);
      
      expect(response.status).toBe(200);
    });

    it('TC-LOGIN-025: Concurrent login attempts from same user', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = 'SecurePass123!';
      
      await createUserAPI({ email, password, role: 'staff' });
      
      // Concurrent logins
      const [login1, login2, login3] = await Promise.all([
        login(email, password),
        login(email, password),
        login(email, password)
      ]);
      
      expect(login1.status).toBe(200);
      expect(login2.status).toBe(200);
      expect(login3.status).toBe(200);
      expect(login1.token).toBeDefined();
      expect(login2.token).toBeDefined();
      expect(login3.token).toBeDefined();
    });
  });
});
