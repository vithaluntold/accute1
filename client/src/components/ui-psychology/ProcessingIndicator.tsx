import { useState, useEffect } from "react";
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProcessingIndicatorProps {
  status: "idle" | "processing" | "success" | "error";
  message?: string;
  variant?: "default" | "ai" | "upload" | "save";
  className?: string;
}

const statusMessages = {
  ai: {
    processing: [
      "AI is analyzing your request...",
      "Thinking through the details...",
      "Generating a thoughtful response...",
      "Processing with care...",
    ],
    success: "Response ready!",
    error: "AI processing failed. Please try again.",
  },
  upload: {
    processing: ["Uploading your document...", "Securing your files...", "Almost there..."],
    success: "Upload complete!",
    error: "Upload failed. Please check your file and try again.",
  },
  save: {
    processing: ["Saving changes...", "Updating records...", "Syncing data..."],
    success: "Changes saved!",
    error: "Failed to save changes. Please try again.",
  },
  default: {
    processing: ["Processing...", "Working on it...", "Just a moment..."],
    success: "Complete!",
    error: "Operation failed. Please try again.",
  },
};

export function ProcessingIndicator({
  status,
  message,
  variant = "default",
  className,
}: ProcessingIndicatorProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("");

  useEffect(() => {
    if (status === "processing" && !message) {
      const messages = statusMessages[variant].processing;
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [status, message, variant]);

  useEffect(() => {
    if (status === "processing") {
      const messages = statusMessages[variant].processing;
      setCurrentMessage(message || messages[messageIndex]);
    } else if (status === "success") {
      setCurrentMessage(message || statusMessages[variant].success);
    } else if (status === "error") {
      setCurrentMessage(message || statusMessages[variant].error);
    }
  }, [status, message, variant, messageIndex]);

  if (status === "idle") return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300",
        status === "processing" && "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
        status === "success" && "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300",
        status === "error" && "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300",
        className
      )}
      role="status"
      aria-live={status === "error" ? "assertive" : "polite"}
      data-testid={`processing-indicator-${status}`}
    >
      {status === "processing" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" data-testid="icon-processing" />
          <span className="text-sm animate-pulse">{currentMessage}</span>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="h-4 w-4" data-testid="icon-success" />
          <span className="text-sm font-medium">{currentMessage}</span>
          {variant === "ai" && <Sparkles className="h-3 w-3 animate-pulse" />}
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4" data-testid="icon-error" />
          <span className="text-sm font-medium">{currentMessage}</span>
        </>
      )}
    </div>
  );
}
