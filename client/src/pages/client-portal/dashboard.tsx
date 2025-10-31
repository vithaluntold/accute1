import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  CheckSquare, 
  FileSignature, 
  MessageSquare,
  Clock,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { useLocation } from "wouter";

interface ClientStats {
  documents: {
    total: number;
    pending: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
  signatures: {
    pending: number;
  };
  forms: {
    pending: number;
  };
}

export default function ClientPortalDashboard() {
  const user = getUser();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading } = useQuery<ClientStats>({
    queryKey: ["/api/client-portal/stats"],
  });

  const { data: recentDocuments = [] } = useQuery<any[]>({
    queryKey: ["/api/client-portal/documents"],
  });

  const { data: pendingTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/client-portal/tasks"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading your portal...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={TrendingUp}
        title={`Welcome back, ${user?.firstName || user?.username}`}
        description="Access your documents, tasks, and communicate with your team"
        testId="client-dashboard"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-documents">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-documents-total">
                {stats?.documents.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.documents.pending || 0} need review
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-tasks">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-tasks-total">
                {stats?.tasks.pending || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.tasks.overdue || 0} overdue
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-signatures">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Signatures Needed</CardTitle>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-signatures-pending">
                {stats?.signatures.pending || 0}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting signature</p>
            </CardContent>
          </Card>

          <Card data-testid="card-forms">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Forms to Complete</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-forms-pending">
                {stats?.forms.pending || 0}
              </div>
              <p className="text-xs text-muted-foreground">Pending submission</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Documents */}
          <Card data-testid="card-recent-documents">
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Documents shared with you</CardDescription>
            </CardHeader>
            <CardContent>
              {recentDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-documents">
                  No documents available
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDocuments.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg hover-elevate border"
                      data-testid={`document-${doc.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/client-portal/documents/${doc.id}`)}
                        data-testid={`button-view-document-${doc.id}`}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setLocation("/client-portal/documents")}
                data-testid="button-view-all-documents"
              >
                View All Documents
              </Button>
            </CardContent>
          </Card>

          {/* Pending Tasks */}
          <Card data-testid="card-pending-tasks">
            <CardHeader>
              <CardTitle>Pending Tasks</CardTitle>
              <CardDescription>Tasks requiring your attention</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-tasks">
                  No pending tasks
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start justify-between p-3 rounded-lg hover-elevate border"
                      data-testid={`task-${task.id}`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        {task.isOverdue ? (
                          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                          {task.isOverdue && (
                            <Badge variant="destructive" className="mt-1">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLocation(`/client-portal/tasks/${task.id}`)}
                        data-testid={`button-view-task-${task.id}`}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setLocation("/client-portal/tasks")}
                data-testid="button-view-all-tasks"
              >
                View All Tasks
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common actions you can take</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => setLocation("/client-portal/documents")}
                data-testid="button-quick-documents"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Documents
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => setLocation("/client-portal/signatures")}
                data-testid="button-quick-signatures"
              >
                <FileSignature className="h-4 w-4 mr-2" />
                Sign Documents
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => setLocation("/client-portal/forms")}
                data-testid="button-quick-forms"
              >
                <FileText className="h-4 w-4 mr-2" />
                Complete Forms
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => setLocation("/client-portal/messages")}
                data-testid="button-quick-messages"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
