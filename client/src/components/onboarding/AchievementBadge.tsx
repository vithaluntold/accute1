import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Star,
  Zap,
  Crown,
  Award,
  Target,
  Flame,
  Sparkles,
  Medal,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type BadgeCategory = 'streak' | 'points' | 'completion' | 'special';

interface AchievementBadgeData {
  id: string;
  name: string;
  description: string;
  icon: typeof Trophy;
  rarity: BadgeRarity;
  category: BadgeCategory;
  earnedAt?: Date;
  progress?: number; // 0-100 for in-progress badges
  maxProgress?: number;
}

interface AchievementBadgeProps {
  badge: AchievementBadgeData;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  className?: string;
}

const RARITY_COLORS = {
  common: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-600 dark:text-gray-400',
    glow: 'shadow-gray-500/20',
  },
  rare: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  epic: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'shadow-purple-500/20',
  },
  legendary: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-600 dark:text-yellow-400',
    glow: 'shadow-yellow-500/20',
  },
};

const SIZE_CONFIG = {
  sm: {
    iconSize: 'w-6 h-6',
    iconContainer: 'w-12 h-12',
    textSize: 'text-xs',
    descSize: 'text-[10px]',
  },
  md: {
    iconSize: 'w-8 h-8',
    iconContainer: 'w-16 h-16',
    textSize: 'text-sm',
    descSize: 'text-xs',
  },
  lg: {
    iconSize: 'w-12 h-12',
    iconContainer: 'w-24 h-24',
    textSize: 'text-base',
    descSize: 'text-sm',
  },
};

export function AchievementBadge({
  badge,
  size = 'md',
  showProgress = true,
  className,
}: AchievementBadgeProps) {
  const Icon = badge.icon;
  const colors = RARITY_COLORS[badge.rarity];
  const sizes = SIZE_CONFIG[size];
  const isEarned = !!badge.earnedAt;
  const isInProgress = !isEarned && badge.progress !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
      className={className}
      data-testid={`badge-${badge.id}`}
    >
      <Card
        className={cn(
          "p-4 border-2 transition-all",
          colors.border,
          colors.bg,
          isEarned && `${colors.glow} shadow-lg`,
          !isEarned && "opacity-60 grayscale"
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          {/* Badge icon */}
          <div
            className={cn(
              "rounded-full flex items-center justify-center",
              sizes.iconContainer,
              isEarned ? `${colors.bg} border-2 ${colors.border}` : 'bg-muted border-2 border-muted'
            )}
          >
            <Icon
              className={cn(
                sizes.iconSize,
                isEarned ? colors.text : 'text-muted-foreground'
              )}
            />
          </div>

          {/* Badge name */}
          <div className="space-y-0.5">
            <p
              className={cn(
                "font-medium",
                sizes.textSize,
                isEarned ? colors.text : 'text-muted-foreground'
              )}
            >
              {badge.name}
            </p>
            <p
              className={cn(
                "text-muted-foreground",
                sizes.descSize
              )}
            >
              {badge.description}
            </p>
          </div>

          {/* Rarity badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] capitalize",
              isEarned ? colors.text : ''
            )}
          >
            {badge.rarity}
          </Badge>

          {/* Earned date or progress */}
          {isEarned && badge.earnedAt && (
            <p className="text-[10px] text-muted-foreground">
              Earned {new Date(badge.earnedAt).toLocaleDateString()}
            </p>
          )}

          {isInProgress && showProgress && (
            <div className="w-full space-y-1">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${badge.progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    `bg-gradient-to-r from-${colors.text.replace('text-', '')} to-${colors.text.replace('text-', '')}/70`
                  )}
                  style={{
                    background: `linear-gradient(to right, currentColor, currentColor)`,
                  }}
                  className={colors.text}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                {badge.progress}% complete
              </p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// Badge Grid Component
interface AchievementGridProps {
  badges: AchievementBadgeData[];
  size?: 'sm' | 'md' | 'lg';
  columns?: number;
}

export function AchievementGrid({
  badges,
  size = 'md',
  columns = 3,
}: AchievementGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4"
      )}
      data-testid="achievement-grid"
    >
      {badges.map((badge) => (
        <AchievementBadge key={badge.id} badge={badge} size={size} />
      ))}
    </div>
  );
}

// Predefined badge configurations
export const ACHIEVEMENT_BADGES: Record<string, Omit<AchievementBadgeData, 'earnedAt' | 'progress'>> = {
  // Streak badges
  STREAK_7: {
    id: 'streak-7',
    name: 'Week Warrior',
    description: '7-day login streak',
    icon: Flame,
    rarity: 'common',
    category: 'streak',
  },
  STREAK_14: {
    id: 'streak-14',
    name: 'Fortnight Champion',
    description: '14-day login streak',
    icon: Zap,
    rarity: 'rare',
    category: 'streak',
  },
  STREAK_21: {
    id: 'streak-21',
    name: 'Consistency Master',
    description: '21-day login streak',
    icon: Crown,
    rarity: 'epic',
    category: 'streak',
  },

  // Points badges
  POINTS_500: {
    id: 'points-500',
    name: 'Rising Star',
    description: 'Earned 500 points',
    icon: Star,
    rarity: 'common',
    category: 'points',
  },
  POINTS_1000: {
    id: 'points-1000',
    name: 'Elite Achiever',
    description: 'Earned 1000 points',
    icon: Trophy,
    rarity: 'rare',
    category: 'points',
  },
  POINTS_2500: {
    id: 'points-2500',
    name: 'Power User',
    description: 'Earned 2500 points',
    icon: Crown,
    rarity: 'epic',
    category: 'points',
  },

  // Completion badges
  WEEK_1_COMPLETE: {
    id: 'week-1-complete',
    name: 'Week 1 Champion',
    description: 'Completed Week 1 of onboarding',
    icon: Medal,
    rarity: 'common',
    category: 'completion',
  },
  WEEK_2_COMPLETE: {
    id: 'week-2-complete',
    name: 'Automation Expert',
    description: 'Completed Week 2 of onboarding',
    icon: Zap,
    rarity: 'rare',
    category: 'completion',
  },
  WEEK_3_COMPLETE: {
    id: 'week-3-complete',
    name: 'Accute Master',
    description: 'Completed Week 3 of onboarding',
    icon: Crown,
    rarity: 'epic',
    category: 'completion',
  },
  JOURNEY_COMPLETE: {
    id: 'journey-complete',
    name: 'Certified Expert',
    description: 'Completed 21-day journey',
    icon: Award,
    rarity: 'legendary',
    category: 'completion',
  },

  // Special badges
  FIRST_CLIENT: {
    id: 'first-client',
    name: 'Client Pioneer',
    description: 'Added your first client',
    icon: Target,
    rarity: 'common',
    category: 'special',
  },
  FIRST_INVOICE: {
    id: 'first-invoice',
    name: 'Invoice Initiator',
    description: 'Created your first invoice',
    icon: Sparkles,
    rarity: 'common',
    category: 'special',
  },
  FIRST_WORKFLOW: {
    id: 'first-workflow',
    name: 'Automation Pioneer',
    description: 'Built your first workflow',
    icon: Zap,
    rarity: 'rare',
    category: 'special',
  },
  AI_EXPLORER: {
    id: 'ai-explorer',
    name: 'AI Explorer',
    description: 'Chatted with all 10 AI agents',
    icon: Shield,
    rarity: 'epic',
    category: 'special',
  },
};
