import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Rocket,
  CheckCircle2,
  Target,
  Trophy,
  Zap,
  ChevronRight,
} from "lucide-react";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  organizationName?: string;
}

export function WelcomeModal({
  isOpen,
  onClose,
  userName = "there",
  organizationName = "your organization",
}: WelcomeModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);

  const startOnboardingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/onboarding/progress', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress'] });
      toast({
        title: "Welcome aboard!",
        description: "Your 21-day journey has begun. Let's get started!",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to start onboarding",
        description: error.message || "Please try again",
      });
    },
  });

  const steps = [
    {
      title: "Welcome to Accute!",
      description: "Your AI-native accounting workflow automation platform",
      icon: Rocket,
      content: (
        <div className="space-y-4">
          <div className="text-center py-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-[#e5a660] to-[#d76082] flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">
              Welcome, {userName}!
            </h3>
            <p className="text-muted-foreground">
              We're excited to have you at {organizationName}
            </p>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">10 AI Agents</p>
                <p className="text-xs text-muted-foreground">
                  Automate tasks with specialized AI assistants
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Workflow Automation</p>
                <p className="text-xs text-muted-foreground">
                  Streamline client engagements with custom workflows
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Document Management</p>
                <p className="text-xs text-muted-foreground">
                  Secure storage with e-signatures and PKI verification
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Your 21-Day Journey",
      description: "Learn Accute at your own pace with guided tasks",
      icon: Target,
      content: (
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">
              Structured Learning Path
            </h3>
            <p className="text-sm text-muted-foreground">
              We've designed a 21-day onboarding journey to help you master Accute
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-md border">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <span className="text-sm font-bold text-primary">1-7</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">Getting Started</p>
                <p className="text-xs text-muted-foreground">
                  Set up your profile, add clients, create your first workflow
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <span className="text-sm font-bold text-primary">8-14</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">Core Features</p>
                <p className="text-xs text-muted-foreground">
                  Master AI agents, documents, invoicing, and automation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <span className="text-sm font-bold text-primary">15-21</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">Advanced Workflows</p>
                <p className="text-xs text-muted-foreground">
                  Build custom workflows, integrations, and team collaboration
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Earn Rewards & Unlock Features",
      description: "Complete tasks to earn points and unlock platform capabilities",
      icon: Trophy,
      content: (
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">
              Gamified Learning
            </h3>
            <p className="text-sm text-muted-foreground">
              Stay motivated with points, badges, and progressive unlocks
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-md border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="font-medium text-sm">Points System</span>
                </div>
                <Badge variant="secondary">+10-50 pts/task</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Earn points for completing tasks, from quick wins to in-depth tutorials
              </p>
            </div>

            <div className="p-4 rounded-md border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Streak Bonus</span>
                </div>
                <Badge variant="secondary">+Daily Multiplier</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Log in daily to build your streak and earn bonus points
              </p>
            </div>

            <div className="p-4 rounded-md border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-sm">Feature Unlocks</span>
                </div>
                <Badge variant="secondary">Progressive</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Unlock advanced features as you progress through your journey
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Last step - start onboarding
      startOnboardingMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    startOnboardingMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-welcome-modal"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <currentStepData.icon className="w-6 h-6 text-primary" />
            <DialogTitle data-testid="text-welcome-modal-title">
              {currentStepData.title}
            </DialogTitle>
          </div>
          <DialogDescription data-testid="text-welcome-modal-description">
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {currentStepData.content}
        </div>

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} data-testid="progress-welcome-modal" />
          </div>

          <DialogFooter className="gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                data-testid="button-welcome-back"
              >
                Back
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={startOnboardingMutation.isPending}
              data-testid="button-welcome-skip"
            >
              Skip Tour
            </Button>
            <Button
              onClick={handleNext}
              disabled={startOnboardingMutation.isPending}
              data-testid="button-welcome-next"
            >
              {currentStep < steps.length - 1 ? (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Get Started
                  <Rocket className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
