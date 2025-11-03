import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { calculateKycCompletion, getKycStatusMessage } from "@/../../shared/kycUtils";

interface KycWarningBannerProps {
  user: any;
  showOnlyIfIncomplete?: boolean;
}

export function KycWarningBanner({ user, showOnlyIfIncomplete = true }: KycWarningBannerProps) {
  const [, setLocation] = useLocation();
  
  if (!user) return null;

  const kycCheck = calculateKycCompletion(user);

  // Don't show banner if profile is complete and we only want to show for incomplete
  if (showOnlyIfIncomplete && kycCheck.isComplete) {
    return null;
  }

  const getAlertVariant = () => {
    if (kycCheck.isComplete) return "default";
    if (kycCheck.completionPercentage >= 80) return "default";
    if (kycCheck.completionPercentage >= 50) return "default";
    return "destructive";
  };

  const getIcon = () => {
    if (kycCheck.isComplete) return <CheckCircle className="h-4 w-4" />;
    if (kycCheck.completionPercentage >= 80) return <Info className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  return (
    <Alert variant={getAlertVariant()} className="mb-4" data-testid="alert-kyc-warning">
      <div className="flex items-start gap-3 w-full">
        {getIcon()}
        <div className="flex-1 space-y-2">
          <AlertTitle data-testid="text-kyc-title">
            {kycCheck.isComplete ? "Profile Verified" : "Profile Verification Required"}
          </AlertTitle>
          <AlertDescription data-testid="text-kyc-message">
            {getKycStatusMessage(kycCheck)}
          </AlertDescription>
          
          {!kycCheck.isComplete && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium" data-testid="text-kyc-percentage">
                    {kycCheck.completionPercentage}%
                  </span>
                </div>
                <Progress value={kycCheck.completionPercentage} className="h-2" data-testid="progress-kyc" />
              </div>

              {kycCheck.missingFields.length > 0 && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Missing requirements:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    {kycCheck.missingFields.map((field, index) => (
                      <li key={index} data-testid={`text-missing-field-${index}`}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                size="sm"
                onClick={() => setLocation("/profile")}
                data-testid="button-complete-profile"
              >
                Complete Profile
              </Button>
            </>
          )}
        </div>
      </div>
    </Alert>
  );
}
