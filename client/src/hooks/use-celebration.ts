import { useState, useCallback } from "react";
import type { CelebrationType } from "@/components/ui-psychology/MicroCelebration";

interface CelebrationState {
  show: boolean;
  type: CelebrationType;
  title: string;
  message?: string;
}

export function useCelebration() {
  const [celebration, setCelebration] = useState<CelebrationState>({
    show: false,
    type: "task-complete",
    title: "",
  });

  const celebrate = useCallback(
    (type: CelebrationType, title: string, message?: string) => {
      setCelebration({
        show: true,
        type,
        title,
        message,
      });
    },
    []
  );

  const hideCelebration = useCallback(() => {
    setCelebration((prev) => ({ ...prev, show: false }));
  }, []);

  return {
    celebration,
    celebrate,
    hideCelebration,
  };
}
