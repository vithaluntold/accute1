import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook to automatically complete onboarding tasks when user performs specific actions
 */
export function useOnboardingTaskTrigger() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest(`/api/onboarding/tasks/${taskId}/complete`, {
        method: 'POST',
      });
    },
    onSuccess: async (result) => {
      // Refresh onboarding progress
      await queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress'] });
      
      // Show success notification
      const task = result.task;
      if (task && task.points) {
        toast({
          title: "Task completed!",
          description: `+${task.points} points earned`,
        });
      }
    },
    onError: (error: any) => {
      // Silently fail - task may already be completed
      console.warn('Task completion failed:', error);
    },
  });

  /**
   * Trigger a task completion
   * @param taskId - The onboarding task ID to complete
   * @param silent - If true, don't show toast notifications (default: false)
   */
  const triggerTask = (taskId: string, silent: boolean = false) => {
    completeMutation.mutate(taskId);
  };

  return {
    triggerTask,
    isTriggering: completeMutation.isPending,
  };
}

/**
 * Hook to automatically trigger a task when component mounts
 * Useful for "view" tasks like viewing a page for the first time
 */
export function useOnboardingPageView(taskId: string, enabled: boolean = true) {
  const { triggerTask } = useOnboardingTaskTrigger();

  useEffect(() => {
    if (enabled) {
      // Delay slightly to ensure page has rendered
      const timer = setTimeout(() => {
        triggerTask(taskId, true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [taskId, enabled]);
}

/**
 * Map of actions to onboarding task IDs
 * This makes it easy to trigger the right task based on user actions
 */
export const ONBOARDING_TRIGGERS = {
  // Client actions
  'client.view_list': 'view-client-list',
  'client.create': 'add-first-client',
  'client.import': 'import-clients-bulk',
  
  // Document actions
  'document.view_list': 'view-document-list',
  'document.upload': 'upload-first-document',
  'document.esign': 'send-first-esignature',
  'document.create_folder': 'organize-documents-folders',
  
  // Invoice actions
  'invoice.view_list': 'view-invoice-list',
  'invoice.create': 'create-first-invoice',
  'invoice.send': 'send-first-invoice',
  'invoice.receive_payment': 'receive-first-payment',
  
  // Workflow actions
  'workflow.view_list': 'view-workflow-list',
  'workflow.create': 'create-first-workflow',
  'workflow.assign': 'assign-first-workflow',
  'workflow.automation': 'setup-workflow-automation',
  
  // AI Agent actions
  'agent.view_list': 'view-ai-agents',
  'agent.chat': 'chat-with-ai-agent',
  'agent.marketplace': 'browse-agent-marketplace',
  
  // Team actions
  'team.invite': 'invite-team-member',
  'team.assign_role': 'configure-team-roles',
  
  // Settings actions
  'settings.profile': 'complete-profile',
  'settings.billing': 'configure-payment-gateway',
  'settings.integration': 'connect-first-integration',
  
  // Onboarding actions
  'onboarding.view': 'view-onboarding-checklist',
  'onboarding.complete_day': 'complete-all-day-tasks',
} as const;
