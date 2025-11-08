import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Clock, CheckCircle2, Sparkles, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlatformStat {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  color?: "primary" | "accent" | "success" | "warning";
}

interface SocialProofStatsProps {
  stats: PlatformStat[];
  title?: string;
  description?: string;
  className?: string;
}

const colorClasses = {
  primary: "text-primary",
  accent: "text-accent",
  success: "text-green-500 dark:text-green-400",
  warning: "text-amber-500 dark:text-amber-400",
};

export function SocialProofStats({
  stats,
  title = "Platform Impact",
  description = "Real-time usage across all accounting firms",
  className,
}: SocialProofStatsProps) {
  return (
    <Card className={cn("overflow-hidden", className)} data-testid="card-social-proof-stats">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            const colorClass = stat.color ? colorClasses[stat.color] : "text-muted-foreground";
            
            return (
              <div
                key={index}
                className="flex flex-col gap-2"
                data-testid={`stat-item-${index}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", colorClass)} />
                  {stat.trend && (
                    <span className="text-xs text-green-500 dark:text-green-400 font-medium">
                      {stat.trend}
                    </span>
                  )}
                </div>
                <div>
                  <div
                    className="text-2xl font-bold tabular-nums"
                    data-testid={`stat-value-${index}`}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="text-xs text-muted-foreground mt-0.5"
                    data-testid={`stat-label-${index}`}
                  >
                    {stat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Pre-configured platform stats for quick integration
export const DEFAULT_PLATFORM_STATS: PlatformStat[] = [
  {
    label: "Active Firms",
    value: "247",
    icon: Building2,
    trend: "+12%",
    color: "primary",
  },
  {
    label: "Tasks Completed",
    value: "15.2K",
    icon: CheckCircle2,
    trend: "+23%",
    color: "success",
  },
  {
    label: "Hours Saved",
    value: "3,840",
    icon: Clock,
    color: "accent",
  },
  {
    label: "Active Users",
    value: "1,429",
    icon: Users,
    trend: "+8%",
    color: "primary",
  },
  {
    label: "Workflows Run",
    value: "8,932",
    icon: TrendingUp,
    trend: "+31%",
    color: "success",
  },
  {
    label: "AI Insights",
    value: "42.1K",
    icon: Sparkles,
    trend: "+45%",
    color: "accent",
  },
];
