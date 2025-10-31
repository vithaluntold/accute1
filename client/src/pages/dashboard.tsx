import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, AlertCircle, ListTodo, TrendingUp, Users, Briefcase, Building2, Smartphone, Download, X } from "lucide-react";
import { format } from "date-fns";
import { getUser } from "@/lib/auth";
import { useIsPWA } from "@/hooks/use-mobile-detect";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import type { WorkflowTask } from "@shared/schema";

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  onTime?: number;
  teamSize?: number;
}

interface EnrichedTask extends WorkflowTask {
  isOverdue?: boolean;
  isOnTime?: boolean;
  workflow?: any;
  stage?: any;
  step?: any;
}

interface PracticeStats {
  taskStats: TaskStats;
  workflows: {
    total: number;
    active: number;
    completed: number;
  };
  clients: {
    total: number;
    active: number;
  };
  team: {
    total: number;
  };
}

export default function Dashboard() {
  const user = getUser();
  const userPermissions = user?.permissions || [];
  const isPWA = useIsPWA();
  const [showMobileAppBanner, setShowMobileAppBanner] = useState(true);
  
  const hasReportsView = userPermissions.includes('reports.view');
  const hasWorkflowsView = userPermissions.includes('workflows.view');

  // Check if banner was dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('mobile-app-banner-dismissed');
    if (dismissed) {
      setShowMobileAppBanner(false);
    }
  }, []);

  const dismissBanner = () => {
    localStorage.setItem('mobile-app-banner-dismissed', 'true');
    setShowMobileAppBanner(false);
  };

  const { data: myStats, isLoading: myStatsLoading } = useQuery<TaskStats>({
    queryKey: ['/api/dashboard/my-stats'],
  });

  const { data: myTasks, isLoading: myTasksLoading } = useQuery<EnrichedTask[]>({
    queryKey: ['/api/my-tasks'],
  });

  const { data: teamStats, isLoading: teamStatsLoading } = useQuery<TaskStats>({
    queryKey: ['/api/dashboard/team-stats'],
    enabled: hasWorkflowsView,
  });

  const { data: practiceStats, isLoading: practiceStatsLoading } = useQuery<PracticeStats>({
    queryKey: ['/api/dashboard/practice-stats'],
    enabled: hasReportsView,
  });

  const { data: tasksDueSoon } = useQuery<any[]>({
    queryKey: ['/api/tasks/due-soon'],
  });

  if (myStatsLoading || myTasksLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  const overdueTasks = myTasks?.filter(t => t.isOverdue) || [];
  const inProgressTasks = myTasks?.filter(t => t.status === 'in_progress') || [];
  const pendingTasks = myTasks?.filter(t => t.status === 'pending') || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Section with Gradient */}
      <div className="gradient-hero relative overflow-hidden rounded-b-2xl">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative px-6 py-8 md:py-12">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2 animate-fade-in" data-testid="text-dashboard-title">
            Welcome back, {user?.firstName || user?.username}
          </h1>
          <p className="text-white/90 text-lg">Track your tasks and stay on top of deadlines</p>
        </div>
      </div>
      
      <div className="px-6 space-y-6">

      {/* Mobile App Download Banner */}
      {!isPWA && showMobileAppBanner && (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-accent/5" data-testid="card-mobile-app-banner">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">Get the Mobile App</CardTitle>
                  <CardDescription className="text-sm">
                    Install Accute on your phone for faster access, offline support, and a native app experience
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismissBanner}
                className="h-6 w-6 -mt-1"
                data-testid="button-dismiss-banner"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <Link href="/mobile-apps">
                <Button size="sm" data-testid="button-install-mobile-app">
                  <Download className="h-4 w-4 mr-2" />
                  Install Now
                </Button>
              </Link>
              <Link href="/mobile-apps">
                <Button variant="outline" size="sm" data-testid="button-learn-more-mobile">
                  Learn More
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Task Statistics */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-1 w-12 gradient-primary rounded-full"></div>
          <h2 className="text-xl font-display font-bold">My Tasks</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="gradient-subtle">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <ListTodo className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold gradient-text-primary" data-testid="stat-my-total">{myStats?.total || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-info/5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <div className="p-2 rounded-lg bg-info/10">
                <Clock className="h-4 w-4 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-info" data-testid="stat-my-pending">{myStats?.pending || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-warning/5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <TrendingUp className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-warning" data-testid="stat-my-in-progress">{myStats?.in_progress || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-success/5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-success" data-testid="stat-my-completed">{myStats?.completed || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-destructive/5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-destructive" data-testid="stat-my-overdue">
                {myStats?.overdue || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Team Statistics (Manager View) */}
      {hasWorkflowsView && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-12 gradient-accent rounded-full"></div>
            <h2 className="text-xl font-display font-bold">Team Overview</h2>
          </div>
          {teamStatsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Size</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-team-size">{teamStats?.teamSize || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-team-total">{teamStats?.total || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-team-in-progress">{teamStats?.in_progress || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive" data-testid="stat-team-overdue">
                    {teamStats?.overdue || 0}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Practice Statistics (Admin View) */}
      {hasReportsView && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-12 gradient-success rounded-full"></div>
            <h2 className="text-xl font-display font-bold">Practice Overview</h2>
          </div>
          {practiceStatsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-practice-workflows">
                    {practiceStats?.workflows.active || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {practiceStats?.workflows.total || 0} total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-practice-clients">
                    {practiceStats?.clients.active || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {practiceStats?.clients.total || 0} total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-practice-team">
                    {practiceStats?.team.total || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tasks Overdue</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive" data-testid="stat-practice-overdue">
                    {practiceStats?.taskStats.overdue || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {practiceStats?.taskStats.total || 0} total tasks
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Task Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Overdue Tasks */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Overdue Tasks
            </CardTitle>
            <CardDescription>Tasks past their due date</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue tasks</p>
            ) : (
              <div className="space-y-3">
                {overdueTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50"
                    data-testid={`task-overdue-${task.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      {task.dueDate && (
                        <p className="text-xs text-destructive">
                          Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                    <Badge variant="destructive" className="text-xs">Overdue</Badge>
                  </div>
                ))}
                {overdueTasks.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{overdueTasks.length - 5} more overdue tasks
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* In Progress Tasks */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              In Progress
            </CardTitle>
            <CardDescription>Tasks currently being worked on</CardDescription>
          </CardHeader>
          <CardContent>
            {inProgressTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks in progress</p>
            ) : (
              <div className="space-y-3">
                {inProgressTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50"
                    data-testid={`task-in-progress-${task.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">In Progress</Badge>
                  </div>
                ))}
                {inProgressTasks.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{inProgressTasks.length - 5} more tasks
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Tasks
            </CardTitle>
            <CardDescription>Tasks not yet started</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending tasks</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50"
                    data-testid={`task-pending-${task.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" data-testid={`button-start-${task.id}`}>
                      Start
                    </Button>
                  </div>
                ))}
                {pendingTasks.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{pendingTasks.length - 5} more tasks
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Due Soon */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Due Soon (Next 7 Days)
            </CardTitle>
            <CardDescription>Upcoming tasks requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {!tasksDueSoon || tasksDueSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks due soon</p>
            ) : (
              <div className="space-y-3">
                {tasksDueSoon.slice(0, 5).map((item: any) => (
                  <div
                    key={item.task.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50"
                    data-testid={`task-due-soon-${item.task.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.task.name}</p>
                      {item.task.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(item.task.dueDate), 'MMM dd, yyyy')}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.task.status}
                    </Badge>
                  </div>
                ))}
                {tasksDueSoon.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{tasksDueSoon.length - 5} more tasks
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
