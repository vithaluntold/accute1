import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import { Settings, Key, Webhook, Globe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const stripeSettingsSchema = z.object({
  stripePublicKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
});

const razorpaySettingsSchema = z.object({
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  razorpayWebhookSecret: z.string().optional(),
});

type StripeSettings = z.infer<typeof stripeSettingsSchema>;
type RazorpaySettings = z.infer<typeof razorpaySettingsSchema>;

// Utility function to mask a value showing only last 4 characters
function maskValue(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return value;
  return "●".repeat(value.length - 4) + value.slice(-4);
}

export default function PlatformSettingsPage() {
  const { toast } = useToast();
  const [showSecrets, setShowSecrets] = useState(false);
  const [editedKeys, setEditedKeys] = useState<Set<string>>(new Set());

  const form = useForm<StripeSettings>({
    resolver: zodResolver(stripeSettingsSchema),
    defaultValues: {
      stripePublicKey: "",
      stripeSecretKey: "",
      stripeWebhookSecret: "",
    },
  });

  const razorpayForm = useForm<RazorpaySettings>({
    resolver: zodResolver(razorpaySettingsSchema),
    defaultValues: {
      razorpayKeyId: "",
      razorpayKeySecret: "",
      razorpayWebhookSecret: "",
    },
  });

  const { data: settings, isLoading } = useQuery<StripeSettings & RazorpaySettings>({
    queryKey: ["/api/platform-settings"],
  });

  // Reset form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset({
        stripePublicKey: settings.stripePublicKey,
        stripeSecretKey: settings.stripeSecretKey,
        stripeWebhookSecret: settings.stripeWebhookSecret,
      });
      razorpayForm.reset({
        razorpayKeyId: settings.razorpayKeyId,
        razorpayKeySecret: settings.razorpayKeySecret,
        razorpayWebhookSecret: settings.razorpayWebhookSecret,
      });
    }
  }, [settings, form, razorpayForm]);

  const updateMutation = useMutation({
    mutationFn: async (data: StripeSettings) => {
      // Only send keys that don't start with *** (i.e., that have been changed)
      const payload: StripeSettings = {
        stripePublicKey: data.stripePublicKey,
        stripeSecretKey: data.stripeSecretKey && !data.stripeSecretKey.startsWith("***") 
          ? data.stripeSecretKey 
          : undefined,
        stripeWebhookSecret: data.stripeWebhookSecret && !data.stripeWebhookSecret.startsWith("***")
          ? data.stripeWebhookSecret
          : undefined,
      };
      return await apiRequest("PATCH", "/api/platform-settings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-settings"] });
      toast({ title: "Settings updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update settings", description: error.message, variant: "destructive" });
      form.setError("root", { message: error.message });
    },
  });

  const updateRazorpayMutation = useMutation({
    mutationFn: async (data: RazorpaySettings) => {
      const payload: RazorpaySettings = {
        razorpayKeyId: data.razorpayKeyId,
        razorpayKeySecret: data.razorpayKeySecret && !data.razorpayKeySecret.startsWith("***") 
          ? data.razorpayKeySecret 
          : undefined,
        razorpayWebhookSecret: data.razorpayWebhookSecret && !data.razorpayWebhookSecret.startsWith("***")
          ? data.razorpayWebhookSecret
          : undefined,
      };
      return await apiRequest("PATCH", "/api/platform-settings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-settings"] });
      toast({ title: "Razorpay settings updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update Razorpay settings", description: error.message, variant: "destructive" });
      razorpayForm.setError("root", { message: error.message });
    },
  });

  const onSubmit = (data: StripeSettings) => {
    updateMutation.mutate(data);
  };

  const onRazorpaySubmit = (data: RazorpaySettings) => {
    updateRazorpayMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GradientHero
        title="Platform Settings"
        description="Configure platform-level settings and integrations"
        icon={Settings}
      />

      <div className="container mx-auto p-6 max-w-4xl">
        <Tabs defaultValue="razorpay" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-settings">
            <TabsTrigger value="razorpay" data-testid="tab-razorpay">
              <Key className="w-4 h-4 mr-2" />
              Razorpay (Primary)
            </TabsTrigger>
            <TabsTrigger value="stripe" data-testid="tab-stripe">
              <Key className="w-4 h-4 mr-2" />
              Stripe (Optional)
            </TabsTrigger>
            <TabsTrigger value="general" data-testid="tab-general">
              <Globe className="w-4 h-4 mr-2" />
              General Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="razorpay" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Razorpay API Configuration
                </CardTitle>
                <CardDescription>
                  Configure your Razorpay API keys for payment processing in India, UAE, Turkey, and USA. Keys are stored securely and encrypted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <AlertDescription>
                    <strong>How to get your Razorpay API keys:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Go to <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Razorpay Dashboard → API Keys</a></li>
                      <li>Generate new keys if you don't have them</li>
                      <li>Copy your Key ID (starts with <code className="bg-muted px-1 rounded">rzp_test_</code> or <code className="bg-muted px-1 rounded">rzp_live_</code>)</li>
                      <li>Copy your Key Secret (click "Show" to reveal)</li>
                      <li>For webhooks, go to Webhooks section and create a webhook endpoint</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <Form {...razorpayForm}>
                  <form onSubmit={razorpayForm.handleSubmit(onRazorpaySubmit)} className="space-y-6">
                    <FormField
                      control={razorpayForm.control}
                      name="razorpayKeyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key ID (RAZORPAY_KEY_ID)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              type="text"
                              placeholder="rzp_test_... or rzp_live_..."
                              data-testid="input-razorpay-key-id"
                            />
                          </FormControl>
                          <FormDescription>
                            Your Razorpay Key ID - used for identifying your account
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={razorpayForm.control}
                      name="razorpayKeySecret"
                      render={({ field }) => {
                        const isServerMasked = field.value?.startsWith("***");
                        return (
                          <FormItem>
                            <FormLabel>Key Secret (RAZORPAY_KEY_SECRET)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                type={showSecrets && !isServerMasked ? "text" : "password"}
                                placeholder={isServerMasked ? "●●●●●●●●●●●●" : "Enter your key secret"}
                                data-testid="input-razorpay-key-secret"
                                onChange={(e) => {
                                  field.onChange(e);
                                  if (!isServerMasked) {
                                    setEditedKeys((prev) => new Set(prev).add("razorpayKeySecret"));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Your Razorpay Key Secret - keep this secure and never share publicly
                              {isServerMasked && " (already configured - leave blank to keep existing)"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={razorpayForm.control}
                      name="razorpayWebhookSecret"
                      render={({ field }) => {
                        const isServerMasked = field.value?.startsWith("***");
                        return (
                          <FormItem>
                            <FormLabel>Webhook Secret (RAZORPAY_WEBHOOK_SECRET) - Optional</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                type={showSecrets && !isServerMasked ? "text" : "password"}
                                placeholder={isServerMasked ? "●●●●●●●●●●●●" : "Enter webhook secret"}
                                data-testid="input-razorpay-webhook-secret"
                                onChange={(e) => {
                                  field.onChange(e);
                                  if (!isServerMasked) {
                                    setEditedKeys((prev) => new Set(prev).add("razorpayWebhookSecret"));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Your Razorpay webhook signing secret - used to verify webhook signatures
                              {isServerMasked && " (already configured - leave blank to keep existing)"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <div className="flex items-center gap-4 pt-4">
                      <Button
                        type="submit"
                        disabled={updateRazorpayMutation.isPending}
                        data-testid="button-save-razorpay"
                      >
                        {updateRazorpayMutation.isPending ? "Saving..." : "Save Razorpay Configuration"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowSecrets(!showSecrets)}
                        data-testid="button-toggle-secrets"
                      >
                        {showSecrets ? "Hide" : "Show"} Secrets
                      </Button>
                    </div>

                    {razorpayForm.formState.errors.root && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {razorpayForm.formState.errors.root.message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supported Countries & Currencies</CardTitle>
                <CardDescription>Razorpay supports the following markets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>🇮🇳 India</strong>
                    <p className="text-muted-foreground">INR (₹)</p>
                  </div>
                  <div>
                    <strong>🇦🇪 UAE</strong>
                    <p className="text-muted-foreground">AED (د.إ)</p>
                  </div>
                  <div>
                    <strong>🇹🇷 Turkey</strong>
                    <p className="text-muted-foreground">TRY (₺)</p>
                  </div>
                  <div>
                    <strong>🇺🇸 USA</strong>
                    <p className="text-muted-foreground">USD ($)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stripe" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Stripe API Configuration
                </CardTitle>
                <CardDescription>
                  Configure your Stripe API keys for payment processing. Keys are stored securely and encrypted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <AlertDescription>
                    <strong>How to get your Stripe API keys:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Stripe Dashboard</a></li>
                      <li>Copy your Publishable key (starts with <code className="bg-muted px-1 rounded">pk_</code>)</li>
                      <li>Copy your Secret key (starts with <code className="bg-muted px-1 rounded">sk_</code>)</li>
                      <li>For webhooks, get the signing secret from the webhook configuration page</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="stripePublicKey"
                      render={({ field }) => {
                        const displayValue = showSecrets ? field.value : field.value;
                        return (
                          <FormItem>
                            <FormLabel>Publishable Key (VITE_STRIPE_PUBLIC_KEY)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={displayValue || ""}
                                type="text"
                                placeholder="pk_test_..."
                                data-testid="input-stripe-public-key"
                              />
                            </FormControl>
                            <FormDescription>
                              Your Stripe publishable key - safe to use in frontend code
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="stripeSecretKey"
                      render={({ field }) => {
                        const isServerMasked = field.value?.startsWith("***");
                        return (
                          <FormItem>
                            <FormLabel>Secret Key (STRIPE_SECRET_KEY)</FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                type={showSecrets || isServerMasked ? "text" : "password"}
                                placeholder="sk_test_... (or enter new key)"
                                data-testid="input-stripe-secret-key"
                              />
                            </FormControl>
                            <FormDescription>
                              Your Stripe secret key - keep this secure, only used server-side
                              {isServerMasked && " (currently set, enter new value to update)"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name="stripeWebhookSecret"
                      render={({ field }) => {
                        const isServerMasked = field.value?.startsWith("***");
                        return (
                          <FormItem>
                            <FormLabel>Webhook Signing Secret</FormLabel>
                            <FormControl>
                              <Input
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                type={showSecrets || isServerMasked ? "text" : "password"}
                                placeholder="whsec_... (or enter new secret)"
                                data-testid="input-stripe-webhook-secret"
                              />
                            </FormControl>
                            <FormDescription>
                              Stripe webhook signing secret for verifying webhook events
                              {isServerMasked && " (currently set, enter new value to update)"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowSecrets(!showSecrets)}
                        data-testid="button-toggle-secrets"
                      >
                        {showSecrets ? "Hide" : "Show"} Keys
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                        data-testid="button-save-stripe-settings"
                      >
                        {updateMutation.isPending ? "Saving..." : "Save Settings"}
                      </Button>
                    </div>

                    {form.formState.errors.root && (
                      <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5" />
                  Webhook Configuration
                </CardTitle>
                <CardDescription>
                  Set up webhooks in your Stripe dashboard to receive real-time subscription events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Webhook Endpoint URL:</p>
                  <code className="block bg-muted p-3 rounded text-sm">
                    {window.location.origin}/api/stripe-webhook
                  </code>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Events to subscribe to:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>checkout.session.completed</li>
                    <li>customer.subscription.created</li>
                    <li>customer.subscription.updated</li>
                    <li>customer.subscription.deleted</li>
                    <li>invoice.payment_succeeded</li>
                    <li>invoice.payment_failed</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Platform Settings</CardTitle>
                <CardDescription>
                  Configure general platform settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Additional platform settings will be available here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
