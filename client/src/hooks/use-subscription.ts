import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from './use-user';
import type {
  SubscriptionEntitlements,
  FeatureIdentifier,
  ResourceLimit,
  ResourceLimitInfo
} from '@shared/subscription-types';
import { PLATFORM_ADMIN_ENTITLEMENTS } from '@shared/subscription-types';

// Re-export types for convenience
export type { FeatureIdentifier, ResourceLimit, SubscriptionEntitlements, ResourceLimitInfo };

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
      entitlements: PLATFORM_ADMIN_ENTITLEMENTS,
      isLoading: false,
      plan: PLATFORM_ADMIN_ENTITLEMENTS.plan,
      features: PLATFORM_ADMIN_ENTITLEMENTS.features,
      limits: PLATFORM_ADMIN_ENTITLEMENTS.limits,
      usage: PLATFORM_ADMIN_ENTITLEMENTS.usage,
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
 * Now uses ResourceLimitInfo with explicit unlimited flags
 */
export function useResourceLimit(resource: ResourceLimit): ResourceLimitInfo & { isLoading: boolean; isAtLimit: boolean; isNearLimit: boolean } {
  const { limits, isLoading } = useSubscription();

  if (!limits) {
    return {
      limit: 0,
      current: 0,
      available: 0,
      percentage: 0,
      isUnlimited: false,
      isAtLimit: false,
      isNearLimit: false,
      isLoading: true,
    };
  }

  const limitInfo = limits[resource];
  
  return {
    ...limitInfo,
    isAtLimit: !limitInfo.isUnlimited && limitInfo.current >= limitInfo.limit,
    isNearLimit: !limitInfo.isUnlimited && limitInfo.percentage >= 80,
    isLoading,
  };
}

/**
 * Hook to check if user can perform an action based on limits
 * Handles unlimited plans correctly
 */
export function useCanCreate(resource: ResourceLimit, amount: number = 1) {
  const { limit, current, isUnlimited, available, isLoading } = useResourceLimit(resource);
  
  return {
    canCreate: isUnlimited || current + amount <= limit,
    isLoading,
    limit,
    current,
    available,
    isUnlimited,
  };
}

/**
 * Hook to invalidate subscription cache
 * Call this after subscription changes
 */
export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['/api/subscription/entitlements'] });
  };
}
