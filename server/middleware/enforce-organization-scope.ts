/**
 * Organization Scope Enforcement Middleware
 * 
 * Purpose: Defense-in-depth layer for multi-tenant data isolation
 * - Works in conjunction with Row Level Security (RLS)
 * - Validates user belongs to organization before processing requests
 * - Injects organizationId into request context for filtering
 * 
 * Security: Even if RLS is bypassed, this middleware provides application-level protection
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Extend Express Request to include organization context
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      userOrganizations?: string[]; // All organizations user belongs to
      isSuperAdmin?: boolean;
    }
  }
}

/**
 * Middleware: Enforce organization scope for all requests
 * 
 * This middleware:
 * 1. Verifies user belongs to organization (if organizationId in request)
 * 2. Injects user's organization context into request
 * 3. Blocks requests that attempt cross-org access
 * 
 * Usage: Apply to all multi-tenant API routes
 */
export async function enforceOrganizationScope(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip for non-authenticated requests (handled by requireAuth)
    if (!req.user || !req.userId) {
      return next();
    }

    // Get user's role information
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId),
      with: {
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is Super Admin (bypass organization checks)
    const isSuperAdmin = user.role?.name === 'Super Admin';
    req.isSuperAdmin = isSuperAdmin;

    // Get all organizations user belongs to
    const userOrgs = await db.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.userId, req.userId),
      columns: {
        organizationId: true,
        status: true,
      },
    });

    const activeOrgIds = userOrgs
      .filter(uo => uo.status === 'active')
      .map(uo => uo.organizationId);

    req.userOrganizations = activeOrgIds;

    // Get current organization from request
    // Priority: 1. Request body, 2. Query param, 3. URL param, 4. User's default org
    let requestedOrgId = 
      req.body?.organizationId || 
      req.query?.organizationId || 
      req.params?.organizationId ||
      user.organizationId; // Legacy organization_id field

    // If organization specified in request, verify user has access
    if (requestedOrgId && !isSuperAdmin) {
      // Verify user belongs to this organization
      if (!activeOrgIds.includes(requestedOrgId)) {
        console.warn(`[SECURITY] User ${req.userId} attempted to access organization ${requestedOrgId} without membership`);
        return res.status(403).json({ 
          error: 'Access denied: You do not have access to this organization',
          code: 'ORG_ACCESS_DENIED'
        });
      }
    }

    // Inject organization context into request
    req.organizationId = requestedOrgId || activeOrgIds[0]; // Use first org if none specified

    next();
  } catch (error) {
    console.error('[SECURITY] Error in organization scope enforcement:', error);
    return res.status(500).json({ error: 'Internal server error during authorization' });
  }
}

/**
 * Middleware: Require specific organization access
 * 
 * Use this after enforceOrganizationScope to ensure organizationId is present
 */
export function requireOrganization(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.organizationId && !req.isSuperAdmin) {
    return res.status(403).json({ 
      error: 'Organization context required',
      code: 'ORG_REQUIRED'
    });
  }
  next();
}

/**
 * Helper: Validate entity belongs to user's organization
 * 
 * Use this in route handlers to double-check organization ownership
 */
export async function validateEntityOrganization(
  entityOrgId: string | null,
  userOrgId: string | undefined,
  isSuperAdmin: boolean = false
): Promise<boolean> {
  // Super admin bypasses all checks
  if (isSuperAdmin) {
    return true;
  }

  // User must have organization context
  if (!userOrgId) {
    return false;
  }

  // System-wide entities (NULL org_id) are accessible to all
  if (entityOrgId === null) {
    return true;
  }

  // Entity must belong to user's organization
  return entityOrgId === userOrgId;
}

/**
 * Middleware: Log organization access for audit trail
 */
export function logOrganizationAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.organizationId) {
    console.log(`[ORG-ACCESS] User ${req.userId} accessing ${req.method} ${req.path} for org ${req.organizationId}`);
  }
  next();
}
