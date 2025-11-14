/**
 * Shared Subscription & Feature Gating Types
 * Ensures frontend-backend consistency for entitlements
 */

/**
 * Feature identifiers available in the platform
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
  | 'time_tracking'
  | 'resource_management';

/**
 * Resource limit identifiers
 */
export type ResourceLimit = 
  | 'maxUsers'
  | 'maxClients'
  | 'maxStorage'
  | 'maxWorkflows'
  | 'maxAIAgents';

/**
 * Resource limit with explicit unlimited flag
 * Replaces sentinel values with clear semantics
 */
export interface ResourceLimitInfo {
  limit: number;
  current: number;
  available: number;
  isUnlimited: boolean;
  percentage: number; // 0-100
}

/**
 * Complete subscription entitlements
 * Shared contract between frontend and backend
 */
export interface SubscriptionEntitlements {
  plan: string;
  features: FeatureIdentifier[];
  
  // Resource limits with explicit unlimited flags
  limits: {
    maxUsers: ResourceLimitInfo;
    maxClients: ResourceLimitInfo;
    maxStorage: ResourceLimitInfo;
    maxWorkflows: ResourceLimitInfo;
    maxAIAgents: ResourceLimitInfo;
  };
  
  // Current usage counts
  usage: {
    users: number;
    clients: number;
    storage: number;
    workflows: number;
    aiAgents: number;
  };
}

/**
 * Normalized resource limit
 * Converts null/undefined to explicit unlimited flag
 */
export function normalizeResourceLimit(
  rawLimit: number | null | undefined,
  currentUsage: number
): ResourceLimitInfo {
  const isUnlimited = rawLimit == null;
  const limit = isUnlimited ? Infinity : rawLimit;
  const available = isUnlimited ? Infinity : Math.max(0, limit - currentUsage);
  const percentage = isUnlimited ? 0 : limit > 0 ? (currentUsage / limit) * 100 : 0;

  return {
    limit: isUnlimited ? Infinity : limit,
    current: currentUsage,
    available,
    isUnlimited,
    percentage
  };
}

/**
 * Normalize complete entitlements
 * Ensures consistent format across frontend and backend
 */
export function normalizeEntitlements(params: {
  plan: string;
  features: FeatureIdentifier[];
  rawLimits: {
    maxUsers?: number | null;
    maxClients?: number | null;
    maxStorage?: number | null;
    maxWorkflows?: number | null;
    maxAIAgents?: number | null;
  };
  usage: {
    users: number;
    clients: number;
    storage: number;
    workflows: number;
    aiAgents: number;
  };
}): SubscriptionEntitlements {
  const { plan, features, rawLimits, usage } = params;

  return {
    plan,
    features,
    limits: {
      maxUsers: normalizeResourceLimit(rawLimits.maxUsers, usage.users),
      maxClients: normalizeResourceLimit(rawLimits.maxClients, usage.clients),
      maxStorage: normalizeResourceLimit(rawLimits.maxStorage, usage.storage),
      maxWorkflows: normalizeResourceLimit(rawLimits.maxWorkflows, usage.workflows),
      maxAIAgents: normalizeResourceLimit(rawLimits.maxAIAgents, usage.aiAgents),
    },
    usage
  };
}

/**
 * Platform admin entitlements (unlimited access)
 */
export const PLATFORM_ADMIN_ENTITLEMENTS: SubscriptionEntitlements = {
  plan: 'platform',
  features: [
    'workflows',
    'ai_agents',
    'signatures',
    'analytics',
    'custom_branding',
    'api_access',
    'sso',
    'advanced_reporting',
    'white_label',
    'priority_support',
    'custom_workflows',
    'automations',
    'integrations',
    'resource_management',
    'document_management',
    'client_portal',
    'team_collaboration',
    'time_tracking'
  ],
  limits: {
    maxUsers: { limit: Infinity, current: 0, available: Infinity, isUnlimited: true, percentage: 0 },
    maxClients: { limit: Infinity, current: 0, available: Infinity, isUnlimited: true, percentage: 0 },
    maxStorage: { limit: Infinity, current: 0, available: Infinity, isUnlimited: true, percentage: 0 },
    maxWorkflows: { limit: Infinity, current: 0, available: Infinity, isUnlimited: true, percentage: 0 },
    maxAIAgents: { limit: Infinity, current: 0, available: Infinity, isUnlimited: true, percentage: 0 },
  },
  usage: {
    users: 0,
    clients: 0,
    storage: 0,
    workflows: 0,
    aiAgents: 0
  }
};

/**
 * Free tier entitlements (default for new organizations)
 */
export const FREE_TIER_ENTITLEMENTS: Readonly<{
  features: FeatureIdentifier[];
  limits: {
    maxUsers: number;
    maxClients: number;
    maxStorage: number;
    maxWorkflows: number;
    maxAIAgents: number;
  };
}> = {
  features: ['workflows', 'client_portal', 'document_management'],
  limits: {
    maxUsers: 5,
    maxClients: 10,
    maxStorage: 5, // GB
    maxWorkflows: 10,
    maxAIAgents: 3
  }
};

/**
 * Check if user is platform admin based on role and organization
 */
export function isPlatformAdmin(user: { organizationId: string | null; roleScope?: string }): boolean {
  return user.organizationId === null && user.roleScope === 'platform';
}

/**
 * Check if a feature is accessible
 */
export function hasFeature(entitlements: SubscriptionEntitlements, feature: FeatureIdentifier): boolean {
  // Platform admins have all features
  if (entitlements.plan === 'platform') {
    return true;
  }
  
  return entitlements.features.includes(feature);
}

/**
 * Check if can create more of a resource
 */
export function canCreateResource(
  entitlements: SubscriptionEntitlements,
  resource: ResourceLimit,
  amount: number = 1
): boolean {
  const limitInfo = entitlements.limits[resource];
  
  if (limitInfo.isUnlimited) {
    return true;
  }
  
  return limitInfo.current + amount <= limitInfo.limit;
}
