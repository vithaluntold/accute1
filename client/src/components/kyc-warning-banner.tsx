import { AlertCircle, CheckCircle, Info, ChevronRight, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { calculateKycCompletion, getKycStatusMessage } from "@shared/kycUtils";

interface KycWarningBannerProps {
  user: any;
  showOnlyIfIncomplete?: boolean;
}

export function KycWarningBanner({ user, showOnlyIfIncomplete = true }: KycWarningBannerProps) {
  const [, setLocation] = useLocation();
  
  if (!user) return null;

  const kycCheck = calculateKycCompletion(user);

  if (showOnlyIfIncomplete && kycCheck.isComplete) {
    return null;
  }

  const getStatusColor = () => {
    if (kycCheck.isComplete) return "text-green-600 dark:text-green-400";
    if (kycCheck.completionPercentage >= 80) return "text-blue-600 dark:text-blue-400";
    if (kycCheck.completionPercentage >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-primary";
  };

  const getProgressColor = () => {
    if (kycCheck.completionPercentage >= 80) return "bg-green-500";
    if (kycCheck.completionPercentage >= 50) return "bg-amber-500";
    return "bg-primary";
  };

  const getIcon = () => {
    if (kycCheck.isComplete) return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
    if (kycCheck.completionPercentage >= 80) return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    return <Shield className="h-5 w-5 text-primary" />;
  };

  return (
    <Card className="mb-4 border-0 shadow-sm bg-gradient-to-br from-muted/30 via-card to-muted/20" data-testid="alert-kyc-warning">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-muted/50 shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`font-semibold flex items-center gap-2 ${getStatusColor()}`} data-testid="text-kyc-title">
                  {kycCheck.isComplete ? "Profile Verified" : "Profile Verification Required"}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-kyc-message">
                  {getKycStatusMessage(kycCheck)}
                </p>
              </div>
            </div>
            
            {!kycCheck.isComplete && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completion</span>
                    <Badge variant="secondary" className="font-medium" data-testid="text-kyc-percentage">
                      {kycCheck.completionPercentage}%
                    </Badge>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                      style={{ width: `${kycCheck.completionPercentage}%` }}
                      data-testid="progress-kyc"
                    />
                  </div>
                </div>

                {kycCheck.missingFields.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Missing requirements:</p>
                    <div className="flex flex-wrap gap-2">
                      {kycCheck.missingFields.map((field, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="text-xs font-normal bg-muted/30"
                          data-testid={`text-missing-field-${index}`}
                        >
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={() => setLocation("/profile")}
                  className="gap-1.5 mt-1"
                  data-testid="button-complete-profile"
                >
                  Complete Profile
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
