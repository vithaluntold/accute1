import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  Brain
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface AITransparencyData {
  confidence?: number; // 0-100
  reasoning?: string;
  sources?: string[];
  modelUsed?: string;
  isEstimated?: boolean; // Flag to indicate estimated vs real AI-provided data
}

interface AITransparencyIndicatorProps {
  data: AITransparencyData;
  variant?: "inline" | "detailed";
  showReasoning?: boolean;
  onToggleReasoning?: (show: boolean) => void;
}

export function AITransparencyIndicator({ 
  data, 
  variant = "inline",
  showReasoning = false,
  onToggleReasoning
}: AITransparencyIndicatorProps) {

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600 dark:text-green-400";
    if (confidence >= 70) return "text-blue-600 dark:text-blue-400";
    if (confidence >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return CheckCircle2;
    if (confidence >= 70) return Sparkles;
    if (confidence >= 50) return Info;
    return AlertCircle;
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return "High Confidence";
    if (confidence >= 70) return "Good Confidence";
    if (confidence >= 50) return "Medium Confidence";
    return "Low Confidence";
  };

  const confidence = data.confidence ?? 85; // Default to 85% if not provided
  const Icon = getConfidenceIcon(confidence);

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 mt-2" data-testid="ai-transparency-indicator">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`gap-1 ${getConfidenceColor(confidence)} border-current`}
                data-testid="badge-confidence"
              >
                <Icon className="h-3 w-3" />
                {confidence}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{getConfidenceLabel(confidence)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.isEstimated 
                  ? "Estimated confidence (based on response analysis)" 
                  : "AI-reported confidence in this response"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {data.modelUsed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Brain className="h-3 w-3" />
                  {data.modelUsed}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">AI Model Used</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {data.reasoning && onToggleReasoning && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => onToggleReasoning(!showReasoning)}
            data-testid="button-show-reasoning"
          >
            <Info className="h-3 w-3" />
            Why?
            {showReasoning ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className="mt-3 space-y-2" data-testid="ai-transparency-detailed">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${getConfidenceColor(confidence)}`} />
        <span className="text-sm font-medium">
          {getConfidenceLabel(confidence)} ({confidence}%)
        </span>
      </div>

      {data.reasoning && showReasoning && (
        <div className="pl-6 border-l-2 border-muted">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Reasoning:</span> {data.reasoning}
          </p>
        </div>
      )}

      {data.sources && data.sources.length > 0 && (
        <div className="pl-6">
          <p className="text-xs font-medium text-muted-foreground">Sources:</p>
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            {data.sources.map((source, idx) => (
              <li key={idx}>{source}</li>
            ))}
          </ul>
        </div>
      )}

      {data.modelUsed && (
        <div className="pl-6">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Brain className="h-3 w-3" />
            {data.modelUsed}
          </Badge>
        </div>
      )}
    </div>
  );
}

// Collapsible reasoning section that goes below the message
export function AIReasoning({ 
  reasoning, 
  isOpen, 
  onToggle 
}: { 
  reasoning: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="mt-2">
      <CollapsibleContent>
        <div 
          className="p-3 rounded-md bg-muted/50 border border-muted text-sm"
          data-testid="ai-reasoning-content"
        >
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-xs text-muted-foreground mb-1">
                AI Reasoning:
              </p>
              <p className="text-sm">{reasoning}</p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
