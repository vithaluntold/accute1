import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { GradientHero } from "@/components/gradient-hero";
import { getUser } from "@/lib/auth";
import { Rocket } from "lucide-react";

export default function OnboardingPage() {
  const user = getUser();
  const [showWelcome, setShowWelcome] = useState(false);

  // Check if onboarding progress exists
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/onboarding/progress'],
    retry: false,
  });

  // Fix: Show welcome modal only when onboarding doesn't exist and user hasn't dismissed it
  const hasOnboarding = data?.progress != null;
  const shouldShowWelcome = !hasOnboarding && !isLoading && !localStorage.getItem('onboarding-welcome-dismissed');

  // Fix: Auto-show welcome modal using useEffect to avoid state mutation during render
  useEffect(() => {
    if (shouldShowWelcome) {
      setShowWelcome(true);
    }
  }, [shouldShowWelcome]);

  const handleWelcomeClose = () => {
    // Fix: Persist dismissal to prevent modal from reopening
    localStorage.setItem('onboarding-welcome-dismissed', 'true');
    setShowWelcome(false);
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={Rocket}
        title="Your 21-Day Journey"
        description="Complete tasks, earn points, and unlock features as you master Accute"
        testId="onboarding-hero"
      />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        <OnboardingChecklist />
      </div>

      {/* Fix: Show welcome modal only to new users */}
      <WelcomeModal
        isOpen={showWelcome}
        onClose={handleWelcomeClose}
        userName={user?.firstName || user?.username}
        organizationName={user?.organizationId || "your organization"}
      />
    </div>
  );
}
