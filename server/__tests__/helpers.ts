import { testDb as db } from '../test-db';
import { users, organizations, roles, permissions, rolePermissions, type User, type Organization, type Role } from '@shared/schema';
import request from 'supertest';
import app from '../test-app'; // Use test-friendly app export
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Cache for role IDs
let roleCache: Map<string, string> | null = null;
let ensureRolesPromise: Promise<Map<string, string>> | null = null;

/**
 * Clear role cache (called during test cleanup)
 */
export function clearRoleCache(): void {
  roleCache = null;
  ensureRolesPromise = null;
}

/**
 * Helper to get roleId from role name (for use in tests)
 */
export async function getRoleId(roleName: 'owner' | 'admin' | 'manager' | 'staff'): Promise<string> {
  const roleMap = await ensureRolesExist();
  const roleId = roleMap.get(roleName);
  
  if (!roleId) {
    throw new Error(`Role ${roleName} not found`);
  }
  
  return roleId;
}

/**
 * Get or create roles for testing (creates test roles with permissions)
 * IDEMPOTENT: Safe to call multiple times, handles existing roles/permissions
 * THREAD-SAFE: Uses promise to prevent concurrent execution
 */
async function ensureRolesExist(): Promise<Map<string, string>> {
  // Return cached result if available
  if (roleCache) {
    return roleCache;
  }
  
  // If another call is in progress, wait for it
  if (ensureRolesPromise) {
    return ensureRolesPromise;
  }
  
  // Start the initialization and cache the promise
  ensureRolesPromise = (async () => {
    roleCache = new Map<string, string>();
  
  // Define test roles (needed for RBAC tests)
  const testRoles = [
    { name: 'owner', description: 'Organization owner', scope: 'tenant', isSystemRole: true },
    { name: 'admin', description: 'Organization admin', scope: 'tenant', isSystemRole: true },
    { name: 'manager', description: 'Team manager', scope: 'tenant', isSystemRole: true },
    { name: 'staff', description: 'Staff member', scope: 'tenant', isSystemRole: true }
  ];
  
  // Create or get test roles (idempotent - uses onConflictDoNothing)
  for (const roleData of testRoles) {
    const existing = await db.select().from(roles).where(eq(roles.name, roleData.name));
    if (existing.length > 0) {
      roleCache.set(roleData.name, existing[0].id);
    } else {
      try {
        const [newRole] = await db.insert(roles).values(roleData).onConflictDoNothing().returning();
        if (newRole) {
          roleCache.set(roleData.name, newRole.id);
        } else {
          // Race condition: role was created by another test, fetch it
          const refetch = await db.select().from(roles).where(eq(roles.name, roleData.name));
          if (refetch.length > 0) {
            roleCache.set(roleData.name, refetch[0].id);
          }
        }
      } catch (e) {
        // Fallback: fetch existing role
        const refetch = await db.select().from(roles).where(eq(roles.name, roleData.name));
        if (refetch.length > 0) {
          roleCache.set(roleData.name, refetch[0].id);
        }
      }
    }
  }
  
  // Define baseline permissions (DOT notation)
  const basePermissions = [
    { name: 'users.create', resource: 'users', action: 'create', description: 'Create users' },
    { name: 'users.edit', resource: 'users', action: 'edit', description: 'Edit users' },
    { name: 'users.delete', resource: 'users', action: 'delete', description: 'Delete users' },
    { name: 'users.view', resource: 'users', action: 'view', description: 'View users' },
    { name: 'organization.edit', resource: 'organization', action: 'edit', description: 'Edit org' },
    { name: 'organization.delete', resource: 'organization', action: 'delete', description: 'Delete org' },
    { name: 'organization.billing', resource: 'organization', action: 'billing', description: 'View billing' },
    { name: 'organization.transfer', resource: 'organization', action: 'transfer', description: 'Transfer ownership' },
    { name: 'clients.create', resource: 'clients', action: 'create', description: 'Create clients' },
    { name: 'clients.edit', resource: 'clients', action: 'edit', description: 'Edit clients' },
    { name: 'clients.delete', resource: 'clients', action: 'delete', description: 'Delete clients' },
    { name: 'clients.view', resource: 'clients', action: 'view', description: 'View clients' },
  ];
  
  // Create or get permissions (idempotent - uses onConflictDoNothing)
  const permissionMap = new Map<string, string>();
  for (const perm of basePermissions) {
    const existing = await db.select().from(permissions).where(eq(permissions.name, perm.name));
    if (existing.length > 0) {
      permissionMap.set(perm.name, existing[0].id);
    } else {
      try {
        const [newPerm] = await db.insert(permissions).values(perm).onConflictDoNothing().returning();
        if (newPerm) {
          permissionMap.set(perm.name, newPerm.id);
        } else {
          // Race condition: fetch existing
          const refetch = await db.select().from(permissions).where(eq(permissions.name, perm.name));
          if (refetch.length > 0) {
            permissionMap.set(perm.name, refetch[0].id);
          }
        }
      } catch (e) {
        // Fallback: fetch existing
        const refetch = await db.select().from(permissions).where(eq(permissions.name, perm.name));
        if (refetch.length > 0) {
          permissionMap.set(perm.name, refetch[0].id);
        }
      }
    }
  }
  
  // Assign permissions to roles (idempotent - uses onConflictDoNothing)
  const ownerRoleId = roleCache.get('owner');
  const adminRoleId = roleCache.get('admin');
  const managerRoleId = roleCache.get('manager');
  const staffRoleId = roleCache.get('staff');
  
  // Verify all roles exist (safety check)
  if (!ownerRoleId || !adminRoleId || !managerRoleId || !staffRoleId) {
    throw new Error(`Missing roles in cache: owner=${!!ownerRoleId}, admin=${!!adminRoleId}, manager=${!!managerRoleId}, staff=${!!staffRoleId}`);
  }
  
  // Verify roles exist in database (additional safety check for concurrency)
  const roleVerification = await db.select().from(roles).where(
    eq(roles.id, ownerRoleId)
  );
  if (roleVerification.length === 0) {
    throw new Error(`Owner role ${ownerRoleId} not found in database - possible race condition`);
  }
  
  // Check which assignments already exist to avoid duplicates
  const existingAssignments = await db.select().from(rolePermissions);
  const assignmentSet = new Set(
    existingAssignments.map(a => `${a.roleId}:${a.permissionId}`)
  );
  
  const assignments = [];
  
  // Owner gets ALL permissions (only add if not exists)
  for (const permId of permissionMap.values()) {
    const key = `${ownerRoleId}:${permId}`;
    if (!assignmentSet.has(key)) {
      assignments.push({ roleId: ownerRoleId, permissionId: permId });
    }
  }
  
  // Admin gets most (no org delete/transfer)
  const adminPerms = ['users.create', 'users.edit', 'users.delete', 'users.view', 
    'organization.edit', 'organization.billing', 
    'clients.create', 'clients.edit', 'clients.delete', 'clients.view'];
  for (const permName of adminPerms) {
    if (permissionMap.has(permName)) {
      const permId = permissionMap.get(permName)!;
      const key = `${adminRoleId}:${permId}`;
      if (!assignmentSet.has(key)) {
        assignments.push({ roleId: adminRoleId, permissionId: permId });
      }
    }
  }
  
  // Manager gets team + client perms
  const managerPerms = ['users.view', 'users.edit', 'clients.create', 'clients.edit', 'clients.view'];
  for (const permName of managerPerms) {
    if (permissionMap.has(permName)) {
      const permId = permissionMap.get(permName)!;
      const key = `${managerRoleId}:${permId}`;
      if (!assignmentSet.has(key)) {
        assignments.push({ roleId: managerRoleId, permissionId: permId });
      }
    }
  }
  
  // Staff gets minimal perms
  const staffPerms = ['users.edit', 'clients.view'];
  for (const permName of staffPerms) {
    if (permissionMap.has(permName)) {
      const permId = permissionMap.get(permName)!;
      const key = `${staffRoleId}:${permId}`;
      if (!assignmentSet.has(key)) {
        assignments.push({ roleId: staffRoleId, permissionId: permId });
      }
    }
  }
  
    // Insert all assignments
    if (assignments.length > 0) {
      await db.insert(rolePermissions).values(assignments).onConflictDoNothing();
    }
    
    return roleCache;
  })(); // Close the async IIFE
  
  return ensureRolesPromise;
}

/**
 * Helper function to create a test organization via API
 */
export async function createOrgAPI(data: {
  name?: string;
  industry?: string;
  size?: string;
  token?: string;
} = {}): Promise<{ status: number; org?: Organization; body: any }> {
  const req = request(app).post('/api/organizations').send({
    name: data.name || `Test Org ${Date.now()}`,
    slug: `test-org-${Date.now()}`,
    industry: data.industry || 'accounting',
    size: data.size || '1-10'
  });

  if (data.token) {
    req.set('Authorization', `Bearer ${data.token}`);
  }

  const response = await req;
  
  return {
    status: response.status,
    org: response.body,
    body: response.body
  };
}

/**
 * Helper function to create a test user via API
 */
export async function createUserAPI(data: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'owner' | 'admin' | 'manager' | 'staff';
  organizationId?: string;
  token?: string;
} = {}): Promise<{ status: number; user?: User; body: any }> {
  const password = data.password || 'SecurePass123!';
  const email = data.email || `test${Date.now()}@test.com`;
  
  // If no token provided, create via database directly (for tests)
  // This allows tests to create users without authentication
  if (!data.token) {
    const user = await createUser({
      email,
      password,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'User',
      role: data.role,
      organizationId: data.organizationId
    });
    
    return { status: 201, user, body: { user } };
  }

  // Otherwise, use API endpoint with authentication
  // Get role ID from role name
  const roleMap = await ensureRolesExist();
  const roleName = data.role || 'staff';
  const roleId = roleMap.get(roleName);
  
  if (!roleId) {
    throw new Error(`Role ${roleName} not found`);
  }
  
  const payload: any = {
    email,
    password,
    username: email.split('@')[0] + Date.now(),
    firstName: data.firstName || 'Test',
    lastName: data.lastName || 'User',
    roleId,
  };

  if (data.organizationId) {
    payload.organizationId = data.organizationId;
  }

  const endpoint = '/api/users';
  const req = request(app).post(endpoint).send(payload);
  req.set('Authorization', `Bearer ${data.token}`);
  const response = await req;
  
  return {
    status: response.status,
    user: response.body,
    body: response.body
  };
}

/**
 * Helper function to login and get JWT token
 */
export async function login(email: string, password: string): Promise<{
  status: number;
  token?: string;
  user?: any;
  body: any;
}> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return {
    status: response.status,
    token: response.body.token,
    user: response.body.user,
    body: response.body
  };
}

/**
 * Helper function to logout
 */
export async function logout(token: string): Promise<{
  status: number;
  body: any;
}> {
  const response = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${token}`);

  return {
    status: response.status,
    body: response.body
  };
}

/**
 * Helper function to create authenticated user and return token
 */
export async function createAuthenticatedUser(data: {
  email?: string;
  password?: string;
  role?: 'owner' | 'admin' | 'manager' | 'staff';
  organizationId?: string;
} = {}): Promise<{ user: User; token: string; password: string }> {
  const password = data.password || 'SecurePass123!';
  
  // Create user via API
  const createResult = await createUserAPI({
    ...data,
    password
  });

  if (createResult.status !== 201 || !createResult.user) {
    throw new Error(`Failed to create user: ${createResult.status} - ${JSON.stringify(createResult.body)}`);
  }

  // Login to get token
  const loginResponse = await login(createResult.user.email, password);

  if (!loginResponse.token) {
    throw new Error(`Failed to get authentication token: ${JSON.stringify(loginResponse.body)}`);
  }

  return {
    user: createResult.user,
    token: loginResponse.token,
    password
  };
}

/**
 * Helper function to make authenticated API request
 */
export function authenticatedRequest(token: string) {
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`)
  };
}

/**
 * Helper function to wait/delay
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * DATABASE DIRECT HELPERS - For test setup and verification
 */

/**
 * Helper function to create organization directly in database
 */
export async function createOrg(data: {
  name?: string;
  slug?: string;
  industry?: string;
  size?: string;
} = {}): Promise<Organization> {
  const [org] = await db.insert(organizations).values({
    name: data.name || `Test Org ${Date.now()}`,
    slug: data.slug || `test-org-${Date.now()}`,
    industry: data.industry || 'accounting',
    size: data.size || '1-10'
  }).returning();
  
  return org;
}

/**
 * Helper function to create user directly in database
 */
export async function createUser(data: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'owner' | 'admin' | 'manager' | 'staff';
  organizationId?: string;
  status?: 'active' | 'inactive' | 'suspended';
} = {}): Promise<User> {
  // Ensure roles exist and get role ID
  const roleMap = await ensureRolesExist();
  const roleName = data.role || 'staff';
  const roleId = roleMap.get(roleName);
  
  if (!roleId) {
    throw new Error(`Role ${roleName} not found`);
  }
  
  // Create organization if not provided
  let orgId = data.organizationId;
  if (!orgId) {
    const org = await createOrg();
    orgId = org.id;
  }
  
  const plainPassword = data.password || 'SecurePass123!';
  const password = await bcrypt.hash(plainPassword, 10);
  const email = data.email || `test${Date.now()}@test.com`;
  const username = email.split('@')[0] + Date.now();
  
  const [user] = await db.insert(users).values({
    email,
    username,
    password,
    firstName: data.firstName || 'Test',
    lastName: data.lastName || 'User',
    roleId,
    organizationId: orgId,
    isActive: data.status === 'active' || data.status === undefined
  }).returning();
  
  return user;
}

/**
 * Helper function to get user by email (for verification)
 */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  return await db.query.users.findFirst({
    where: eq(users.email, email)
  });
}

/**
 * Helper function to get organization by ID (for verification)
 */
export async function getOrgById(id: string): Promise<Organization | undefined> {
  return await db.query.organizations.findFirst({
    where: eq(organizations.id, id)
  });
}

/**
 * Helper function to get all users (for verification)
 */
export async function getAllUsers(): Promise<User[]> {
  return await db.query.users.findMany();
}

/**
 * Helper function to get all organizations (for verification)
 */
export async function getAllOrgs(): Promise<Organization[]> {
  return await db.query.organizations.findMany();
}

/**
 * Helper to request password reset
 */
export async function requestPasswordReset(email: string): Promise<{
  status: number;
  body: any;
}> {
  const response = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email });

  return {
    status: response.status,
    body: response.body
  };
}

/**
 * Helper to reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<{
  status: number;
  body: any;
}> {
  const response = await request(app)
    .post('/api/auth/reset-password')
    .send({ token, newPassword });

  return {
    status: response.status,
    body: response.body
  };
}

/**
 * Helper to verify password hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Create a test context with organization, owner, and role IDs
 * Perfect for starting tests
 */
export async function createTestContext() {
  const roleMap = await ensureRolesExist();
  
  const ownerRoleId = roleMap.get('owner')!;
  const adminRoleId = roleMap.get('admin')!;
  const managerRoleId = roleMap.get('manager')!;
  const staffRoleId = roleMap.get('staff')!;
  
  // Create organization
  const testOrg = await createOrg({
    name: 'Test Organization',
    slug: `test-org-${Date.now()}`
  });
  
  // Create owner user
  const ownerUser = await createUser({
    email: `owner-${Date.now()}@test.com`,
    password: 'SecurePass123!',
    firstName: 'Owner',
    lastName: 'User',
    role: 'owner',
    organizationId: testOrg.id
  });
  
  // Login to get token
  const loginResp = await login(ownerUser.email, 'SecurePass123!');
  
  return {
    testOrg: {
      ...testOrg,
      ownerRoleId,
      adminRoleId,
      managerRoleId,
      staffRoleId
    },
    ownerUser,
    ownerToken: loginResp.token!,
    roleIds: {
      owner: ownerRoleId,
      admin: adminRoleId,
      manager: managerRoleId,
      staff: staffRoleId
    }
  };
}

/**
 * Create organization with owner user
 */
export async function createOrgWithOwner(data: {
  orgName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
}) {
  const roleMap = await ensureRolesExist();
  
  // Create organization
  const testOrg = await createOrg({
    name: data.orgName || `Test Org ${Date.now()}`,
    slug: `test-org-${Date.now()}`
  });
  
  // Create owner user
  const ownerUser = await createUser({
    email: data.ownerEmail || `owner-${Date.now()}@test.com`,
    password: data.ownerPassword || 'SecurePass123!',
    firstName: data.ownerFirstName || 'Owner',
    lastName: data.ownerLastName || 'User',
    role: 'owner',
    organizationId: testOrg.id
  });
  
  // Login to get token
  const loginResp = await login(ownerUser.email, data.ownerPassword || 'SecurePass123!');
  
  return {
    testOrg: {
      ...testOrg,
      ownerRoleId: roleMap.get('owner')!,
      adminRoleId: roleMap.get('admin')!,
      managerRoleId: roleMap.get('manager')!,
      staffRoleId: roleMap.get('staff')!
    },
    ownerUser,
    ownerToken: loginResp.token!
  };
}

/**
 * Create user in organization
 * Can accept either roleId or role name (owner, admin, manager, staff)
 */
export async function createUserInOrg(data: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'owner' | 'admin' | 'manager' | 'staff';
  roleId?: string;
  organizationId: string;
}) {
  const plainPassword = data.password || 'SecurePass123!';
  const password = await bcrypt.hash(plainPassword, 10);
  const email = data.email || `user-${Date.now()}@test.com`;
  const username = email.split('@')[0] + Date.now();
  
  // Get roleId - either directly provided or looked up by role name
  let roleId = data.roleId;
  if (!roleId && data.role) {
    const roleMap = await ensureRolesExist();
    roleId = roleMap.get(data.role);
    if (!roleId) {
      throw new Error(`Role "${data.role}" not found in organization`);
    }
  }
  if (!roleId) {
    throw new Error('Either roleId or role must be provided');
  }
  
  const [user] = await db.insert(users).values({
    email,
    username,
    password,
    firstName: data.firstName || 'Test',
    lastName: data.lastName || 'User',
    roleId,
    organizationId: data.organizationId,
    isActive: true
  }).returning();
  
  return user;
}

/**
 * Login user and return token
 */
export async function loginUser(email: string, password: string, organizationId?: string) {
  const payload: any = { email, password };
  if (organizationId) {
    payload.organizationId = organizationId;
  }
  
  const response = await request(app)
    .post('/api/auth/login')
    .send(payload);
  
  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.body)}`);
  }
  
  return {
    token: response.body.token,
    user: response.body.user
  };
}
