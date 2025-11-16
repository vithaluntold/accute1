import { db } from '../db';
import { users, organizations, type User, type Organization } from '@shared/schema';
import bcrypt from 'bcrypt';
import request from 'supertest';
import app from '../index';
import { eq } from 'drizzle-orm';

/**
 * Helper function to create a test organization
 */
export async function createOrg(data: {
  name?: string;
  industry?: string;
  size?: string;
} = {}): Promise<Organization> {
  const [org] = await db.insert(organizations)
    .values({
      name: data.name || 'Test Organization',
      industry: data.industry || 'accounting',
      size: data.size || '1-10'
    })
    .returning();
  
  return org;
}

/**
 * Helper function to create a test user
 */
export async function createUser(data: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'owner' | 'admin' | 'manager' | 'staff';
  organizationId?: number;
  status?: string;
} = {}): Promise<User> {
  // Create organization if not provided
  let orgId = data.organizationId;
  if (!orgId) {
    const org = await createOrg();
    orgId = org.id;
  }

  const password = data.password || 'SecurePass123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(users)
    .values({
      email: data.email || `test${Date.now()}@test.com`,
      passwordHash,
      firstName: data.firstName || 'Test',
      lastName: data.lastName || 'User',
      role: data.role || 'staff',
      organizationId: orgId,
      status: data.status || 'active'
    })
    .returning();

  // Store password for testing (not in real DB)
  (user as any)._testPassword = password;

  return user;
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
 * Helper function to create authenticated user and return token
 */
export async function createAuthenticatedUser(data: {
  email?: string;
  password?: string;
  role?: 'owner' | 'admin' | 'manager' | 'staff';
  organizationId?: number;
} = {}): Promise<{ user: User; token: string; password: string }> {
  const password = data.password || 'SecurePass123!';
  const user = await createUser({
    ...data,
    password
  });

  const loginResponse = await login(user.email, password);

  if (!loginResponse.token) {
    throw new Error('Failed to get authentication token');
  }

  return {
    user,
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
 * Helper function to get user by email
 */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  return await db.query.users.findFirst({
    where: eq(users.email, email)
  });
}

/**
 * Helper function to get organization by ID
 */
export async function getOrgById(id: number): Promise<Organization | undefined> {
  return await db.query.organizations.findFirst({
    where: eq(organizations.id, id)
  });
}

/**
 * Helper to verify password hash
 */
export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(plainPassword, hash);
}

/**
 * Helper to generate expired JWT token for testing
 */
export function generateExpiredToken(userId: number): string {
  // This would need JWT library - placeholder for now
  return 'expired-token-placeholder';
}
