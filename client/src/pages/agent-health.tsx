import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Server, 
  Bot,
  Clock,
  Zap
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface LLMHealthStatus {
  id: string;
  name: string;
  provider: string;
  model: string;
  scope: string;
  isActive: boolean;
  isDefault: boolean;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message: string;
  responseTime: number;
}

interface Agent {
  id: string;
  slug: string;
  name: string;
  category: string;
  provider: string;
}

interface HealthResponse {
  llmConfigurations: LLMHealthStatus[];
  agents: Agent[];
  summary: {
    totalConfigurations: number;
    healthyConfigurations: number;
    unhealthyConfigurations: number;
    totalAgents: number;
  };
}

export default function AgentHealth() {
  const { data, isLoading, refetch, isFetching } = useQuery<HealthResponse>({
    queryKey: ['/api/agents/health']
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/agents/health'] });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const healthPercentage = data?.summary.totalConfigurations 
    ? Math.round((data.summary.healthyConfigurations / data.summary.totalConfigurations) * 100)
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'unhealthy':
        return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "font-medium";
    switch (status) {
      case 'healthy':
        return <Badge className={`${baseClasses} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800`}>Healthy</Badge>;
      case 'unhealthy':
        return <Badge className={`${baseClasses} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800`}>Unhealthy</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      case 'azure_openai':
        return 'Azure OpenAI';
      default:
        return provider;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Agent Health Control Panel
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor the health and status of all AI agents and LLM providers
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isFetching}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Checking...' : 'Refresh'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-summary-total">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Configurations</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-configs">
              {data?.summary.totalConfigurations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              LLM provider configurations
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-summary-healthy">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-healthy-configs">
              {data?.summary.healthyConfigurations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {healthPercentage}% operational
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-summary-unhealthy">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unhealthy</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-unhealthy-configs">
              {data?.summary.unhealthyConfigurations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-summary-agents">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-agents">
              {data?.summary.totalAgents || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Installed agents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* LLM Configurations Status */}
      <Card data-testid="card-llm-configurations">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            LLM Provider Configurations
          </CardTitle>
          <CardDescription>
            Connection health status for all configured LLM providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.llmConfigurations.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No LLM configurations found</p>
              <p className="text-sm mt-1">Add LLM providers in Settings to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.llmConfigurations.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-4 rounded-md border hover-elevate"
                  data-testid={`config-${config.id}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(config.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium" data-testid={`config-name-${config.id}`}>
                          {config.name}
                        </p>
                        {config.isDefault && (
                          <Badge variant="outline" className="text-xs">Default</Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {config.scope}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span data-testid={`config-provider-${config.id}`}>
                          {getProviderLabel(config.provider)}
                        </span>
                        <span className="text-xs">•</span>
                        <span data-testid={`config-model-${config.id}`}>{config.model}</span>
                        {config.responseTime > 0 && (
                          <>
                            <span className="text-xs">•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {config.responseTime}ms
                            </span>
                          </>
                        )}
                      </div>
                      {config.message && config.status === 'unhealthy' && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1" data-testid={`config-error-${config.id}`}>
                          {config.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    {getStatusBadge(config.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installed AI Agents */}
      <Card data-testid="card-ai-agents">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Installed AI Agents
          </CardTitle>
          <CardDescription>
            All AI agents currently installed and available in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.agents.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No AI agents installed</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-4 rounded-md border hover-elevate"
                  data-testid={`agent-${agent.slug}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid={`agent-name-${agent.slug}`}>
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {agent.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
