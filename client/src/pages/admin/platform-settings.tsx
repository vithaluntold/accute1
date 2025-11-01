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

type StripeSettings = z.infer<typeof stripeSettingsSchema>;

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

  const { data: settings, isLoading } = useQuery<StripeSettings>({
    queryKey: ["/api/platform-settings"],
  });

  // Reset form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

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

  const onSubmit = (data: StripeSettings) => {
    updateMutation.mutate(data);
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
        <Tabs defaultValue="stripe" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2" data-testid="tabs-settings">
            <TabsTrigger value="stripe" data-testid="tab-stripe">
              <Key className="w-4 h-4 mr-2" />
              Stripe Integration
            </TabsTrigger>
            <TabsTrigger value="general" data-testid="tab-general">
              <Globe className="w-4 h-4 mr-2" />
              General Settings
            </TabsTrigger>
          </TabsList>

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
