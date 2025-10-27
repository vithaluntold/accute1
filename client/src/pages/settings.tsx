import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Check, X, Loader2, Settings as SettingsIcon, Shield, Copy, CheckCircle2, AlertCircle, Clock, Sparkles } from "lucide-react";
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

const providerSchema = z.object({
  provider: z.enum(["openai", "azure_openai", "anthropic"]),
  apiKey: z.string().min(1, "API key is required"),
  endpoint: z.string().optional(),
  priority: z.coerce.number().min(0).max(100).default(0),
}).refine(
  (data) => {
    // Azure OpenAI requires an endpoint
    if (data.provider === "azure_openai") {
      return data.endpoint && data.endpoint.trim().length > 0;
    }
    return true;
  },
  {
    message: "Azure OpenAI requires an endpoint URL",
    path: ["endpoint"],
  }
);

type ProviderFormData = z.infer<typeof providerSchema>;

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

interface AiProvider {
  id: string;
  organizationId: string;
  provider: string;
  endpoint: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [showLlmForm, setShowLlmForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLlmTarget, setDeleteLlmTarget] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [testConnectionResult, setTestConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const isSuperAdmin = (currentUser as any)?.role?.name === "Super Admin";

  const form = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      provider: "openai",
      apiKey: "",
      endpoint: "",
      priority: 0,
    },
  });

  const selectedProvider = form.watch("provider");

  const { data: providers = [], isLoading } = useQuery<AiProvider[]>({
    queryKey: ["/api/ai-providers"],
  });

  // LLM Configurations (for AI agents)
  const llmForm = useForm<LlmConfigFormData>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: {
      name: "",
      provider: "openai",
      apiKey: "",
      azureEndpoint: "",
      azureApiVersion: "2024-12-01-preview",
      model: "",
      isDefault: false,
    },
  });

  const selectedLlmProvider = llmForm.watch("provider");

  const { data: llmConfigs = [], isLoading: llmLoading } = useQuery<any[]>({
    queryKey: ["/api/llm-configurations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProviderFormData) => {
      return apiRequest("POST", "/api/ai-providers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] });
      toast({
        title: "Success",
        description: "AI provider configured successfully",
      });
      form.reset();
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure AI provider",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ai-providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] });
      toast({
        title: "Success",
        description: "AI provider removed successfully",
      });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove AI provider",
        variant: "destructive",
      });
    },
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
    mutationFn: async (data: { provider: string; apiKey: string; endpoint?: string; apiVersion?: string }) => {
      return apiRequest("POST", "/api/llm-configurations/test", data);
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

  const onSubmit = (data: ProviderFormData) => {
    createMutation.mutate(data);
  };

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-[#e5a660] to-[#d76082] bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure AI providers and platform settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              AI Provider Configuration
            </CardTitle>
            <CardDescription className="mt-1">
              Manage AI providers for agent automation and workflow intelligence
            </CardDescription>
          </div>
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              data-testid="button-add-provider"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {showForm && (
            <div className="border rounded-md p-4 bg-muted/30">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-provider">
                              <SelectValue placeholder="Select AI provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI (GPT-4, GPT-3.5)</SelectItem>
                            <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose your AI provider
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={
                              selectedProvider === "openai"
                                ? "sk-proj-..."
                                : selectedProvider === "anthropic"
                                ? "sk-ant-..."
                                : "Enter your API key"
                            }
                            data-testid="input-api-key"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Your API key will be encrypted using AES-256 before storage
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedProvider === "azure_openai" && (
                    <FormField
                      control={form.control}
                      name="endpoint"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Azure Endpoint</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder="https://your-resource.openai.azure.com"
                              data-testid="input-endpoint"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your Azure OpenAI resource endpoint
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            data-testid="input-priority"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Lower numbers have higher priority (0 = highest)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      data-testid="button-save-provider"
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save Provider
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        form.reset();
                      }}
                      data-testid="button-cancel"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Active Providers</h3>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center p-8 border rounded-md bg-muted/20">
                <SettingsIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No AI providers configured yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add your first provider to enable AI-powered automation
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {providers
                  .sort((a, b) => a.priority - b.priority)
                  .map((provider) => (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                      data-testid={`provider-card-${provider.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={getProviderBadgeVariant(provider.provider)}>
                          {getProviderName(provider.provider)}
                        </Badge>
                        <div className="flex flex-col">
                          {provider.endpoint && (
                            <span className="text-xs text-muted-foreground">
                              {provider.endpoint}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Priority: {provider.priority}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {provider.isActive && (
                          <Badge variant="outline" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(provider.id)}
                          data-testid={`button-delete-${provider.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="mt-4 p-4 border rounded-md bg-muted/20">
            <h4 className="text-sm font-medium mb-2">Security Information</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• API keys are encrypted using AES-256-CBC encryption</li>
              <li>• Keys are never exposed in API responses or logs</li>
              <li>• Each encryption uses a unique initialization vector (IV)</li>
              <li>• All configuration changes are logged in the activity log</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              LLM Configuration (AI Agents)
            </CardTitle>
            <CardDescription className="mt-1">
              Configure LLM credentials for AI agent execution
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

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove AI Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this AI provider? This action cannot be undone
              and may affect workflows using this provider.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Provider"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLlmTarget} onOpenChange={() => setDeleteLlmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove LLM Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this LLM configuration? AI agents using this configuration will fail to execute.
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
