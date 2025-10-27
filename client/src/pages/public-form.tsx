import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormRenderer } from "@/components/form-renderer";
import { Loader2, Lock, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function PublicFormPage() {
  const [, params] = useRoute("/public/:shareToken");
  const shareToken = params?.shareToken;

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  // Fetch form data
  const { data, isLoading, error } = useQuery<any>({
    queryKey: [`/api/public/forms/${shareToken}`],
    enabled: !!shareToken,
  });

  const form = data?.form;
  const shareLink = data?.shareLink;

  // Check if password is required
  useEffect(() => {
    if (shareLink?.requiresPassword && !isSubmitted) {
      setPasswordDialogOpen(true);
    }
  }, [shareLink, isSubmitted]);

  // Submit form mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: any) => {
      const payload: any = { data: formData };
      if (shareLink?.requiresPassword && password) {
        payload.password = password;
      }
      return apiRequest("POST", `/api/public/forms/${shareToken}/submit`, payload);
    },
    onSuccess: () => {
      setIsSubmitted(true);
      setSubmissionError("");
    },
    onError: (error: any) => {
      setSubmissionError(error.message || "Failed to submit form");
    },
  });

  const handlePasswordSubmit = () => {
    if (!password) {
      setPasswordError("Password is required");
      return;
    }
    setPasswordError("");
    setPasswordDialogOpen(false);
  };

  const handleFormSubmit = async (formData: any) => {
    await submitMutation.mutateAsync(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-form" />
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Form Not Available</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground" data-testid="text-error-message">
              {(error as any).message || "This form link is invalid or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle>Form Submitted Successfully</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground" data-testid="text-success-message">
              Thank you for submitting the form. Your response has been recorded.
            </p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                You can now close this window.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold" data-testid="text-form-title">
                {form?.name || "Form"}
              </h1>
            </div>
            {shareLink?.requiresPassword && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPasswordDialogOpen(true)}
                data-testid="button-lock-info"
              >
                <Lock className="h-4 w-4" />
              </Button>
            )}
          </div>
          {form?.description && (
            <p className="text-sm text-muted-foreground mt-2" data-testid="text-form-description">
              {form.description}
            </p>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {submissionError && (
          <Alert variant="destructive" className="mb-6" data-testid="alert-submission-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submissionError}</AlertDescription>
          </Alert>
        )}

        {shareLink?.dueDate && (
          <Alert className="mb-6" data-testid="alert-due-date">
            <AlertDescription>
              <strong>Due Date:</strong>{" "}
              {new Date(shareLink.dueDate).toLocaleDateString()}
            </AlertDescription>
          </Alert>
        )}

        {form && (
          <FormRenderer
            fields={form.fields}
            sections={form.sections}
            pages={form.pages}
            conditionalRules={form.conditionalRules}
            onSubmit={handleFormSubmit}
            isSubmitting={submitMutation.isPending}
          />
        )}
      </main>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent data-testid="dialog-password">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Required
            </DialogTitle>
            <DialogDescription>
              This form is password protected. Please enter the password to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePasswordSubmit();
                  }
                }}
                placeholder="Enter password"
                data-testid="input-password"
              />
              {passwordError && (
                <p className="text-sm text-destructive" data-testid="text-password-error">
                  {passwordError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handlePasswordSubmit} data-testid="button-submit-password">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
