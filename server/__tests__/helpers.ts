import { testDb as db } from '../test-db';
import { users, organizations, roles, permissions, rolePermissions, type User, type Organization, type Role } from '@shared/schema';
import request from 'supertest';
import app from '../test-app'; // Use test-friendly app export
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Cache for role IDs
let roleCache: Map<string, string> | null = null;

/**
 * Clear role cache (called during test cleanup)
 */
export function clearRoleCache(): void {
  roleCache = null;
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
 * Get or create roles for testing
 */
async function ensureRolesExist(): Promise<Map<string, string>> {
  if (roleCache) {
    return roleCache;
  }
  
  roleCache = new Map<string, string>();
  
  // Try to find existing roles
  const existingRoles = await db.select().from(roles);
  
  if (existingRoles.length > 0) {
    for (const role of existingRoles) {
      roleCache.set(role.name, role.id);
    }
    return roleCache;
  }
  
  // Create default roles if they don't exist
  const defaultRoles = [
    { name: 'owner', description: 'Organization owner with full access', scope: 'tenant', isSystemRole: true },
    { name: 'admin', description: 'Administrator with most permissions', scope: 'tenant', isSystemRole: true },
    { name: 'manager', description: 'Manager with team permissions', scope: 'tenant', isSystemRole: true },
    { name: 'staff', description: 'Staff member with limited permissions', scope: 'tenant', isSystemRole: true }
  ];
  
  for (const roleData of defaultRoles) {
    const [role] = await db.insert(roles).values(roleData).returning();
    roleCache.set(role.name, role.id);
  }
  
  // Create baseline permissions for tests
  const basePermissions = [
    // User management
    { name: 'users.create', resource: 'users', action: 'create', description: 'Create new users' },
    { name: 'users.edit', resource: 'users', action: 'edit', description: 'Edit user details' },
    { name: 'users.delete', resource: 'users', action: 'delete', description: 'Delete users' },
    { name: 'users.view', resource: 'users', action: 'view', description: 'View user list' },
    // Organization management
    { name: 'org.edit', resource: 'organization', action: 'edit', description: 'Edit organization' },
    { name: 'org.delete', resource: 'organization', action: 'delete', description: 'Delete organization' },
    { name: 'org.billing', resource: 'organization', action: 'billing', description: 'View billing' },
    { name: 'org.transfer', resource: 'organization', action: 'transfer', description: 'Transfer ownership' },
    // Client management
    { name: 'clients.create', resource: 'clients', action: 'create', description: 'Create clients' },
    { name: 'clients.edit', resource: 'clients', action: 'edit', description: 'Edit clients' },
    { name: 'clients.delete', resource: 'clients', action: 'delete', description: 'Delete clients' },
    { name: 'clients.view', resource: 'clients', action: 'view', description: 'View clients' },
  ];
  
  const permissionMap = new Map<string, string>();
  for (const perm of basePermissions) {
    const [created] = await db.insert(permissions).values(perm).returning();
    permissionMap.set(created.name, created.id);
  }
  
  // Assign permissions to roles
  const ownerRoleId = roleCache.get('owner')!;
  const adminRoleId = roleCache.get('admin')!;
  const managerRoleId = roleCache.get('manager')!;
  const staffRoleId = roleCache.get('staff')!;
  
  // Owner gets all permissions
  for (const permId of permissionMap.values()) {
    await db.insert(rolePermissions).values({ roleId: ownerRoleId, permissionId: permId });
  }
  
  // Admin gets most permissions (no org delete/transfer)
  const adminPerms = [
    'users.create', 'users.edit', 'users.delete', 'users.view',
    'org.edit', 'org.billing',
    'clients.create', 'clients.edit', 'clients.delete', 'clients.view'
  ];
  for (const permName of adminPerms) {
    await db.insert(rolePermissions).values({ roleId: adminRoleId, permissionId: permissionMap.get(permName)! });
  }
  
  // Manager gets team + client permissions
  const managerPerms = [
    'users.view', 'users.edit',
    'clients.create', 'clients.edit', 'clients.view'
  ];
  for (const permName of managerPerms) {
    await db.insert(rolePermissions).values({ roleId: managerRoleId, permissionId: permissionMap.get(permName)! });
  }
  
  // Staff gets basic view permissions
  const staffPerms = ['users.view', 'clients.view'];
  for (const permName of staffPerms) {
    await db.insert(rolePermissions).values({ roleId: staffRoleId, permissionId: permissionMap.get(permName)! });
  }
  
  return roleCache;
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
