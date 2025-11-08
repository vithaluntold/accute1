import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Undo2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface UndoToastProps {
  show: boolean;
  message: string;
  undoLabel?: string;
  duration?: number; // milliseconds before auto-confirm
  onUndo: () => void;
  onConfirm?: () => void;
  onClose?: () => void;
}

export function UndoToast({
  show,
  message,
  undoLabel = "Undo",
  duration = 5000,
  onUndo,
  onConfirm,
  onClose,
}: UndoToastProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setTimeLeft(duration);
      
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 100) {
            clearInterval(interval);
            setIsVisible(false);
            onConfirm?.();
            onClose?.();
            return 0;
          }
          return prev - 100;
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      setIsVisible(false);
    }
  }, [show, duration, onConfirm, onClose]);

  const handleUndo = () => {
    setIsVisible(false);
    onUndo();
    onClose?.();
  };

  if (!isVisible) return null;

  const progress = (timeLeft / duration) * 100;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300"
      data-testid="undo-toast"
    >
      <Card className="px-4 py-3 shadow-lg border-2 min-w-[400px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium" data-testid="undo-toast-message">
              {message}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            className="gap-2 shrink-0"
            data-testid="button-undo"
          >
            <Undo2 className="h-4 w-4" />
            {undoLabel}
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full bg-primary transition-all duration-100 ease-linear",
              timeLeft < 1000 && "bg-destructive"
            )}
            style={{ width: `${progress}%` }}
            data-testid="undo-toast-progress"
          />
        </div>
      </Card>
    </div>
  );
}
