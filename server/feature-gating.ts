import { Response, NextFunction } from 'express';
import { storage } from './storage';
import { AuthRequest, logActivity } from './auth';
import { UsageTrackingService } from './usage-tracking';
import {
  FeatureIdentifier,
  ResourceLimit,
  SubscriptionEntitlements,
  normalizeEntitlements,
  PLATFORM_ADMIN_ENTITLEMENTS,
  FREE_TIER_ENTITLEMENTS,
  isPlatformAdmin as checkIsPlatformAdmin
} from '@shared/subscription-types';

/**
 * Feature Gating System - Subscription-based access control
 * 
 * Controls feature visibility and access based on organization's subscription plan.
 * Works in conjunction with RBAC for comprehensive authorization.
 * 
 * Uses shared subscription types for frontend-backend consistency.
 */

/**
 * Check if organization has access to a specific feature
 * TELEMETRY: Logs quota denials vs system faults
 */
export async function hasFeatureAccess(
  organizationId: string,
  feature: FeatureIdentifier
): Promise<boolean> {
  const context = { organizationId, feature };
  
  try {
    // ✅ NEW: Check if organization is a test account (unlimited access)
    const organization = await storage.getOrganization(organizationId);
    if (organization?.isTestAccount) {
      console.info('[Feature Gating] TEST_ACCOUNT_BYPASS: Test account has unlimited access', context);
      return true; // Test accounts bypass all feature restrictions
    }

    // Get organization's active subscription
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    
    if (!subscription) {
      // TELEMETRY: Quota denial (no subscription)
      console.info('[Feature Gating] QUOTA_DENIAL: No subscription', context);
      
      // No subscription = free plan with limited features
      const freePlanFeatures: FeatureIdentifier[] = FREE_TIER_ENTITLEMENTS.features;
      return freePlanFeatures.includes(feature);
    }

    // ✅ NEW: Get plan features
    let features: FeatureIdentifier[] = [];
    if (subscription.planId) {
      const plan = await storage.getSubscriptionPlan(subscription.planId);
      if (plan && plan.features) {
        features = plan.features as FeatureIdentifier[];
      }
    }

    // ✅ NEW: Get add-on features and merge
    const addons = await storage.getActiveAddonsForOrganization(organizationId);
    for (const { details } of addons) {
      if (details.features) {
        const addonFeatures = details.features as FeatureIdentifier[];
        features = [...features, ...addonFeatures];
      }
    }

    // Deduplicate features
    const uniqueFeatures = [...new Set(features)];
    const hasAccess = uniqueFeatures.includes(feature);
    
    if (!hasAccess) {
      // TELEMETRY: Quota denial (feature not available)
      console.info('[Feature Gating] QUOTA_DENIAL: Feature not in plan or add-ons', {
        ...context,
        planFeatures: features.length,
        addonsCount: addons.length,
        availableFeatures: uniqueFeatures
      });
    } else if (addons.length > 0) {
      // TELEMETRY: Feature granted via add-on
      console.info('[Feature Gating] ADDON_FEATURE_GRANTED: Feature available via add-on', {
        ...context,
        addonsCount: addons.length
      });
    }
    
    return hasAccess;
  } catch (error) {
    // TELEMETRY: System fault (unexpected error)
    console.error('[Feature Gating] SYSTEM_FAULT: Unexpected error in hasFeatureAccess', {
      ...context,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // SECURITY: Fail closed on errors - deny access
    return false;
  }
}

/**
 * Check if organization is within their resource limits
 */
export async function checkResourceLimit(
  organizationId: string,
  resource: ResourceLimit,
  requestedAmount: number = 1
): Promise<{ allowed: boolean; limit: number; current: number; available: number }> {
  try {
    // ✅ NEW: Check if organization is a test account (unlimited limits)
    const organization = await storage.getOrganization(organizationId);
    if (organization?.isTestAccount) {
      console.info('[Feature Gating] TEST_ACCOUNT_BYPASS: Test account has unlimited limits', {
        organizationId,
        resource
      });
      return {
        allowed: true,
        limit: Infinity,
        current: 0,
        available: Infinity
      };
    }

    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    
    // Get current usage using real-time tracking
    const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
    let current = 0;
    switch (resource) {
      case 'maxUsers':
        current = usage.users;
        break;
      case 'maxClients':
        current = usage.clients;
        break;
      case 'maxStorage':
        current = usage.storage;
        break;
      case 'maxWorkflows':
        current = usage.workflows;
        break;
      case 'maxAIAgents':
        current = usage.aiAgents;
        break;
    }
    
    if (!subscription) {
      // Default free tier limits
      const limits = FREE_TIER_ENTITLEMENTS.limits;
      const limit = limits[resource].limit;
      
      const available = Math.max(0, limit - current);
      const allowed = current + requestedAmount <= limit;
      
      if (!allowed) {
        // TELEMETRY: Quota denial (free tier limit exceeded)
        console.info('[Feature Gating] QUOTA_DENIAL: Free tier limit exceeded', {
          organizationId,
          resource,
          limit,
          current,
          requestedAmount,
          available
        });
      }
      
      return {
        allowed,
        limit,
        current,
        available
      };
    }

    // ✅ NEW: Get base limit from plan
    let baseLimit = 0;
    if (subscription.planId) {
      const plan = await storage.getSubscriptionPlan(subscription.planId);
      if (plan) {
        baseLimit = plan[resource] || 0;
      }
    } else {
      // Use subscription limits if no plan
      const rawLimit = subscription[resource];
      baseLimit = rawLimit == null ? 0 : rawLimit;
    }

    // ✅ NEW: Add add-on limit increases
    let addonIncrease = 0;
    const addons = await storage.getActiveAddonsForOrganization(organizationId);
    for (const { details } of addons) {
      switch (resource) {
        case 'maxUsers':
          addonIncrease += details.additionalUsers || 0;
          break;
        case 'maxClients':
          addonIncrease += details.additionalClients || 0;
          break;
        case 'maxStorage':
          addonIncrease += details.additionalStorage || 0;
          break;
        case 'maxWorkflows':
          addonIncrease += details.additionalWorkflows || 0;
          break;
        // Note: additionalAIAgents not in schema yet
      }
    }

    // ✅ NEW: Total limit = base + add-ons
    const totalLimit = baseLimit + addonIncrease;
    const limit = totalLimit === 0 ? Infinity : totalLimit; // 0 means unlimited

    const available = limit === Infinity ? Infinity : Math.max(0, limit - current);
    const allowed = current + requestedAmount <= limit;
    
    if (!allowed && limit !== Infinity) {
      // TELEMETRY: Quota denial (limit exceeded)
      console.info('[Feature Gating] QUOTA_DENIAL: Resource limit exceeded', {
        organizationId,
        resource,
        limit,
        baseLimit,
        addonIncrease,
        current,
        requestedAmount,
        available
      });
    } else if (addonIncrease > 0) {
      // TELEMETRY: Add-on limit increase applied
      console.info('[Feature Gating] ADDON_LIMIT_APPLIED: Add-on increased resource limit', {
        organizationId,
        resource,
        baseLimit,
        addonIncrease,
        totalLimit: limit
      });
    }
    
    return {
      allowed,
      limit,
      current,
      available
    };
  } catch (error) {
    // TELEMETRY: System fault (unexpected error)
    console.error('[Feature Gating] SYSTEM_FAULT: Unexpected error in checkResourceLimit', {
      organizationId,
      resource,
      requestedAmount,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // SECURITY: Fail closed on errors - deny access
    return {
      allowed: false,
      limit: 0,
      current: 0,
      available: 0
    };
  }
}

/**
 * Middleware to require specific feature access
 */
export function requireFeature(feature: FeatureIdentifier) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Platform admins bypass feature gating (organizationId === null is valid)
    const userRole = await storage.getRole(req.user.roleId);
    if (userRole?.scope === 'platform' && req.user.organizationId === null) {
      return next();
    }

    // Regular users must have an organization
    if (!req.user.organizationId) {
      return res.status(403).json({ error: 'Organization required' });
    }

    const hasAccess = await hasFeatureAccess(req.user.organizationId, feature);
    
    if (!hasAccess) {
      await logActivity(
        req.user.id,
        req.user.organizationId,
        'feature_access_denied',
        'subscription',
        feature,
        { feature },
        req
      );
      
      return res.status(403).json({ 
        error: 'Feature not available in your current plan',
        feature,
        upgradeRequired: true
      });
    }

    next();
  };
}

/**
 * Middleware to check resource limits before allowing action
 */
export function requireResourceLimit(resource: ResourceLimit, amount: number = 1) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Platform admins bypass resource limits (organizationId === null is valid)
    const userRole = await storage.getRole(req.user.roleId);
    if (userRole?.scope === 'platform' && req.user.organizationId === null) {
      return next();
    }

    // Regular users must have an organization
    if (!req.user.organizationId) {
      return res.status(403).json({ error: 'Organization required' });
    }

    const limitCheck = await checkResourceLimit(req.user.organizationId, resource, amount);
    
    if (!limitCheck.allowed) {
      await logActivity(
        req.user.id,
        req.user.organizationId,
        'resource_limit_exceeded',
        'subscription',
        resource,
        {
          resource,
          limit: limitCheck.limit,
          current: limitCheck.current,
          requested: amount
        },
        req
      );
      
      return res.status(403).json({ 
        error: `${resource} limit exceeded`,
        resource,
        limit: limitCheck.limit,
        current: limitCheck.current,
        available: limitCheck.available,
        upgradeRequired: true
      });
    }

    next();
  };
}

/**
 * Check if user is platform admin (helper for bypass logic)
 */
export async function isPlatformAdmin(userId: string, organizationId: string | null): Promise<boolean> {
  if (organizationId !== null) {
    return false; // Regular users always have an organization
  }
  
  // Get user's role to verify platform scope
  const user = await storage.getUser(userId);
  if (!user) {
    return false;
  }
  
  const role = await storage.getRole(user.roleId);
  return role?.scope === 'platform';
}

/**
 * Get full feature entitlements for an organization
 * Uses shared normalizeEntitlements for consistency
 */
export async function getOrganizationEntitlements(organizationId: string): Promise<SubscriptionEntitlements> {
  // ✅ NEW: Check if organization is a test account (unlimited access)
  const organization = await storage.getOrganization(organizationId);
  if (organization?.isTestAccount) {
    // Test accounts get platform admin entitlements
    const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
    return {
      ...PLATFORM_ADMIN_ENTITLEMENTS,
      usage: {
        users: usage.users,
        clients: usage.clients,
        storage: usage.storage,
        workflows: usage.workflows,
        aiAgents: usage.aiAgents
      }
    };
  }

  const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
  
  // No subscription = free tier
  if (!subscription) {
    const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
    
    return normalizeEntitlements({
      plan: 'free',
      features: FREE_TIER_ENTITLEMENTS.features,
      rawLimits: FREE_TIER_ENTITLEMENTS.limits,
      usage
    });
  }

  // ✅ NEW: Get plan features and limits
  let features: FeatureIdentifier[] = [];
  let baseLimits = {
    maxUsers: 0,
    maxClients: 0,
    maxStorage: 0,
    maxWorkflows: 0,
    maxAIAgents: 0
  };

  if (subscription.planId) {
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (plan) {
      features = (plan.features as FeatureIdentifier[]) || [];
      baseLimits = {
        maxUsers: plan.maxUsers || 0,
        maxClients: plan.maxClients || 0,
        maxStorage: plan.maxStorage || 0,
        maxWorkflows: plan.maxWorkflows || 0,
        maxAIAgents: plan.maxAIAgents || 0
      };
    }
  } else {
    // Use subscription limits if no plan
    baseLimits = {
      maxUsers: subscription.maxUsers || 0,
      maxClients: subscription.maxClients || 0,
      maxStorage: subscription.maxStorage || 0,
      maxWorkflows: subscription.maxWorkflows || 0,
      maxAIAgents: subscription.maxAIAgents || 0
    };
  }

  // ✅ NEW: Merge add-on features and limits
  const addons = await storage.getActiveAddonsForOrganization(organizationId);
  for (const { details } of addons) {
    // Add features
    if (details.features) {
      const addonFeatures = details.features as FeatureIdentifier[];
      features = [...features, ...addonFeatures];
    }
    
    // Add limit increases
    baseLimits.maxUsers += details.additionalUsers || 0;
    baseLimits.maxClients += details.additionalClients || 0;
    baseLimits.maxStorage += details.additionalStorage || 0;
    baseLimits.maxWorkflows += details.additionalWorkflows || 0;
    // Note: additionalAIAgents not in schema yet
  }

  // Deduplicate features
  const uniqueFeatures = [...new Set(features)];

  // Get real-time usage counts
  const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
  
  // Normalize using shared utility (handles null/undefined limits correctly)
  return normalizeEntitlements({
    plan: subscription.plan,
    features: uniqueFeatures,
    rawLimits: baseLimits,
    usage
  });
}
