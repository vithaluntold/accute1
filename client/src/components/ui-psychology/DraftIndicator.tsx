import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DraftStatus = "draft" | "saving" | "saved" | "error";

export interface DraftIndicatorProps {
  status: DraftStatus;
  lastSaved?: Date;
  errorMessage?: string;
  className?: string;
}

export function DraftIndicator({
  status,
  lastSaved,
  errorMessage,
  className,
}: DraftIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    if (!lastSaved) return;

    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (seconds < 60) {
        setTimeAgo("Just now");
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setTimeAgo(`${minutes}m ago`);
      } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        setTimeAgo(`${hours}h ago`);
      } else {
        setTimeAgo(lastSaved.toLocaleDateString());
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [lastSaved]);

  if (status === "draft") {
    return (
      <Badge
        variant="secondary"
        className={cn("gap-1.5", className)}
        data-testid="draft-indicator-draft"
      >
        <Clock className="h-3 w-3" />
        <span>Draft</span>
        {lastSaved && <span className="text-xs opacity-70">• {timeAgo}</span>}
      </Badge>
    );
  }

  if (status === "saving") {
    return (
      <Badge
        variant="secondary"
        className={cn("gap-1.5 animate-pulse", className)}
        data-testid="draft-indicator-saving"
      >
        <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        <span>Saving...</span>
      </Badge>
    );
  }

  if (status === "saved") {
    return (
      <Badge
        variant="secondary"
        className={cn("gap-1.5 text-green-700 dark:text-green-400", className)}
        data-testid="draft-indicator-saved"
      >
        <CheckCircle2 className="h-3 w-3" />
        <span>Saved</span>
        {lastSaved && <span className="text-xs opacity-70">• {timeAgo}</span>}
      </Badge>
    );
  }

  if (status === "error") {
    return (
      <Badge
        variant="destructive"
        className={cn("gap-1.5", className)}
        data-testid="draft-indicator-error"
      >
        <AlertCircle className="h-3 w-3" />
        <span>{errorMessage || "Save failed"}</span>
      </Badge>
    );
  }

  return null;
}
