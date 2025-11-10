import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import { Building2, Palette, Bot, Users, Save, Trash2, Plus, Globe } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

const companyInfoSchema = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  displayName: z.string().min(1, "Display name is required"),
  industry: z.string().optional(),
  billingEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

const brandingSchema = z.object({
  logoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  brandColors: z.object({
    primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
    secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
  }).optional(),
});

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

type CompanyInfoFormData = z.infer<typeof companyInfoSchema>;
type BrandingFormData = z.infer<typeof brandingSchema>;
type LlmConfigFormData = z.infer<typeof llmConfigSchema>;

export default function OrganizationSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("company");
  const [showLlmForm, setShowLlmForm] = useState(false);
  const [editingLlmId, setEditingLlmId] = useState<string | null>(null);
  const [deleteLlmTarget, setDeleteLlmTarget] = useState<string | null>(null);

  // Get current user and organization
  const { data: user } = useQuery<any>({
    queryKey: ["/api/users/me"],
  });
  const orgId = user?.defaultOrganizationId;

  // Fetch organization settings
  const { data: organization, isLoading: orgLoading } = useQuery<any>({
    queryKey: ["/api/organizations", orgId, "settings"],
    enabled: !!orgId,
  });

  // Fetch LLM configurations (workspace-scoped)
  const { data: llmConfigs = [], isLoading: llmLoading } = useQuery<any[]>({
    queryKey: ["/api/llm-configurations", orgId],
    enabled: !!orgId,
  });

  // Fetch team members
  const { data: members = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/organizations", orgId, "members"],
    enabled: !!orgId,
  });

  // Company Info Form
  const companyForm = useForm<CompanyInfoFormData>({
    resolver: zodResolver(companyInfoSchema),
    values: {
      legalName: organization?.legalName || "",
      displayName: organization?.displayName || organization?.name || "",
      industry: organization?.industry || "",
      billingEmail: organization?.billingEmail || "",
      timezone: organization?.timezone || "America/New_York",
      locale: organization?.locale || "en-US",
      address: organization?.address || {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "US",
      },
    },
  });

  // Branding Form
  const brandingForm = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    values: {
      logoUrl: organization?.logoUrl || "",
      brandColors: organization?.brandColors || {
        primary: "#FF6B35",
        secondary: "#F7931E",
      },
    },
  });

  // LLM Config Form
  const llmForm = useForm<LlmConfigFormData>({
    resolver: zodResolver(llmConfigSchema),
    defaultValues: {
      name: "",
      provider: "openai",
      apiKey: "",
      model: "gpt-4",
      isDefault: false,
    },
  });

  // Update Company Info Mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: CompanyInfoFormData) => {
      return await apiRequest(`/api/organizations/${orgId}/settings`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/workspaces"] });
      toast({
        title: "Success",
        description: "Company information updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update company information",
      });
    },
  });

  // Update Branding Mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (data: BrandingFormData) => {
      return await apiRequest(`/api/organizations/${orgId}/settings`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/workspaces"] });
      toast({
        title: "Success",
        description: "Branding updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update branding",
      });
    },
  });

  // Create LLM Config Mutation
  const createLlmMutation = useMutation({
    mutationFn: async (data: LlmConfigFormData) => {
      return await apiRequest("/api/llm-configurations", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-configurations", orgId] });
      toast({
        title: "Success",
        description: "LLM configuration created successfully",
      });
      setShowLlmForm(false);
      llmForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create LLM configuration",
      });
    },
  });

  // Delete LLM Config Mutation
  const deleteLlmMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/llm-configurations/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-configurations", orgId] });
      toast({
        title: "Success",
        description: "LLM configuration deleted successfully",
      });
      setDeleteLlmTarget(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete LLM configuration",
      });
    },
  });

  const handleCompanySubmit = (data: CompanyInfoFormData) => {
    updateCompanyMutation.mutate(data);
  };

  const handleBrandingSubmit = (data: BrandingFormData) => {
    updateBrandingMutation.mutate(data);
  };

  const handleLlmSubmit = (data: LlmConfigFormData) => {
    createLlmMutation.mutate(data);
  };

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>No Workspace Selected</CardTitle>
            <CardDescription>
              Please create or select a workspace to access organization settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GradientHero
        title="Organization Settings"
        subtitle={`Manage workspace settings for ${organization?.displayName || organization?.name || "your organization"}`}
        icon={Building2}
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="company" data-testid="tab-company">
              <Building2 className="h-4 w-4 mr-2" />
              Company Info
            </TabsTrigger>
            <TabsTrigger value="branding" data-testid="tab-branding">
              <Palette className="h-4 w-4 mr-2" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="llm" data-testid="tab-llm">
              <Bot className="h-4 w-4 mr-2" />
              AI Providers
            </TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
          </TabsList>

          {/* Company Information Tab */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Manage your organization's legal and operational details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...companyForm}>
                  <form onSubmit={companyForm.handleSubmit(handleCompanySubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={companyForm.control}
                        name="legalName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Legal Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-legal-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={companyForm.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-display-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={companyForm.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Industry</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Accounting, Finance" data-testid="input-industry" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={companyForm.control}
                        name="billingEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" data-testid="input-billing-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={companyForm.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-timezone">
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                                <SelectItem value="UTC">UTC</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={companyForm.control}
                        name="locale"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Locale</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-locale">
                                  <SelectValue placeholder="Select locale" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="en-US">English (US)</SelectItem>
                                <SelectItem value="en-GB">English (UK)</SelectItem>
                                <SelectItem value="es-ES">Spanish</SelectItem>
                                <SelectItem value="fr-FR">French</SelectItem>
                                <SelectItem value="de-DE">German</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Address</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={companyForm.control}
                          name="address.street"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Street Address</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-street" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={companyForm.control}
                          name="address.city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={companyForm.control}
                          name="address.state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State/Province</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={companyForm.control}
                          name="address.zipCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>ZIP/Postal Code</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-zipcode" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={companyForm.control}
                          name="address.country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-country" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={updateCompanyMutation.isPending}
                      data-testid="button-save-company"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateCompanyMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Branding & Visual Identity</CardTitle>
                <CardDescription>
                  Customize your workspace's appearance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...brandingForm}>
                  <form onSubmit={brandingForm.handleSubmit(handleBrandingSubmit)} className="space-y-6">
                    <FormField
                      control={brandingForm.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://example.com/logo.png" data-testid="input-logo-url" />
                          </FormControl>
                          <FormDescription>
                            URL to your organization's logo image
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Brand Colors</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={brandingForm.control}
                          name="brandColors.primary"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Primary Color</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input {...field} placeholder="#FF6B35" data-testid="input-primary-color" />
                                </FormControl>
                                <div
                                  className="w-12 h-10 rounded border"
                                  style={{ backgroundColor: field.value || "#FF6B35" }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={brandingForm.control}
                          name="brandColors.secondary"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secondary Color</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input {...field} placeholder="#F7931E" data-testid="input-secondary-color" />
                                </FormControl>
                                <div
                                  className="w-12 h-10 rounded border"
                                  style={{ backgroundColor: field.value || "#F7931E" }}
                                />
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={updateBrandingMutation.isPending}
                      data-testid="button-save-branding"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateBrandingMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LLM Configurations Tab */}
          <TabsContent value="llm">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>AI Provider Configurations</CardTitle>
                    <CardDescription>
                      Manage workspace-specific AI provider credentials
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowLlmForm(true)}
                    data-testid="button-add-llm-config"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Configuration
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {llmConfigs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No AI provider configurations yet</p>
                    <p className="text-sm">Add a configuration to use AI agents in this workspace</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {llmConfigs.map((config: any) => (
                      <Card key={config.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium" data-testid={`llm-config-name-${config.id}`}>
                                  {config.name}
                                </h3>
                                {config.isDefault && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Provider: {config.provider}</span>
                                <span>Model: {config.model}</span>
                              </div>
                              {config.provider === "azure" && config.azureEndpoint && (
                                <div className="text-sm text-muted-foreground">
                                  <Globe className="h-3 w-3 inline mr-1" />
                                  {config.azureEndpoint}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteLlmTarget(config.id)}
                              data-testid={`button-delete-llm-${config.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Add/Edit LLM Config Dialog */}
                {showLlmForm && (
                  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl">
                      <CardHeader>
                        <CardTitle>Add AI Provider Configuration</CardTitle>
                        <CardDescription>
                          Configure an AI provider for this workspace
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Form {...llmForm}>
                          <form onSubmit={llmForm.handleSubmit(handleLlmSubmit)} className="space-y-4">
                            <FormField
                              control={llmForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Configuration Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Production OpenAI" data-testid="input-llm-name" />
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
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-llm-provider">
                                        <SelectValue placeholder="Select provider" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="openai">OpenAI</SelectItem>
                                      <SelectItem value="azure">Azure OpenAI</SelectItem>
                                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                                    </SelectContent>
                                  </Select>
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
                                    <Input {...field} type="password" data-testid="input-llm-api-key" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {llmForm.watch("provider") === "azure" && (
                              <>
                                <FormField
                                  control={llmForm.control}
                                  name="azureEndpoint"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Azure Endpoint</FormLabel>
                                      <FormControl>
                                        <Input {...field} placeholder="https://your-resource.openai.azure.com" data-testid="input-azure-endpoint" />
                                      </FormControl>
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
                                        <Input {...field} placeholder="2024-02-15-preview" data-testid="input-azure-api-version" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </>
                            )}

                            <FormField
                              control={llmForm.control}
                              name="model"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Model</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="gpt-4" data-testid="input-llm-model" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="flex justify-end gap-2 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setShowLlmForm(false);
                                  llmForm.reset();
                                }}
                                data-testid="button-cancel-llm"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={createLlmMutation.isPending}
                                data-testid="button-submit-llm"
                              >
                                {createLlmMutation.isPending ? "Creating..." : "Create Configuration"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Members</CardTitle>
                <CardDescription>
                  View and manage team members in this workspace
                </CardDescription>
              </CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="text-center py-8">Loading members...</div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No members found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {members.map((member: any) => (
                      <Card key={member.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {member.user?.fullName?.substring(0, 2).toUpperCase() || "?"}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium" data-testid={`member-name-${member.id}`}>
                                  {member.user?.fullName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {member.user?.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm bg-secondary/50 px-3 py-1 rounded" data-testid={`member-role-${member.id}`}>
                                {member.role?.name || "Member"}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                member.status === "active" ? "bg-green-500/10 text-green-600" : "bg-gray-500/10"
                              }`}>
                                {member.status}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete LLM Config Confirmation */}
      <AlertDialog open={!!deleteLlmTarget} onOpenChange={() => setDeleteLlmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AI Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this AI provider configuration. AI agents using this configuration will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-llm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLlmTarget && deleteLlmMutation.mutate(deleteLlmTarget)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete-llm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
