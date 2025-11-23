import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import logoUrl from "@assets/Accute Main Logo_1761505804712.png";
import { MFAVerificationModal } from "@/components/mfa-verification-modal";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [mfaData, setMFAData] = useState<{
    userId: string;
    deviceId: string;
  } | null>(null);
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data, { authenticated: false });
      return res.json();
    },
    onSuccess: (data) => {
      // Check if MFA is required
      if (data.mfaRequired) {
        setMFAData({
          userId: data.userId,
          deviceId: data.deviceId,
        });
        setShowMFAModal(true);
        return;
      }

      // Normal login flow (no MFA or device is trusted)
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: data.isFirstLogin ? "Welcome!" : "Welcome back!",
        description: "You've successfully logged in.",
      });
      
      // Redirect Super Admins to platform dashboard, others to org dashboard
      if (data.role?.scope === "platform") {
        setLocation("/admin/dashboard", { replace: true });
      } else {
        setLocation("/dashboard", { replace: true });
      }
    },
    onError: (error: any) => {
      // Check if it's an email verification error
      if (error.emailVerificationRequired) {
        toast({
          title: "Email verification required",
          description: error.message || "Please verify your email address before logging in. Check your inbox for the verification link.",
          variant: "destructive",
          duration: 6000,
        });
      } else {
        toast({
          title: "Login failed",
          description: error.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    },
  });

  const handleMFASuccess = (data: { user: any; role: any; token: string; isFirstLogin?: boolean }) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setShowMFAModal(false);
    setMFAData(null);
    
    toast({
      title: data.isFirstLogin ? "Welcome!" : "Welcome back!",
      description: "MFA verification successful",
    });

    // Redirect based on role
    if (data.role?.scope === "platform") {
      setLocation("/admin/dashboard", { replace: true });
    } else {
      setLocation("/dashboard", { replace: true });
    }
  };

  const handleMFACancel = () => {
    setShowMFAModal(false);
    setMFAData(null);
  };

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt="Accute Logo" className="h-12" />
          </div>
          <CardTitle className="text-2xl font-display">Welcome to Accute</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="you@company.com"
                        data-testid="input-email"
                        disabled={loginMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => setLocation("/auth/forgot-password")}
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          data-testid="input-password"
                          disabled={loginMutation.isPending}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={loginMutation.isPending}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/register")}
            data-testid="link-register"
          >
            Don't have an account? Sign up
          </Button>
        </CardFooter>
      </Card>

      {/* MFA Verification Modal */}
      {showMFAModal && mfaData && (
        <MFAVerificationModal
          open={showMFAModal}
          userId={mfaData.userId}
          deviceId={mfaData.deviceId}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />
      )}
    </div>
  );
}
