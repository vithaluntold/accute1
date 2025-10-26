import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Workflow, Bot, FileText, Activity } from "lucide-react";
import { getUser, getToken } from "@/lib/auth";

export default function Dashboard() {
  const user = getUser();
  const token = getToken();

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ["/api/workflows"],
    enabled: !!token,
  });

  const { data: aiAgents, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/ai-agents"],
    enabled: !!token,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/documents"],
    enabled: !!token,
  });

  const stats = [
    {
      title: "Active Workflows",
      value: workflows?.filter((w: any) => w.isActive).length || 0,
      icon: Workflow,
      description: "Running automation workflows",
      loading: workflowsLoading,
    },
    {
      title: "AI Agents",
      value: aiAgents?.length || 0,
      icon: Bot,
      description: "Available AI assistants",
      loading: agentsLoading,
    },
    {
      title: "Documents",
      value: documents?.length || 0,
      icon: FileText,
      description: "Uploaded and processed",
      loading: documentsLoading,
    },
    {
      title: "Activity",
      value: "Live",
      icon: Activity,
      description: "System status",
      loading: false,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-display mb-2" data-testid="text-dashboard-title">
          Welcome back, {user?.firstName || user?.username}
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your accounting automation platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-4 w-full" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Workflows</CardTitle>
            <CardDescription>Your most recently updated workflows</CardDescription>
          </CardHeader>
          <CardContent>
            {workflowsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : workflows && workflows.length > 0 ? (
              <div className="space-y-2">
                {workflows.slice(0, 5).map((workflow: any) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                    data-testid={`workflow-item-${workflow.id}`}
                  >
                    <div>
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-sm text-muted-foreground">{workflow.type}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      workflow.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                      workflow.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {workflow.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No workflows yet. Create your first workflow to get started.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Agents Marketplace</CardTitle>
            <CardDescription>Popular AI agents for automation</CardDescription>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : aiAgents && aiAgents.length > 0 ? (
              <div className="space-y-2">
                {aiAgents.slice(0, 5).map((agent: any) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                    data-testid={`agent-item-${agent.id}`}
                  >
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">{agent.category}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ⭐ {agent.rating}/5
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No AI agents available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
