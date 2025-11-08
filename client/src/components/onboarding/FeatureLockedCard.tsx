import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Calendar, Star, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface FeatureLockedCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  unlockDay?: number;
  currentDay?: number;
  pointsRequired?: number;
  currentPoints?: number;
  tasksRequired?: string[];
  className?: string;
}

export function FeatureLockedCard({
  title,
  description,
  icon,
  unlockDay,
  currentDay = 1,
  pointsRequired,
  currentPoints = 0,
  tasksRequired = [],
  className,
}: FeatureLockedCardProps) {
  const [, setLocation] = useLocation();
  const daysRemaining = unlockDay ? unlockDay - currentDay : 0;
  const pointsRemaining = pointsRequired ? pointsRequired - currentPoints : 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-2 border-dashed border-muted-foreground/30 bg-muted/30",
        className
      )}
      data-testid="card-feature-locked"
    >
      {/* Locked overlay */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10" />

      <CardContent className="relative z-20 p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          {icon && (
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted flex-shrink-0 opacity-50">
              {icon}
            </div>
          )}

          <div className="flex-1 space-y-3">
            {/* Title with lock badge */}
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{title}</h3>
              <Badge variant="outline" className="gap-1">
                <Lock className="w-3 h-3" />
                Locked
              </Badge>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground">{description}</p>

            {/* Unlock requirements */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Unlock Requirements:
              </p>

              <div className="space-y-1.5">
                {/* Day requirement */}
                {unlockDay && (
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center",
                        currentDay >= unlockDay
                          ? "bg-green-500"
                          : "bg-muted border border-muted-foreground/30"
                      )}
                    >
                      {currentDay >= unlockDay ? (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      ) : (
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <span className={cn(
                      currentDay >= unlockDay
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                    )}>
                      {currentDay >= unlockDay
                        ? `Day ${unlockDay} reached ✓`
                        : `Reach Day ${unlockDay} (${daysRemaining} days remaining)`
                      }
                    </span>
                  </div>
                )}

                {/* Points requirement */}
                {pointsRequired && (
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center",
                        currentPoints >= pointsRequired
                          ? "bg-green-500"
                          : "bg-muted border border-muted-foreground/30"
                      )}
                    >
                      {currentPoints >= pointsRequired ? (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      ) : (
                        <Star className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <span className={cn(
                      currentPoints >= pointsRequired
                        ? "text-green-600 dark:text-green-400"
                        : "text-muted-foreground"
                    )}>
                      {currentPoints >= pointsRequired
                        ? `${pointsRequired} points earned ✓`
                        : `Earn ${pointsRequired} points (${pointsRemaining} remaining)`
                      }
                    </span>
                  </div>
                )}

                {/* Tasks requirement */}
                {tasksRequired.length > 0 && (
                  <div className="space-y-1">
                    {tasksRequired.map((task, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded-full bg-muted border border-muted-foreground/30 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className="text-muted-foreground">
                          Complete: {task}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/onboarding')}
              className="mt-2"
              data-testid="button-view-onboarding"
            >
              View Onboarding Tasks
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact locked badge for sidebar items
export function FeatureLockedBadge({ unlockDay }: { unlockDay: number }) {
  return (
    <Badge variant="outline" className="gap-1 text-[10px] py-0 h-4">
      <Lock className="w-2.5 h-2.5" />
      Day {unlockDay}
    </Badge>
  );
}
