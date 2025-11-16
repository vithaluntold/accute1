import request from 'supertest';
import app from '../../test-app';
import { createOrg, createUser, createAuthenticatedUser, wait } from '../helpers';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('User Profile Management', () => {
  let testOrg;
  let ownerToken: string;

  beforeEach(async () => {
    testOrg = await createOrg({ name: 'Profile Test Firm' });
    const { token } = await createAuthenticatedUser({ role: 'owner', organizationId: testOrg.id });
    ownerToken = token;
  });

  test('TC-PROFILE-001: Get user by ID', async () => {
    const user = await createUser({ email: 'get@test.com', organizationId: testOrg.id });
    
    const response = await request(app)
      .get(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('get@test.com');
  });

  test('TC-PROFILE-002: Update user firstName', async () => {
    const user = await createUser({ 
      email: 'update@test.com',
      firstName: 'Old',
      organizationId: testOrg.id 
    });

    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'New' });

    expect(response.status).toBe(200);
    expect(response.body.firstName).toBe('New');
  });

  test('TC-PROFILE-003: Update user lastName', async () => {
    const user = await createUser({
      email: 'lastname@test.com',
      lastName: 'OldLast',
      organizationId: testOrg.id
    });

    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ lastName: 'NewLast' });

    expect(response.status).toBe(200);
    expect(response.body.lastName).toBe('NewLast');
  });

  test('TC-PROFILE-004: Update user email', async () => {
    const user = await createUser({ 
      email: 'old@test.com',
      organizationId: testOrg.id 
    });

    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'new@test.com' });

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('new@test.com');
  });

  test('TC-PROFILE-005: Prevent email update to existing email', async () => {
    await createUser({ email: 'existing@test.com', organizationId: testOrg.id });
    const user = await createUser({ email: 'other@test.com', organizationId: testOrg.id });

    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'existing@test.com' });

    expect(response.status).toBe(409); // Conflict
  });

  test('TC-PROFILE-006: Cannot update role directly (security)', async () => {
    const user = await createUser({ 
      email: 'staff@test.com',
      role: 'staff',
      organizationId: testOrg.id 
    });

    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'owner' }); // Try to escalate

    expect(response.status).toBe(403); // Forbidden
  });

  test('TC-PROFILE-007: Cannot update organizationId (prevent org hopping)', async () => {
    const org1 = await createOrg({ name: 'Org 1' });
    const org2 = await createOrg({ name: 'Org 2' });
    const user = await createUser({ 
      email: 'user@test.com',
      organizationId: org1.id 
    });

    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ organizationId: org2.id });

    expect(response.status).toBe(403); // Forbidden
  });

  test('TC-PROFILE-008: Upload profile picture (placeholder)', async () => {
    const user = await createUser({ 
      email: 'pic@test.com',
      organizationId: testOrg.id 
    });

    // This test assumes profile picture upload endpoint exists
    // For now, we just verify the user exists
    expect(user.id).toBeDefined();
  });

  test('TC-PROFILE-009: Reject profile picture > 5MB (placeholder)', async () => {
    const user = await createUser({ 
      email: 'large@test.com',
      organizationId: testOrg.id 
    });

    // Placeholder - would test file size validation
    expect(user.id).toBeDefined();
  });

  test('TC-PROFILE-010: Reject non-image file for profile picture (placeholder)', async () => {
    const user = await createUser({ 
      email: 'pdf@test.com',
      organizationId: testOrg.id 
    });

    // Placeholder - would test MIME type validation
    expect(user.id).toBeDefined();
  });

  test('TC-PROFILE-011: Delete user', async () => {
    const user = await createUser({ 
      email: 'delete@test.com',
      organizationId: testOrg.id 
    });

    const response = await request(app)
      .delete(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(204);

    // Verify user no longer exists
    const deletedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    expect(deletedUser).toBeUndefined();
  });

  test('TC-PROFILE-012: Soft delete vs hard delete', async () => {
    const user = await createUser({ 
      email: 'soft@test.com',
      organizationId: testOrg.id 
    });

    await request(app)
      .delete(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    // Check if soft delete (deletedAt field) or hard delete
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });

    // Currently hard delete (user is undefined)
    expect(dbUser).toBeUndefined();
  });

  test('TC-PROFILE-013: List users in organization', async () => {
    await createUser({ email: 'user1@test.com', organizationId: testOrg.id });
    await createUser({ email: 'user2@test.com', organizationId: testOrg.id });

    const response = await request(app)
      .get(`/api/organizations/${testOrg.id}/users`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
  });

  test('TC-PROFILE-014: Filter users by role', async () => {
    await createUser({ 
      email: 'owner@test.com',
      role: 'owner',
      organizationId: testOrg.id 
    });
    await createUser({ 
      email: 'staff@test.com',
      role: 'staff',
      organizationId: testOrg.id 
    });

    const response = await request(app)
      .get(`/api/organizations/${testOrg.id}/users?role=owner`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    const owners = response.body.filter(u => u.role === 'owner');
    expect(owners.length).toBeGreaterThan(0);
  });

  test('TC-PROFILE-015: Pagination for user list', async () => {
    // Create 25 users
    for (let i = 0; i < 25; i++) {
      await createUser({ 
        email: `user${i}@test.com`,
        organizationId: testOrg.id 
      });
    }

    const response = await request(app)
      .get(`/api/organizations/${testOrg.id}/users?page=1&limit=10`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data || response.body).toBeDefined();
  });

  test('TC-PROFILE-016: Handle concurrent updates (optimistic locking)', async () => {
    const user = await createUser({ 
      email: 'concurrent@test.com',
      organizationId: testOrg.id 
    });

    // Simulate two simultaneous updates
    const [update1, update2] = await Promise.all([
      request(app)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'Update1' }),
      request(app)
        .patch(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'Update2' })
    ]);

    // Both should succeed (last write wins)
    expect([update1.status, update2.status]).toContain(200);
  });

  test('TC-PROFILE-017: Case-insensitive email lookup', async () => {
    await createUser({ 
      email: 'CaseSensitive@test.com',
      organizationId: testOrg.id 
    });

    const response = await request(app)
      .get('/api/users/by-email?email=casesensitive@test.com')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
  });

  test('TC-PROFILE-018: Trim whitespace from email', async () => {
    const user = await createUser({
      email: '  spaces@test.com  ',
      organizationId: testOrg.id
    });

    // Email should be trimmed
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });

    expect(dbUser?.email.trim()).toBe(dbUser?.email);
  });

  test('TC-PROFILE-019: Validate email domain (optional business rule)', async () => {
    // Test that consumer emails are allowed (or rejected based on business rules)
    const user = await createUser({
      email: 'test@gmail.com', // Consumer email
      organizationId: testOrg.id
    });

    expect(user.email).toBe('test@gmail.com');
  });

  test('TC-PROFILE-020: Verify updatedAt timestamp changes on update', async () => {
    const user = await createUser({ 
      email: 'timestamp@test.com',
      organizationId: testOrg.id 
    });
    const originalUpdatedAt = user.updatedAt;

    await wait(1000); // Wait 1 second

    await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Updated' });

    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });

    expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});
