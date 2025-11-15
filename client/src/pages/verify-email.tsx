import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import logoUrl from "@assets/Accute Main Logo_1761505804712.png";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const verificationToken = urlParams.get("token");

        if (!verificationToken) {
          setStatus("error");
          setMessage("No verification token found. Please check your email for the correct link.");
          return;
        }

        setToken(verificationToken);

        const response = await fetch(`/api/auth/verify-email?token=${verificationToken}`);
        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(data.error || "Verification failed. Please try again.");
          return;
        }

        setStatus("success");
        setMessage(data.message || "Email verified successfully!");

        // Redirect to set-password page after 2 seconds with the token
        setTimeout(() => {
          setLocation(`/auth/set-password?token=${verificationToken}`);
        }, 2000);
      } catch (error: any) {
        setStatus("error");
        setMessage("An error occurred during verification. Please try again.");
      }
    };

    verifyEmail();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logoUrl} alt="Accute Logo" className="h-12 w-auto" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
            <CardDescription className="mt-2">
              {status === "loading" && "Verifying your email address..."}
              {status === "success" && "Email verified successfully!"}
              {status === "error" && "Verification failed"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Please wait while we verify your email...</p>
            </div>
          )}

          {status === "success" && (
            <>
              <Alert className="mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <div className="text-center text-sm text-muted-foreground">
                <p>Redirecting you to set your password...</p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <div className="flex flex-col gap-4">
                <Button
                  onClick={() => setLocation("/auth/register")}
                  variant="outline"
                  data-testid="button-back-to-register"
                >
                  Back to Registration
                </Button>
                <Button
                  onClick={() => setLocation("/auth/login")}
                  data-testid="button-go-to-login"
                >
                  Go to Login
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
