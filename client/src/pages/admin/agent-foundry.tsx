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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Bot className="w-8 h-8" />
            AI Agent Foundry
          </h1>
          <p className="text-muted-foreground mt-1">
            Create, manage, and publish AI agents for your platform
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-agent">
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
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
