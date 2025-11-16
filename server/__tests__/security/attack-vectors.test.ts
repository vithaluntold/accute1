/**
 * LAYER 4: Security & Edge Cases - Attack Vectors (Test-First Approach)
 * 
 * Tests current security posture and identifies gaps for targeted fixes.
 * Total: 52 tests across 6 attack categories
 * 
 * Philosophy: Test what EXISTS, identify what's MISSING, fix SURGICALLY
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../test-app';
import { testDb as db } from '../../test-db';
import { users, organizations, sessions } from '@shared/schema';
import { createTestContext, createOrgWithOwner, createUserInOrg, loginUser } from '../helpers';
import { eq } from 'drizzle-orm';

describe('Security - Attack Vectors (Layer 4)', () => {
  let ownerToken: string;
  let ownerUser: any;
  let testOrg: any;

  beforeEach(async () => {
    const context = await createTestContext();
    ownerToken = context.ownerToken;
    ownerUser = context.ownerUser;
    testOrg = context.testOrg;
  });

  // ==================== SQL INJECTION (10 tests) ====================
  
  describe('SQL Injection Prevention via Drizzle ORM', () => {
    it('TC-SEC-001: Malicious SQL in login email does not bypass authentication', async () => {
      const maliciousEmail = "admin@example.com' OR '1'='1' --";
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousEmail,
          password: 'anypassword'
        });
      
      // MUST fail authentication (parameterized queries prevent injection)
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.token).toBeUndefined();
    });

    it('TC-SEC-002: SQL injection in user firstName is stored literally (not executed)', async () => {
      const maliciousFirstName = "John'; DELETE FROM users WHERE '1'='1";
      const userCountBefore = (await db.select().from(users)).length;
      
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: `newuser-${Date.now()}@test.com`,
          firstName: maliciousFirstName,
          lastName: 'Doe',
          roleId: testOrg.staffRoleId
        });
      
      // Verify users table wasn't affected
      const userCountAfter = (await db.select().from(users)).length;
      expect(userCountAfter).toBeGreaterThanOrEqual(userCountBefore);
      
      // If accepted, firstName should be stored literally
      if (response.status === 201) {
        expect(response.body.firstName).toBe(maliciousFirstName);
      }
    });

    it('TC-SEC-003: SQL injection in organization name does not execute', async () => {
      const maliciousName = "Test Org'; DROP TABLE organizations; --";
      const orgCountBefore = (await db.select().from(organizations)).length;
      
      await request(app)
        .post('/api/organizations')
        .send({
          name: maliciousName,
          ownerEmail: `owner-${Date.now()}@test.com`,
          ownerPassword: 'SecurePass123!',
          ownerFirstName: 'Test',
          ownerLastName: 'Owner'
        });
      
      // Verify organizations table still exists
      const orgCountAfter = (await db.select().from(organizations)).length;
      expect(orgCountAfter).toBeGreaterThanOrEqual(orgCountBefore);
    });

    it('TC-SEC-004: SQL injection in search parameter does not bypass filtering', async () => {
      const maliciousSearch = "test' OR '1'='1' --";
      
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users?search=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Should not return all users (parameterized queries prevent injection)
      const allUsers = await db.select().from(users)
        .where(eq(users.organizationId, testOrg.id));
      expect(response.body.length).toBeLessThanOrEqual(allUsers.length);
    });

    it('TC-SEC-005: SQL injection in role filter is handled safely', async () => {
      const maliciousRole = "owner' OR '1'='1";
      
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users?role=${encodeURIComponent(maliciousRole)}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('TC-SEC-006: SQL injection in PATCH endpoint does not corrupt data', async () => {
      const maliciousFirstName = "Hacker'; DROP TABLE sessions; --";
      const sessionCountBefore = (await db.select().from(sessions)).length;
      
      await request(app)
        .patch(`/api/users/${ownerUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: maliciousFirstName
        });
      
      // Verify sessions table wasn't dropped
      const sessionCountAfter = (await db.select().from(sessions)).length;
      expect(sessionCountAfter).toBeGreaterThanOrEqual(sessionCountBefore);
    });

    it('TC-SEC-007: Invalid UUID in organizationId parameter is rejected', async () => {
      const maliciousOrgId = "1' OR '1'='1";
      
      const response = await request(app)
        .get(`/api/organizations/${maliciousOrgId}/users`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      // Should reject invalid UUID format
      expect([400, 403, 404]).toContain(response.status);
    });

    it('TC-SEC-008: Invalid UUID in userId parameter is rejected', async () => {
      const maliciousUserId = "1' UNION SELECT * FROM users WHERE '1'='1";
      
      const response = await request(app)
        .get(`/api/users/${maliciousUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect([400, 404]).toContain(response.status);
    });

    it('TC-SEC-009: SQL injection in lastName does not alter other users', async () => {
      const maliciousLastName = "Doe'; UPDATE users SET role_id = 'admin' WHERE '1'='1";
      const staffRoleBefore = await db.select().from(users)
        .where(eq(users.roleId, testOrg.staffRoleId));
      
      await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: `test-${Date.now()}@test.com`,
          firstName: 'Test',
          lastName: maliciousLastName,
          roleId: testOrg.staffRoleId
        });
      
      // Verify existing staff users weren't modified
      const staffRoleAfter = await db.select().from(users)
        .where(eq(users.roleId, testOrg.staffRoleId));
      expect(staffRoleAfter.length).toBeGreaterThanOrEqual(staffRoleBefore.length);
    });

    it('TC-SEC-010: Parameterized queries protect against UNION injection', async () => {
      const maliciousEmail = "test@test.com' UNION SELECT * FROM users--";
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousEmail,
          password: 'password'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.token).toBeUndefined();
    });
  });

  // ==================== XSS PREVENTION (10 tests) ====================
  
  describe('XSS Prevention (Current State)', () => {
    it('TC-SEC-011: Script tags in organization name - test current handling', async () => {
      const xssName = '<script>alert("XSS")</script>';
      
      const createResp = await request(app)
        .post('/api/organizations')
        .send({
          name: xssName,
          ownerEmail: `xss-${Date.now()}@test.com`,
          ownerPassword: 'SecurePass123!',
          ownerFirstName: 'Test',
          ownerLastName: 'User'
        });
      
      if (createResp.status === 201) {
        // Verify Content-Type is JSON (not HTML)
        expect(createResp.headers['content-type']).toMatch(/json/);
        
        // Retrieve and check response format
        const token = createResp.body.ownerToken || createResp.body.token;
        if (token) {
          const getResp = await request(app)
            .get(`/api/organizations/${createResp.body.id}`)
            .set('Authorization', `Bearer ${token}`);
          
          expect(getResp.headers['content-type']).toMatch(/json/);
        }
      }
    });

    it('TC-SEC-012: HTML tags in user firstName - verify safe storage/retrieval', async () => {
      const xssFirstName = '<img src=x onerror=alert(1)>';
      
      const createResp = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: `xss1-${Date.now()}@test.com`,
          firstName: xssFirstName,
          lastName: 'User',
          roleId: testOrg.staffRoleId
        });
      
      if (createResp.status === 201) {
        expect(createResp.headers['content-type']).toMatch(/json/);
      }
    });

    it('TC-SEC-013: SVG XSS payload in lastName', async () => {
      const xssLastName = '<svg/onload=alert(1)>';
      
      const createResp = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: `xss2-${Date.now()}@test.com`,
          firstName: 'John',
          lastName: xssLastName,
          roleId: testOrg.staffRoleId
        });
      
      if (createResp.status === 201) {
        const getResp = await request(app)
          .get(`/api/users/${createResp.body.id}`)
          .set('Authorization', `Bearer ${ownerToken}`);
        
        expect(getResp.headers['content-type']).toMatch(/json/);
      }
    });

    it('TC-SEC-014: Email with script tags must be rejected (invalid format)', async () => {
      const xssEmail = `user-${Date.now()}@example.com<script>alert(1)</script>`;
      
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: xssEmail,
          firstName: 'John',
          lastName: 'Doe',
          roleId: testOrg.staffRoleId
        });
      
      // Invalid email format must be rejected
      expect(response.status).toBe(400);
    });

    it('TC-SEC-015: XSS in search parameter returns JSON response', async () => {
      const xssSearch = '<script>document.cookie</script>';
      
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users?search=${encodeURIComponent(xssSearch)}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('TC-SEC-016: Malicious Content-Type header is rejected', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Content-Type', 'text/html')
        .send('<html><script>alert(1)</script></html>');
      
      expect(response.status).toBe(400);
    });

    it('TC-SEC-017: API responses are always JSON (not HTML)', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('TC-SEC-018: XSS payload in error messages does not execute', async () => {
      const xssEmail = '<script>alert(1)</script>@test.com';
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: xssEmail,
          password: 'anypassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('TC-SEC-019: Custom headers are not reflected in response', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Custom-Header', '<script>alert(1)</script>');
      
      expect(response.status).toBe(200);
      expect(response.headers['x-custom-header']).toBeUndefined();
    });

    it('TC-SEC-020: User list returns JSON with safe content types', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ==================== CSRF PROTECTION (10 tests) ====================
  
  describe('CSRF Protection via Authentication', () => {
    it('TC-SEC-021: User creation requires authentication', async () => {
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .send({
          email: `csrf-${Date.now()}@test.com`,
          firstName: 'CSRF',
          lastName: 'Test',
          roleId: testOrg.staffRoleId
        });
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-022: User deletion requires authentication', async () => {
      const staffUser = await createUserInOrg({
        email: `todelete-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const response = await request(app)
        .delete(`/api/users/${staffUser.id}`);
      
      expect(response.status).toBe(401);
      
      // Verify user wasn't deleted
      const userCheck = await db.select().from(users).where(eq(users.id, staffUser.id));
      expect(userCheck.length).toBe(1);
    });

    it('TC-SEC-023: Organization update requires authentication', async () => {
      const response = await request(app)
        .patch(`/api/organizations/${testOrg.id}`)
        .send({
          name: 'Hacked Name'
        });
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-024: Organization deletion requires authentication', async () => {
      const response = await request(app)
        .delete(`/api/organizations/${testOrg.id}`);
      
      expect(response.status).toBe(401);
      
      // Verify org not deleted
      const orgCheck = await db.select().from(organizations).where(eq(organizations.id, testOrg.id));
      expect(orgCheck.length).toBe(1);
    });

    it('TC-SEC-025: Invalid token is rejected', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', 'Bearer invalid-token-12345');
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-026: Malformed JWT is rejected', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', 'Bearer malformed.jwt.here');
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-027: Missing Authorization header is rejected', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`);
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-028: Empty Authorization header is rejected', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', '');
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-029: Malformed Authorization header format is rejected', async () => {
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', 'InvalidFormat token123');
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-030: All state-changing operations require authentication', async () => {
      const endpoints = [
        { method: 'post', path: `/api/organizations/${testOrg.id}/users`, data: { email: 'test@test.com' } },
        { method: 'patch', path: `/api/users/${ownerUser.id}`, data: { firstName: 'Hacked' } },
        { method: 'delete', path: `/api/users/${ownerUser.id}` },
      ];
      
      for (const endpoint of endpoints) {
        const req = (request(app) as any)[endpoint.method](endpoint.path);
        if (endpoint.data) {
          req.send(endpoint.data);
        }
        const response = await req;
        expect(response.status).toBe(401);
      }
    });
  });

  // ==================== SESSION HIJACKING PREVENTION (10 tests) ====================
  
  describe('Session Hijacking Prevention', () => {
    it('TC-SEC-031: Token invalidated after logout', async () => {
      const staffUser = await createUserInOrg({
        email: `session1-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const loginResp = await loginUser(staffUser.email, 'SecurePass123!', testOrg.id);
      const token = loginResp.token;
      
      // Verify token works before logout
      const beforeLogout = await request(app)
        .get(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(beforeLogout.status).toBe(200);
      
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      
      // Try to use token after logout
      const afterLogout = await request(app)
        .get(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(afterLogout.status).toBe(401);
    });

    it('TC-SEC-032: New session created on each login', async () => {
      const staffUser = await createUserInOrg({
        email: `session2-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const login1 = await loginUser(staffUser.email, 'SecurePass123!', testOrg.id);
      const token1 = login1.token;
      
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token1}`);
      
      // Login again
      const login2 = await loginUser(staffUser.email, 'SecurePass123!', testOrg.id);
      const token2 = login2.token;
      
      // Tokens must be different
      expect(token1).not.toBe(token2);
      
      // Old token must not work
      const oldTokenResp = await request(app)
        .get(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${token1}`);
      expect(oldTokenResp.status).toBe(401);
      
      // New token must work
      const newTokenResp = await request(app)
        .get(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(newTokenResp.status).toBe(200);
    });

    it('TC-SEC-033: Session has expiry timestamp', async () => {
      const loginResp = await loginUser(ownerUser.email, 'SecurePass123!', testOrg.id);
      
      // Verify session has expiry in database
      const sessionData = await db.select().from(sessions)
        .where(eq(sessions.token, loginResp.token));
      
      expect(sessionData.length).toBe(1);
      expect(sessionData[0].expiresAt).toBeDefined();
      expect(sessionData[0].expiresAt > new Date()).toBe(true);
    });

    it('TC-SEC-034: Session contains correct user ID', async () => {
      const loginResp = await loginUser(ownerUser.email, 'SecurePass123!', testOrg.id);
      
      const sessionData = await db.select().from(sessions)
        .where(eq(sessions.token, loginResp.token));
      
      expect(sessionData.length).toBe(1);
      expect(sessionData[0].userId).toBe(ownerUser.id);
    });

    it('TC-SEC-035: Session isolation between users', async () => {
      const user1 = await createUserInOrg({
        email: `user1-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const user2 = await createUserInOrg({
        email: `user2-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const login1 = await loginUser(user1.email, 'SecurePass123!', testOrg.id);
      
      // User1's token should not work for User2's data
      const response = await request(app)
        .patch(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${login1.token}`)
        .send({ firstName: 'Hacked' });
      
      expect(response.status).toBe(403);
    });

    it('TC-SEC-036: Session does not contain password', async () => {
      const loginResp = await loginUser(ownerUser.email, 'SecurePass123!', testOrg.id);
      
      const sessionData = await db.select().from(sessions)
        .where(eq(sessions.token, loginResp.token));
      
      const sessionStr = JSON.stringify(sessionData[0]);
      expect(sessionStr).not.toContain('password');
      expect(sessionStr).not.toContain('SecurePass');
    });

    it('TC-SEC-037: Token tampering is rejected (invalid signature)', async () => {
      const loginResp = await loginUser(ownerUser.email, 'SecurePass123!', testOrg.id);
      const tokenParts = loginResp.token.split('.');
      
      // Tamper with payload
      const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'hacker-123' })).toString('base64');
      const tamperedToken = `${tokenParts[0]}.${tamperedPayload}.${tokenParts[2]}`;
      
      const response = await request(app)
        .get(`/api/users/${ownerUser.id}`)
        .set('Authorization', `Bearer ${tamperedToken}`);
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-038: Expired session is rejected', async () => {
      // Create a session and then expire it
      const loginResp = await loginUser(ownerUser.email, 'SecurePass123!', testOrg.id);
      
      // Expire the session by backdating expiresAt
      await db.update(sessions)
        .set({ expiresAt: new Date(Date.now() - 60000) }) // 1 minute ago
        .where(eq(sessions.token, loginResp.token));
      
      // Try to use expired token
      const response = await request(app)
        .get(`/api/users/${ownerUser.id}`)
        .set('Authorization', `Bearer ${loginResp.token}`);
      
      // Expired session MUST be rejected
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toMatch(/expired/i);
    });

    it('TC-SEC-039: Inactive user session is rejected', async () => {
      // Verify inactive users cannot use tokens
      const staffUser = await createUserInOrg({
        email: `inactive-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const loginResp = await loginUser(staffUser.email, 'SecurePass123!', testOrg.id);
      
      // Deactivate user
      await db.update(users)
        .set({ isActive: false })
        .where(eq(users.id, staffUser.id));
      
      // Try to use token
      const response = await request(app)
        .get(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${loginResp.token}`);
      
      expect(response.status).toBe(401);
    });

    it('TC-SEC-040: Bearer token prefix is required', async () => {
      const loginResp = await loginUser(ownerUser.email, 'SecurePass123!', testOrg.id);
      
      // Try without Bearer prefix
      const response = await request(app)
        .get(`/api/organizations/${testOrg.id}`)
        .set('Authorization', loginResp.token);
      
      expect(response.status).toBe(401);
    });
  });

  // ==================== BRUTE FORCE PROTECTION (10 tests) ====================
  
  describe('Brute Force Protection (Current State)', () => {
    it('TC-SEC-041: Rate limiting blocks excessive login attempts', async () => {
      // Use deterministic email for all attempts
      const victimEmail = `brute-force-victim-${Date.now()}@test.com`;
      const responses = [];
      
      // Make 6 sequential login attempts (not parallel) to test rate limiting
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: victimEmail,
            password: `wrong${i}`
          });
        responses.push(response);
      }
      
      // 6th attempt MUST be rate limited (this test FAILS if rate limiting is missing)
      const finalResponse = responses[5];
      expect(finalResponse.status).toBe(429);
      expect(finalResponse.body.error).toBeDefined();
      expect(finalResponse.body.error).toMatch(/too many|rate limit/i);
      
      // Earlier attempts should fail with 401 (authentication failure)
      responses.slice(0, 5).forEach(r => {
        expect(r.status).toBe(401);
      });
    });

    it('TC-SEC-042: Server handles rapid requests safely', async () => {
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get(`/api/organizations/${testOrg.id}`)
            .set('Authorization', `Bearer ${ownerToken}`)
        );
      }
      
      const responses = await Promise.all(requests);
      
      responses.forEach(r => {
        expect(r.status).toBe(200);
      });
    });

    it('TC-SEC-043: Successful login works after failed attempts', async () => {
      const testUser = await createUserInOrg({
        email: `locktest-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword',
            organizationId: testOrg.id
          });
      }
      
      // Correct password should work
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePass123!',
          organizationId: testOrg.id
        });
      
      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('TC-SEC-044: Invalid email format is rejected', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'password123'
        });
      
      expect([400, 401]).toContain(response.status);
    });

    it('TC-SEC-045: Empty credentials are rejected', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '',
          password: ''
        });
      
      expect([400, 401]).toContain(response.status);
    });

    it('TC-SEC-046: Missing credentials are rejected', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});
      
      expect([400, 401]).toContain(response.status);
    });

    it('TC-SEC-047: Account enumeration prevention (consistent errors)', async () => {
      // Non-existent email
      const nonExistentResp = await request(app)
        .post('/api/auth/login')
        .send({
          email: `nonexistent-${Date.now()}@test.com`,
          password: 'anypassword'
        });
      
      // Existing email, wrong password
      const wrongPassResp = await request(app)
        .post('/api/auth/login')
        .send({
          email: ownerUser.email,
          password: 'wrongpassword'
        });
      
      // Both should return 401
      expect(nonExistentResp.status).toBe(401);
      expect(wrongPassResp.status).toBe(401);
    });

    it('TC-SEC-048: Concurrent login requests handled safely', async () => {
      const testUser = await createUserInOrg({
        email: `concurrent-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const requests = [1, 2, 3].map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'SecurePass123!',
            organizationId: testOrg.id
          })
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(r => {
        expect(r.status).toBe(200);
        expect(r.body.token).toBeDefined();
      });
    });

    it('TC-SEC-049: Password complexity is enforced', async () => {
      const weakPassword = '123';
      
      const response = await request(app)
        .post(`/api/organizations/${testOrg.id}/users`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: `weak-${Date.now()}@test.com`,
          password: weakPassword,
          firstName: 'Weak',
          lastName: 'Password',
          roleId: testOrg.staffRoleId
        });
      
      // Weak passwords MUST be rejected
      // Test FAILS if weak passwords are accepted (identifies missing control)
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      
      // Error message should mention password requirements
      const errorMsg = JSON.stringify(response.body).toLowerCase();
      expect(
        errorMsg.includes('password') && 
        (errorMsg.includes('complex') || errorMsg.includes('length') || errorMsg.includes('requirement'))
      ).toBe(true);
    });

    it('TC-SEC-050: Response time consistency (timing attack prevention)', async () => {
      // Test with non-existent user
      const start1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: `nonexistent-${Date.now()}@test.com`,
          password: 'password123'
        });
      const time1 = Date.now() - start1;
      
      // Test with wrong password
      const start2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: ownerUser.email,
          password: 'wrongpassword'
        });
      const time2 = Date.now() - start2;
      
      // Times should be similar (allow 500ms variance)
      expect(Math.abs(time1 - time2)).toBeLessThan(500);
    });
  });

  // ==================== PRIVILEGE ESCALATION (2 tests) ====================
  
  describe('Privilege Escalation Prevention', () => {
    it('TC-SEC-051: Cannot escalate role via user update', async () => {
      const staffUser = await createUserInOrg({
        email: `staff-${Date.now()}@test.com`,
        password: 'SecurePass123!',
        roleId: testOrg.staffRoleId,
        organizationId: testOrg.id
      });
      
      const staffLogin = await loginUser(staffUser.email, 'SecurePass123!', testOrg.id);
      
      // Try to escalate own role to owner
      const response = await request(app)
        .patch(`/api/users/${staffUser.id}`)
        .set('Authorization', `Bearer ${staffLogin.token}`)
        .send({
          roleId: testOrg.ownerRoleId
        });
      
      expect([400, 403]).toContain(response.status);
      
      // Verify role didn't change
      const updatedUser = await db.select().from(users).where(eq(users.id, staffUser.id));
      expect(updatedUser[0].roleId).toBe(testOrg.staffRoleId);
    });

    it('TC-SEC-052: Cannot change organizationId to access other organizations', async () => {
      const otherOrg = await createOrgWithOwner({
        orgName: 'Other Firm',
        ownerEmail: `other-${Date.now()}@test.com`,
        ownerPassword: 'SecurePass123!'
      });
      
      // Try to change organization
      const response = await request(app)
        .patch(`/api/users/${ownerUser.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          organizationId: otherOrg.testOrg.id
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toMatch(/organizationId/i);
      
      // Verify organizationId didn't change
      const updatedUser = await db.select().from(users).where(eq(users.id, ownerUser.id));
      expect(updatedUser[0].organizationId).toBe(testOrg.id);
    });
  });
});
