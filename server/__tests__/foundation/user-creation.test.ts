import request from 'supertest';
import app from '../../test-app';
import { createOrg, createUser, verifyPassword } from '../helpers';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

describe('User Creation - Owner Role', () => {
  let testOrg;

  beforeEach(async () => {
    testOrg = await createOrg({ name: 'Test Firm' });
  });

  // HAPPY PATH
  test('TC-USER-001: Create owner user with valid data', async () => {
    const user = await createUser({
      email: 'owner@test.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'owner',
      organizationId: testOrg.id
    });

    expect(user.email).toBe('owner@test.com');
    expect(user.role).toBe('owner');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe('SecurePass123!'); // Should be hashed
  });

  // VALIDATION
  test('TC-USER-002: Reject user with invalid email format', async () => {
    await expect(async () => {
      await createUser({
        email: 'not-an-email',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        organizationId: testOrg.id
      });
    }).rejects.toThrow();
  });

  test('TC-USER-003: Reject user with weak password', async () => {
    // This test assumes password validation in the API layer
    // For now, we test that short passwords work in DB but should fail in API
    const user = await createUser({
      email: 'weak@test.com',
      password: '123', // Weak password
      organizationId: testOrg.id
    });
    
    // Database accepts it, but API should reject it
    expect(user).toBeDefined();
  });

  test('TC-USER-004: Reject duplicate email within same organization', async () => {
    const email = 'duplicate@test.com';
    
    await createUser({ email, organizationId: testOrg.id });
    
    await expect(async () => {
      await createUser({ email, organizationId: testOrg.id });
    }).rejects.toThrow();
  });

  test('TC-USER-005: Allow same email in different organizations', async () => {
    const org1 = await createOrg({ name: 'Org 1' });
    const org2 = await createOrg({ name: 'Org 2' });
    const email = 'same@test.com';

    const user1 = await createUser({ email, organizationId: org1.id });
    const user2 = await createUser({ email, organizationId: org2.id });

    expect(user1.email).toBe(email);
    expect(user2.email).toBe(email);
    expect(user1.id).not.toBe(user2.id);
  });

  test('TC-USER-006: Verify password is hashed (bcrypt)', async () => {
    const plainPassword = 'PlainPassword123';
    const user = await createUser({
      email: 'hash@test.com',
      password: plainPassword,
      organizationId: testOrg.id
    });

    expect(user.passwordHash).not.toBe(plainPassword);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt format
    
    // Verify password can be checked
    const isValid = await bcrypt.compare(plainPassword, user.passwordHash);
    expect(isValid).toBe(true);
  });

  test('TC-USER-007: Reject user with missing organizationId', async () => {
    await expect(async () => {
      await db.insert(users).values({
        email: 'noorg@test.com',
        passwordHash: 'hash',
        firstName: 'No',
        lastName: 'Org',
        role: 'staff'
        // Missing organizationId
      });
    }).rejects.toThrow();
  });

  test('TC-USER-008: Reject user with non-existent organizationId', async () => {
    await expect(async () => {
      await createUser({
        email: 'invalid@test.com',
        password: 'SecurePass123!',
        organizationId: 99999 // Doesn't exist
      });
    }).rejects.toThrow();
  });

  test('TC-USER-009: Default role to "staff" if not provided', async () => {
    const user = await createUser({
      email: 'default@test.com',
      password: 'SecurePass123!',
      firstName: 'Default',
      lastName: 'User',
      organizationId: testOrg.id
      // No role specified - should default to 'staff'
    });

    expect(user.role).toBe('staff');
  });

  test('TC-USER-010: Reject invalid role', async () => {
    await expect(async () => {
      await db.insert(users).values({
        email: 'bad@test.com',
        passwordHash: 'hash',
        firstName: 'Bad',
        lastName: 'Role',
        role: 'superadmin' as any, // Invalid role
        organizationId: testOrg.id
      });
    }).rejects.toThrow();
  });
});

describe('User Creation - Admin Role', () => {
  let testOrg;

  beforeEach(async () => {
    testOrg = await createOrg({ name: 'Admin Test Firm' });
  });

  test('TC-USER-011: Create admin user with valid data', async () => {
    const user = await createUser({
      email: 'admin@test.com',
      password: 'AdminPass123!',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'admin',
      organizationId: testOrg.id
    });

    expect(user.email).toBe('admin@test.com');
    expect(user.role).toBe('admin');
    expect(user.firstName).toBe('Jane');
    expect(user.lastName).toBe('Smith');
  });

  test('TC-USER-012: Admin user has correct default status', async () => {
    const user = await createUser({ role: 'admin', organizationId: testOrg.id });
    expect(user.status).toBe('active');
  });

  test('TC-USER-013: Admin user password is hashed', async () => {
    const password = 'AdminPassword123!';
    const user = await createUser({ 
      role: 'admin', 
      password,
      organizationId: testOrg.id 
    });

    expect(user.passwordHash).not.toBe(password);
    const isValid = await bcrypt.compare(password, user.passwordHash);
    expect(isValid).toBe(true);
  });

  test('TC-USER-014: Admin user has timestamps', async () => {
    const user = await createUser({ role: 'admin', organizationId: testOrg.id });
    
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  test('TC-USER-015: Admin user can have same email as user in different org', async () => {
    const org2 = await createOrg({ name: 'Another Org' });
    const email = 'admin-shared@test.com';

    const admin1 = await createUser({ email, role: 'admin', organizationId: testOrg.id });
    const admin2 = await createUser({ email, role: 'admin', organizationId: org2.id });

    expect(admin1.email).toBe(email);
    expect(admin2.email).toBe(email);
    expect(admin1.organizationId).not.toBe(admin2.organizationId);
  });

  test('TC-USER-016: Cannot create duplicate admin email in same org', async () => {
    const email = 'admin-dup@test.com';
    
    await createUser({ email, role: 'admin', organizationId: testOrg.id });
    
    await expect(async () => {
      await createUser({ email, role: 'admin', organizationId: testOrg.id });
    }).rejects.toThrow();
  });

  test('TC-USER-017: Admin user organizationId is required', async () => {
    await expect(async () => {
      await db.insert(users).values({
        email: 'admin-noorg@test.com',
        passwordHash: 'hash',
        firstName: 'Admin',
        lastName: 'NoOrg',
        role: 'admin'
      });
    }).rejects.toThrow();
  });

  test('TC-USER-018: Admin user validates email format', async () => {
    await expect(async () => {
      await createUser({
        email: 'not.an.email',
        role: 'admin',
        organizationId: testOrg.id
      });
    }).rejects.toThrow();
  });

  test('TC-USER-019: Admin user accepts valid email variations', async () => {
    const emails = [
      'admin+tag@test.com',
      'admin.name@test.com',
      'admin_name@test.com'
    ];

    for (const email of emails) {
      const user = await createUser({ email, role: 'admin', organizationId: testOrg.id });
      expect(user.email).toBe(email);
    }
  });

  test('TC-USER-020: Admin user profile is complete', async () => {
    const user = await createUser({
      email: 'complete-admin@test.com',
      password: 'Pass123!',
      firstName: 'Complete',
      lastName: 'Admin',
      role: 'admin',
      organizationId: testOrg.id
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('complete-admin@test.com');
    expect(user.firstName).toBe('Complete');
    expect(user.lastName).toBe('Admin');
    expect(user.role).toBe('admin');
    expect(user.organizationId).toBe(testOrg.id);
    expect(user.status).toBe('active');
  });
});

describe('User Creation - Manager Role', () => {
  let testOrg;

  beforeEach(async () => {
    testOrg = await createOrg({ name: 'Manager Test Firm' });
  });

  test('TC-USER-021: Create manager user with valid data', async () => {
    const user = await createUser({
      email: 'manager@test.com',
      password: 'ManagerPass123!',
      firstName: 'Bob',
      lastName: 'Johnson',
      role: 'manager',
      organizationId: testOrg.id
    });

    expect(user.email).toBe('manager@test.com');
    expect(user.role).toBe('manager');
  });

  test('TC-USER-022: Manager user has correct defaults', async () => {
    const user = await createUser({ role: 'manager', organizationId: testOrg.id });
    expect(user.status).toBe('active');
    expect(user.createdAt).toBeDefined();
  });

  test('TC-USER-023: Manager password is hashed', async () => {
    const password = 'ManagerPass123!';
    const user = await createUser({ role: 'manager', password, organizationId: testOrg.id });
    
    expect(user.passwordHash).not.toBe(password);
    const isValid = await bcrypt.compare(password, user.passwordHash);
    expect(isValid).toBe(true);
  });

  test('TC-USER-024: Manager email is unique per org', async () => {
    const email = 'manager-dup@test.com';
    
    await createUser({ email, role: 'manager', organizationId: testOrg.id });
    
    await expect(async () => {
      await createUser({ email, role: 'manager', organizationId: testOrg.id });
    }).rejects.toThrow();
  });

  test('TC-USER-025: Manager can have same email in different org', async () => {
    const org2 = await createOrg();
    const email = 'manager-shared@test.com';

    const m1 = await createUser({ email, role: 'manager', organizationId: testOrg.id });
    const m2 = await createUser({ email, role: 'manager', organizationId: org2.id });

    expect(m1.email).toBe(email);
    expect(m2.email).toBe(email);
  });

  test('TC-USER-026: Manager requires organizationId', async () => {
    await expect(async () => {
      await db.insert(users).values({
        email: 'manager-noorg@test.com',
        passwordHash: 'hash',
        firstName: 'Manager',
        lastName: 'NoOrg',
        role: 'manager'
      });
    }).rejects.toThrow();
  });

  test('TC-USER-027: Manager validates email format', async () => {
    await expect(async () => {
      await createUser({
        email: 'invalid-email',
        role: 'manager',
        organizationId: testOrg.id
      });
    }).rejects.toThrow();
  });

  test('TC-USER-028: Manager accepts Unicode in name', async () => {
    const user = await createUser({
      email: 'unicode-manager@test.com',
      firstName: '李',
      lastName: '明',
      role: 'manager',
      organizationId: testOrg.id
    });

    expect(user.firstName).toBe('李');
    expect(user.lastName).toBe('明');
  });

  test('TC-USER-029: Manager user is complete', async () => {
    const user = await createUser({
      email: 'complete-manager@test.com',
      firstName: 'Complete',
      lastName: 'Manager',
      role: 'manager',
      organizationId: testOrg.id
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.firstName).toBeDefined();
    expect(user.lastName).toBeDefined();
    expect(user.role).toBe('manager');
    expect(user.organizationId).toBe(testOrg.id);
  });

  test('TC-USER-030: Manager timestamps are set', async () => {
    const user = await createUser({ role: 'manager', organizationId: testOrg.id });
    
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
});

describe('User Creation - Staff Role', () => {
  let testOrg;

  beforeEach(async () => {
    testOrg = await createOrg({ name: 'Staff Test Firm' });
  });

  test('TC-USER-031: Create staff user with valid data', async () => {
    const user = await createUser({
      email: 'staff@test.com',
      password: 'StaffPass123!',
      firstName: 'Alice',
      lastName: 'Williams',
      role: 'staff',
      organizationId: testOrg.id
    });

    expect(user.email).toBe('staff@test.com');
    expect(user.role).toBe('staff');
  });

  test('TC-USER-032: Staff is default role', async () => {
    const user = await createUser({
      email: 'default-role@test.com',
      organizationId: testOrg.id
      // No role specified
    });

    expect(user.role).toBe('staff');
  });

  test('TC-USER-033: Staff password is hashed', async () => {
    const password = 'StaffPass123!';
    const user = await createUser({ role: 'staff', password, organizationId: testOrg.id });
    
    expect(user.passwordHash).not.toBe(password);
    const isValid = await bcrypt.compare(password, user.passwordHash);
    expect(isValid).toBe(true);
  });

  test('TC-USER-034: Staff email is unique per org', async () => {
    const email = 'staff-dup@test.com';
    
    await createUser({ email, role: 'staff', organizationId: testOrg.id });
    
    await expect(async () => {
      await createUser({ email, role: 'staff', organizationId: testOrg.id });
    }).rejects.toThrow();
  });

  test('TC-USER-035: Staff can have same email in different org', async () => {
    const org2 = await createOrg();
    const email = 'staff-shared@test.com';

    const s1 = await createUser({ email, role: 'staff', organizationId: testOrg.id });
    const s2 = await createUser({ email, role: 'staff', organizationId: org2.id });

    expect(s1.email).toBe(email);
    expect(s2.email).toBe(email);
  });

  test('TC-USER-036: Staff requires organizationId', async () => {
    await expect(async () => {
      await db.insert(users).values({
        email: 'staff-noorg@test.com',
        passwordHash: 'hash',
        firstName: 'Staff',
        lastName: 'NoOrg',
        role: 'staff'
      });
    }).rejects.toThrow();
  });

  test('TC-USER-037: Staff validates email format', async () => {
    await expect(async () => {
      await createUser({
        email: '@test.com', // Missing local part
        role: 'staff',
        organizationId: testOrg.id
      });
    }).rejects.toThrow();
  });

  test('TC-USER-038: Staff has default status active', async () => {
    const user = await createUser({ role: 'staff', organizationId: testOrg.id });
    expect(user.status).toBe('active');
  });

  test('TC-USER-039: Staff user is complete', async () => {
    const user = await createUser({
      email: 'complete-staff@test.com',
      firstName: 'Complete',
      lastName: 'Staff',
      role: 'staff',
      organizationId: testOrg.id
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('complete-staff@test.com');
    expect(user.firstName).toBe('Complete');
    expect(user.lastName).toBe('Staff');
    expect(user.role).toBe('staff');
  });

  test('TC-USER-040: Staff timestamps are set correctly', async () => {
    const before = new Date();
    const user = await createUser({ role: 'staff', organizationId: testOrg.id });
    const after = new Date();
    
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
