/**
 * Onboarding Task Templates
 * Defines all tasks for the 21-day onboarding journey
 * Each day has required and optional tasks with points
 */

export interface OnboardingTaskTemplate {
  taskId: string;
  taskType: string;
  title: string;
  description: string;
  requiredForDay: boolean;
  points: number;
  actionUrl?: string;
  estimatedMinutes?: number;
  videoUrl?: string;
}

export const ONBOARDING_TEMPLATES: Record<number, OnboardingTaskTemplate[]> = {
  1: [
    {
      taskId: 'view-client-overview',
      taskType: 'exploration',
      title: 'Explore Client Management',
      description: 'Take a tour of the Clients page to understand how to manage your client relationships',
      requiredForDay: true,
      points: 50,
      actionUrl: '/clients',
      estimatedMinutes: 5,
    },
    {
      taskId: 'complete-profile',
      taskType: 'profile',
      title: 'Complete Your Profile',
      description: 'Add your personal details and preferences to personalize your experience',
      requiredForDay: true,
      points: 100,
      actionUrl: '/settings/profile',
      estimatedMinutes: 10,
    },
    {
      taskId: 'explore-dashboard',
      taskType: 'exploration',
      title: 'Explore Your Dashboard',
      description: 'Get familiar with your dashboard and understand key metrics',
      requiredForDay: false,
      points: 30,
      actionUrl: '/dashboard',
      estimatedMinutes: 3,
    },
  ],
  2: [
    {
      taskId: 'add-first-client',
      taskType: 'client',
      title: 'Add Your First Client',
      description: 'Create a client profile to start managing your relationships',
      requiredForDay: true,
      points: 150,
      actionUrl: '/clients',
      estimatedMinutes: 8,
    },
    {
      taskId: 'explore-ai-agents',
      taskType: 'exploration',
      title: 'Meet Your AI Assistants',
      description: 'Discover how Luca, Cadence, and other AI agents can help automate your work',
      requiredForDay: true,
      points: 75,
      actionUrl: '/ai-agents',
      estimatedMinutes: 5,
    },
    {
      taskId: 'setup-team',
      taskType: 'team',
      title: 'Invite Team Members',
      description: 'Add colleagues to collaborate on client work (optional)',
      requiredForDay: false,
      points: 100,
      actionUrl: '/teams',
      estimatedMinutes: 5,
    },
  ],
  3: [
    {
      taskId: 'create-first-invoice',
      taskType: 'invoice',
      title: 'Create Your First Invoice',
      description: 'Generate a professional invoice for a client',
      requiredForDay: true,
      points: 200,
      actionUrl: '/invoices',
      estimatedMinutes: 10,
    },
    {
      taskId: 'explore-workflows',
      taskType: 'exploration',
      title: 'Explore Workflow Automation',
      description: 'Learn how to automate repetitive tasks with workflows',
      requiredForDay: true,
      points: 100,
      actionUrl: '/workflows',
      estimatedMinutes: 8,
    },
    {
      taskId: 'upload-documents',
      taskType: 'documents',
      title: 'Upload Client Documents',
      description: 'Store important client files securely (optional)',
      requiredForDay: false,
      points: 50,
      actionUrl: '/documents',
      estimatedMinutes: 5,
    },
  ],
  // Days 4-21 can be added incrementally as features are developed
};

/**
 * Get task templates for a specific day
 */
export function getTasksForDay(day: number): OnboardingTaskTemplate[] {
  return ONBOARDING_TEMPLATES[day] || [];
}

/**
 * Check if day has tasks defined
 */
export function hasDayTemplates(day: number): boolean {
  return day in ONBOARDING_TEMPLATES && ONBOARDING_TEMPLATES[day].length > 0;
}

/**
 * Get total days with templates defined
 */
export function getTotalDaysWithTemplates(): number {
  return Object.keys(ONBOARDING_TEMPLATES).length;
}
