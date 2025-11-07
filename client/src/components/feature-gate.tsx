import { ReactNode } from 'react';
import { useFeatureAccess, type FeatureIdentifier } from '@/hooks/use-subscription';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';

interface FeatureGateProps {
  feature: FeatureIdentifier;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * Feature Gate Component
 * Conditionally renders children based on subscription access
 * 
 * @example
 * <FeatureGate feature="ai_agents">
 *   <AIAgentList />
 * </FeatureGate>
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useFeatureAccess(feature);
  const [, navigate] = useLocation();

  if (isLoading) {
    return null;
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return (
        <div className="flex items-center justify-center p-8">
          <Alert className="max-w-lg border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid={`upgrade-prompt-${feature}`}>
            <Lock className="h-5 w-5 text-primary" />
            <AlertTitle className="text-lg font-semibold">Premium Feature</AlertTitle>
            <AlertDescription className="mt-2 space-y-4">
              <p className="text-muted-foreground">
                This feature is not available in your current plan. Upgrade to unlock {feature.replace(/_/g, ' ')}.
              </p>
              <Button 
                onClick={() => navigate('/settings/billing')}
                className="w-full"
                data-testid="button-upgrade-plan"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
}

/**
 * Inline Feature Lock - Shows a lock icon with tooltip
 * Use for buttons or menu items that should be visible but disabled
 */
interface FeatureLockProps {
  feature: FeatureIdentifier;
  children: ReactNode;
  tooltip?: string;
}

export function FeatureLock({ feature, children, tooltip }: FeatureLockProps) {
  const { hasAccess } = useFeatureAccess(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative opacity-50" title={tooltip || `Requires ${feature.replace(/_/g, ' ')} feature`}>
      {children}
      <Lock className="absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-muted-foreground" data-testid={`lock-icon-${feature}`} />
    </div>
  );
}
