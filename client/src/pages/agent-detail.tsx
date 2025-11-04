import { lazy, Suspense } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";

// Dynamically import agent components
const agentComponents: Record<string, React.LazyExoticComponent<any>> = {
  cadence: lazy(() => import("../../../agents/cadence/frontend/CadenceAgent")),
  echo: lazy(() => import("../../../agents/echo/frontend/EchoAgent")),
  forma: lazy(() => import("../../../agents/forma/frontend/FormaAgent")),
  luca: lazy(() => import("../../../agents/luca/frontend/LucaAgent")),
  omnispectra: lazy(() => import("../../../agents/omnispectra/frontend/OmniSpectra")),
  parity: lazy(() => import("../../../agents/parity/frontend/ParityAgent")),
  radar: lazy(() => import("../../../agents/radar/frontend/Radar")),
  relay: lazy(() => import("../../../agents/relay/frontend/RelayAgent")),
  scribe: lazy(() => import("../../../agents/scribe/frontend/ScribeAgent")),
};

export default function AgentDetail() {
  const params = useParams();
  const slug = params.slug;
  const [, setLocation] = useLocation();

  const { data: agent, isLoading } = useQuery<any>({
    queryKey: ["/api/ai-agents", slug],
    queryFn: async () => {
      const response = await fetch(`/api/ai-agents?slug=${slug}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to load agent");
      const agents = await response.json();
      return agents.find((a: any) => a.slug === slug);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading AI agent...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <h3 className="font-semibold text-lg">Agent Not Found</h3>
            <p className="text-sm text-muted-foreground">
              The AI agent you're looking for doesn't exist or hasn't been installed.
            </p>
            <Button onClick={() => setLocation("/ai-agents")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AI Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const AgentComponent = agentComponents[slug || ""];

  if (!AgentComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <h3 className="font-semibold text-lg">Component Not Available</h3>
            <p className="text-sm text-muted-foreground">
              This agent doesn't have a conversational interface yet.
            </p>
            <Button onClick={() => setLocation("/ai-agents")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AI Agents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/ai-agents")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-2xl">{agent.name}</h1>
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {agent.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Interface */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Loading {agent.name}...</p>
                </div>
              </div>
            }
          >
            <AgentComponent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
