import { useQuery } from '@tanstack/react-query';
import { useUser } from './use-user';

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

interface SubscriptionEntitlements {
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
}

/**
 * Hook to get current user's subscription entitlements
 */
export function useSubscription() {
  const { user } = useUser();

  const { data: entitlements, isLoading } = useQuery<SubscriptionEntitlements>({
    queryKey: ['/api/subscription/entitlements'],
    enabled: !!user, // Enable for all authenticated users, including platform admins
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Platform admins (organizationId === null) get unlimited access
  const isPlatformAdmin = user && user.organizationId === null;
  
  if (isPlatformAdmin) {
    return {
      entitlements: {
        plan: 'platform',
        features: ['*'] as any, // All features
        limits: {
          maxUsers: Infinity,
          maxClients: Infinity,
          maxStorage: Infinity,
          maxWorkflows: Infinity,
          maxAIAgents: Infinity,
        },
        usage: {
          users: 0,
          clients: 0,
          storage: 0,
          workflows: 0,
          aiAgents: 0,
        },
      },
      isLoading: false,
      plan: 'platform',
      features: ['*'] as any,
      limits: {
        maxUsers: Infinity,
        maxClients: Infinity,
        maxStorage: Infinity,
        maxWorkflows: Infinity,
        maxAIAgents: Infinity,
      },
      usage: {
        users: 0,
        clients: 0,
        storage: 0,
        workflows: 0,
        aiAgents: 0,
      },
    };
  }

  return {
    entitlements,
    isLoading,
    plan: entitlements?.plan || 'free',
    features: entitlements?.features || [],
    limits: entitlements?.limits,
    usage: entitlements?.usage,
  };
}

/**
 * Hook to check if a feature is available in current plan
 */
export function useFeatureAccess(feature: FeatureIdentifier) {
  const { features, isLoading, plan } = useSubscription();
  
  // Platform admins have access to all features
  const hasAccess = plan === 'platform' || features.includes(feature);
  
  return {
    hasAccess,
    isLoading,
  };
}

/**
 * Hook to check resource usage against limits
 */
export function useResourceLimit(resource: ResourceLimit) {
  const { limits, usage, isLoading } = useSubscription();

  if (!limits || !usage) {
    return {
      limit: 0,
      current: 0,
      available: 0,
      percentage: 0,
      isAtLimit: false,
      isNearLimit: false,
      isLoading,
    };
  }

  const resourceKey = resource === 'maxUsers' ? 'users'
    : resource === 'maxClients' ? 'clients'
    : resource === 'maxStorage' ? 'storage'
    : resource === 'maxWorkflows' ? 'workflows'
    : 'aiAgents';

  const limit = limits[resource];
  const current = usage[resourceKey];
  const available = Math.max(0, limit - current);
  const percentage = limit > 0 ? (current / limit) * 100 : 0;

  return {
    limit,
    current,
    available,
    percentage,
    isAtLimit: current >= limit,
    isNearLimit: percentage >= 80,
    isLoading,
  };
}

/**
 * Hook to check if user can perform an action based on limits
 */
export function useCanCreate(resource: ResourceLimit, amount: number = 1) {
  const { limit, current, isLoading } = useResourceLimit(resource);
  
  return {
    canCreate: current + amount <= limit,
    isLoading,
    limit,
    current,
  };
}
