import { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/use-window-size";
import { Trophy, Star, Zap, Award, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type CelebrationType = 
  | "task-complete"
  | "milestone"
  | "achievement"
  | "first-time"
  | "streak"
  | "level-up";

export interface MicroCelebrationProps {
  type: CelebrationType;
  title: string;
  message?: string;
  show: boolean;
  onComplete?: () => void;
  duration?: number; // milliseconds
}

const celebrationConfig: Record<CelebrationType, {
  icon: typeof Trophy;
  color: string;
  confettiColors: string[];
  intensity: number;
}> = {
  "task-complete": {
    icon: Target,
    color: "text-green-600 dark:text-green-400",
    confettiColors: ["#22c55e", "#86efac", "#4ade80"],
    intensity: 50,
  },
  "milestone": {
    icon: Award,
    color: "text-purple-600 dark:text-purple-400",
    confettiColors: ["#a855f7", "#c084fc", "#e9d5ff"],
    intensity: 100,
  },
  "achievement": {
    icon: Trophy,
    color: "text-yellow-600 dark:text-yellow-400",
    confettiColors: ["#eab308", "#fbbf24", "#fde047"],
    intensity: 150,
  },
  "first-time": {
    icon: Sparkles,
    color: "text-blue-600 dark:text-blue-400",
    confettiColors: ["#3b82f6", "#60a5fa", "#93c5fd"],
    intensity: 80,
  },
  "streak": {
    icon: Zap,
    color: "text-orange-600 dark:text-orange-400",
    confettiColors: ["#f97316", "#fb923c", "#fdba74"],
    intensity: 120,
  },
  "level-up": {
    icon: Star,
    color: "text-pink-600 dark:text-pink-400",
    confettiColors: ["#ec4899", "#f472b6", "#fbcfe8"],
    intensity: 200,
  },
};

export function MicroCelebration({
  type,
  title,
  message,
  show,
  onComplete,
  duration = 3000,
}: MicroCelebrationProps) {
  const { width, height } = useWindowSize();
  const [isVisible, setIsVisible] = useState(false);
  const config = celebrationConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  if (!isVisible) return null;

  return (
    <>
      {/* Confetti Effect */}
      <Confetti
        width={width}
        height={height}
        numberOfPieces={config.intensity}
        colors={config.confettiColors}
        recycle={false}
        gravity={0.3}
        data-testid="confetti-effect"
      />

      {/* Celebration Toast */}
      <div
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 fade-in duration-500"
        data-testid="celebration-toast"
      >
        <Card className="px-6 py-4 shadow-lg border-2">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "p-3 rounded-full bg-gradient-to-br animate-pulse",
                type === "task-complete" && "from-green-100 to-green-200 dark:from-green-900 dark:to-green-800",
                type === "milestone" && "from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800",
                type === "achievement" && "from-yellow-100 to-yellow-200 dark:from-yellow-900 dark:to-yellow-800",
                type === "first-time" && "from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800",
                type === "streak" && "from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800",
                type === "level-up" && "from-pink-100 to-pink-200 dark:from-pink-900 dark:to-pink-800"
              )}
            >
              <Icon className={cn("h-6 w-6", config.color)} />
            </div>
            <div>
              <h3 
                className="font-semibold text-lg" 
                data-testid="celebration-title"
              >
                {title}
              </h3>
              {message && (
                <p 
                  className="text-sm text-muted-foreground" 
                  data-testid="celebration-message"
                >
                  {message}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
