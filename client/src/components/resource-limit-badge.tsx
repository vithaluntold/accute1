import { useResourceLimit, type ResourceLimit } from '@/hooks/use-subscription';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ResourceLimitBadgeProps {
  resource: ResourceLimit;
  showProgress?: boolean;
  compact?: boolean;
}

/**
 * Resource Limit Badge
 * Displays current usage vs limit with visual indicators
 * 
 * @example
 * <ResourceLimitBadge resource="maxClients" showProgress />
 */
export function ResourceLimitBadge({ 
  resource, 
  showProgress = false,
  compact = false 
}: ResourceLimitBadgeProps) {
  const { limit, current, percentage, isAtLimit, isNearLimit, isUnlimited, isLoading } = useResourceLimit(resource);

  if (isLoading) {
    return null;
  }

  const getIcon = () => {
    if (isUnlimited) return <CheckCircle className="h-3 w-3" />;
    if (isAtLimit) return <AlertCircle className="h-3 w-3" />;
    if (isNearLimit) return <AlertTriangle className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  const getVariant = (): "default" | "destructive" | "outline" | "secondary" => {
    if (isUnlimited) return "default";
    if (isAtLimit) return "destructive";
    if (isNearLimit) return "secondary";
    return "default";
  };

  const label = compact 
    ? (isUnlimited ? `${current}/∞` : `${current}/${limit}`)
    : (isUnlimited ? `${current} ${formatResourceName(resource)} (Unlimited)` : `${current} of ${limit} ${formatResourceName(resource)}`);

  const content = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {getIcon()}
        <span className="font-medium">{label}</span>
      </div>
      {showProgress && !isUnlimited && (
        <div className="space-y-1">
          <Progress value={percentage} className="h-2" data-testid={`progress-${resource}`} />
          <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}% used</p>
        </div>
      )}
      {showProgress && isUnlimited && (
        <p className="text-xs text-muted-foreground">Unlimited plan - no restrictions</p>
      )}
      {isAtLimit && !isUnlimited && (
        <p className="text-xs text-destructive">
          Limit reached. Upgrade to add more.
        </p>
      )}
      {isNearLimit && !isAtLimit && !isUnlimited && (
        <p className="text-xs text-muted-foreground">
          Approaching limit. Consider upgrading.
        </p>
      )}
    </div>
  );

  if (showProgress) {
    return (
      <div className="rounded-lg border p-3" data-testid={`limit-badge-${resource}`}>
        {content}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={getVariant()} className="gap-1.5" data-testid={`limit-badge-${resource}`}>
            {getIcon()}
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isUnlimited ? 'Unlimited plan' : `${percentage.toFixed(0)}% of limit used`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatResourceName(resource: ResourceLimit): string {
  return resource
    .replace('max', '')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
}
