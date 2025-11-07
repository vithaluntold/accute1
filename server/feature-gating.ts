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
    // Get organization's active subscription
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    
    if (!subscription) {
      // TELEMETRY: Quota denial (no subscription)
      console.info('[Feature Gating] QUOTA_DENIAL: No subscription', context);
      
      // No subscription = free plan with limited features
      const freePlanFeatures: FeatureIdentifier[] = FREE_TIER_ENTITLEMENTS.features;
      return freePlanFeatures.includes(feature);
    }

    // If planId is set, get full plan details
    if (subscription.planId) {
      const plan = await storage.getSubscriptionPlan(subscription.planId);
      if (plan && plan.features) {
        const planFeatures = plan.features as FeatureIdentifier[];
        const hasAccess = planFeatures.includes(feature);
        
        if (!hasAccess) {
          // TELEMETRY: Quota denial (feature not in plan)
          console.info('[Feature Gating] QUOTA_DENIAL: Feature not in plan', {
            ...context,
            plan: plan.name,
            planFeatures
          });
        }
        
        return hasAccess;
      }
    }

    // TELEMETRY: System fault (missing plan data)
    console.warn('[Feature Gating] SYSTEM_FAULT: Missing plan data', {
      ...context,
      subscriptionId: subscription.id,
      planId: subscription.planId
    });

    // Fallback to basic features for unknown plans
    return FREE_TIER_ENTITLEMENTS.features.includes(feature);
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
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    
    if (!subscription) {
      // Default free tier limits - USE REAL USAGE TRACKING
      const limits = FREE_TIER_ENTITLEMENTS.limits;
      const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
      
      const limit = limits[resource];
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
          current = usage.workflows; // Real-time count
          break;
        case 'maxAIAgents':
          current = usage.aiAgents; // Real-time count
          break;
      }
      
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

    // Treat null/undefined limits as unlimited (Infinity)
    const rawLimit = subscription[resource];
    const limit = rawLimit == null ? Infinity : rawLimit;
    
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
        current = usage.workflows; // Real-time count
        break;
      case 'maxAIAgents':
        current = usage.aiAgents; // Real-time count
        break;
    }

    const available = limit === Infinity ? Infinity : Math.max(0, limit - current);
    const allowed = current + requestedAmount <= limit;
    
    if (!allowed && limit !== Infinity) {
      // TELEMETRY: Quota denial (limit exceeded)
      console.info('[Feature Gating] QUOTA_DENIAL: Resource limit exceeded', {
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

  // Get features from plan
  let features: FeatureIdentifier[] = [];
  if (subscription.planId) {
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (plan && plan.features) {
      features = plan.features as FeatureIdentifier[];
    }
  }

  // Get real-time usage counts
  const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
  
  // Normalize using shared utility (handles null/undefined limits correctly)
  return normalizeEntitlements({
    plan: subscription.plan,
    features,
    rawLimits: {
      maxUsers: subscription.maxUsers,
      maxClients: subscription.maxClients,
      maxStorage: subscription.maxStorage,
      maxWorkflows: subscription.maxWorkflows,
      maxAIAgents: subscription.maxAIAgents
    },
    usage
  });
}
