import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, CheckCircle2, Award, Globe, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeType = "security" | "compliance" | "integration" | "customer" | "custom";

export interface TrustBadgeData {
  type: BadgeType;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  verified?: boolean;
}

interface TrustBadgeProps {
  badge: TrustBadgeData;
  className?: string;
  compact?: boolean;
}

const typeIcons: Record<BadgeType, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  compliance: CheckCircle2,
  integration: Globe,
  customer: Users,
  custom: Award,
};

export function TrustBadge({ badge, className, compact = false }: TrustBadgeProps) {
  const Icon = badge.icon || typeIcons[badge.type];

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border",
          className
        )}
        data-testid="badge-trust-compact"
      >
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{badge.label}</span>
        {badge.verified && (
          <CheckCircle2 className="h-3 w-3 text-green-500 dark:text-green-400" />
        )}
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="card-trust-badge">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm" data-testid="badge-label">
                {badge.label}
              </h4>
              {badge.verified && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            {badge.description && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="badge-description">
                {badge.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TrustBadgeGridProps {
  badges: TrustBadgeData[];
  title?: string;
  compact?: boolean;
  className?: string;
}

export function TrustBadgeGrid({
  badges,
  title = "Trust & Security",
  compact = false,
  className,
}: TrustBadgeGridProps) {
  if (compact) {
    return (
      <div className={cn("space-y-3", className)} data-testid="grid-trust-badges">
        {title && (
          <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        )}
        <div className="flex flex-wrap gap-2">
          {badges.map((badge, index) => (
            <TrustBadge key={index} badge={badge} compact />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="grid-trust-badges">
      {title && (
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          {title}
        </h3>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((badge, index) => (
          <TrustBadge key={index} badge={badge} />
        ))}
      </div>
    </div>
  );
}

// Pre-configured trust badges for quick integration
export const DEFAULT_TRUST_BADGES: TrustBadgeData[] = [
  {
    type: "security",
    label: "256-bit Encryption",
    description: "Bank-level AES-256-GCM encryption for all sensitive data",
    verified: true,
  },
  {
    type: "compliance",
    label: "SOC 2 Type II",
    description: "Independently audited security and availability controls",
    verified: true,
  },
  {
    type: "compliance",
    label: "GDPR Compliant",
    description: "Full compliance with EU data protection regulations",
    verified: true,
  },
  {
    type: "security",
    label: "Multi-Factor Auth",
    description: "TOTP-based MFA with trusted device management",
    verified: true,
  },
  {
    type: "integration",
    label: "50+ Integrations",
    description: "Seamless connections with leading accounting tools",
    verified: false,
  },
  {
    type: "customer",
    label: "24/7 Support",
    description: "Round-the-clock assistance for enterprise clients",
    verified: true,
  },
];
