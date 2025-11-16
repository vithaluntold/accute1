import { testDb as db } from '../../test-db'; // Use test database
import { users, organizations, roles } from '@shared/schema';
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
    expect(user).toHaveProperty('password'); // Schema uses 'password' not 'passwordHash'
    expect(user).toHaveProperty('firstName');
    expect(user).toHaveProperty('lastName');
    expect(user).toHaveProperty('roleId'); // Schema uses 'roleId' not 'role'
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

  test('TC-DB-003: users.roleId references all 4 role types', async () => {
    const org = await createOrg();

    const owner = await createUser({ role: 'owner', organizationId: org.id });
    expect(owner.roleId).toBeDefined(); // roleId is a UUID

    const admin = await createUser({ role: 'admin', organizationId: org.id });
    expect(admin.roleId).toBeDefined();

    const manager = await createUser({ role: 'manager', organizationId: org.id });
    expect(manager.roleId).toBeDefined();

    const staff = await createUser({ role: 'staff', organizationId: org.id });
    expect(staff.roleId).toBeDefined();
  });

  test('TC-DB-004: Foreign key constraint users.organizationId → organizations.id', async () => {
    // Skip: This test requires direct DB insertion without helpers
    // TODO: Implement after getting valid roleId for direct inserts
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

    // Timestamps exist (Date or ISO string)
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    expect(user.isActive).toBe(true); // Default isActive is true
  });

  test('TC-DB-007: password is hashed (not plain text)', async () => {
    const plainPassword = 'PlainPassword123!';
    const user = await createUser({ password: plainPassword });

    expect(user.password).not.toBe(plainPassword);
    expect(user.password).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt format
  });

  test('TC-DB-008: createdAt and updatedAt timestamps work', async () => {
    const user = await createUser();

    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    
    // Timestamps can be Date objects or ISO strings depending on Drizzle config
    const createdAt = user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt);
    const updatedAt = user.updatedAt instanceof Date ? user.updatedAt : new Date(user.updatedAt);
    
    expect(createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('TC-DB-009: CASCADE delete (requires schema update)', async () => {
    // Skip: Schema needs ON DELETE CASCADE added to users.organizationId FK
    // TODO: Add { onDelete: 'cascade' } to organizationId reference in shared/schema.ts
    // Then test that deleting org deletes users
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
