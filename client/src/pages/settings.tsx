import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Check, X, Loader2, Settings as SettingsIcon, Shield, Copy, CheckCircle2, AlertCircle, Clock, Sparkles, KeyRound } from "lucide-react";
import { formatDistance } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { GradientHero } from "@/components/gradient-hero";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MFASetupDialog } from "@/components/mfa-setup-dialog";

// LLM Configuration schema (for AI agents)
const llmConfigSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  provider: z.enum(["openai", "azure", "anthropic"]),
  apiKey: z.string().min(1, "API key is required"),
  azureEndpoint: z.string().optional(),
  azureApiVersion: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  isDefault: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.provider === "azure") {
      return data.azureEndpoint && data.azureEndpoint.trim().length > 0;
    }
    return true;
  },
  {
    message: "Azure OpenAI requires an endpoint URL",
    path: ["azureEndpoint"],
  }
);

type LlmConfigFormData = z.infer<typeof llmConfigSchema>;

export default function Settings() {
  const { toast } = useToast();
  const [showLlmForm, setShowLlmForm] = useState(false);
  const [deleteLlmTarget, setDeleteLlmTarget] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [testConnectionResult, setTestConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [showDisableMFAConfirm, setShowDisableMFAConfirm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const isSuperAdmin = (currentUser as any)?.role?.name === "Super Admin";

  // MFA Status Query
  const { data: mfaStatus, isLoading: mfaLoading } = useQuery<{
    enabled: boolean;
    enforced: boolean;
    backupCodesRemaining: number;
  }>({
    queryKey: ['/api/mfa/status'],
  });

  // Disable MFA Mutation
  const disableMFAMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest('/api/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password }),
        headers: { 'Content-Type': 'application/json' },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      toast({
        title: "MFA Disabled",
        description: "Two-factor authentication has been disabled",
      });
      setShowDisableMFAConfirm(false);
      setDisablePassword('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable MFA",
        variant: "destructive",
      });
    },
  });

  // LLM Configurations (for AI agents)
  const llmForm = useForm<LlmConfigFormData>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: {
      name: "",
      provider: "openai",
      apiKey: "",
      azureEndpoint: "",
      azureApiVersion: "2025-01-01-preview",
      model: "",
      isDefault: false,
    },
  });

  const selectedLlmProvider = llmForm.watch("provider");

  const { data: llmConfigs = [], isLoading: llmLoading } = useQuery<any[]>({
    queryKey: ["/api/llm-configurations"],
  });

  // LLM Configuration mutations
  const createLlmMutation = useMutation({
    mutationFn: async (data: LlmConfigFormData) => {
      return apiRequest("POST", "/api/llm-configurations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-configurations"] });
      toast({
        title: "Success",
        description: "LLM configuration created successfully",
      });
      llmForm.reset();
      setShowLlmForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create LLM configuration",
        variant: "destructive",
      });
    },
  });

  const deleteLlmMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/llm-configurations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-configurations"] });
      toast({
        title: "Success",
        description: "LLM configuration removed successfully",
      });
      setDeleteLlmTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove LLM configuration",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (data: { provider: string; apiKey: string; endpoint?: string; apiVersion?: string; model?: string }) => {
      const response = await apiRequest("POST", "/api/llm-configurations/test", data);
      return response.json();
    },
    onSuccess: (result: any) => {
      setTestConnectionResult(result);
      toast({
        title: result.success ? "Connection Successful" : "Connection Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      const errorResult = { success: false, message: error.message || "Failed to test connection" };
      setTestConnectionResult(errorResult);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    },
  });

  const onLlmSubmit = (data: LlmConfigFormData) => {
    createLlmMutation.mutate(data);
  };

  const handleTestConnection = () => {
    const formData = llmForm.getValues();
    if (!formData.apiKey) {
      toast({
        title: "Validation Error",
        description: "Please enter an API key before testing",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.provider) {
      toast({
        title: "Validation Error",
        description: "Please select a provider before testing",
        variant: "destructive",
      });
      return;
    }

    if (formData.provider === "azure" && !formData.azureEndpoint) {
      toast({
        title: "Validation Error",
        description: "Azure OpenAI requires an endpoint URL",
        variant: "destructive",
      });
      return;
    }

    setTestConnectionResult(null);
    testConnectionMutation.mutate({
      provider: formData.provider === "azure" ? "azure_openai" : formData.provider,
      apiKey: formData.apiKey,
      endpoint: formData.azureEndpoint,
      apiVersion: formData.azureApiVersion,
      model: formData.model,
    });
  };

  const getProviderName = (provider: string) => {
    const names: Record<string, string> = {
      openai: "OpenAI",
      azure_openai: "Azure OpenAI",
      anthropic: "Anthropic (Claude)",
    };
    return names[provider] || provider;
  };

  const getProviderBadgeVariant = (provider: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      openai: "default",
      azure_openai: "secondary",
      anthropic: "outline",
    };
    return variants[provider] || "default";
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={SettingsIcon}
        title="Settings"
        description="Configure AI providers and platform settings"
        testId="hero-settings"
      />
      
      <div className="container mx-auto p-6 space-y-6">

      {/* MFA Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription className="mt-1">
              Add an extra layer of security to your account with TOTP-based MFA
            </CardDescription>
          </div>
          {!mfaLoading && !mfaStatus?.enabled && (
            <Button onClick={() => setShowMFASetup(true)} data-testid="button-enable-mfa">
              <KeyRound className="h-4 w-4 mr-2" />
              Enable MFA
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {mfaLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading MFA status...
            </div>
          ) : mfaStatus?.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">MFA is Active</p>
                    <p className="text-sm text-muted-foreground">
                      Your account is protected with two-factor authentication
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700">
                  Enabled
                </Badge>
              </div>

              {mfaStatus.backupCodesRemaining !== undefined && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Backup Codes</p>
                      <p className="text-sm text-muted-foreground">
                        {mfaStatus.backupCodesRemaining} {mfaStatus.backupCodesRemaining === 1 ? 'code' : 'codes'} remaining
                      </p>
                    </div>
                  </div>
                  {mfaStatus.backupCodesRemaining < 3 && (
                    <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                      Low
                    </Badge>
                  )}
                </div>
              )}

              <Button
                variant="destructive"
                onClick={() => setShowDisableMFAConfirm(true)}
                data-testid="button-disable-mfa"
              >
                Disable MFA
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">MFA is not enabled</p>
                <p className="text-sm text-muted-foreground">
                  Protect your account with two-factor authentication using Google Authenticator or similar apps
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Provider Configuration
            </CardTitle>
            <CardDescription className="mt-1">
              Configure LLM credentials for AI agent execution and workflow intelligence
            </CardDescription>
          </div>
          {!showLlmForm && (
            <Button onClick={() => setShowLlmForm(true)} data-testid="button-add-llm-config">
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {showLlmForm && (
            <div className="border rounded-md p-4 bg-muted/30">
              <Form {...llmForm}>
                <form onSubmit={llmForm.handleSubmit(onLlmSubmit)} className="space-y-4">
                  <FormField
                    control={llmForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Configuration Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Production OpenAI" data-testid="input-llm-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={llmForm.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-llm-provider">
                              <SelectValue placeholder="Select LLM provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="azure">Azure OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={llmForm.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={
                              selectedLlmProvider === "openai" 
                                ? "gpt-4" 
                                : selectedLlmProvider === "anthropic" 
                                ? "claude-3-opus-20240229" 
                                : selectedLlmProvider === "azure"
                                ? "your-deployment-name"
                                : "gpt-4"
                            } 
                            data-testid="input-llm-model" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {selectedLlmProvider === "azure" 
                            ? "Enter your Azure deployment name (not the full URL)"
                            : "Model identifier for API calls"
                          }
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={llmForm.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="sk-..." data-testid="input-llm-api-key" {...field} />
                        </FormControl>
                        <FormDescription>
                          Encrypted with AES-256-GCM before storage
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedLlmProvider === "azure" && (
                    <>
                      <FormField
                        control={llmForm.control}
                        name="azureEndpoint"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Azure Endpoint</FormLabel>
                            <FormControl>
                              <Input type="url" placeholder="https://your-resource.openai.azure.com" data-testid="input-llm-azure-endpoint" {...field} />
                            </FormControl>
                            <FormDescription>
                              Base URL only - do not include /openai/deployments or other paths
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={llmForm.control}
                        name="azureApiVersion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Azure API Version</FormLabel>
                            <FormControl>
                              <Input placeholder="2024-12-01-preview" data-testid="input-llm-azure-api-version" {...field} />
                            </FormControl>
                            <FormDescription>
                              Azure OpenAI API version (e.g., 2024-12-01-preview, 2024-02-01)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={llmForm.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <input type="checkbox" checked={field.value} onChange={field.onChange} data-testid="checkbox-llm-default" />
                        </FormControl>
                        <FormLabel className="mt-0">Set as default configuration</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {testConnectionResult && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-md ${
                        testConnectionResult.success
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20"
                          : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                      }`}
                      data-testid="test-connection-result"
                    >
                      {testConnectionResult.success ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm">{testConnectionResult.message}</span>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTestConnection}
                      disabled={testConnectionMutation.isPending}
                      data-testid="button-test-connection"
                    >
                      {testConnectionMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>
                    <Button type="submit" disabled={createLlmMutation.isPending} data-testid="button-save-llm-config">
                      {createLlmMutation.isPending ? "Saving..." : "Save Configuration"}
                    </Button>
                    <Button variant="outline" onClick={() => { llmForm.reset(); setShowLlmForm(false); setTestConnectionResult(null); }} type="button">
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          <div>
            {llmConfigs.length === 0 ? (
              <div className="text-center p-8 border rounded-md bg-muted/20">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No LLM configurations yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add your first configuration to enable AI agents
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {llmConfigs.map((config: any) => (
                  <div key={config.id} className="flex items-center justify-between p-4 border rounded-md hover-elevate" data-testid={`llm-config-card-${config.id}`}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        {config.isDefault && (
                          <Badge variant="default" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {config.provider === "openai" ? "OpenAI" : config.provider === "azure" ? "Azure OpenAI" : "Anthropic"} • {config.model}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteLlmTarget(config.id)} data-testid={`button-delete-llm-${config.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Super Admin Key Management
              </CardTitle>
              <CardDescription className="mt-1">
                Generate invitation keys for new super administrators
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-md p-4 bg-muted/30 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Expires In (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                    className="mt-2"
                    data-testid="input-key-expiry"
                  />
                </div>
                <Button
                  onClick={() => {
                    apiRequest("POST", "/api/super-admin/keys", { expiresInDays })
                      .then(res => res.json())
                      .then(data => {
                        setGeneratedKey(data.key);
                        queryClient.invalidateQueries({ queryKey: ["/api/super-admin/keys"] });
                        toast({
                          title: "Super admin key generated!",
                          description: "Save this key securely - it will not be shown again",
                        });
                      })
                      .catch(error => {
                        toast({
                          title: "Failed to generate key",
                          description: error.message,
                          variant: "destructive",
                        });
                      });
                  }}
                  className="mt-7"
                  data-testid="button-generate-key"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Key
                </Button>
              </div>

              {generatedKey && (
                <div className="p-4 bg-primary/10 border border-primary rounded-md">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium">New Super Admin Key:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKey);
                        toast({ title: "Key copied to clipboard" });
                      }}
                      data-testid="button-copy-key"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="text-xs break-all bg-background p-2 rounded block" data-testid="text-generated-key">
                    {generatedKey}
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Save this key securely. It will not be shown again.
                  </p>
                </div>
              )}
            </div>

            <SuperAdminKeysList />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteLlmTarget} onOpenChange={() => setDeleteLlmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove AI Provider Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this AI provider configuration? AI agents using this configuration will fail to execute.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-llm">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLlmTarget && deleteLlmMutation.mutate(deleteLlmTarget)}
              data-testid="button-confirm-delete-llm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLlmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Configuration"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MFA Setup Dialog */}
      <MFASetupDialog
        open={showMFASetup}
        onClose={() => setShowMFASetup(false)}
      />

      {/* Disable MFA Confirmation Dialog */}
      <AlertDialog open={showDisableMFAConfirm} onOpenChange={setShowDisableMFAConfirm}>
        <AlertDialogContent data-testid="dialog-disable-mfa-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra layer of security from your account. Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <Label htmlFor="disable-password">Password</Label>
            <Input
              id="disable-password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Enter your password"
              data-testid="input-disable-mfa-password"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDisableMFAConfirm(false);
              setDisablePassword('');
            }}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => disableMFAMutation.mutate(disablePassword)}
              disabled={!disablePassword || disableMFAMutation.isPending}
              data-testid="button-confirm-disable-mfa"
            >
              {disableMFAMutation.isPending ? "Disabling..." : "Disable MFA"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

function SuperAdminKeysList() {
  const { data: keys = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/super-admin/keys"],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="text-center p-8 border rounded-md bg-muted/20">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No super admin keys generated yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Generated Keys</h3>
      {keys.map((key: any) => (
        <div
          key={key.id}
          className="flex items-center justify-between p-4 border rounded-md"
          data-testid={`key-card-${key.id}`}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {key.usedAt ? (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Used
                </Badge>
              ) : key.revokedAt ? (
                <Badge variant="outline" className="gap-1 text-red-600 border-red-600">
                  <X className="h-3 w-3" />
                  Revoked
                </Badge>
              ) : new Date(key.expiresAt) < new Date() ? (
                <Badge variant="outline" className="gap-1 text-orange-600 border-orange-600">
                  <AlertCircle className="h-3 w-3" />
                  Expired
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Created {formatDistance(new Date(key.createdAt), new Date(), { addSuffix: true })}
            </span>
            <span className="text-xs text-muted-foreground">
              Expires {formatDistance(new Date(key.expiresAt), new Date(), { addSuffix: true })}
            </span>
            {key.usedAt && (
              <span className="text-xs text-muted-foreground">
                Used {formatDistance(new Date(key.usedAt), new Date(), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
