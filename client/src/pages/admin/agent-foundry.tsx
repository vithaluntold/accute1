import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bot, Plus, CheckCircle, XCircle, Eye, Upload, Code, Settings, Loader2, Package, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AIAgent {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  provider: string;
  category: string;
  version: string;
  isPublished: boolean;
  publishedAt: string | null;
  subscriptionMinPlan: string;
  backendPath: string | null;
  frontendPath: string | null;
  manifestJson: string | null;
  installCount: number;
  createdAt: string;
}

export default function AgentFoundryPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    provider: "internal",
    category: "accounting",
    version: "1.0.0",
    subscriptionMinPlan: "free" as "free" | "starter" | "professional" | "enterprise",
    pricingModel: "free" as "free" | "per_month" | "per_year" | "per_instance" | "per_token" | "one_time" | "hybrid",
    priceMonthly: "",
    priceYearly: "",
    pricePerInstance: "",
    pricePerToken: "",
    oneTimeFee: "",
    manifestJson: "",
  });

  // Fetch all agents
  const { data: agents = [], isLoading } = useQuery<AIAgent[]>({
    queryKey: ["/api/admin/agents"],
    select: (data: any) => data.agents || [],
  });

  // Create agent mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/agents", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create agent",
        variant: "destructive",
      });
    },
  });

  // Publish agent mutation
  const publishMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await apiRequest("POST", `/api/admin/agents/${slug}/publish`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent published successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish agent",
        variant: "destructive",
      });
    },
  });

  // Unpublish agent mutation
  const unpublishMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await apiRequest("POST", `/api/admin/agents/${slug}/unpublish`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent unpublished successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unpublish agent",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate manifest JSON
    let manifestData;
    try {
      manifestData = JSON.parse(formData.manifestJson);
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON in manifest",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      provider: formData.provider,
      category: formData.category,
      version: formData.version,
      subscriptionMinPlan: formData.subscriptionMinPlan,
      pricingModel: formData.pricingModel,
      priceMonthly: formData.priceMonthly ? parseFloat(formData.priceMonthly) : 0,
      priceYearly: formData.priceYearly ? parseFloat(formData.priceYearly) : 0,
      pricePerInstance: formData.pricePerInstance ? parseFloat(formData.pricePerInstance) : 0,
      pricePerToken: formData.pricePerToken ? parseFloat(formData.pricePerToken) : 0,
      oneTimeFee: formData.oneTimeFee ? parseFloat(formData.oneTimeFee) : 0,
      manifestJson: formData.manifestJson,
    };

    createMutation.mutate(payload);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      provider: "internal",
      category: "accounting",
      version: "1.0.0",
      subscriptionMinPlan: "free",
      pricingModel: "free",
      priceMonthly: "",
      priceYearly: "",
      pricePerInstance: "",
      pricePerToken: "",
      oneTimeFee: "",
      manifestJson: "",
    });
  };

  const loadExampleManifest = () => {
    const exampleManifest = {
      slug: formData.slug || "example-agent",
      name: formData.name || "Example Agent",
      version: formData.version || "1.0.0",
      description: formData.description || "An example AI agent",
      category: formData.category || "accounting",
      provider: formData.provider || "internal",
      capabilities: ["chat", "analysis"],
      subscriptionMinPlan: formData.subscriptionMinPlan || "free",
      defaultScope: "admin",
      pricing: {
        model: formData.pricingModel || "free",
        priceMonthly: formData.priceMonthly ? parseFloat(formData.priceMonthly) : 0,
        priceYearly: formData.priceYearly ? parseFloat(formData.priceYearly) : 0,
        pricePerInstance: formData.pricePerInstance ? parseFloat(formData.pricePerInstance) : 0,
        pricePerToken: formData.pricePerToken ? parseFloat(formData.pricePerToken) : 0,
        oneTimeFee: formData.oneTimeFee ? parseFloat(formData.oneTimeFee) : 0,
      },
      paths: {
        backend: `/agents/${formData.slug || "example-agent"}/backend.ts`,
        frontend: `/agents/${formData.slug || "example-agent"}/frontend.tsx`,
        icon: `/agents/${formData.slug || "example-agent"}/icon.png`,
      },
    };

    setFormData({
      ...formData,
      manifestJson: JSON.stringify(exampleManifest, null, 2),
    });
  };

  const viewAgent = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setIsViewDialogOpen(true);
  };

  return (
    <div>
      {/* Gradient Hero Section */}
      <div className="relative mb-8">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-2">
                <Bot className="h-10 w-10 text-white" />
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white">AI Agent Foundry</h1>
              </div>
              <p className="text-white/90 text-lg">Create, manage, and publish AI agents for your platform</p>
            </div>
            <Button data-testid="button-create-agent" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-7xl">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New AI Agent</DialogTitle>
              <DialogDescription>
                Define a new AI agent with its manifest configuration. The manifest will be validated and synced to the database.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" data-testid="label-name">Agent Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Parity AI Accountant"
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug" data-testid="label-slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="parity-accountant"
                    required
                    data-testid="input-slug"
                  />
                  <p className="text-xs text-muted-foreground">Unique identifier (lowercase, hyphens only)</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" data-testid="label-description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="AI-powered accounting assistant that helps with bookkeeping tasks"
                  rows={3}
                  required
                  data-testid="textarea-description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider" data-testid="label-provider">Provider</Label>
                  <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
                    <SelectTrigger id="provider" data-testid="select-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="azure">Azure OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" data-testid="label-category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accounting">Accounting</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="automation">Automation</SelectItem>
                      <SelectItem value="communication">Communication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version" data-testid="label-version">Version</Label>
                  <Input
                    id="version"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="1.0.0"
                    data-testid="input-version"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-plan" data-testid="label-subscription-plan">Minimum Subscription Plan</Label>
                <Select
                  value={formData.subscriptionMinPlan}
                  onValueChange={(value: any) => setFormData({ ...formData, subscriptionMinPlan: value })}
                >
                  <SelectTrigger id="subscription-plan" data-testid="select-subscription-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Comprehensive Pricing Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-secondary font-semibold text-sm">Agent Pricing</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="pricing-model" data-testid="label-pricing-model">Pricing Model</Label>
                  <Select
                    value={formData.pricingModel}
                    onValueChange={(value: any) => setFormData({ ...formData, pricingModel: value })}
                  >
                    <SelectTrigger id="pricing-model" data-testid="select-pricing-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="per_month">Per Month</SelectItem>
                      <SelectItem value="per_year">Per Year</SelectItem>
                      <SelectItem value="per_instance">Per Instance (Usage-Based)</SelectItem>
                      <SelectItem value="per_token">Per Token Consumed</SelectItem>
                      <SelectItem value="one_time">One-Time Fee</SelectItem>
                      <SelectItem value="hybrid">Hybrid (Multiple Models)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose how organizations will be billed for this agent</p>
                </div>

                {/* Conditional pricing inputs based on model */}
                {(formData.pricingModel === 'per_month' || formData.pricingModel === 'hybrid') && (
                  <div className="space-y-2">
                    <Label htmlFor="price-monthly" data-testid="label-price-monthly">Monthly Price ($)</Label>
                    <Input
                      id="price-monthly"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.priceMonthly}
                      onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                      placeholder="29.99"
                      data-testid="input-price-monthly"
                    />
                  </div>
                )}

                {(formData.pricingModel === 'per_year' || formData.pricingModel === 'hybrid') && (
                  <div className="space-y-2">
                    <Label htmlFor="price-yearly" data-testid="label-price-yearly">Yearly Price ($)</Label>
                    <Input
                      id="price-yearly"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.priceYearly}
                      onChange={(e) => setFormData({ ...formData, priceYearly: e.target.value })}
                      placeholder="299.99"
                      data-testid="input-price-yearly"
                    />
                  </div>
                )}

                {(formData.pricingModel === 'per_instance' || formData.pricingModel === 'hybrid') && (
                  <div className="space-y-2">
                    <Label htmlFor="price-per-instance" data-testid="label-price-per-instance">Price Per Instance ($)</Label>
                    <Input
                      id="price-per-instance"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={formData.pricePerInstance}
                      onChange={(e) => setFormData({ ...formData, pricePerInstance: e.target.value })}
                      placeholder="0.50"
                      data-testid="input-price-per-instance"
                    />
                    <p className="text-xs text-muted-foreground">Cost each time the agent is invoked</p>
                  </div>
                )}

                {(formData.pricingModel === 'per_token' || formData.pricingModel === 'hybrid') && (
                  <div className="space-y-2">
                    <Label htmlFor="price-per-token" data-testid="label-price-per-token">Price Per Token ($)</Label>
                    <Input
                      id="price-per-token"
                      type="number"
                      step="0.000001"
                      min="0"
                      value={formData.pricePerToken}
                      onChange={(e) => setFormData({ ...formData, pricePerToken: e.target.value })}
                      placeholder="0.000001"
                      data-testid="input-price-per-token"
                    />
                    <p className="text-xs text-muted-foreground">Cost per AI token consumed</p>
                  </div>
                )}

                {(formData.pricingModel === 'one_time' || formData.pricingModel === 'hybrid') && (
                  <div className="space-y-2">
                    <Label htmlFor="one-time-fee" data-testid="label-one-time-fee">One-Time Fee ($)</Label>
                    <Input
                      id="one-time-fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.oneTimeFee}
                      onChange={(e) => setFormData({ ...formData, oneTimeFee: e.target.value })}
                      placeholder="99.99"
                      data-testid="input-one-time-fee"
                    />
                    <p className="text-xs text-muted-foreground">One-time purchase price for lifetime access</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="manifest" data-testid="label-manifest">Manifest JSON *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadExampleManifest}
                    data-testid="button-load-example"
                  >
                    <Code className="w-4 h-4 mr-2" />
                    Load Example
                  </Button>
                </div>
                <Textarea
                  id="manifest"
                  value={formData.manifestJson}
                  onChange={(e) => setFormData({ ...formData, manifestJson: e.target.value })}
                  placeholder='{"slug": "agent-name", "name": "Agent Name", ...}'
                  rows={12}
                  className="font-mono text-sm"
                  required
                  data-testid="textarea-manifest"
                />
                <p className="text-xs text-muted-foreground">
                  Define the agent's capabilities, paths, and configuration. Must be valid JSON.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Agent
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>AI Agents</CardTitle>
            <CardDescription>
              Manage your platform's AI agents. Publish agents to make them available to organizations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Installs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No agents found. Create your first agent to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.id} data-testid={`row-agent-${agent.slug}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-muted-foreground line-clamp-1">{agent.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">{agent.slug || "—"}</code>
                      </TableCell>
                      <TableCell className="capitalize">{agent.category}</TableCell>
                      <TableCell className="capitalize">{agent.subscriptionMinPlan}</TableCell>
                      <TableCell>
                        {agent.isPublished ? (
                          <Badge variant="default" className="gap-1" data-testid={`status-published-${agent.slug}`}>
                            <Globe className="w-3 h-3" />
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="secondary" data-testid={`status-draft-${agent.slug}`}>
                            Draft
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{agent.installCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewAgent(agent)}
                            data-testid={`button-view-${agent.slug}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {agent.slug && (
                            agent.isPublished ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unpublishMutation.mutate(agent.slug!)}
                                disabled={unpublishMutation.isPending}
                                data-testid={`button-unpublish-${agent.slug}`}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Unpublish
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => publishMutation.mutate(agent.slug!)}
                                disabled={publishMutation.isPending}
                                data-testid={`button-publish-${agent.slug}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Publish
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* View Agent Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {selectedAgent?.name}
            </DialogTitle>
            <DialogDescription>Agent details and configuration</DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Slug</Label>
                  <code className="block text-sm bg-muted px-3 py-2 rounded mt-1">
                    {selectedAgent.slug || "—"}
                  </code>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Version</Label>
                  <p className="text-sm mt-1">{selectedAgent.version}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Description</Label>
                <p className="text-sm mt-1">{selectedAgent.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Provider</Label>
                  <p className="text-sm mt-1 capitalize">{selectedAgent.provider}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Category</Label>
                  <p className="text-sm mt-1 capitalize">{selectedAgent.category}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Min Plan</Label>
                  <p className="text-sm mt-1 capitalize">{selectedAgent.subscriptionMinPlan}</p>
                </div>
              </div>

              {selectedAgent.manifestJson && (
                <div>
                  <Label className="text-sm text-muted-foreground">Manifest</Label>
                  <pre className="text-xs bg-muted p-4 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedAgent.manifestJson), null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Created At</Label>
                  <p className="text-sm mt-1">{new Date(selectedAgent.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Published At</Label>
                  <p className="text-sm mt-1">
                    {selectedAgent.publishedAt
                      ? new Date(selectedAgent.publishedAt).toLocaleString()
                      : "Not published"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
