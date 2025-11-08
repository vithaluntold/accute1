import { useQuery } from "@tanstack/react-query";

// Feature unlock configuration
export interface FeatureUnlockConfig {
  feature: string;
  minDay?: number;
  requiredTasks?: string[];
  requiredPoints?: number;
  isPremium?: boolean;
}

// All features and their unlock requirements
export const FEATURE_UNLOCKS: Record<string, FeatureUnlockConfig> = {
  // Core features (available immediately)
  dashboard: {
    feature: 'dashboard',
    minDay: 1,
  },
  onboarding: {
    feature: 'onboarding',
    minDay: 1,
  },
  settings: {
    feature: 'settings',
    minDay: 1,
  },

  // Client management (Day 1+)
  clients: {
    feature: 'clients',
    minDay: 1,
  },
  'clients.create': {
    feature: 'clients.create',
    minDay: 1,
    requiredTasks: ['view-client-overview'],
  },
  'clients.import': {
    feature: 'clients.import',
    minDay: 4,
    requiredTasks: ['add-first-client'],
  },

  // Documents (Day 2+)
  documents: {
    feature: 'documents',
    minDay: 2,
  },
  'documents.upload': {
    feature: 'documents.upload',
    minDay: 2,
  },
  'documents.esign': {
    feature: 'documents.esign',
    minDay: 5,
    requiredTasks: ['upload-first-document'],
  },
  'documents.folders': {
    feature: 'documents.folders',
    minDay: 7,
    requiredPoints: 200,
  },

  // AI Agents (Day 3+)
  'ai-agents': {
    feature: 'ai-agents',
    minDay: 3,
  },
  'ai-agents.marketplace': {
    feature: 'ai-agents.marketplace',
    minDay: 8,
    requiredTasks: ['chat-with-ai-agent'],
  },
  'ai-agents.foundry': {
    feature: 'ai-agents.foundry',
    minDay: 15,
    requiredPoints: 1000,
  },

  // Invoicing (Day 5+)
  invoices: {
    feature: 'invoices',
    minDay: 5,
  },
  'invoices.recurring': {
    feature: 'invoices.recurring',
    minDay: 8,
    requiredTasks: ['create-first-invoice'],
  },
  'invoices.payment-links': {
    feature: 'invoices.payment-links',
    minDay: 8,
    requiredTasks: ['create-first-invoice'],
  },

  // Workflows (Day 6+)
  workflows: {
    feature: 'workflows',
    minDay: 6,
  },
  'workflows.builder': {
    feature: 'workflows.builder',
    minDay: 6,
  },
  'workflows.automation': {
    feature: 'workflows.automation',
    minDay: 10,
    requiredTasks: ['create-first-workflow'],
  },
  'workflows.templates': {
    feature: 'workflows.templates',
    minDay: 10,
    requiredPoints: 500,
  },

  // Tasks (Day 4+)
  tasks: {
    feature: 'tasks',
    minDay: 4,
  },

  // Team collaboration (Day 8+)
  team: {
    feature: 'team',
    minDay: 8,
    requiredPoints: 300,
  },
  'team.roles': {
    feature: 'team.roles',
    minDay: 10,
    requiredTasks: ['invite-team-member'],
  },

  // Analytics (Day 12+)
  analytics: {
    feature: 'analytics',
    minDay: 12,
    requiredPoints: 600,
  },
  'analytics.custom-reports': {
    feature: 'analytics.custom-reports',
    minDay: 18,
    requiredPoints: 1500,
  },

  // Marketplace (Day 10+)
  marketplace: {
    feature: 'marketplace',
    minDay: 10,
    requiredPoints: 400,
  },
  'marketplace.publish': {
    feature: 'marketplace.publish',
    minDay: 21,
    requiredPoints: 2000,
  },

  // Admin features (Day 15+, Admin role only)
  'admin.users': {
    feature: 'admin.users',
    minDay: 1, // Admin can always access
  },
  'admin.billing': {
    feature: 'admin.billing',
    minDay: 1, // Admin can always access
  },
  'admin.integrations': {
    feature: 'admin.integrations',
    minDay: 12,
    requiredPoints: 500,
  },
};

/**
 * Hook to check if a feature is unlocked for the current user
 */
export function useFeatureUnlock(feature: string) {
  const { data: onboardingData, isLoading } = useQuery<any>({
    queryKey: ['/api/onboarding/progress'],
    retry: false,
  });

  const config = FEATURE_UNLOCKS[feature];
  
  // If no config exists, feature is unlocked by default
  if (!config) {
    return {
      isUnlocked: true,
      isLoading: false,
      reason: null,
      progress: onboardingData?.progress,
    };
  }

  // While loading, optimistically assume locked
  if (isLoading || !onboardingData?.progress) {
    return {
      isUnlocked: false,
      isLoading: true,
      reason: 'Loading...',
      progress: null,
    };
  }

  const { progress, tasks } = onboardingData;
  const completedTaskIds = tasks
    .filter((t: any) => t.isCompleted)
    .map((t: any) => t.id);

  // Check day requirement
  if (config.minDay && progress.currentDay < config.minDay) {
    return {
      isUnlocked: false,
      isLoading: false,
      reason: `Unlocks on Day ${config.minDay}`,
      progress,
      daysRemaining: config.minDay - progress.currentDay,
    };
  }

  // Check required tasks
  if (config.requiredTasks && config.requiredTasks.length > 0) {
    const missingTasks = config.requiredTasks.filter(
      taskId => !completedTaskIds.includes(taskId)
    );
    
    if (missingTasks.length > 0) {
      return {
        isUnlocked: false,
        isLoading: false,
        reason: `Complete required tasks first`,
        progress,
        missingTasks,
      };
    }
  }

  // Check required points
  if (config.requiredPoints && progress.totalScore < config.requiredPoints) {
    return {
      isUnlocked: false,
      isLoading: false,
      reason: `Requires ${config.requiredPoints} points`,
      progress,
      pointsNeeded: config.requiredPoints - progress.totalScore,
    };
  }

  // Feature is unlocked!
  return {
    isUnlocked: true,
    isLoading: false,
    reason: null,
    progress,
  };
}

/**
 * Hook to check multiple features at once
 */
export function useMultipleFeatureUnlocks(features: string[]) {
  const { data: onboardingData, isLoading } = useQuery<any>({
    queryKey: ['/api/onboarding/progress'],
    retry: false,
  });

  if (isLoading || !onboardingData?.progress) {
    return {
      unlockedFeatures: [],
      lockedFeatures: features,
      isLoading: true,
    };
  }

  const results = features.map(feature => ({
    feature,
    ...useFeatureUnlock(feature),
  }));

  return {
    unlockedFeatures: results
      .filter(r => r.isUnlocked)
      .map(r => r.feature),
    lockedFeatures: results
      .filter(r => !r.isUnlocked)
      .map(r => ({
        feature: r.feature,
        reason: r.reason,
        daysRemaining: r.daysRemaining,
        pointsNeeded: r.pointsNeeded,
      })),
    isLoading: false,
    progress: onboardingData.progress,
  };
}

/**
 * Get all unlocked features for current user
 */
export function useUnlockedFeatures() {
  const allFeatures = Object.keys(FEATURE_UNLOCKS);
  return useMultipleFeatureUnlocks(allFeatures);
}
