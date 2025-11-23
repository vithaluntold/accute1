import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  FileText, 
  Workflow, 
  FileCheck, 
  Star, 
  Download, 
  Search, 
  Check,
  Loader2,
  ShoppingBag,
  Bot
} from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: 'document_template' | 'form_template' | 'pipeline_template';
  type: string;
  pricingModel: 'free' | 'one_time' | 'subscription';
  price: string;
  priceYearly?: string;
  isFeatured: boolean;
  installCount: number;
  rating: string;
  reviewCount: number;
  tags: string[];
  status: string;
}

interface AIAgent {
  slug: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  capabilities: string[];
  pricingModel?: string;
  priceMonthly?: number;
  priceYearly?: number;
  version?: string;
  tags?: string[];
  isInstalled?: boolean;
}

interface Installation {
  id: string;
  marketplaceItemId: string;
  organizationId: string;
  installedAt: Date;
}

interface AgentInstallation {
  id: string;
  agentId: string;
  agentSlug: string;
  agentName: string;
  agentCategory: string;
  organizationId: string;
  installedBy: string;
  isActive: boolean;
  createdAt: string;
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'document_template' | 'form_template' | 'pipeline_template' | 'ai_agents'>('ai_agents');
  const [installingItemId, setInstallingItemId] = useState<string | null>(null);
  const [uninstallingItemId, setUninstallingItemId] = useState<string | null>(null);
  const [installingAgentSlug, setInstallingAgentSlug] = useState<string | null>(null);
  const [uninstallingAgentSlug, setUninstallingAgentSlug] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch marketplace items
  const { data: items = [], isLoading } = useQuery<MarketplaceItem[]>({
    queryKey: ['/api/marketplace/items'],
  });

  // Fetch installations
  const { data: installations = [] } = useQuery<Installation[]>({
    queryKey: ['/api/marketplace/installations'],
  });

  // Fetch AI agents
  const { data: aiAgents = [], isLoading: isLoadingAgents } = useQuery<AIAgent[]>({
    queryKey: ['/api/marketplace/agents'],
  });

  // Fetch AI agent installations
  const { data: agentInstallations = [] } = useQuery<AgentInstallation[]>({
    queryKey: ['/api/marketplace/agents/installations'],
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: async (itemId: string) => {
      setInstallingItemId(itemId);
      return apiRequest('POST', `/api/marketplace/install/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/installations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/items'] });
      toast({
        title: 'Success',
        description: 'Template installed successfully',
      });
      setInstallingItemId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to install template',
        variant: 'destructive',
      });
      setInstallingItemId(null);
    },
  });

  // Uninstall mutation
  const uninstallMutation = useMutation({
    mutationFn: async (installationId: string) => {
      return apiRequest('DELETE', `/api/marketplace/install/${installationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/installations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/items'] });
      toast({
        title: 'Success',
        description: 'Template uninstalled successfully',
      });
      setUninstallingItemId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to uninstall template',
        variant: 'destructive',
      });
      setUninstallingItemId(null);
    },
  });

  // Install AI agent mutation
  const installAgentMutation = useMutation({
    mutationFn: async (agentSlug: string) => {
      setInstallingAgentSlug(agentSlug);
      return apiRequest('POST', `/api/marketplace/agents/${agentSlug}/install`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/agents/installations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/agents'] });
      toast({
        title: 'Success',
        description: 'AI agent installed successfully',
      });
      setInstallingAgentSlug(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to install AI agent',
        variant: 'destructive',
      });
      setInstallingAgentSlug(null);
    },
  });

  // Uninstall AI agent mutation
  const uninstallAgentMutation = useMutation({
    mutationFn: async (agentSlug: string) => {
      setUninstallingAgentSlug(agentSlug);
      return apiRequest('DELETE', `/api/marketplace/agents/${agentSlug}/uninstall`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/agents/installations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/agents'] });
      toast({
        title: 'Success',
        description: 'AI agent uninstalled successfully',
      });
      setUninstallingAgentSlug(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to uninstall AI agent',
        variant: 'destructive',
      });
      setUninstallingAgentSlug(null);
    },
  });

  const getInstallation = (itemId: string) => {
    return installations.find((inst) => inst.marketplaceItemId === itemId);
  };

  const isInstalled = (itemId: string) => {
    return !!getInstallation(itemId);
  };

  const handleInstall = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    installMutation.mutate(itemId);
  };

  const handleUninstall = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const installation = getInstallation(itemId);
    if (installation) {
      setUninstallingItemId(itemId);
      uninstallMutation.mutate(installation.id);
    }
  };

  const isAgentInstalled = (agentSlug: string) => {
    return agentInstallations.some((inst) => inst.agentSlug === agentSlug && inst.isActive);
  };

  const handleInstallAgent = (agentSlug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    installAgentMutation.mutate(agentSlug);
  };

  const handleUninstallAgent = (agentSlug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    uninstallAgentMutation.mutate(agentSlug);
  };

  const filterItems = (category: string) => {
    return items
      .filter((item) => item.category === category)
      .filter((item) => item.status === 'published')
      .filter((item) => 
        searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        // Featured items first
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        // Then by install count
        return b.installCount - a.installCount;
      });
  };

  const filterAgents = () => {
    return aiAgents.filter((agent) => 
      searchQuery === '' || 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.capabilities && agent.capabilities.some((cap) => cap.toLowerCase().includes(searchQuery.toLowerCase())))
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'document_template':
        return <FileText className="h-5 w-5" />;
      case 'form_template':
        return <FileCheck className="h-5 w-5" />;
      case 'pipeline_template':
        return <Workflow className="h-5 w-5" />;
      case 'ai_agents':
        return <Bot className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const formatPrice = (item: MarketplaceItem) => {
    if (item.pricingModel === 'free') {
      return 'Free';
    }
    const price = parseFloat(item.price || '0');
    if (item.pricingModel === 'one_time') {
      return `$${price.toFixed(2)}`;
    }
    if (item.pricingModel === 'subscription') {
      const yearly = item.priceYearly ? parseFloat(item.priceYearly) : null;
      if (yearly) {
        return `$${price.toFixed(2)}/mo or $${yearly.toFixed(2)}/yr`;
      }
      return `$${price.toFixed(2)}/month`;
    }
    return 'Free';
  };

  const formatAgentPrice = (agent: AIAgent) => {
    if (!agent.pricingModel || agent.pricingModel === 'free') {
      return 'Free';
    }
    if (agent.priceMonthly && agent.priceYearly) {
      return `$${agent.priceMonthly}/mo or $${agent.priceYearly}/yr`;
    }
    if (agent.priceMonthly) {
      return `$${agent.priceMonthly}/month`;
    }
    return 'Free';
  };

  const renderItemCard = (item: MarketplaceItem) => {
    const installed = isInstalled(item.id);
    const installing = installingItemId === item.id;
    const uninstalling = uninstallingItemId === item.id;

    return (
      <Card 
        key={item.id} 
        className="hover-elevate transition-all"
        data-testid={`marketplace-item-${item.id}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-accent/50">
                {getCategoryIcon(item.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-lg truncate" data-testid={`item-name-${item.id}`}>
                    {item.name}
                  </CardTitle>
                  {item.isFeatured && (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Featured
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2" data-testid={`item-description-${item.id}`}>
                  {item.description}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {item.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{item.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                <span data-testid={`item-install-count-${item.id}`}>
                  {item.installCount.toLocaleString()}
                </span>
              </div>
              {item.reviewCount > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-current text-yellow-500" />
                  <span data-testid={`item-rating-${item.id}`}>
                    {parseFloat(item.rating).toFixed(1)} ({item.reviewCount})
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium" data-testid={`item-price-${item.id}`}>
              {formatPrice(item)}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.pricingModel === 'subscription' ? 'Monthly subscription' : 
               item.pricingModel === 'one_time' ? 'One-time purchase' : 
               'No cost'}
            </span>
          </div>
          {installed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleUninstall(item.id, e)}
              disabled={uninstalling}
              data-testid={`button-uninstall-${item.id}`}
            >
              {uninstalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Installed
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => handleInstall(item.id, e)}
              disabled={installing}
              data-testid={`button-install-${item.id}`}
            >
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Install
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  const renderAgentCard = (agent: AIAgent) => {
    const installed = isAgentInstalled(agent.slug);
    const installing = installingAgentSlug === agent.slug;
    const uninstalling = uninstallingAgentSlug === agent.slug;

    return (
      <Card 
        key={agent.slug} 
        className="hover-elevate transition-all"
        data-testid={`marketplace-agent-${agent.slug}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CardTitle className="text-lg truncate" data-testid={`agent-name-${agent.slug}`}>
                    {agent.name}
                  </CardTitle>
                  {agent.pricingModel === 'free' && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      Free
                    </Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2" data-testid={`agent-description-${agent.slug}`}>
                  {agent.description}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Category */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">
                {agent.category}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {agent.provider}
              </Badge>
              {agent.version && (
                <Badge variant="secondary" className="text-xs">
                  v{agent.version}
                </Badge>
              )}
            </div>

            {/* Capabilities */}
            {agent.capabilities && agent.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.slice(0, 3).map((capability) => (
                  <Badge key={capability} variant="secondary" className="text-xs">
                    {capability.replace(/_/g, ' ')}
                  </Badge>
                ))}
                {agent.capabilities.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{agent.capabilities.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium" data-testid={`agent-price-${agent.slug}`}>
              {formatAgentPrice(agent)}
            </span>
            <span className="text-xs text-muted-foreground">
              {agent.pricingModel === 'subscription' ? 'Monthly subscription' : 
               agent.pricingModel === 'free' ? 'No cost' : 'Free'}
            </span>
          </div>
          {installed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => handleUninstallAgent(agent.slug, e)}
              disabled={uninstalling}
              data-testid={`button-uninstall-agent-${agent.slug}`}
            >
              {uninstalling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Installed
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => handleInstallAgent(agent.slug, e)}
              disabled={installing}
              data-testid={`button-install-agent-${agent.slug}`}
            >
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Install
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  if (isLoading || isLoadingAgents) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  const documentItems = filterItems('document_template');
  const formItems = filterItems('form_template');
  const pipelineItems = filterItems('pipeline_template');
  const filteredAgents = filterAgents();

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={ShoppingBag}
        title="Marketplace"
        description="Browse and install templates to accelerate your workflow"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-marketplace"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="ai_agents" data-testid="tab-ai-agents">
            <Bot className="h-4 w-4 mr-2" />
            AI Agents ({filteredAgents.length})
          </TabsTrigger>
          <TabsTrigger value="document_template" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents ({documentItems.length})
          </TabsTrigger>
          <TabsTrigger value="form_template" data-testid="tab-forms">
            <FileCheck className="h-4 w-4 mr-2" />
            Forms ({formItems.length})
          </TabsTrigger>
          <TabsTrigger value="pipeline_template" data-testid="tab-pipelines">
            <Workflow className="h-4 w-4 mr-2" />
            Pipelines ({pipelineItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai_agents" className="space-y-4">
          {filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No AI agents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map(renderAgentCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="document_template" className="space-y-4">
          {documentItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No document templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documentItems.map(renderItemCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="form_template" className="space-y-4">
          {formItems.length === 0 ? (
            <div className="text-center py-12">
              <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No form templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formItems.map(renderItemCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline_template" className="space-y-4">
          {pipelineItems.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No pipeline templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pipelineItems.map(renderItemCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
