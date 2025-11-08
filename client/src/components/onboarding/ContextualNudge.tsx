import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Lightbulb, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";

export type NudgeType = 'tooltip' | 'banner' | 'modal';
export type NudgeTrigger = 
  | 'page_visit'
  | 'feature_hover'
  | 'idle_time'
  | 'incomplete_action'
  | 'milestone_reached';

interface ContextualNudgeProps {
  nudgeId: string;
  type?: NudgeType;
  trigger?: NudgeTrigger;
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
  showOnce?: boolean;
  delayMs?: number;
  condition?: () => boolean;
}

export function ContextualNudge({
  nudgeId,
  type = 'banner',
  trigger = 'page_visit',
  title,
  description,
  actionLabel,
  actionUrl,
  onAction,
  onDismiss,
  dismissible = true,
  showOnce = true,
  delayMs = 0,
  condition,
}: ContextualNudgeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Check if nudge was already shown/dismissed
  const localStorageKey = `nudge-dismissed-${nudgeId}`;
  const isDismissed = showOnce && localStorage.getItem(localStorageKey) === 'true';

  // Track nudge impression
  const trackNudgeMutation = useMutation({
    mutationFn: async (action: 'shown' | 'dismissed' | 'action_taken') => {
      return await apiRequest('/api/onboarding/nudges/track', {
        method: 'POST',
        body: JSON.stringify({
          nudgeId,
          action,
          trigger,
        }),
      });
    },
  });

  useEffect(() => {
    // Don't show if already dismissed
    if (isDismissed) return;

    // Check custom condition
    if (condition && !condition()) return;

    // Show nudge after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
      trackNudgeMutation.mutate('shown');
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isDismissed, delayMs]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (showOnce) {
      localStorage.setItem(localStorageKey, 'true');
    }
    trackNudgeMutation.mutate('dismissed');
    onDismiss?.();
  };

  const handleAction = () => {
    trackNudgeMutation.mutate('action_taken');
    onAction?.();
    if (actionUrl) {
      window.location.href = actionUrl;
    }
    handleDismiss();
  };

  if (!isVisible) return null;

  // Tooltip variant (appears near UI elements)
  if (type === 'tooltip') {
    return (
      <div
        className="absolute z-50 max-w-xs p-3 bg-popover text-popover-foreground rounded-md shadow-lg border animate-in fade-in slide-in-from-top-2"
        data-testid={`nudge-tooltip-${nudgeId}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Arrow pointer */}
        <div className="absolute -bottom-2 left-4 w-4 h-4 bg-popover border-b border-r rotate-45" />
        
        <div className="relative space-y-2">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {dismissible && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 -mt-1 -mr-1"
                onClick={handleDismiss}
                data-testid={`button-dismiss-nudge-${nudgeId}`}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          {actionLabel && (
            <Button
              size="sm"
              variant="default"
              className="w-full"
              onClick={handleAction}
              data-testid={`button-action-nudge-${nudgeId}`}
            >
              {actionLabel}
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Banner variant (full-width at top of section)
  if (type === 'banner') {
    return (
      <Card
        className="mb-4 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2"
        data-testid={`nudge-banner-${nudgeId}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{title}</h4>
                <Badge variant="secondary" className="text-xs">
                  Tip
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
              
              {actionLabel && (
                <Button
                  size="sm"
                  variant="default"
                  className="mt-2"
                  onClick={handleAction}
                  data-testid={`button-action-nudge-${nudgeId}`}
                >
                  {actionLabel}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            
            {dismissible && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismiss}
                data-testid={`button-dismiss-nudge-${nudgeId}`}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// Hook for managing nudges based on onboarding state
export function useOnboardingNudge(pageContext: string) {
  const { data: onboardingData } = useQuery<any>({
    queryKey: ['/api/onboarding/progress'],
    retry: false,
  });

  const shouldShowNudge = (nudgeConfig: {
    minDay?: number;
    maxDay?: number;
    requiredTask?: string;
    excludeIfCompleted?: string;
  }) => {
    if (!onboardingData?.progress) return false;

    const { currentDay, completedTasks } = onboardingData.progress;

    // Check day range
    if (nudgeConfig.minDay && currentDay < nudgeConfig.minDay) return false;
    if (nudgeConfig.maxDay && currentDay > nudgeConfig.maxDay) return false;

    // Check required task completion
    if (nudgeConfig.requiredTask && !completedTasks?.includes(nudgeConfig.requiredTask)) {
      return false;
    }

    // Check exclusion condition
    if (nudgeConfig.excludeIfCompleted && completedTasks?.includes(nudgeConfig.excludeIfCompleted)) {
      return false;
    }

    return true;
  };

  return {
    onboardingProgress: onboardingData?.progress,
    shouldShowNudge,
  };
}
