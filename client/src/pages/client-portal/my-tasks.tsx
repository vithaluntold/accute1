import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  isOverdue: boolean;
  assignmentName: string;
  workflowName: string;
}

export default function ClientMyTasks() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");

  const { data: tasks = [], isLoading } = useQuery<ClientTask[]>({
    queryKey: ["/api/client-portal/tasks"],
  });

  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const overdueTasks = tasks.filter((t) => t.isOverdue);

  const getTasksForTab = () => {
    switch (activeTab) {
      case "pending":
        return pendingTasks;
      case "completed":
        return completedTasks;
      case "overdue":
        return overdueTasks;
      default:
        return tasks;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge variant="default">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "in_progress":
        return <Badge variant="default">In Progress</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const displayTasks = getTasksForTab();

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={CheckSquare}
        title="My Tasks"
        description="Track and manage your assigned tasks"
        testId="client-tasks"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-all-tasks">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">All Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-all-tasks">
                {tasks.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-tasks">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-tasks">
                {pendingTasks.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-completed-tasks">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-completed-tasks">
                {completedTasks.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-overdue-tasks">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-tasks">
                {overdueTasks.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <Card data-testid="card-tasks-list">
          <CardHeader>
            <CardTitle>Task List</CardTitle>
            <CardDescription>View and manage your assigned tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all" data-testid="tab-all">
                  All ({tasks.length})
                </TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({pendingTasks.length})
                </TabsTrigger>
                <TabsTrigger value="overdue" data-testid="tab-overdue">
                  Overdue ({overdueTasks.length})
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed">
                  Completed ({completedTasks.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading tasks...
                  </div>
                ) : displayTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-tasks">
                    No tasks to display
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 rounded-lg border hover-elevate"
                        data-testid={`task-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{task.title}</h3>
                              {task.isOverdue && (
                                <Badge variant="destructive">Overdue</Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Workflow:</span>
                                <span className="font-medium">{task.workflowName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Assignment:</span>
                                <span className="font-medium">{task.assignmentName}</span>
                              </div>
                              {task.dueDate && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    Due: {new Date(task.dueDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                {getPriorityBadge(task.priority)}
                                {getStatusBadge(task.status)}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setLocation(`/client-portal/tasks/${task.id}`)}
                            data-testid={`button-view-task-${task.id}`}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
