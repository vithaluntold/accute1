import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Building2, UserPlus, CheckCircle2 } from "lucide-react";
import logoUrl from "@assets/Accute Transparent symbol_1761505804713.png";

const superAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  superAdminKey: z.string().min(1, "Super admin key is required"),
});

const adminSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  organizationName: z.string().min(1, "Organization name is required"),
});

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  invitationToken: z.string().min(1, "Invitation token is required"),
});

type SuperAdminForm = z.infer<typeof superAdminSchema>;
type AdminForm = z.infer<typeof adminSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

type RegistrationType = "admin" | "superadmin" | "invite";

interface InvitationValidationResponse {
  valid: boolean;
  invitation?: {
    email?: string;
    organizationName?: string;
    roleName?: string;
    expiresAt?: string;
  };
  error?: string;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [registrationType, setRegistrationType] = useState<RegistrationType>("admin");
  const [invitationToken, setInvitationToken] = useState<string>("");
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const superAdminParam = urlParams.get("superadmin");
    const keyParam = urlParams.get("key");

    if (token) {
      setInvitationToken(token);
      setRegistrationType("invite");
    } else if (superAdminParam === "true" || keyParam) {
      setRegistrationType("superadmin");
    } else {
      setRegistrationType("admin");
    }
  }, []);

  const { data: invitationData, isLoading: inviteLoading } = useQuery<InvitationValidationResponse>({
    queryKey: ["/api/invitations/validate", invitationToken],
    queryFn: async () => {
      const response = await fetch(`/api/invitations/validate/${invitationToken}`);
      if (!response.ok) {
        throw new Error("Failed to validate invitation");
      }
      return response.json();
    },
    enabled: registrationType === "invite" && !!invitationToken,
    retry: false,
  });

  const superAdminForm = useForm<SuperAdminForm>({
    resolver: zodResolver(superAdminSchema),
    defaultValues: {
      email: "",
      username: "",
      firstName: "",
      lastName: "",
      superAdminKey: "",
    },
  });

  const adminForm = useForm<AdminForm>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      email: "",
      username: "",
      firstName: "",
      lastName: "",
      organizationName: "",
    },
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: invitationData?.invitation?.email || "",
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      invitationToken: invitationToken,
    },
  });

  useEffect(() => {
    if (invitationData?.invitation?.email) {
      inviteForm.setValue("email", invitationData.invitation.email);
    }
    if (invitationToken) {
      inviteForm.setValue("invitationToken", invitationToken);
    }
  }, [invitationData, invitationToken]);

  const superAdminMutation = useMutation({
    mutationFn: async (data: SuperAdminForm) => {
      const res = await apiRequest("POST", "/api/super-admin/register", data, { authenticated: false });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account created!",
        description: data.message || "Please check your email to verify your account before logging in.",
      });
      // Redirect to login after successful registration
      setTimeout(() => setLocation("/auth/login"), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Invalid super admin key",
        variant: "destructive",
      });
    },
  });

  const adminMutation = useMutation({
    mutationFn: async (data: AdminForm) => {
      const res = await apiRequest("POST", "/api/auth/register-admin", data, { authenticated: false });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account and organization created!",
        description: data.message || `Please check your email to verify your account before logging in. Organization "${data.organization?.name}" is ready.`,
      });
      // Redirect to login after successful registration  
      setTimeout(() => setLocation("/auth/login"), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteForm) => {
      const res = await apiRequest("POST", "/api/auth/register-invite", data, { authenticated: false });
      return res.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: "Account created!",
        description: "Welcome to your organization on Accute.",
      });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  if (registrationType === "invite" && inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registrationType === "invite" && !invitationData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
            <CardDescription>This invitation link is invalid or has expired</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                {invitationData?.error || "The invitation link you used is not valid. Please contact your administrator for a new invitation."}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setLocation("/login")} className="w-full" data-testid="button-back-to-login">
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoUrl} alt="Accute Logo" className="h-12" data-testid="img-logo" />
          </div>
          <CardTitle className="text-2xl font-display">Join Accute</CardTitle>
          <CardDescription>
            {registrationType === "superadmin" && "Register as Super Administrator"}
            {registrationType === "admin" && "Create your organization"}
            {registrationType === "invite" && `Join ${invitationData?.invitation?.organizationName} as ${invitationData?.invitation?.roleName}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrationType === "invite" && invitationData?.valid && (
            <Alert className="mb-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                You've been invited to join {invitationData?.invitation?.organizationName}
              </AlertDescription>
            </Alert>
          )}

          {registrationType === "admin" && (
            <>
              <Tabs value="admin" className="mb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="admin" disabled>
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Organization
                  </TabsTrigger>
                  <TabsTrigger value="superadmin" onClick={() => setRegistrationType("superadmin")} data-testid="tab-superadmin">
                    <Shield className="h-4 w-4 mr-2" />
                    Super Admin
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Alert className="mb-4">
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Registration Process:</strong> After submitting, check your email for a verification link. Click the link to verify your email, then set your password to complete registration.
                </AlertDescription>
              </Alert>
            </>
          )}

          {registrationType === "superadmin" && (
            <>
              <Tabs value="superadmin" className="mb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="admin" onClick={() => setRegistrationType("admin")} data-testid="tab-admin">
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Organization
                  </TabsTrigger>
                  <TabsTrigger value="superadmin" disabled>
                    <Shield className="h-4 w-4 mr-2" />
                    Super Admin
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Alert className="mb-4">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Registration Process:</strong> Super admin registration requires a valid key. After submitting, you'll receive a verification email. Click the link to verify your email, then set your password to complete registration.
                </AlertDescription>
              </Alert>
            </>
          )}

          {registrationType === "superadmin" && (
            <Form {...superAdminForm}>
              <form onSubmit={superAdminForm.handleSubmit((data) => superAdminMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={superAdminForm.control}
                  name="superAdminKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Super Admin Key</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your super admin key"
                          data-testid="input-superadmin-key"
                          disabled={superAdminMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={superAdminForm.control}
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
                          disabled={superAdminMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={superAdminForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="johndoe"
                          data-testid="input-username"
                          disabled={superAdminMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={superAdminForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="John"
                            data-testid="input-firstname"
                            disabled={superAdminMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={superAdminForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Doe"
                            data-testid="input-lastname"
                            disabled={superAdminMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    You'll set your password after verifying your email address.
                  </AlertDescription>
                </Alert>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={superAdminMutation.isPending}
                  data-testid="button-register"
                >
                  {superAdminMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Super Admin Account
                </Button>
              </form>
            </Form>
          )}

          {registrationType === "admin" && (
            <Form {...adminForm}>
              <form onSubmit={adminForm.handleSubmit((data) => adminMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={adminForm.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Acme Accounting Firm"
                          data-testid="input-organization"
                          disabled={adminMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
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
                          disabled={adminMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="johndoe"
                          data-testid="input-username"
                          disabled={adminMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={adminForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="John"
                            data-testid="input-firstname"
                            disabled={adminMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Doe"
                            data-testid="input-lastname"
                            disabled={adminMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    You'll set your password after verifying your email address.
                  </AlertDescription>
                </Alert>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={adminMutation.isPending}
                  data-testid="button-register"
                >
                  {adminMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Organization & Account
                </Button>
              </form>
            </Form>
          )}

          {registrationType === "invite" && invitationData?.valid && (
            <Form {...inviteForm}>
              <form onSubmit={inviteForm.handleSubmit((data) => inviteMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={inviteForm.control}
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
                          disabled={!!invitationData?.invitation?.email || inviteMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={inviteForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="johndoe"
                          data-testid="input-username"
                          disabled={inviteMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={inviteForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="John"
                            data-testid="input-firstname"
                            disabled={inviteMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={inviteForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Doe"
                            data-testid="input-lastname"
                            disabled={inviteMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={inviteForm.control}
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
                          disabled={inviteMutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={inviteMutation.isPending}
                  data-testid="button-register"
                >
                  {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Accept Invitation & Create Account
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => setLocation("/login")}
            data-testid="link-login"
          >
            Already have an account? Sign in
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
