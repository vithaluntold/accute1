/**
 * Test Automation Toolkit
 * 
 * Accelerates Six Sigma test development with:
 * 1. Parameterized test runners for RBAC permission matrices
 * 2. Enhanced test factories for rapid setup
 * 3. Shared assertion helpers for common validation patterns
 * 
 * Goal: 3-4x velocity boost while maintaining Six Sigma quality
 */

import request from 'supertest';
import { expect } from 'vitest';
import type { Express } from 'express';

// ==================== TYPE DEFINITIONS ====================

export interface RolePermissionMatrix {
  role: 'owner' | 'admin' | 'manager' | 'staff';
  permissions: {
    allowed: string[];
    denied: string[];
  };
}

export interface EndpointTestCase {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  requiredPermission: string;
  testData?: any;
  description?: string;
}

export interface AssertionHelpers {
  expectSuccess: (response: any, expectedStatus?: number) => void;
  expectForbidden: (response: any, permission?: string) => void;
  expectUnauthorized: (response: any) => void;
  expectValidationError: (response: any, field?: string) => void;
  expectNotFound: (response: any) => void;
}

// ==================== RBAC PERMISSION MATRICES ====================

/**
 * Complete permission matrix for all 4 roles
 * Source: replit.md Permission Matrix (RBAC System)
 */
export const PERMISSION_MATRICES: Record<string, RolePermissionMatrix> = {
  owner: {
    role: 'owner',
    permissions: {
      allowed: [
        'users.view', 'users.create', 'users.edit', 'users.delete',
        'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
        'organization.edit', 'organization.billing', 'organization.delete', 'organization.transfer'
      ],
      denied: []
    }
  },
  admin: {
    role: 'admin',
    permissions: {
      allowed: [
        'users.view', 'users.create', 'users.edit', 'users.delete',
        'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
        'organization.edit', 'organization.billing'
      ],
      denied: ['organization.delete', 'organization.transfer']
    }
  },
  manager: {
    role: 'manager',
    permissions: {
      allowed: [
        'users.view',
        'users.edit', // Self-edit only (enforced at endpoint level)
        'clients.view', 'clients.create', 'clients.edit'
      ],
      denied: [
        'users.create', 'users.delete',
        'clients.delete',
        'organization.edit', 'organization.billing', 'organization.delete', 'organization.transfer'
      ]
    }
  },
  staff: {
    role: 'staff',
    permissions: {
      allowed: [
        'users.edit', // Self-edit only (enforced at endpoint level)
        'clients.view'
      ],
      denied: [
        'users.view', 'users.create', 'users.delete',
        'clients.create', 'clients.edit', 'clients.delete',
        'organization.edit', 'organization.billing', 'organization.delete', 'organization.transfer'
      ]
    }
  }
};

// ==================== ENDPOINT PERMISSION MAPPINGS ====================

/**
 * Maps API endpoints to required permissions
 * Used for automated RBAC testing
 */
export const ENDPOINT_PERMISSIONS: Record<string, EndpointTestCase[]> = {
  users: [
    {
      method: 'GET',
      path: '/api/organizations/:orgId/users',
      requiredPermission: 'users.view',
      description: 'List organization users'
    },
    {
      method: 'POST',
      path: '/api/organizations/:orgId/users',
      requiredPermission: 'users.create',
      testData: {
        email: 'newuser@test.com',
        firstName: 'New',
        lastName: 'User',
        roleId: 'staff-role-id'
      },
      description: 'Create new user'
    },
    {
      method: 'PATCH',
      path: '/api/users/:userId',
      requiredPermission: 'users.edit',
      testData: {
        firstName: 'Updated'
      },
      description: 'Edit user (self-edit only for Manager/Staff)'
    },
    {
      method: 'DELETE',
      path: '/api/users/:userId',
      requiredPermission: 'users.delete',
      description: 'Delete user'
    }
  ],
  organization: [
    {
      method: 'PATCH',
      path: '/api/organizations/:orgId',
      requiredPermission: 'organization.edit',
      testData: {
        name: 'Updated Org Name'
      },
      description: 'Edit organization settings'
    },
    {
      method: 'DELETE',
      path: '/api/organizations/:orgId',
      requiredPermission: 'organization.delete',
      description: 'Delete organization (Owner only)'
    }
  ]
};

// ==================== PARAMETERIZED TEST RUNNER ====================

/**
 * Generates parameterized RBAC tests for a role
 * 
 * Example usage:
 * ```typescript
 * generateRBACTests({
 *   role: 'staff',
 *   app,
 *   token: staffToken,
 *   orgId: testOrg.id,
 *   testUsers: [staffUser]
 * });
 * ```
 */
export interface RBACTestConfig {
  role: 'owner' | 'admin' | 'manager' | 'staff';
  app: Express;
  token: string;
  orgId: string;
  testUsers?: any[];
  skipEndpoints?: string[];
}

export function generateRBACTestSpecs(config: RBACTestConfig) {
  const { role, app, token, orgId, testUsers = [] } = config;
  const matrix = PERMISSION_MATRICES[role];
  
  if (!matrix) {
    throw new Error(`Unknown role: ${role}`);
  }

  const specs: any[] = [];

  // Test ALLOWED permissions
  for (const permission of matrix.permissions.allowed) {
    const endpoints = findEndpointsForPermission(permission);
    
    for (const endpoint of endpoints) {
      specs.push({
        testName: `${role} CAN ${endpoint.description} (requires ${permission})`,
        testFn: async () => {
          const path = resolveEndpointPath(endpoint.path, { orgId, userId: testUsers[0]?.id });
          const response = await makeRequest(app, endpoint.method, path, token, endpoint.testData);
          
          // Should succeed (200, 201) or have valid business logic failure (not 403)
          expect(response.status).not.toBe(403);
        }
      });
    }
  }

  // Test DENIED permissions
  for (const permission of matrix.permissions.denied) {
    const endpoints = findEndpointsForPermission(permission);
    
    for (const endpoint of endpoints) {
      specs.push({
        testName: `${role} CANNOT ${endpoint.description} (requires ${permission})`,
        testFn: async () => {
          const path = resolveEndpointPath(endpoint.path, { orgId, userId: testUsers[0]?.id });
          const response = await makeRequest(app, endpoint.method, path, token, endpoint.testData);
          
          // Should be forbidden
          expect(response.status).toBe(403);
          expect(response.body.error).toBeDefined();
        }
      });
    }
  }

  return specs;
}

// ==================== HELPER FUNCTIONS ====================

function findEndpointsForPermission(permission: string): EndpointTestCase[] {
  const allEndpoints = Object.values(ENDPOINT_PERMISSIONS).flat();
  return allEndpoints.filter(e => e.requiredPermission === permission);
}

function resolveEndpointPath(
  path: string,
  params: { orgId?: string; userId?: string }
): string {
  return path
    .replace(':orgId', params.orgId || 'test-org-id')
    .replace(':userId', params.userId || 'test-user-id');
}

async function makeRequest(
  app: Express,
  method: string,
  path: string,
  token: string,
  data?: any
): Promise<any> {
  let req = request(app)[method.toLowerCase()](path)
    .set('Authorization', `Bearer ${token}`);
  
  if (data && (method === 'POST' || method === 'PATCH')) {
    req = req.send(data);
  }
  
  return req;
}

// ==================== ASSERTION HELPERS ====================

/**
 * Reusable assertion helpers for common test patterns
 */
export const assertionHelpers: AssertionHelpers = {
  expectSuccess: (response: any, expectedStatus: number = 200) => {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBeUndefined();
  },

  expectForbidden: (response: any, permission?: string) => {
    expect(response.status).toBe(403);
    expect(response.body.error).toBeDefined();
    if (permission) {
      expect(response.body.error.toLowerCase()).toContain('permission');
    }
  },

  expectUnauthorized: (response: any) => {
    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
  },

  expectValidationError: (response: any, field?: string) => {
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    if (field) {
      expect(response.body.error.toLowerCase()).toContain(field.toLowerCase());
    }
  },

  expectNotFound: (response: any) => {
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  }
};

// ==================== ENHANCED TEST FACTORIES ====================

/**
 * Quick factory for creating test users with specific roles
 */
export interface QuickUserFactoryOptions {
  email?: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  firstName?: string;
  lastName?: string;
  password?: string;
}

export function generateQuickUserData(options: QuickUserFactoryOptions) {
  const timestamp = Date.now();
  return {
    email: options.email || `user-${options.role}-${timestamp}@test.com`,
    firstName: options.firstName || `Test${options.role.charAt(0).toUpperCase()}${options.role.slice(1)}`,
    lastName: options.lastName || 'User',
    password: options.password || 'TestPass123!',
    role: options.role
  };
}

/**
 * Quick factory for creating test organizations
 */
export interface QuickOrgFactoryOptions {
  name?: string;
  ownerEmail?: string;
}

export function generateQuickOrgData(options: QuickOrgFactoryOptions = {}) {
  const timestamp = Date.now();
  return {
    name: options.name || `Test Org ${timestamp}`,
    ownerEmail: options.ownerEmail || `owner-${timestamp}@test.com`,
    ownerPassword: 'OwnerPass123!'
  };
}

// ==================== BULK TEST DATA GENERATORS ====================

/**
 * Generate test data for bulk operations
 */
export function generateBulkUsers(count: number, role: 'staff' | 'manager' = 'staff') {
  return Array.from({ length: count }, (_, i) => 
    generateQuickUserData({ 
      role,
      email: `bulk-user-${i}-${Date.now()}@test.com` 
    })
  );
}

/**
 * Generate SQL injection test payloads
 */
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users; --",
  "' OR '1'='1' --",
  "admin'--",
  "' OR 1=1--",
  "'; DELETE FROM users WHERE '1'='1",
  "' UNION SELECT NULL, username, password FROM users--"
];

/**
 * Generate XSS test payloads
 */
export const XSS_PAYLOADS = [
  "<script>alert('XSS')</script>",
  "<img src=x onerror=alert('XSS')>",
  "<svg onload=alert('XSS')>",
  "javascript:alert('XSS')",
  "<iframe src='javascript:alert(\"XSS\")'>"
];

// ==================== PERFORMANCE HELPERS ====================

/**
 * Measure test execution time
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { result, durationMs };
}

/**
 * Validate response time is under threshold (for timing attack prevention)
 */
export function expectResponseTimeUnder(durationMs: number, maxMs: number = 500) {
  expect(durationMs).toBeLessThan(maxMs);
}
