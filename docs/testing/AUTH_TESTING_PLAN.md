# Authentication & Authorization Testing Plan
**Accute - Complete End-to-End Testing Workflow**

## Executive Summary

This document outlines the **complete testing workflow** for Authentication & Authorization, starting from bare minimum foundations and building up layer by layer. Each layer must pass before moving to the next.

**Testing Layers:**
1. **Foundation Layer** - Database, User Profile Creation
2. **Authentication Layer** - Login, Logout, Sessions
3. **Authorization Layer** - RBAC (4 roles), Permissions
4. **Security Layer** - Edge cases, Attack vectors
5. **Integration Layer** - Real-world workflows

**Total Test Cases:** 287 (135 core + 152 edge cases)
**Estimated Timeline:** 2 weeks (Phase 1 of Six Sigma strategy)

---

## Dependency Map

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: Integration Testing (Real Workflows)               │
│ - Complete user journeys across features                    │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: Security & Edge Cases                              │
│ - Attack vectors, SQL injection, XSS, CSRF                  │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Authorization (RBAC)                               │
│ - Owner, Admin, Manager, Staff permissions                  │
│ - Cross-organization access prevention                      │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Authentication                                     │
│ - Login/Logout, Session management                          │
│ - Password reset, Token validation                          │
└─────────────────────────────────────────────────────────────┘
                            ↑
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Foundation (MUST PASS FIRST)                       │
│ - Database setup, User creation                             │
│ - Organization setup, Profile management                    │
└─────────────────────────────────────────────────────────────┘
```

**Golden Rule:** Each layer MUST have 100% pass rate before moving to next layer.

---

## LAYER 1: Foundation Testing (Days 1-2)

### Prerequisites
- ✅ Database running (PostgreSQL)
- ✅ Database schema migrated (`npm run db:push`)
- ✅ Server running (`npm run dev`)
- ✅ Frontend accessible

### 1.1 Database Schema Validation

**Purpose:** Ensure all required tables exist with correct structure

#### Test Cases (10 tests)

```typescript
// Test File: server/__tests__/database/schema.test.ts

describe('Database Schema', () => {
  test('TC-DB-001: users table exists with correct columns', async () => {
    // Verify: id, email, passwordHash, firstName, lastName, role, organizationId, createdAt, updatedAt
  });

  test('TC-DB-002: organizations table exists', async () => {
    // Verify: id, name, ownerId, createdAt, updatedAt
  });

  test('TC-DB-003: users.role enum has all 4 values', async () => {
    // Verify: 'owner', 'admin', 'manager', 'staff'
  });

  test('TC-DB-004: Foreign key constraint users.organizationId → organizations.id', async () => {
    // Attempt to insert user with invalid orgId, should fail
  });

  test('TC-DB-005: Unique constraint on users.email', async () => {
    // Attempt to insert duplicate email, should fail
  });

  test('TC-DB-006: Default values set correctly', async () => {
    // Verify: createdAt defaults to now(), role defaults to 'staff'
  });

  test('TC-DB-007: passwordHash is hashed (not plain text)', async () => {
    // Insert user, verify passwordHash != original password
  });

  test('TC-DB-008: createdAt and updatedAt timestamps work', async () => {
    // Create user, verify timestamps exist and are valid dates
  });

  test('TC-DB-009: CASCADE delete works (org deletion cascades to users)', async () => {
    // Delete org, verify users are also deleted
  });

  test('TC-DB-010: Database indexes exist for performance', async () => {
    // Verify indexes on: users.email, users.organizationId
  });
});
```

**Success Criteria:** 10/10 tests pass

---

### 1.2 Organization Creation (Bare Minimum)

**Purpose:** Create organizations before users (users need organizationId)

#### Test Cases (15 tests)

```typescript
// Test File: server/__tests__/api/organizations.test.ts

describe('Organization Creation', () => {
  // HAPPY PATH
  test('TC-ORG-001: Create organization with valid data', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({
        name: 'Test Accounting Firm',
        industry: 'accounting',
        size: '1-10'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Test Accounting Firm');
  });

  // VALIDATION
  test('TC-ORG-002: Reject organization with missing name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ industry: 'accounting' });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('name');
  });

  test('TC-ORG-003: Reject organization with name < 2 characters', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: 'A' });
    
    expect(response.status).toBe(400);
  });

  test('TC-ORG-004: Reject organization with name > 100 characters', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: 'A'.repeat(101) });
    
    expect(response.status).toBe(400);
  });

  test('TC-ORG-005: Accept organization with special characters in name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: 'Smith & Associates, LLC' });
    
    expect(response.status).toBe(201);
  });

  // DUPLICATE HANDLING
  test('TC-ORG-006: Allow duplicate organization names (different entities)', async () => {
    await createOrg('ABC Accounting');
    const response = await createOrg('ABC Accounting');
    
    expect(response.status).toBe(201); // Should allow duplicates
  });

  // RETRIEVAL
  test('TC-ORG-007: Get organization by ID', async () => {
    const org = await createOrg('Test Firm');
    const response = await request(app).get(`/api/organizations/${org.id}`);
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Test Firm');
  });

  test('TC-ORG-008: Return 404 for non-existent organization', async () => {
    const response = await request(app).get('/api/organizations/99999');
    expect(response.status).toBe(404);
  });

  // UPDATE
  test('TC-ORG-009: Update organization name', async () => {
    const org = await createOrg('Old Name');
    const response = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .send({ name: 'New Name' });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('New Name');
  });

  // DELETE (will be restricted later by RBAC)
  test('TC-ORG-010: Delete organization', async () => {
    const org = await createOrg('To Delete');
    const response = await request(app).delete(`/api/organizations/${org.id}`);
    
    expect(response.status).toBe(204);
  });

  // EDGE CASES
  test('TC-ORG-011: Handle SQL injection attempt in name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: "'; DROP TABLE organizations; --" });
    
    expect(response.status).toBe(201); // Should sanitize and accept
    // Verify organizations table still exists
  });

  test('TC-ORG-012: Handle XSS attempt in name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: '<script>alert("xss")</script>' });
    
    expect(response.status).toBe(201);
    // Verify script tags are escaped
  });

  test('TC-ORG-013: Handle emoji in organization name', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: 'ABC Accounting 🚀' });
    
    expect(response.status).toBe(201);
  });

  test('TC-ORG-014: Handle Unicode characters (Chinese, Arabic, etc.)', async () => {
    const response = await request(app)
      .post('/api/organizations')
      .send({ name: '会计事务所' }); // Chinese characters
    
    expect(response.status).toBe(201);
  });

  test('TC-ORG-015: Verify timestamps (createdAt, updatedAt)', async () => {
    const org = await createOrg('Timestamp Test');
    expect(org.createdAt).toBeDefined();
    expect(org.updatedAt).toBeDefined();
    expect(new Date(org.createdAt)).toBeInstanceOf(Date);
  });
});
```

**Success Criteria:** 15/15 tests pass

---

### 1.3 User Profile Creation (ALL 4 ROLES)

**Purpose:** Create users with different roles BEFORE testing authentication

#### Test Cases (40 tests - 10 per role)

```typescript
// Test File: server/__tests__/api/users.test.ts

describe('User Creation - Owner Role', () => {
  let testOrg;

  beforeEach(async () => {
    testOrg = await createOrg('Test Firm');
  });

  // HAPPY PATH
  test('TC-USER-001: Create owner user with valid data', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'owner@test.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        role: 'owner',
        organizationId: testOrg.id
      });
    
    expect(response.status).toBe(201);
    expect(response.body.email).toBe('owner@test.com');
    expect(response.body.role).toBe('owner');
    expect(response.body.passwordHash).toBeUndefined(); // Never return password
  });

  // VALIDATION
  test('TC-USER-002: Reject user with invalid email format', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'not-an-email',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        organizationId: testOrg.id
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('email');
  });

  test('TC-USER-003: Reject user with weak password', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'owner@test.com',
        password: '123', // Too short
        firstName: 'John',
        lastName: 'Doe',
        organizationId: testOrg.id
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('password');
  });

  test('TC-USER-004: Reject duplicate email within same organization', async () => {
    await createUser({ email: 'duplicate@test.com', organizationId: testOrg.id });
    const response = await createUser({ email: 'duplicate@test.com', organizationId: testOrg.id });
    
    expect(response.status).toBe(409); // Conflict
  });

  test('TC-USER-005: Allow same email in different organizations', async () => {
    const org1 = await createOrg('Org 1');
    const org2 = await createOrg('Org 2');
    
    await createUser({ email: 'same@test.com', organizationId: org1.id });
    const response = await createUser({ email: 'same@test.com', organizationId: org2.id });
    
    expect(response.status).toBe(201); // Should allow
  });

  test('TC-USER-006: Verify password is hashed (bcrypt)', async () => {
    const response = await createUser({ 
      email: 'hash@test.com', 
      password: 'PlainPassword123' 
    });
    
    // Fetch user from database
    const user = await db.query.users.findFirst({ 
      where: eq(users.email, 'hash@test.com') 
    });
    
    expect(user.passwordHash).not.toBe('PlainPassword123');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt format
  });

  test('TC-USER-007: Reject user with missing organizationId', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'noorg@test.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      });
    
    expect(response.status).toBe(400);
  });

  test('TC-USER-008: Reject user with non-existent organizationId', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'invalid@test.com',
        password: 'SecurePass123!',
        organizationId: '99999' // Doesn't exist
      });
    
    expect(response.status).toBe(404);
  });

  test('TC-USER-009: Default role to "staff" if not provided', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'default@test.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        organizationId: testOrg.id
        // No role specified
      });
    
    expect(response.status).toBe(201);
    expect(response.body.role).toBe('staff');
  });

  test('TC-USER-010: Reject invalid role', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'bad@test.com',
        password: 'SecurePass123!',
        role: 'superadmin', // Not a valid role
        organizationId: testOrg.id
      });
    
    expect(response.status).toBe(400);
  });
});

// Repeat similar tests for Admin, Manager, Staff roles
describe('User Creation - Admin Role', () => {
  // TC-USER-011 to TC-USER-020: Same tests with role='admin'
});

describe('User Creation - Manager Role', () => {
  // TC-USER-021 to TC-USER-030: Same tests with role='manager'
});

describe('User Creation - Staff Role', () => {
  // TC-USER-031 to TC-USER-040: Same tests with role='staff'
});
```

**Success Criteria:** 40/40 tests pass

---

### 1.4 User Profile Management

**Purpose:** Update, retrieve, delete users

#### Test Cases (20 tests)

```typescript
describe('User Profile Management', () => {
  test('TC-PROFILE-001: Get user by ID', async () => {
    const user = await createUser({ email: 'get@test.com' });
    const response = await request(app).get(`/api/users/${user.id}`);
    
    expect(response.status).toBe(200);
    expect(response.body.email).toBe('get@test.com');
  });

  test('TC-PROFILE-002: Update user firstName', async () => {
    const user = await createUser({ email: 'update@test.com', firstName: 'Old' });
    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: 'New' });
    
    expect(response.status).toBe(200);
    expect(response.body.firstName).toBe('New');
  });

  test('TC-PROFILE-003: Update user lastName', async () => {
    // Similar to TC-PROFILE-002
  });

  test('TC-PROFILE-004: Update user email', async () => {
    const user = await createUser({ email: 'old@test.com' });
    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .send({ email: 'new@test.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.email).toBe('new@test.com');
  });

  test('TC-PROFILE-005: Prevent email update to existing email', async () => {
    await createUser({ email: 'existing@test.com' });
    const user = await createUser({ email: 'other@test.com' });
    
    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .send({ email: 'existing@test.com' });
    
    expect(response.status).toBe(409); // Conflict
  });

  test('TC-PROFILE-006: Cannot update role directly (security)', async () => {
    const user = await createUser({ email: 'staff@test.com', role: 'staff' });
    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .send({ role: 'owner' }); // Try to escalate
    
    expect(response.status).toBe(403); // Forbidden
  });

  test('TC-PROFILE-007: Cannot update organizationId (prevent org hopping)', async () => {
    const org1 = await createOrg('Org 1');
    const org2 = await createOrg('Org 2');
    const user = await createUser({ email: 'user@test.com', organizationId: org1.id });
    
    const response = await request(app)
      .patch(`/api/users/${user.id}`)
      .send({ organizationId: org2.id });
    
    expect(response.status).toBe(403); // Forbidden
  });

  test('TC-PROFILE-008: Upload profile picture', async () => {
    const user = await createUser({ email: 'pic@test.com' });
    const response = await request(app)
      .post(`/api/users/${user.id}/profile-picture`)
      .attach('file', 'test/fixtures/profile.jpg');
    
    expect(response.status).toBe(200);
    expect(response.body.profilePicture).toBeDefined();
  });

  test('TC-PROFILE-009: Reject profile picture > 5MB', async () => {
    const user = await createUser({ email: 'large@test.com' });
    const response = await request(app)
      .post(`/api/users/${user.id}/profile-picture`)
      .attach('file', 'test/fixtures/large-image.jpg'); // 6MB file
    
    expect(response.status).toBe(413); // Payload too large
  });

  test('TC-PROFILE-010: Reject non-image file for profile picture', async () => {
    const user = await createUser({ email: 'pdf@test.com' });
    const response = await request(app)
      .post(`/api/users/${user.id}/profile-picture`)
      .attach('file', 'test/fixtures/document.pdf');
    
    expect(response.status).toBe(400);
  });

  test('TC-PROFILE-011: Delete user', async () => {
    const user = await createUser({ email: 'delete@test.com' });
    const response = await request(app).delete(`/api/users/${user.id}`);
    
    expect(response.status).toBe(204);
    
    // Verify user no longer exists
    const getResponse = await request(app).get(`/api/users/${user.id}`);
    expect(getResponse.status).toBe(404);
  });

  test('TC-PROFILE-012: Soft delete vs hard delete', async () => {
    const user = await createUser({ email: 'soft@test.com' });
    await request(app).delete(`/api/users/${user.id}`);
    
    // Verify user is marked deleted but still in DB
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    
    expect(dbUser.deletedAt).toBeDefined(); // Soft delete
  });

  test('TC-PROFILE-013: List users in organization', async () => {
    const org = await createOrg('List Test');
    await createUser({ email: 'user1@test.com', organizationId: org.id });
    await createUser({ email: 'user2@test.com', organizationId: org.id });
    
    const response = await request(app).get(`/api/organizations/${org.id}/users`);
    
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
  });

  test('TC-PROFILE-014: Filter users by role', async () => {
    const org = await createOrg('Filter Test');
    await createUser({ email: 'owner@test.com', role: 'owner', organizationId: org.id });
    await createUser({ email: 'staff@test.com', role: 'staff', organizationId: org.id });
    
    const response = await request(app)
      .get(`/api/organizations/${org.id}/users?role=owner`);
    
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].role).toBe('owner');
  });

  test('TC-PROFILE-015: Pagination for user list', async () => {
    const org = await createOrg('Pagination Test');
    for (let i = 0; i < 25; i++) {
      await createUser({ email: `user${i}@test.com`, organizationId: org.id });
    }
    
    const response = await request(app)
      .get(`/api/organizations/${org.id}/users?page=1&limit=10`);
    
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(10);
    expect(response.body.total).toBe(25);
    expect(response.body.pages).toBe(3);
  });

  // Edge cases
  test('TC-PROFILE-016: Handle concurrent updates (optimistic locking)', async () => {
    const user = await createUser({ email: 'concurrent@test.com' });
    
    // Simulate two simultaneous updates
    const [update1, update2] = await Promise.all([
      request(app).patch(`/api/users/${user.id}`).send({ firstName: 'Update1' }),
      request(app).patch(`/api/users/${user.id}`).send({ firstName: 'Update2' })
    ]);
    
    // Both should succeed, last write wins
    expect([update1.status, update2.status]).toContain(200);
  });

  test('TC-PROFILE-017: Case-insensitive email lookup', async () => {
    await createUser({ email: 'CaseSensitive@test.com' });
    
    const response = await request(app)
      .get('/api/users/by-email?email=casesensitive@test.com');
    
    expect(response.status).toBe(200);
  });

  test('TC-PROFILE-018: Trim whitespace from email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        email: '  spaces@test.com  ',
        password: 'SecurePass123!',
        organizationId: testOrg.id
      });
    
    expect(response.status).toBe(201);
    expect(response.body.email).toBe('spaces@test.com'); // Trimmed
  });

  test('TC-PROFILE-019: Validate email domain (optional business rule)', async () => {
    // If you want to restrict to business emails only
    const response = await request(app)
      .post('/api/users')
      .send({
        email: 'test@gmail.com', // Consumer email
        password: 'SecurePass123!',
        organizationId: testOrg.id
      });
    
    // Decide: Allow or reject consumer emails?
    expect(response.status).toBe(201); // Currently allowing
  });

  test('TC-PROFILE-020: Verify updatedAt timestamp changes on update', async () => {
    const user = await createUser({ email: 'timestamp@test.com' });
    const originalUpdatedAt = user.updatedAt;
    
    await wait(1000); // Wait 1 second
    
    await request(app)
      .patch(`/api/users/${user.id}`)
      .send({ firstName: 'Updated' });
    
    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });
    
    expect(updated.updatedAt).not.toBe(originalUpdatedAt);
  });
});
```

**Success Criteria:** 20/20 tests pass

**LAYER 1 COMPLETE:** 85/85 tests pass ✅

---

## LAYER 2: Authentication Testing (Days 3-5)

### Prerequisites
- ✅ Layer 1 (Foundation) 100% passing
- ✅ At least 1 user of each role created

### 2.1 Login Flow

#### Test Cases (25 tests)

```typescript
// Test File: server/__tests__/auth/login.test.ts

describe('User Login', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await createUser({
      email: 'login@test.com',
      password: 'SecurePass123!',
      role: 'owner'
    });
  });

  // HAPPY PATH
  test('TC-LOGIN-001: Login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'SecurePass123!'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined(); // JWT token
    expect(response.body.user.email).toBe('login@test.com');
    expect(response.body.user.passwordHash).toBeUndefined(); // Never return
  });

  test('TC-LOGIN-002: Set JWT token in cookie', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'SecurePass123!'
      });
    
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('token=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly'); // Security
    expect(response.headers['set-cookie'][0]).toContain('Secure'); // HTTPS only
  });

  // VALIDATION
  test('TC-LOGIN-003: Reject login with incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'WrongPassword123!'
      });
    
    expect(response.status).toBe(401); // Unauthorized
    expect(response.body.error).toContain('Invalid credentials');
  });

  test('TC-LOGIN-004: Reject login with non-existent email', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'notexist@test.com',
        password: 'SecurePass123!'
      });
    
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid credentials'); // Generic message
  });

  test('TC-LOGIN-005: Case-insensitive email login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'LOGIN@test.com', // Uppercase
        password: 'SecurePass123!'
      });
    
    expect(response.status).toBe(200);
  });

  test('TC-LOGIN-006: Trim whitespace from email on login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: '  login@test.com  ',
        password: 'SecurePass123!'
      });
    
    expect(response.status).toBe(200);
  });

  // SECURITY
  test('TC-LOGIN-007: Rate limiting after failed login attempts', async () => {
    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'wrong' });
    }
    
    // 6th attempt should be rate limited
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    expect(response.status).toBe(429); // Too many requests
  });

  test('TC-LOGIN-008: Account lockout after 10 failed attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'wrong' });
    }
    
    // Even correct password should fail now
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    expect(response.status).toBe(423); // Locked
    expect(response.body.error).toContain('Account locked');
  });

  test('TC-LOGIN-009: JWT token expiration set to 24 hours', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    const token = response.body.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
  });

  test('TC-LOGIN-010: JWT token contains user ID and role', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    const token = response.body.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    expect(decoded.userId).toBe(testUser.id);
    expect(decoded.role).toBe('owner');
    expect(decoded.organizationId).toBe(testUser.organizationId);
  });

  // SESSION TRACKING
  test('TC-LOGIN-011: Create session record in database', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    const sessions = await db.query.sessions.findMany({
      where: eq(sessions.userId, testUser.id)
    });
    
    expect(sessions.length).toBeGreaterThan(0);
  });

  test('TC-LOGIN-012: Session includes IP address and user agent', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Test Browser')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.userId, testUser.id)
    });
    
    expect(session.ipAddress).toBeDefined();
    expect(session.userAgent).toBe('Test Browser');
  });

  // MULTI-DEVICE
  test('TC-LOGIN-013: Allow multiple concurrent sessions (multi-device)', async () => {
    const session1 = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Desktop Browser')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    const session2 = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mobile Browser')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    expect(session1.status).toBe(200);
    expect(session2.status).toBe(200);
    expect(session1.body.token).not.toBe(session2.body.token);
  });

  test('TC-LOGIN-014: List active sessions for user', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    const response = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${getToken()}`);
    
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(2);
  });

  // EDGE CASES
  test('TC-LOGIN-015: Reject login for deleted user', async () => {
    await request(app).delete(`/api/users/${testUser.id}`);
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    expect(response.status).toBe(401);
  });

  test('TC-LOGIN-016: Reject login for suspended user', async () => {
    await db.update(users)
      .set({ status: 'suspended' })
      .where(eq(users.id, testUser.id));
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'SecurePass123!' });
    
    expect(response.status).toBe(403); // Forbidden
    expect(response.body.error).toContain('suspended');
  });

  test('TC-LOGIN-017: Handle SQL injection in email field', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: "' OR '1'='1", // SQL injection attempt
        password: 'anything'
      });
    
    expect(response.status).toBe(401); // Should reject safely
  });

  test('TC-LOGIN-018: Handle very long password (1000+ chars)', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'a'.repeat(1000)
      });
    
    expect(response.status).toBe(401); // Should handle gracefully
  });

  test('TC-LOGIN-019: Handle Unicode characters in password', async () => {
    const user = await createUser({
      email: 'unicode@test.com',
      password: 'パスワード123!' // Japanese characters
    });
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'unicode@test.com',
        password: 'パスワード123!'
      });
    
    expect(response.status).toBe(200);
  });

  test('TC-LOGIN-020: Login timing should not reveal if email exists', async () => {
    // Login with existing email (wrong password)
    const start1 = Date.now();
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'wrong' });
    const time1 = Date.now() - start1;
    
    // Login with non-existent email
    const start2 = Date.now();
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'notexist@test.com', password: 'wrong' });
    const time2 = Date.now() - start2;
    
    // Times should be similar (timing attack prevention)
    expect(Math.abs(time1 - time2)).toBeLessThan(100); // Within 100ms
  });

  // REMEMBER ME
  test('TC-LOGIN-021: "Remember me" extends token expiration to 30 days', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'SecurePass123!',
        rememberMe: true
      });
    
    const token = response.body.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const expiresIn = decoded.exp - decoded.iat;
    expect(expiresIn).toBe(30 * 24 * 60 * 60); // 30 days
  });

  // 2FA (if implemented)
  test('TC-LOGIN-022: Require 2FA code for users with 2FA enabled', async () => {
    await db.update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, testUser.id));
    
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'SecurePass123!'
      });
    
    expect(response.status).toBe(202); // Accepted, waiting for 2FA
    expect(response.body.requires2FA).toBe(true);
  });

  test('TC-LOGIN-023: Reject invalid 2FA code', async () => {
    // First login step
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'SecurePass123!'
      });
    
    const tempToken = loginResponse.body.tempToken;
    
    // Second login step with wrong 2FA code
    const response = await request(app)
      .post('/api/auth/verify-2fa')
      .send({
        tempToken,
        code: '000000' // Wrong code
      });
    
    expect(response.status).toBe(401);
  });

  test('TC-LOGIN-024: Accept valid 2FA code', async () => {
    // Generate valid 2FA code
    const code = generateTOTP(testUser.twoFactorSecret);
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'SecurePass123!'
      });
    
    const response = await request(app)
      .post('/api/auth/verify-2fa')
      .send({
        tempToken: loginResponse.body.tempToken,
        code
      });
    
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  test('TC-LOGIN-025: 2FA backup codes work', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@test.com',
        password: 'SecurePass123!'
      });
    
    // Use backup code instead of TOTP
    const response = await request(app)
      .post('/api/auth/verify-2fa')
      .send({
        tempToken: loginResponse.body.tempToken,
        backupCode: testUser.backupCodes[0]
      });
    
    expect(response.status).toBe(200);
    
    // Backup code should be consumed (single-use)
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, testUser.id)
    });
    expect(updatedUser.backupCodes).not.toContain(testUser.backupCodes[0]);
  });
});
```

**Success Criteria:** 25/25 tests pass

---

### 2.2 Logout Flow

#### Test Cases (10 tests)

```typescript
describe('User Logout', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    testUser = await createUser({ email: 'logout@test.com' });
    const loginResponse = await login(testUser.email, 'SecurePass123!');
    authToken = loginResponse.token;
  });

  test('TC-LOGOUT-001: Logout invalidates token', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    
    // Try to use token after logout
    const protectedResponse = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(protectedResponse.status).toBe(401); // Token no longer valid
  });

  test('TC-LOGOUT-002: Logout clears cookie', async () => {
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('token=;');
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=0');
  });

  test('TC-LOGOUT-003: Logout deletes session from database', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);
    
    const sessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.userId, testUser.id),
        isNull(sessions.loggedOutAt)
      )
    });
    
    expect(sessions.length).toBe(0);
  });

  test('TC-LOGOUT-004: Logout only current session, not all sessions', async () => {
    // Login from two devices
    const token1 = (await login(testUser.email, 'SecurePass123!')).token;
    const token2 = (await login(testUser.email, 'SecurePass123!')).token;
    
    // Logout from device 1
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token1}`);
    
    // Device 2 should still work
    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token2}`);
    
    expect(response.status).toBe(200);
  });

  test('TC-LOGOUT-005: Logout from all sessions', async () => {
    // Login from two devices
    const token1 = (await login(testUser.email, 'SecurePass123!')).token;
    const token2 = (await login(testUser.email, 'SecurePass123!')).token;
    
    // Logout from all devices
    await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token1}`);
    
    // Both tokens should be invalid
    const response1 = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token1}`);
    
    const response2 = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token2}`);
    
    expect(response1.status).toBe(401);
    expect(response2.status).toBe(401);
  });

  test('TC-LOGOUT-006: Cannot logout without authentication', async () => {
    const response = await request(app).post('/api/auth/logout');
    expect(response.status).toBe(401);
  });

  test('TC-LOGOUT-007: Cannot logout with expired token', async () => {
    const expiredToken = generateExpiredToken(testUser.id);
    
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${expiredToken}`);
    
    expect(response.status).toBe(401);
  });

  test('TC-LOGOUT-008: Logout records timestamp', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);
    
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.userId, testUser.id)
    });
    
    expect(session.loggedOutAt).toBeDefined();
    expect(new Date(session.loggedOutAt)).toBeInstanceOf(Date);
  });

  test('TC-LOGOUT-009: Double logout is idempotent', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);
    
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(401); // Already logged out
  });

  test('TC-LOGOUT-010: Logout from specific session by ID', async () => {
    const token1 = (await login(testUser.email, 'SecurePass123!')).token;
    const token2 = (await login(testUser.email, 'SecurePass123!')).token;
    
    const sessions = await db.query.sessions.findMany({
      where: eq(sessions.userId, testUser.id)
    });
    
    // Logout specific session
    await request(app)
      .delete(`/api/auth/sessions/${sessions[0].id}`)
      .set('Authorization', `Bearer ${token1}`);
    
    // That token should be invalid
    const response1 = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token1}`);
    expect(response1.status).toBe(401);
    
    // Other token still works
    const response2 = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token2}`);
    expect(response2.status).toBe(200);
  });
});
```

**Success Criteria:** 10/10 tests pass

---

### 2.3 Password Reset Flow

#### Test Cases (15 tests)

```typescript
describe('Password Reset', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await createUser({ email: 'reset@test.com' });
  });

  // REQUEST RESET
  test('TC-RESET-001: Request password reset sends email', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('sent');
    
    // Verify email was sent (mock or check email service)
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'reset@test.com',
        subject: expect.stringContaining('Password Reset')
      })
    );
  });

  test('TC-RESET-002: Reset token saved to database', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'reset@test.com')
    });
    
    expect(user.resetToken).toBeDefined();
    expect(user.resetTokenExpires).toBeDefined();
  });

  test('TC-RESET-003: Reset token expires in 1 hour', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'reset@test.com')
    });
    
    const expiresIn = new Date(user.resetTokenExpires) - new Date();
    expect(expiresIn).toBeGreaterThan(59 * 60 * 1000); // ~59 min
    expect(expiresIn).toBeLessThan(61 * 60 * 1000); // ~61 min
  });

  test('TC-RESET-004: Generic response for non-existent email (security)', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'notexist@test.com' });
    
    // Should return 200 even if email doesn't exist (prevent email enumeration)
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('sent'); // Generic message
  });

  test('TC-RESET-005: Rate limit password reset requests', async () => {
    // Send 3 reset requests
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@test.com' });
    }
    
    // 4th request should be rate limited
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    expect(response.status).toBe(429);
  });

  // RESET PASSWORD
  test('TC-RESET-006: Reset password with valid token', async () => {
    // Request reset
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'reset@test.com')
    });
    
    // Reset password
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: user.resetToken,
        newPassword: 'NewSecurePass123!'
      });
    
    expect(response.status).toBe(200);
    
    // Verify can login with new password
    const loginResponse = await login('reset@test.com', 'NewSecurePass123!');
    expect(loginResponse.status).toBe(200);
  });

  test('TC-RESET-007: Reject expired reset token', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'reset@test.com')
    });
    
    // Manually expire the token
    await db.update(users)
      .set({ resetTokenExpires: new Date(Date.now() - 1000) }) // 1 second ago
      .where(eq(users.id, user.id));
    
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: user.resetToken,
        newPassword: 'NewSecurePass123!'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('expired');
  });

  test('TC-RESET-008: Reject invalid reset token', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-token-12345',
        newPassword: 'NewSecurePass123!'
      });
    
    expect(response.status).toBe(400);
  });

  test('TC-RESET-009: Reset token is single-use', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'reset@test.com')
    });
    
    // Use token once
    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: user.resetToken,
        newPassword: 'NewSecurePass123!'
      });
    
    // Try to use same token again
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: user.resetToken,
        newPassword: 'AnotherPass123!'
      });
    
    expect(response.status).toBe(400);
  });

  test('TC-RESET-010: Reset password validates new password strength', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'reset@test.com')
    });
    
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: user.resetToken,
        newPassword: '123' // Weak password
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('password');
  });

  test('TC-RESET-011: Reset password invalidates all existing sessions', async () => {
    // Login and get token
    const loginResponse = await login('reset@test.com', 'SecurePass123!');
    const oldToken = loginResponse.token;
    
    // Request reset
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'reset@test.com')
    });
    
    // Reset password
    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: user.resetToken,
        newPassword: 'NewSecurePass123!'
      });
    
    // Old token should no longer work
    const response = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${oldToken}`);
    
    expect(response.status).toBe(401);
  });

  test('TC-RESET-012: Reset token is cryptographically random', async () => {
    const tokens = new Set();
    
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@test.com' });
      
      const user = await db.query.users.findFirst({
        where: eq(users.email, 'reset@test.com')
      });
      
      tokens.add(user.resetToken);
    }
    
    // All tokens should be unique
    expect(tokens.size).toBe(100);
  });

  test('TC-RESET-013: Reset email contains secure link', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    const emailCall = emailService.sendEmail.mock.calls[0][0];
    expect(emailCall.html).toContain('https://'); // Secure link
    expect(emailCall.html).toContain('/reset-password?token=');
  });

  test('TC-RESET-014: Cannot request reset for suspended user', async () => {
    await db.update(users)
      .set({ status: 'suspended' })
      .where(eq(users.email, 'reset@test.com'));
    
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    // Should still return 200 (generic response) but no email sent
    expect(response.status).toBe(200);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  test('TC-RESET-015: Cannot request reset for deleted user', async () => {
    await request(app).delete(`/api/users/${testUser.id}`);
    
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@test.com' });
    
    expect(response.status).toBe(200); // Generic response
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });
});
```

**Success Criteria:** 15/15 tests pass

**LAYER 2 COMPLETE:** 50/50 tests pass ✅

---

## LAYER 3: Authorization (RBAC) Testing (Days 6-10)

### Prerequisites
- ✅ Layer 1 & 2 (Foundation + Authentication) 100% passing
- ✅ Users created for all 4 roles

### 3.1 Role Permissions Matrix

```
┌──────────────────────┬────────┬────────┬──────────┬────────┐
│ Resource/Action      │ Owner  │ Admin  │ Manager  │ Staff  │
├──────────────────────┼────────┼────────┼──────────┼────────┤
│ View organization    │   ✓    │   ✓    │    ✓     │   ✓    │
│ Edit organization    │   ✓    │   ✓    │    ✗     │   ✗    │
│ Delete organization  │   ✓    │   ✗    │    ✗     │   ✗    │
│ View all users       │   ✓    │   ✓    │    ✓     │   ✗    │
│ Create user          │   ✓    │   ✓    │    ✗     │   ✗    │
│ Edit any user        │   ✓    │   ✓    │    ✗     │   ✗    │
│ Delete any user      │   ✓    │   ✗    │    ✗     │   ✗    │
│ Edit own profile     │   ✓    │   ✓    │    ✓     │   ✓    │
│ Change own password  │   ✓    │   ✓    │    ✓     │   ✓    │
│ Manage billing       │   ✓    │   ✗    │    ✗     │   ✗    │
│ View clients         │   ✓    │   ✓    │    ✓     │   ✓*   │
│ Create client        │   ✓    │   ✓    │    ✓     │   ✓    │
│ Edit any client      │   ✓    │   ✓    │    ✓     │   ✗    │
│ Delete client        │   ✓    │   ✓    │    ✗     │   ✗    │
│ AI agents (all)      │   ✓    │   ✓    │    ✓     │   ✓    │
│ Workflows            │   ✓    │   ✓    │    ✓     │   ✓*   │
│ Reports              │   ✓    │   ✓    │    ✓     │   ✓*   │
└──────────────────────┴────────┴────────┴──────────┴────────┘

* Staff can only view/edit resources assigned to them
```

### 3.2 Owner Role Tests

#### Test Cases (10 tests)

```typescript
describe('RBAC - Owner Role', () => {
  let owner, admin, manager, staff;
  let org;
  let ownerToken;

  beforeEach(async () => {
    org = await createOrg('RBAC Test Firm');
    owner = await createUser({ email: 'owner@test.com', role: 'owner', organizationId: org.id });
    admin = await createUser({ email: 'admin@test.com', role: 'admin', organizationId: org.id });
    manager = await createUser({ email: 'manager@test.com', role: 'manager', organizationId: org.id });
    staff = await createUser({ email: 'staff@test.com', role: 'staff', organizationId: org.id });
    
    ownerToken = (await login('owner@test.com', 'SecurePass123!')).token;
  });

  test('TC-OWNER-001: Owner can view organization', async () => {
    const response = await request(app)
      .get(`/api/organizations/${org.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(200);
  });

  test('TC-OWNER-002: Owner can edit organization', async () => {
    const response = await request(app)
      .patch(`/api/organizations/${org.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Updated Name' });
    
    expect(response.status).toBe(200);
  });

  test('TC-OWNER-003: Owner can delete organization', async () => {
    const response = await request(app)
      .delete(`/api/organizations/${org.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(204);
  });

  test('TC-OWNER-004: Owner can view all users in organization', async () => {
    const response = await request(app)
      .get(`/api/organizations/${org.id}/users`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(4); // All 4 users
  });

  test('TC-OWNER-005: Owner can create new user', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'newuser@test.com',
        password: 'SecurePass123!',
        role: 'staff',
        organizationId: org.id
      });
    
    expect(response.status).toBe(201);
  });

  test('TC-OWNER-006: Owner can edit any user', async () => {
    const response = await request(app)
      .patch(`/api/users/${staff.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Updated' });
    
    expect(response.status).toBe(200);
  });

  test('TC-OWNER-007: Owner can delete any user', async () => {
    const response = await request(app)
      .delete(`/api/users/${staff.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(204);
  });

  test('TC-OWNER-008: Owner can change user roles', async () => {
    const response = await request(app)
      .patch(`/api/users/${staff.id}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'manager' });
    
    expect(response.status).toBe(200);
  });

  test('TC-OWNER-009: Owner can manage billing', async () => {
    const response = await request(app)
      .get(`/api/billing/subscription`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(200);
  });

  test('TC-OWNER-010: Owner cannot access other organization', async () => {
    const otherOrg = await createOrg('Other Firm');
    
    const response = await request(app)
      .get(`/api/organizations/${otherOrg.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(response.status).toBe(403); // Forbidden
  });
});
```

### 3.3 Admin Role Tests (10 tests)
### 3.4 Manager Role Tests (10 tests)
### 3.5 Staff Role Tests (10 tests)
### 3.6 Cross-Organization Access Prevention (10 tests)

**Success Criteria:** 50/50 tests pass

**LAYER 3 COMPLETE:** 50/50 tests pass ✅

---

## LAYER 4: Security & Edge Cases (Days 11-12)

### 4.1 Attack Vectors

#### Test Cases (52 tests)

```typescript
describe('Security - Attack Vectors', () => {
  // SQL INJECTION (10 tests)
  test('TC-SEC-001: SQL injection in login email', async () => { /* ... */ });
  test('TC-SEC-002: SQL injection in user creation', async () => { /* ... */ });
  // ... 8 more SQL injection tests
  
  // XSS (10 tests)
  test('TC-SEC-011: XSS in organization name', async () => { /* ... */ });
  test('TC-SEC-012: XSS in user firstName/lastName', async () => { /* ... */ });
  // ... 8 more XSS tests
  
  // CSRF (10 tests)
  test('TC-SEC-021: CSRF protection on state-changing operations', async () => { /* ... */ });
  // ... 9 more CSRF tests
  
  // SESSION HIJACKING (10 tests)
  test('TC-SEC-031: Token theft prevention', async () => { /* ... */ });
  test('TC-SEC-032: Session fixation prevention', async () => { /* ... */ });
  // ... 8 more session hijacking tests
  
  // BRUTE FORCE (10 tests)
  test('TC-SEC-041: Login rate limiting', async () => { /* ... */ });
  test('TC-SEC-042: Password reset rate limiting', async () => { /* ... */ });
  // ... 8 more brute force tests
  
  // PRIVILEGE ESCALATION (2 tests)
  test('TC-SEC-051: Cannot escalate role via API', async () => { /* ... */ });
  test('TC-SEC-052: Cannot escalate organizationId', async () => { /* ... */ });
});
```

**Success Criteria:** 52/52 tests pass

**LAYER 4 COMPLETE:** 52/52 tests pass ✅

---

## LAYER 5: Integration Testing (Days 13-14)

### 5.1 Complete User Journeys

#### E2E Test Cases (50 tests using Playwright)

```typescript
describe('E2E - Complete User Journeys', () => {
  test('TC-E2E-001: New firm owner signs up and invites team', async ({ page }) => {
    // 1. Create organization
    // 2. Owner creates account
    // 3. Owner logs in
    // 4. Owner invites admin, manager, staff
    // 5. Invitees receive emails
    // 6. Invitees set passwords
    // 7. Invitees log in
    // 8. Verify all have correct permissions
  });
  
  test('TC-E2E-002: Staff member attempts unauthorized access', async ({ page }) => {
    // 1. Staff logs in
    // 2. Tries to access billing page → blocked
    // 3. Tries to edit other user → blocked
    // 4. Tries to delete client → blocked
    // 5. Can edit own profile → success
  });
  
  // ... 48 more E2E tests
});
```

**Success Criteria:** 50/50 tests pass

**LAYER 5 COMPLETE:** 50/50 tests pass ✅

---

## Tools & Infrastructure

### Testing Framework
```bash
# Install dependencies
npm install --save-dev \
  jest \
  supertest \
  @types/jest \
  @types/supertest \
  playwright \
  @playwright/test
```

### Test Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

```typescript
// server/__tests__/setup.ts
import { db } from '../db';
import { users, organizations, sessions } from '@shared/schema';

beforeEach(async () => {
  // Clear all tables before each test
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(organizations);
});

afterAll(async () => {
  // Close database connection
  await db.$client.end();
});
```

### Helper Functions

```typescript
// server/__tests__/helpers.ts

export async function createOrg(name: string) {
  const [org] = await db.insert(organizations)
    .values({ name })
    .returning();
  return org;
}

export async function createUser(data: {
  email: string;
  password?: string;
  role?: string;
  organizationId?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password || 'SecurePass123!', 10);
  
  const [user] = await db.insert(users)
    .values({
      email: data.email,
      passwordHash,
      role: data.role || 'staff',
      organizationId: data.organizationId || (await createOrg('Test Org')).id,
      firstName: 'Test',
      lastName: 'User'
    })
    .returning();
  
  return user;
}

export async function login(email: string, password: string) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  
  return {
    status: response.status,
    token: response.body.token,
    user: response.body.user
  };
}
```

---

## Implementation Workflow

### Week 1: Foundation & Authentication
**Days 1-2: Foundation**
- [ ] Implement database schema tests
- [ ] Implement organization CRUD tests
- [ ] Implement user creation tests (all 4 roles)
- [ ] Implement user profile management tests
- **Target:** 85 tests passing

**Days 3-5: Authentication**
- [ ] Implement login tests
- [ ] Implement logout tests
- [ ] Implement password reset tests
- [ ] Implement session management tests
- **Target:** 135 tests passing (85 + 50)

### Week 2: Authorization & Security
**Days 6-10: RBAC**
- [ ] Implement Owner role tests
- [ ] Implement Admin role tests
- [ ] Implement Manager role tests
- [ ] Implement Staff role tests
- [ ] Implement cross-organization access tests
- **Target:** 185 tests passing (135 + 50)

**Days 11-12: Security**
- [ ] Implement SQL injection tests
- [ ] Implement XSS tests
- [ ] Implement CSRF tests
- [ ] Implement session hijacking tests
- [ ] Implement brute force tests
- **Target:** 237 tests passing (185 + 52)

**Days 13-14: Integration**
- [ ] Implement E2E tests with Playwright
- [ ] Test complete user journeys
- [ ] Performance testing
- **Target:** 287 tests passing (237 + 50)

---

## Success Criteria

### Code Coverage
- **Unit Tests:** > 95% coverage on auth logic
- **Integration Tests:** > 90% coverage on API routes
- **E2E Tests:** 100% of critical user flows

### Performance
- Login response time: < 500ms (p95)
- Session validation: < 50ms (p95)
- RBAC check: < 10ms (p95)

### Security
- Zero SQL injection vulnerabilities
- Zero XSS vulnerabilities
- Zero CSRF vulnerabilities
- OWASP Top 10 compliance

---

## Next Steps

1. **Review this plan** - Ensure all stakeholders agree
2. **Set up testing infrastructure** - Install Jest, Supertest, Playwright
3. **Create test database** - Separate from development/production
4. **Start Layer 1** - Foundation tests (Days 1-2)
5. **Daily standup** - Review progress, blockers

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Owner:** QA Lead / CTO  
**Status:** 📋 READY FOR IMPLEMENTATION
