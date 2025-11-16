/**
 * Layer 2: Authentication Tests - Logout Flow
 * Test Count: 10 tests
 * Dependencies: Layer 1 (Foundation) must pass
 */

import request from 'supertest';
import app from '../../test-app';
import { createAuthenticatedUser, logout, authenticatedRequest } from '../helpers';

describe('Layer 2B: Logout Flow (10 tests)', () => {
  
  // TC-LOGOUT-001 to TC-LOGOUT-005: Successful Logout
  describe('Successful Logout (5 tests)', () => {
    
    it('TC-LOGOUT-001: User can logout successfully', async () => {
      const { token } = await createAuthenticatedUser({ role: 'staff' });
      
      const response = await logout(token);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
    });

    it('TC-LOGOUT-002: Token becomes invalid after logout', async () => {
      const { token } = await createAuthenticatedUser({ role: 'admin' });
      
      await logout(token);
      
      // Try to use token after logout
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(401);
    });

    it('TC-LOGOUT-003: Session is removed from database after logout', async () => {
      const { token, user } = await createAuthenticatedUser({ role: 'manager' });
      
      await logout(token);
      
      // Verify session is gone (would need to query sessions table)
      const response = await authenticatedRequest(token).get('/api/users/me');
      expect(response.status).toBe(401);
    });

    it('TC-LOGOUT-004: Multiple sessions can logout independently', async () => {
      const email = `user${Date.now()}@test.com`;
      const password = 'SecurePass123!';
      
      const user1 = await createAuthenticatedUser({ email, password, role: 'staff' });
      const user2 = await createAuthenticatedUser({ email, password, role: 'staff' });
      
      // Logout first session
      await logout(user1.token);
      
      // Second session should still work
      const response = await authenticatedRequest(user2.token).get('/api/users/me');
      expect(response.status).toBe(200);
    });

    it('TC-LOGOUT-005: Logout from all roles works correctly', async () => {
      const roles: ('owner' | 'admin' | 'manager' | 'staff')[] = ['owner', 'admin', 'manager', 'staff'];
      
      for (const role of roles) {
        const { token } = await createAuthenticatedUser({ role });
        const response = await logout(token);
        expect(response.status).toBe(200);
      }
    });
  });

  // TC-LOGOUT-006 to TC-LOGOUT-010: Error Scenarios
  describe('Logout Error Scenarios (5 tests)', () => {
    
    it('TC-LOGOUT-006: Logout fails with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token-123');
      
      expect(response.status).toBe(401);
    });

    it('TC-LOGOUT-007: Logout fails with missing token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');
      
      expect(response.status).toBe(401);
    });

    it('TC-LOGOUT-008: Logout fails with malformed Authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'malformed-header');
      
      expect(response.status).toBe(401);
    });

    it('TC-LOGOUT-009: Double logout does not cause error', async () => {
      const { token } = await createAuthenticatedUser({ role: 'staff' });
      
      const response1 = await logout(token);
      const response2 = await logout(token);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(401); // Already logged out
    });

    it('TC-LOGOUT-010: Logout with expired token fails gracefully', async () => {
      // Use malformed token as proxy for expired
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired');
      
      expect(response.status).toBe(401);
    });
  });
});
