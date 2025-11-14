import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { GradientHero } from "@/components/gradient-hero";
import { Users, TrendingUp, Clock, AlertTriangle, CheckCircle2, Target } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

interface TeamMember {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  workload: {
    activeAssignments: number;
    completedAssignments: number;
    activeTasks: number;
    overdueTasks: number;
    completedTasks: number;
    totalTasks: number;
  };
  hours: {
    total: number;
    billable: number;
  };
  allocation: {
    totalPercentage: number;
    isOverAllocated: boolean;
    allocationsCount: number;
  };
  metrics: {
    avgHoursPerTask: number;
    avgTasksPerAssignment: number;
    completionRate: number;
    workloadScore: number;
  };
}

interface WorkloadInsights {
  teamMembers: TeamMember[];
  teamTotals: {
    activeAssignments: number;
    activeTasks: number;
    overdueTasks: number;
    totalHours: number;
    avgCompletionRate: number;
  };
  timestamp: string;
}

export default function WorkloadView() {
  const { data: insights, isLoading } = useQuery<WorkloadInsights>({
    queryKey: ["/api/analytics/workload-insights"],
  });

  // Calculate workload status colors
  const getWorkloadStatus = (score: number): { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    if (score >= 80) return { label: "Overloaded", color: "hsl(0 84.2% 60.2%)", variant: "destructive" };
    if (score >= 50) return { label: "High Load", color: "hsl(48 96% 53%)", variant: "secondary" };
    if (score >= 20) return { label: "Moderate", color: "hsl(142.1 76.2% 36.3%)", variant: "outline" };
    return { label: "Light", color: "hsl(210 40% 96.1%)", variant: "default" };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <GradientHero
          title="Team Workload"
          subtitle="Capacity planning and resource allocation"
          icon={TrendingUp}
        />
        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="min-h-screen flex flex-col">
        <GradientHero
          title="Team Workload"
          subtitle="Capacity planning and resource allocation"
          icon={TrendingUp}
        />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No workload data available
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = insights.teamMembers.map((member) => ({
    name: member.userName.split(" ")[0], // First name only
    score: member.metrics.workloadScore,
    tasks: member.workload.activeTasks,
    assignments: member.workload.activeAssignments,
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <GradientHero
        title="Team Workload"
        subtitle="Capacity planning and resource allocation"
        icon={TrendingUp}
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Team Totals Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card data-testid="card-total-assignments">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-assignments">
                {insights.teamTotals.activeAssignments}
              </div>
              <p className="text-xs text-muted-foreground">Team total</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-tasks">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-tasks">
                {insights.teamTotals.activeTasks}
              </div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-overdue">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-total-overdue">
                {insights.teamTotals.overdueTasks}
              </div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-hours">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-hours">
                {insights.teamTotals.totalHours}h
              </div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card data-testid="card-completion-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-completion-rate">
                {insights.teamTotals.avgCompletionRate}%
              </div>
              <p className="text-xs text-muted-foreground">Team average</p>
            </CardContent>
          </Card>
        </div>

        {/* Workload Distribution Chart */}
        <Card data-testid="card-workload-chart">
          <CardHeader>
            <CardTitle>Workload Distribution</CardTitle>
            <CardDescription>Team member workload scores (sorted high to low)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                score: {
                  label: "Workload Score",
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--foreground))" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => {
                      const status = getWorkloadStatus(entry.score);
                      return <Cell key={`cell-${index}`} fill={status.color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Team Member Cards */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Team Members</h2>
          <p className="text-sm text-muted-foreground">
            {insights.teamMembers.length} team members sorted by workload
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.teamMembers.map((member) => {
            const status = getWorkloadStatus(member.metrics.workloadScore);
            const capacityPercentage = Math.min((member.metrics.workloadScore / 100) * 100, 100);

            return (
              <Card key={member.userId} data-testid={`card-member-${member.userId}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg" data-testid={`text-member-name-${member.userId}`}>
                        {member.userName}
                      </CardTitle>
                      <CardDescription data-testid={`text-member-email-${member.userId}`}>
                        {member.userEmail}
                      </CardDescription>
                    </div>
                    <Badge variant={status.variant} data-testid={`badge-status-${member.userId}`}>
                      {status.label}
                    </Badge>
                  </div>

                  {/* Capacity Bar */}
                  <div className="space-y-2 pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-medium" data-testid={`text-workload-score-${member.userId}`}>
                        {member.metrics.workloadScore} pts
                      </span>
                    </div>
                    <Progress value={capacityPercentage} className="h-2" />
                  </div>

                  {/* Resource Allocation */}
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Resource Allocation
                        {member.allocation.isOverAllocated && (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span 
                          className={`font-medium ${member.allocation.isOverAllocated ? 'text-destructive' : ''}`}
                          data-testid={`text-allocation-${member.userId}`}
                        >
                          {member.allocation.totalPercentage}%
                        </span>
                        {member.allocation.isOverAllocated && (
                          <Badge variant="destructive" className="text-xs" data-testid={`badge-overallocated-${member.userId}`}>
                            Over-allocated
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={Math.min(member.allocation.totalPercentage, 100)} 
                      className={`h-2 ${member.allocation.isOverAllocated ? '[&>div]:bg-destructive' : ''}`}
                    />
                    {member.allocation.isOverAllocated && (
                      <p className="text-xs text-destructive" data-testid={`text-overallocation-warning-${member.userId}`}>
                        Warning: Allocated to {member.allocation.allocationsCount} project{member.allocation.allocationsCount !== 1 ? 's' : ''} exceeding 100% capacity
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Workload Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Active Assignments</p>
                      <p className="text-xl font-bold" data-testid={`text-assignments-${member.userId}`}>
                        {member.workload.activeAssignments}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Active Tasks</p>
                      <p className="text-xl font-bold" data-testid={`text-tasks-${member.userId}`}>
                        {member.workload.activeTasks}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Overdue Tasks</p>
                      <p
                        className={`text-xl font-bold ${
                          member.workload.overdueTasks > 0 ? "text-destructive" : ""
                        }`}
                        data-testid={`text-overdue-${member.userId}`}
                      >
                        {member.workload.overdueTasks}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Completion Rate</p>
                      <p className="text-xl font-bold" data-testid={`text-completion-${member.userId}`}>
                        {member.metrics.completionRate}%
                      </p>
                    </div>
                  </div>

                  {/* Hours & Metrics */}
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Hours (30d)</span>
                      <span className="font-medium" data-testid={`text-hours-${member.userId}`}>
                        {member.hours.total}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Billable Hours</span>
                      <span className="font-medium" data-testid={`text-billable-${member.userId}`}>
                        {member.hours.billable}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Avg Hours/Task</span>
                      <span className="font-medium" data-testid={`text-avg-hours-${member.userId}`}>
                        {member.metrics.avgHoursPerTask}h
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
