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
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import logoUrl from "@assets/Accute Transparent symbol_1761505804713.png";
import { MFAVerificationModal } from "@/components/mfa-verification-modal";
import { AIVisualAnimation, FloatingParticles } from "@/components/ai-visual-animation";
import { Link } from "wouter";

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
      if (data.mfaRequired) {
        setMFAData({
          userId: data.userId,
          deviceId: data.deviceId,
        });
        setShowMFAModal(true);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: data.isFirstLogin ? "Welcome!" : "Welcome back!",
        description: "You've successfully logged in.",
      });
      
      if (data.role?.scope === "platform") {
        setLocation("/admin/dashboard", { replace: true });
      } else {
        setLocation("/dashboard", { replace: true });
      }
    },
    onError: (error: any) => {
      if (error.emailVerificationRequired) {
        toast({
          title: "Email verification required",
          description: error.message || "Please verify your email address before logging in.",
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
    <div className="min-h-screen flex">
      {/* Left Panel - AI Visual (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#16213e] items-center justify-center overflow-hidden">
        <FloatingParticles count={30} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#e5a660]/5 via-transparent to-[#d76082]/5" />
        
        <div className="relative z-10 text-center px-8">
          <AIVisualAnimation variant="sidebar" className="mx-auto mb-8" />
          <h2 className="text-3xl font-display font-bold text-white mb-4">
            <span className="bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
              AI-Powered
            </span>
            <br />
            Practice Management
          </h2>
          <p className="text-white/70 max-w-md mx-auto">
            10 specialized AI agents working for you. Automate workflows, 
            delight clients, and save 15+ hours weekly.
          </p>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-10 left-10">
          <div className="h-20 w-20 rounded-full border border-[#e5a660]/20 animate-pulse" />
        </div>
        <div className="absolute bottom-20 right-10">
          <div className="h-32 w-32 rounded-full border border-[#d76082]/20 animate-pulse" style={{ animationDelay: "1s" }} />
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-background p-4 lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <img src={logoUrl} alt="Accute" className="h-10" />
              <span className="font-display text-2xl font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
                Accute
              </span>
            </Link>
          </div>

          <Card className="border-0 shadow-xl lg:border">
            <CardHeader className="text-center pb-2">
              <div className="hidden lg:flex justify-center mb-4">
                <Link href="/">
                  <img src={logoUrl} alt="Accute Logo" className="h-12 hover:scale-105 transition-transform" />
                </Link>
              </div>
              <CardTitle className="text-2xl font-display">Welcome Back</CardTitle>
              <CardDescription>Sign in to your account to continue</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
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
                            className="h-11"
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
                            className="h-auto p-0 text-xs text-[#e5a660]"
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
                              className="pr-10 h-11"
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-1/2 -translate-y-1/2 px-3 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => setShowPassword(!showPassword)}
                              disabled={loginMutation.isPending}
                              data-testid="button-toggle-password"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-[#e5a660] to-[#d76082] hover:opacity-90 transition-opacity"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Sign In
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2">
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    New to Accute?
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/register")}
                data-testid="link-register"
              >
                Create an account
              </Button>
            </CardFooter>
          </Card>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-[#e5a660] hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#e5a660] hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>

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
