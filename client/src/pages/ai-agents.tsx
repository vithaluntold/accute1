import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Bot, Download, Check, Sparkles } from "lucide-react";

export default function AIAgents() {
  const { toast } = useToast();

  const { data: agents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ai-agents"],
  });

  const { data: installedAgents = [] } = useQuery<any[]>({
    queryKey: ["/api/ai-agents/installed"],
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
    return installedAgents.some((a: any) => a.aiAgentId === agentId);
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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-[#e5a660]" />
            AI Agent Marketplace
          </h1>
          <p className="text-muted-foreground">
            Browse and install pre-built AI agents to automate your workflows
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search AI agents..."
            className="pl-9"
            data-testid="input-search-agents"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" data-testid="button-filter-all">
            All
          </Button>
          <Button variant="outline" size="sm" data-testid="button-filter-accounting">
            Accounting
          </Button>
          <Button variant="outline" size="sm" data-testid="button-filter-tax">
            Tax
          </Button>
          <Button variant="outline" size="sm" data-testid="button-filter-client">
            Client Service
          </Button>
        </div>
      </div>

      {agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-agents">
              No AI agents available
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              AI agents will be available once you configure your AI providers in Settings
            </p>
            <Button data-testid="button-configure-ai">
              Configure AI Providers
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => {
            const installed = isInstalled(agent.id);
            
            return (
              <Card key={agent.id} className="hover-elevate" data-testid={`agent-card-${agent.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-12 w-12 rounded-md bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-[#e5a660]" />
                    </div>
                    {installed && (
                      <Badge className="bg-green-500" data-testid={`badge-installed-${agent.id}`}>
                        <Check className="h-3 w-3 mr-1" />
                        Installed
                      </Badge>
                    )}
                  </div>
                  <CardTitle data-testid={`agent-name-${agent.id}`}>
                    {agent.name}
                  </CardTitle>
                  <CardDescription data-testid={`agent-description-${agent.id}`}>
                    {agent.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {agent.category && (
                      <Badge variant="outline" data-testid={`agent-category-${agent.id}`}>
                        {agent.category}
                      </Badge>
                    )}
                    {agent.requiredProvider && (
                      <Badge variant="outline" data-testid={`agent-provider-${agent.id}`}>
                        {agent.requiredProvider}
                      </Badge>
                    )}
                  </div>

                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div>
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

                  <Button
                    className="w-full"
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
            AI agents are pre-built automation components that can be installed into your
            workflows. Each agent is powered by your configured AI providers (OpenAI, Azure
            OpenAI, or Anthropic Claude).
          </p>
          <p className="text-sm text-muted-foreground">
            To use AI agents, make sure you've configured at least one AI provider in Settings.
          </p>
        </div>
      )}
    </div>
  );
}
