import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import logoUrl from "@assets/Accute Main Logo_1761505804712.png";

const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SetPasswordForm = z.infer<typeof setPasswordSchema>;

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string>("");
  const [tokenError, setTokenError] = useState<string>("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    
    if (!tokenParam) {
      setTokenError("No verification token found. Please check your email for the correct link.");
    } else {
      setToken(tokenParam);
    }
  }, []);

  const form = useForm<SetPasswordForm>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (data: SetPasswordForm) => {
      const res = await apiRequest("POST", "/api/auth/set-password", {
        token,
        password: data.password,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Password set successfully!",
        description: data.message || "You can now log in with your new password.",
      });
      setTimeout(() => setLocation("/auth/login"), 2000);
    },
    onError: (error: any) => {
      const isTokenError = error.message?.toLowerCase().includes("token") || 
                          error.message?.toLowerCase().includes("expired");
      
      toast({
        title: "Failed to set password",
        description: isTokenError 
          ? "Your verification link has expired. Please register again to receive a new verification email."
          : error.message || "Please try again.",
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const onSubmit = (data: SetPasswordForm) => {
    if (!token) {
      toast({
        title: "Invalid token",
        description: "Please use the link from your verification email.",
        variant: "destructive",
      });
      return;
    }
    setPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <img src={logoUrl} alt="Accute Logo" className="h-12 w-auto" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">Set Your Password</CardTitle>
            <CardDescription className="mt-2">
              Complete your registration by creating a secure password
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {tokenError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{tokenError}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert className="mb-6">
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Your email has been verified! Now create a strong password to secure your account.
                </AlertDescription>
              </Alert>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            data-testid="input-password"
                            disabled={setPasswordMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            data-testid="input-confirm-password"
                            disabled={setPasswordMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={setPasswordMutation.isPending}
                    data-testid="button-set-password"
                  >
                    {setPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Set Password
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                <p>
                  Password must be at least 8 characters long
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
