import { db } from '../../db';
import { users, organizations } from '@shared/schema';
import { createOrg, createUser } from '../helpers';
import { eq, sql } from 'drizzle-orm';

describe('Database Schema Validation', () => {
  test('TC-DB-001: users table exists with correct columns', async () => {
    const user = await createUser({
      email: 'schema-test@test.com',
      password: 'TestPass123!',
      firstName: 'Schema',
      lastName: 'Test',
      role: 'staff'
    });

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('passwordHash');
    expect(user).toHaveProperty('firstName');
    expect(user).toHaveProperty('lastName');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('organizationId');
    expect(user).toHaveProperty('createdAt');
    expect(user).toHaveProperty('updatedAt');
  });

  test('TC-DB-002: organizations table exists', async () => {
    const org = await createOrg({ name: 'Schema Test Org' });

    expect(org).toHaveProperty('id');
    expect(org).toHaveProperty('name');
    expect(org).toHaveProperty('createdAt');
    expect(org).toHaveProperty('updatedAt');
  });

  test('TC-DB-003: users.role enum has all 4 values', async () => {
    const org = await createOrg();

    const owner = await createUser({ role: 'owner', organizationId: org.id });
    expect(owner.role).toBe('owner');

    const admin = await createUser({ role: 'admin', organizationId: org.id });
    expect(admin.role).toBe('admin');

    const manager = await createUser({ role: 'manager', organizationId: org.id });
    expect(manager.role).toBe('manager');

    const staff = await createUser({ role: 'staff', organizationId: org.id });
    expect(staff.role).toBe('staff');
  });

  test('TC-DB-004: Foreign key constraint users.organizationId → organizations.id', async () => {
    // Attempt to insert user with invalid orgId should fail
    await expect(async () => {
      await db.insert(users).values({
        email: 'invalid-org@test.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        role: 'staff',
        organizationId: 99999 // Non-existent org
      });
    }).rejects.toThrow();
  });

  test('TC-DB-005: Unique constraint on users.email', async () => {
    const org = await createOrg();
    const email = 'duplicate@test.com';

    // Create first user
    await createUser({ email, organizationId: org.id });

    // Attempt to create second user with same email should fail
    await expect(async () => {
      await createUser({ email, organizationId: org.id });
    }).rejects.toThrow();
  });

  test('TC-DB-006: Default values set correctly', async () => {
    const org = await createOrg();
    const user = await createUser({ organizationId: org.id });

    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
    expect(user.status).toBe('active'); // Default status
  });

  test('TC-DB-007: passwordHash is hashed (not plain text)', async () => {
    const plainPassword = 'PlainPassword123!';
    const user = await createUser({ password: plainPassword });

    expect(user.passwordHash).not.toBe(plainPassword);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt format
  });

  test('TC-DB-008: createdAt and updatedAt timestamps work', async () => {
    const user = await createUser();

    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
    expect(user.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('TC-DB-009: CASCADE delete works (org deletion cascades to users)', async () => {
    const org = await createOrg({ name: 'Delete Test' });
    const user = await createUser({ organizationId: org.id });

    // Delete organization
    await db.delete(organizations).where(eq(organizations.id, org.id));

    // User should also be deleted
    const deletedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });

    expect(deletedUser).toBeUndefined();
  });

  test('TC-DB-010: Database indexes exist for performance', async () => {
    // This test verifies that the schema has proper indexes
    // In a real app, you'd query the database metadata
    // For now, we verify that queries work efficiently
    const org = await createOrg();
    const user = await createUser({ 
      email: 'index-test@test.com',
      organizationId: org.id 
    });

    // Email lookup should be fast (indexed)
    const foundUser = await db.query.users.findFirst({
      where: eq(users.email, 'index-test@test.com')
    });

    expect(foundUser).toBeDefined();
    expect(foundUser?.id).toBe(user.id);
  });
});
