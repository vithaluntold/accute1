import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Trophy,
  Star,
  Zap,
  Crown,
  Target,
  Sparkles,
  Gift,
  Award,
} from "lucide-react";

interface Milestone {
  id: string;
  type: 'day_complete' | 'week_complete' | 'points_milestone' | 'streak_milestone' | 'journey_complete';
  title: string;
  description: string;
  icon: typeof Trophy;
  points?: number;
  reward?: string;
  unlockedFeatures?: string[];
}

interface MilestoneCelebrationProps {
  milestone: Milestone | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MilestoneCelebration({
  milestone,
  isOpen,
  onClose,
}: MilestoneCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });

      // Stop confetti after 5 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!milestone) return null;

  const Icon = milestone.icon;

  return (
    <>
      {/* Confetti overlay */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}

      {/* Celebration modal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-md"
          data-testid={`dialog-milestone-${milestone.id}`}
        >
          <DialogHeader>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
              }}
              className="mx-auto mb-4"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                <Icon className="w-12 h-12 text-white" />
              </div>
            </motion.div>

            <DialogTitle className="text-center text-2xl" data-testid="text-milestone-title">
              {milestone.title}
            </DialogTitle>
            <DialogDescription className="text-center text-base" data-testid="text-milestone-description">
              {milestone.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Points earned */}
            {milestone.points && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center justify-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="text-2xl font-bold text-primary">
                      +{milestone.points} points
                    </span>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Reward */}
            {milestone.reward && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-4 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Reward Unlocked!</p>
                      <p className="text-xs text-muted-foreground">
                        {milestone.reward}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Unlocked features */}
            {milestone.unlockedFeatures && milestone.unlockedFeatures.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="p-4 border-primary/20">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium">New Features Unlocked</p>
                    </div>
                    <div className="space-y-1">
                      {milestone.unlockedFeatures.map((feature, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Zap className="w-3 h-3 text-primary" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={onClose}
              className="w-full"
              data-testid="button-milestone-close"
            >
              Continue Journey
              <Sparkles className="w-4 h-4 ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Predefined milestone configurations
export const MILESTONES: Record<string, Milestone> = {
  DAY_1: {
    id: 'day-1-complete',
    type: 'day_complete',
    title: '🎉 Day 1 Complete!',
    description: 'You've taken your first step in mastering Accute. Keep up the momentum!',
    icon: Trophy,
    points: 50,
    reward: 'Onboarding Explorer Badge',
  },
  WEEK_1: {
    id: 'week-1-complete',
    type: 'week_complete',
    title: '🏆 Week 1 Mastered!',
    description: 'Congratulations! You've completed your first week and unlocked core features.',
    icon: Crown,
    points: 200,
    reward: 'Week 1 Champion Badge',
    unlockedFeatures: [
      'Bulk Client Import',
      'Custom Invoice Templates',
      'AI-Powered Document Classification',
    ],
  },
  WEEK_2: {
    id: 'week-2-complete',
    type: 'week_complete',
    title: '⚡ Week 2 Champion!',
    description: 'You're halfway there! Advanced automation features are now available.',
    icon: Zap,
    points: 300,
    reward: 'Automation Expert Badge',
    unlockedFeatures: [
      'Workflow Automation Builder',
      'Recurring Invoice Scheduler',
      'Team Collaboration Tools',
    ],
  },
  WEEK_3: {
    id: 'week-3-complete',
    type: 'week_complete',
    title: '👑 Week 3 Master!',
    description: 'You've unlocked the full power of Accute. You're now an expert user!',
    icon: Award,
    points: 400,
    reward: 'Power User Badge',
    unlockedFeatures: [
      'Advanced Analytics Dashboard',
      'Custom AI Agent Training',
      'API Access',
    ],
  },
  JOURNEY_COMPLETE: {
    id: 'journey-complete',
    type: 'journey_complete',
    title: '🌟 Journey Complete!',
    description: 'You've completed the 21-day onboarding journey! You're now a certified Accute expert.',
    icon: Crown,
    points: 1000,
    reward: 'Accute Expert Certification',
    unlockedFeatures: [
      'Premium Support Access',
      'Beta Feature Early Access',
      'Marketplace Publishing Rights',
    ],
  },
  STREAK_7: {
    id: 'streak-7-days',
    type: 'streak_milestone',
    title: '🔥 7-Day Streak!',
    description: 'You've logged in for 7 consecutive days. Consistency is key!',
    icon: Zap,
    points: 100,
    reward: 'Consistency Champion Badge',
  },
  STREAK_14: {
    id: 'streak-14-days',
    type: 'streak_milestone',
    title: '🔥 14-Day Streak!',
    description: 'Two weeks of consistent engagement! You're building great habits.',
    icon: Trophy,
    points: 250,
    reward: 'Dedication Badge',
  },
  POINTS_500: {
    id: 'points-500',
    type: 'points_milestone',
    title: '⭐ 500 Points Milestone!',
    description: 'You've earned 500 points! Your productivity is impressive.',
    icon: Star,
    points: 50,
    reward: 'High Achiever Badge',
  },
  POINTS_1000: {
    id: 'points-1000',
    type: 'points_milestone',
    title: '💎 1000 Points Milestone!',
    description: 'Incredible! You've reached 1000 points. You're a power user.',
    icon: Crown,
    points: 100,
    reward: 'Elite User Badge',
  },
};

// Hook to trigger milestone celebrations
export function useMilestoneCelebration() {
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const celebrate = (milestoneKey: keyof typeof MILESTONES) => {
    const milestone = MILESTONES[milestoneKey];
    if (milestone) {
      setActiveMilestone(milestone);
      setIsOpen(true);
    }
  };

  const close = () => {
    setIsOpen(false);
    setTimeout(() => setActiveMilestone(null), 300);
  };

  return {
    celebrate,
    close,
    milestone: activeMilestone,
    isOpen,
  };
}
