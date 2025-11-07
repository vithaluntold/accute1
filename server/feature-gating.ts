import { Response, NextFunction } from 'express';
import { storage } from './storage';
import { AuthRequest, logActivity } from './auth';
import type { SubscriptionPlan } from '@shared/schema';

/**
 * Feature Gating System - Subscription-based access control
 * 
 * Controls feature visibility and access based on organization's subscription plan.
 * Works in conjunction with RBAC for comprehensive authorization.
 */

export type FeatureIdentifier = 
  | 'workflows'
  | 'ai_agents'
  | 'signatures'
  | 'analytics'
  | 'custom_branding'
  | 'api_access'
  | 'sso'
  | 'advanced_reporting'
  | 'white_label'
  | 'priority_support'
  | 'custom_workflows'
  | 'automations'
  | 'integrations'
  | 'document_management'
  | 'client_portal'
  | 'team_collaboration'
  | 'time_tracking';

export type ResourceLimit = 
  | 'maxUsers'
  | 'maxClients'
  | 'maxStorage'
  | 'maxWorkflows'
  | 'maxAIAgents';

/**
 * Check if organization has access to a specific feature
 */
export async function hasFeatureAccess(
  organizationId: string,
  feature: FeatureIdentifier
): Promise<boolean> {
  try {
    // Get organization's active subscription
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    
    if (!subscription) {
      // No subscription = free plan with limited features
      const freePlanFeatures: FeatureIdentifier[] = ['workflows', 'client_portal', 'document_management'];
      return freePlanFeatures.includes(feature);
    }

    // If planId is set, get full plan details
    if (subscription.planId) {
      const plan = await storage.getSubscriptionPlan(subscription.planId);
      if (plan && plan.features) {
        const planFeatures = plan.features as FeatureIdentifier[];
        return planFeatures.includes(feature);
      }
    }

    // Fallback to basic features for unknown plans
    return ['workflows', 'client_portal', 'document_management'].includes(feature);
  } catch (error) {
    console.error('[Feature Gating] CRITICAL: Error checking feature access:', error);
    // SECURITY: Fail closed on errors - deny access and log
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
      // Default free tier limits
      const limits = {
        maxUsers: 5,
        maxClients: 10,
        maxStorage: 5,
        maxWorkflows: 10,
        maxAIAgents: 3
      };
      
      const limit = limits[resource];
      const current = 0; // Would need actual usage tracking
      const available = Math.max(0, limit - current);
      
      return {
        allowed: current + requestedAmount <= limit,
        limit,
        current,
        available
      };
    }

    // Treat null/undefined limits as unlimited (Infinity)
    const rawLimit = subscription[resource];
    const limit = rawLimit == null ? Infinity : rawLimit;
    
    // Get current usage based on resource type
    let current = 0;
    switch (resource) {
      case 'maxUsers':
        current = subscription.currentUsers || 0;
        break;
      case 'maxClients':
        current = subscription.currentClients || 0;
        break;
      case 'maxStorage':
        current = Number(subscription.currentStorage) || 0;
        break;
      case 'maxWorkflows':
        // Would query workflow count for org
        current = 0;
        break;
      case 'maxAIAgents':
        // Would query AI agent installations for org
        current = 0;
        break;
    }

    const available = limit === Infinity ? Infinity : Math.max(0, limit - current);
    
    return {
      allowed: current + requestedAmount <= limit,
      limit,
      current,
      available
    };
  } catch (error) {
    console.error('[Feature Gating] CRITICAL: Error checking resource limit:', error);
    // SECURITY: Fail closed on errors - deny access and log
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
 * Get full feature entitlements for an organization
 */
export async function getOrganizationEntitlements(organizationId: string): Promise<{
  plan: string;
  features: FeatureIdentifier[];
  limits: {
    maxUsers: number;
    maxClients: number;
    maxStorage: number;
    maxWorkflows: number;
    maxAIAgents: number;
  };
  usage: {
    users: number;
    clients: number;
    storage: number;
    workflows: number;
    aiAgents: number;
  };
}> {
  const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
  
  if (!subscription) {
    return {
      plan: 'free',
      features: ['workflows', 'client_portal', 'document_management'],
      limits: {
        maxUsers: 5,
        maxClients: 10,
        maxStorage: 5,
        maxWorkflows: 10,
        maxAIAgents: 3
      },
      usage: {
        users: 0,
        clients: 0,
        storage: 0,
        workflows: 0,
        aiAgents: 0
      }
    };
  }

  let features: FeatureIdentifier[] = [];
  
  if (subscription.planId) {
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (plan && plan.features) {
      features = plan.features as FeatureIdentifier[];
    }
  }

  // CRITICAL: Normalize null/undefined limits to Infinity for unlimited plans
  // Frontend expects numbers, so we use Number.MAX_SAFE_INTEGER as sentinel for "unlimited"
  const UNLIMITED = 999999; // Sentinel value for unlimited (frontend-safe)
  
  return {
    plan: subscription.plan,
    features,
    limits: {
      maxUsers: subscription.maxUsers ?? UNLIMITED,
      maxClients: subscription.maxClients ?? UNLIMITED,
      maxStorage: subscription.maxStorage ?? UNLIMITED,
      maxWorkflows: subscription.maxWorkflows ?? UNLIMITED,
      maxAIAgents: subscription.maxAIAgents ?? UNLIMITED
    },
    usage: {
      users: subscription.currentUsers || 0,
      clients: subscription.currentClients || 0,
      storage: Number(subscription.currentStorage) || 0,
      workflows: 0, // Would query actual count
      aiAgents: 0  // Would query actual count
    }
  };
}
