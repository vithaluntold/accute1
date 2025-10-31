import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Bot, Download, Check, Sparkles, Plus, DollarSign, Tag, FolderCode } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

const createAgentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  provider: z.string().min(1, "Provider is required"),
  category: z.string().min(1, "Category is required"),
  backendPath: z.string().optional(),
  frontendPath: z.string().optional(),
  pricingModel: z.enum(["free", "monthly", "yearly", "usage_based"]),
  priceMonthly: z.coerce.number().min(0).optional(),
  priceYearly: z.coerce.number().min(0).optional(),
  version: z.string().default("1.0.0"),
  tags: z.string().optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

export default function AIAgents() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const isSuperAdmin = currentUser?.role?.name === "Super Admin";

  const { data: agents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ai-agents"],
  });

  const { data: installedAgents = [] } = useQuery<any[]>({
    queryKey: ["/api/ai-agents/installed"],
  });

  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      provider: "openai",
      category: "accounting",
      backendPath: "",
      frontendPath: "",
      pricingModel: "free",
      priceMonthly: 0,
      priceYearly: 0,
      version: "1.0.0",
      tags: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      const agentData = {
        ...data,
        tags: data.tags ? data.tags.split(",").map(t => t.trim()) : [],
        capabilities: [],
        configuration: {},
        isPublic: true,
      };
      return apiRequest("POST", "/api/ai-agents", agentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({
        title: "Success",
        description: "AI agent created successfully",
      });
      form.reset();
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create AI agent",
        variant: "destructive",
      });
    },
  });

  const installMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return apiRequest("POST", `/api/ai-agents/${agentId}/install`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents/installed"] });
      toast({
        title: "Success",
        description: "AI agent installed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to install AI agent",
        variant: "destructive",
      });
    },
  });

  const isInstalled = (agentId: string) => {
    return installedAgents.some((a: any) => a.agentId === agentId);
  };

  const onSubmit = (data: CreateAgentForm) => {
    createMutation.mutate(data);
  };

  const filteredAgents = agents.filter((agent: any) => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || agent.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getPricingDisplay = (agent: any) => {
    if (agent.pricingModel === "free") return "Free";
    if (agent.pricingModel === "monthly") return `$${agent.priceMonthly}/mo`;
    if (agent.pricingModel === "yearly") return `$${agent.priceYearly}/yr`;
    if (agent.pricingModel === "usage_based") return "Usage-based";
    return "Free";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading AI agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={Sparkles}
        title="AI Agent Marketplace"
        description="Browse and install pre-built AI agents to automate your workflows"
        testId="hero-ai-agents"
        actions={
          isSuperAdmin ? (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/20 backdrop-blur-sm text-white border-white/30 hover:bg-white/30" data-testid="button-create-agent">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Agent
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create AI Agent</DialogTitle>
                <DialogDescription>
                  Create a new AI agent listing with directory paths and pricing
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Automated Casting Tool" data-testid="input-agent-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what this agent does..."
                            rows={3}
                            data-testid="input-agent-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AI Provider</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-agent-provider">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="openai">OpenAI</SelectItem>
                              <SelectItem value="anthropic">Anthropic</SelectItem>
                              <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-agent-category">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="accounting">Accounting</SelectItem>
                              <SelectItem value="tax">Tax</SelectItem>
                              <SelectItem value="client_service">Client Service</SelectItem>
                              <SelectItem value="automation">Automation</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border rounded-md p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FolderCode className="h-4 w-4" />
                      Directory Paths
                    </div>
                    <FormField
                      control={form.control}
                      name="backendPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Backend Path</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="agents/automated-casting-tool/backend/"
                              data-testid="input-backend-path"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Path to backend code directory
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="frontendPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frontend Path</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="agents/automated-casting-tool/frontend/"
                              data-testid="input-frontend-path"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Path to frontend code directory
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border rounded-md p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <DollarSign className="h-4 w-4" />
                      Pricing & Subscription
                    </div>
                    <FormField
                      control={form.control}
                      name="pricingModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pricing Model</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-pricing-model">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="monthly">Monthly Subscription</SelectItem>
                              <SelectItem value="yearly">Yearly Subscription</SelectItem>
                              <SelectItem value="usage_based">Usage-Based</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("pricingModel") === "monthly" && (
                      <FormField
                        control={form.control}
                        name="priceMonthly"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Price ($)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="29"
                                data-testid="input-price-monthly"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {form.watch("pricingModel") === "yearly" && (
                      <FormField
                        control={form.control}
                        name="priceYearly"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Yearly Price ($)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="290"
                                data-testid="input-price-yearly"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Version</FormLabel>
                          <FormControl>
                            <Input placeholder="1.0.0" data-testid="input-version" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tags</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="tax, automation, AI"
                              data-testid="input-tags"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Comma-separated</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      data-testid="button-submit-create"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Agent"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />
      
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search AI agents..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-agents"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("all")}
            data-testid="button-filter-all"
          >
            All
          </Button>
          <Button
            variant={categoryFilter === "accounting" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("accounting")}
            data-testid="button-filter-accounting"
          >
            Accounting
          </Button>
          <Button
            variant={categoryFilter === "tax" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("tax")}
            data-testid="button-filter-tax"
          >
            Tax
          </Button>
          <Button
            variant={categoryFilter === "client_service" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("client_service")}
            data-testid="button-filter-client"
          >
            Client Service
          </Button>
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-agents">
              {agents.length === 0 ? "No AI agents available" : "No matching agents found"}
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              {agents.length === 0
                ? "AI agents will be available once Super Admins create them"
                : "Try adjusting your search or filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent: any) => {
            const installed = isInstalled(agent.id);
            
            return (
              <Card key={agent.id} className="hover-elevate flex flex-col" data-testid={`agent-card-${agent.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-12 w-12 rounded-md bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-[#e5a660]" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {installed && (
                        <Badge className="bg-green-500" data-testid={`badge-installed-${agent.id}`}>
                          <Check className="h-3 w-3 mr-1" />
                          Installed
                        </Badge>
                      )}
                      <Badge variant="outline" data-testid={`badge-pricing-${agent.id}`}>
                        {getPricingDisplay(agent)}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle data-testid={`agent-name-${agent.id}`}>
                    {agent.name}
                  </CardTitle>
                  <CardDescription data-testid={`agent-description-${agent.id}`}>
                    {agent.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col">
                  <div className="flex flex-wrap gap-2">
                    {agent.category && (
                      <Badge variant="outline" data-testid={`agent-category-${agent.id}`}>
                        {agent.category}
                      </Badge>
                    )}
                    {agent.version && (
                      <Badge variant="outline">
                        v{agent.version}
                      </Badge>
                    )}
                    {agent.tags && agent.tags.length > 0 && agent.tags.slice(0, 2).map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-2">Capabilities:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {agent.capabilities.slice(0, 3).map((cap: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-3 w-3 text-[#e5a660] mt-0.5 flex-shrink-0" />
                            <span>{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isSuperAdmin && (agent.backendPath || agent.frontendPath) && (
                    <div className="text-xs text-muted-foreground border-t pt-2 mt-auto">
                      {agent.backendPath && (
                        <div className="flex items-start gap-1">
                          <FolderCode className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="break-all">{agent.backendPath}</span>
                        </div>
                      )}
                      {agent.frontendPath && (
                        <div className="flex items-start gap-1 mt-1">
                          <FolderCode className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="break-all">{agent.frontendPath}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full mt-auto"
                    variant={installed ? "outline" : "default"}
                    disabled={installed || installMutation.isPending}
                    onClick={() => installMutation.mutate(agent.id)}
                    data-testid={`button-install-${agent.id}`}
                  >
                    {installed ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Installed
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        {installMutation.isPending ? "Installing..." : "Install"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {agents.length > 0 && (
        <div className="mt-8 p-6 bg-muted/30 rounded-lg">
          <h3 className="font-semibold mb-2">About AI Agents</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI agents are modular automation components developed in isolated environments. Each agent
            consists of backend and frontend code stored in specific directory paths, making them easy
            to integrate and maintain.
          </p>
          <p className="text-sm text-muted-foreground">
            Super Admins can create new agents by specifying directory paths where the agent code lives,
            along with pricing models and subscription details.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
