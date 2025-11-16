import { db } from '../db';
import { users, organizations, type User, type Organization } from '@shared/schema';
import request from 'supertest';
import app from '../test-app'; // Use test-friendly app export
import { eq } from 'drizzle-orm';

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
  
  const payload: any = {
    email,
    password,
    username: email.split('@')[0] + Date.now(),
    firstName: data.firstName || 'Test',
    lastName: data.lastName || 'User',
    roleId: data.role || 'staff', // Will need to map to actual role ID
  };

  if (data.organizationId) {
    payload.organizationId = data.organizationId;
  }

  const endpoint = '/api/users';

  const req = request(app).post(endpoint).send(payload);

  if (data.token) {
    req.set('Authorization', `Bearer ${data.token}`);
  }

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
 * DATABASE QUERY HELPERS - For verification only, not for test setup
 */

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
