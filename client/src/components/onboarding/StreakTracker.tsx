import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Calendar, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakTrackerProps {
  currentStreak: number;
  longestStreak: number;
  lastActivityAt?: Date;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export function StreakTracker({
  currentStreak,
  longestStreak,
  lastActivityAt,
  size = 'md',
  showDetails = true,
}: StreakTrackerProps) {
  const isActive = lastActivityAt 
    ? isToday(new Date(lastActivityAt))
    : false;

  const streakLevel = getStreakLevel(currentStreak);
  const nextMilestone = getNextMilestone(currentStreak);

  return (
    <Card
      className={cn(
        "border-2 transition-all",
        currentStreak >= 7 && "border-orange-500/30 bg-orange-500/5",
        currentStreak >= 14 && "border-red-500/30 bg-red-500/5",
        currentStreak >= 21 && "border-yellow-500/30 bg-yellow-500/5 shadow-yellow-500/20 shadow-lg"
      )}
      data-testid="card-streak-tracker"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className={cn(
              "w-5 h-5",
              currentStreak >= 7 ? "text-orange-500" : "text-muted-foreground",
              currentStreak >= 14 && "text-red-500",
              currentStreak >= 21 && "text-yellow-500"
            )} />
            <span>Login Streak</span>
          </CardTitle>
          {isActive && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              Active Today
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main streak display */}
        <div className="flex items-center justify-center py-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="relative"
          >
            {/* Animated glow effect */}
            {currentStreak >= 7 && (
              <motion.div
                className="absolute inset-0 rounded-full opacity-20"
                style={{
                  background: currentStreak >= 21 
                    ? 'radial-gradient(circle, #eab308 0%, transparent 70%)'
                    : currentStreak >= 14
                    ? 'radial-gradient(circle, #ef4444 0%, transparent 70%)'
                    : 'radial-gradient(circle, #f97316 0%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}

            {/* Streak number */}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex flex-col items-center justify-center border-4 border-orange-500/30">
              <Flame className={cn(
                "w-8 h-8 mb-1",
                currentStreak >= 21 ? "text-yellow-500" :
                currentStreak >= 14 ? "text-red-500" :
                currentStreak >= 7 ? "text-orange-500" :
                "text-orange-400"
              )} />
              <span className="text-4xl font-bold">{currentStreak}</span>
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </motion.div>
        </div>

        {showDetails && (
          <>
            {/* Streak level */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{streakLevel.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {streakLevel.description}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-muted/50 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span className="text-xs text-muted-foreground">Longest</span>
                </div>
                <p className="text-lg font-bold">{longestStreak}</p>
              </div>

              <div className="p-3 rounded-md bg-muted/50 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Calendar className="w-3 h-3 text-primary" />
                  <span className="text-xs text-muted-foreground">Next Goal</span>
                </div>
                <p className="text-lg font-bold">{nextMilestone}</p>
              </div>
            </div>

            {/* Progress to next milestone */}
            {currentStreak < nextMilestone && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Progress to {nextMilestone}-day milestone
                  </span>
                  <span className="font-medium">
                    {currentStreak}/{nextMilestone}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentStreak / nextMilestone) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                  />
                </div>
              </div>
            )}

            {/* Last activity */}
            {lastActivityAt && (
              <p className="text-xs text-muted-foreground text-center">
                Last activity: {formatRelativeTime(new Date(lastActivityAt))}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Compact streak display (for use in headers/sidebars)
export function StreakBadge({ currentStreak }: { currentStreak: number }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
        currentStreak >= 21 ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
        currentStreak >= 14 ? "bg-red-500/10 text-red-600 dark:text-red-400" :
        currentStreak >= 7 ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
        "bg-muted text-muted-foreground"
      )}
      data-testid="badge-streak"
    >
      <Flame className="w-3 h-3" />
      <span>{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
    </motion.div>
  );
}

// Mini streak calendar (7-day view)
interface StreakCalendarProps {
  completedDays: Date[];
  currentStreak: number;
}

export function StreakCalendar({ completedDays, currentStreak }: StreakCalendarProps) {
  const last7Days = getLast7Days();
  
  return (
    <div className="space-y-2" data-testid="streak-calendar">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Last 7 Days</span>
        <StreakBadge currentStreak={currentStreak} />
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {last7Days.map((day, index) => {
          const isCompleted = completedDays.some(d => 
            isSameDay(new Date(d), day)
          );
          const isToday = isSameDay(day, new Date());
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[10px] text-muted-foreground">
                {day.toLocaleDateString('en-US', { weekday: 'short' })[0]}
              </span>
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                  isCompleted && "bg-primary text-primary-foreground shadow-lg",
                  !isCompleted && "bg-muted text-muted-foreground",
                  isToday && "ring-2 ring-primary ring-offset-2"
                )}
              >
                {isCompleted && <Flame className="w-4 h-4" />}
                {!isCompleted && day.getDate()}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Helper functions
function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

function getLast7Days(): Date[] {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    days.push(day);
  }
  return days;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function getStreakLevel(streak: number) {
  if (streak >= 21) {
    return {
      name: 'Legendary Streak',
      description: 'You're unstoppable! 21+ days of consistency.',
    };
  }
  if (streak >= 14) {
    return {
      name: 'Epic Streak',
      description: 'Two weeks strong! Keep it going.',
    };
  }
  if (streak >= 7) {
    return {
      name: 'Power Streak',
      description: 'One full week! Great momentum.',
    };
  }
  if (streak >= 3) {
    return {
      name: 'Building Momentum',
      description: 'Good start! Keep logging in daily.',
    };
  }
  return {
    name: 'Getting Started',
    description: 'Log in daily to build your streak!',
  };
}

function getNextMilestone(current: number): number {
  const milestones = [3, 7, 14, 21, 30, 60, 90, 180, 365];
  return milestones.find(m => m > current) || current + 30;
}
