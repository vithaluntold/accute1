import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  FileText, 
  Users, 
  Workflow, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  XCircle,
  Activity
} from "lucide-react";

export default function Analytics() {
  const { data: forms = [] } = useQuery<any[]>({
    queryKey: ["/api/forms"],
  });

  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ["/api/workflows"],
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  const { data: documentRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/document-requests"],
  });

  // Calculate statistics
  const stats = {
    totalForms: forms.length,
    publishedForms: forms.filter((f: any) => f.isPublished).length,
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter((w: any) => w.isActive).length,
    totalDocuments: documents.length,
    totalClients: clients.length,
    pendingRequests: documentRequests.filter((r: any) => r.status === 'pending').length,
    completedRequests: documentRequests.filter((r: any) => r.status === 'completed').length,
  };

  const statCards = [
    {
      title: "Total Forms",
      value: stats.totalForms,
      subtitle: `${stats.publishedForms} published`,
      icon: FileText,
      trend: "+12%",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Workflows",
      value: stats.totalWorkflows,
      subtitle: `${stats.activeWorkflows} active`,
      icon: Workflow,
      trend: "+8%",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Documents",
      value: stats.totalDocuments,
      subtitle: "Total uploaded",
      icon: Activity,
      trend: "+24%",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Clients",
      value: stats.totalClients,
      subtitle: "Active clients",
      icon: Users,
      trend: "+5%",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  const requestStats = [
    {
      label: "Pending Requests",
      value: stats.pendingRequests,
      icon: Clock,
      variant: "default" as const,
    },
    {
      label: "Completed Requests",
      value: stats.completedRequests,
      icon: CheckCircle2,
      variant: "default" as const,
    },
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2" data-testid="text-analytics-title">
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Track your platform performance and key metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-stat-value-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {stat.value}
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">
                  {stat.subtitle}
                </p>
                <Badge variant="outline" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {stat.trend}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Document Requests Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card className="md:col-span-2 lg:col-span-2" data-testid="card-document-requests">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Document Requests Status
            </CardTitle>
            <CardDescription>
              Current status of document collection requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requestStats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{stat.label}</span>
                  </div>
                  <Badge variant={stat.variant} data-testid={`badge-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                    {stat.value}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a 
              href="/forms" 
              className="block p-3 rounded-md hover-elevate active-elevate-2 border"
              data-testid="link-create-form"
            >
              <div className="font-medium">Create Form</div>
              <div className="text-xs text-muted-foreground">Build a new form template</div>
            </a>
            <a 
              href="/workflows" 
              className="block p-3 rounded-md hover-elevate active-elevate-2 border"
              data-testid="link-create-workflow"
            >
              <div className="font-medium">Create Workflow</div>
              <div className="text-xs text-muted-foreground">Automate processes</div>
            </a>
            <a 
              href="/document-requests" 
              className="block p-3 rounded-md hover-elevate active-elevate-2 border"
              data-testid="link-document-requests"
            >
              <div className="font-medium">Document Requests</div>
              <div className="text-xs text-muted-foreground">Manage client documents</div>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Activity Overview */}
      <Card data-testid="card-activity-overview">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest updates and changes across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {forms.length === 0 && workflows.length === 0 && documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activity">
                No recent activity to display
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                <div className="grid gap-2">
                  {forms.slice(0, 3).map((form: any) => (
                    <div key={form.id} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Form: {form.name}</span>
                      </div>
                      <Badge variant="outline">{form.isPublished ? "Published" : "Draft"}</Badge>
                    </div>
                  ))}
                  {workflows.slice(0, 3).map((workflow: any) => (
                    <div key={workflow.id} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4" />
                        <span>Workflow: {workflow.name}</span>
                      </div>
                      <Badge variant="outline">{workflow.isActive ? "Active" : "Draft"}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
