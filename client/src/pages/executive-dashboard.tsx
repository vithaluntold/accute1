import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, TrendingDown, Users, DollarSign, Clock } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import { startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";

export default function ExecutiveDashboard() {
  const { data: workloadData, isLoading: workloadLoading } = useQuery<any>({ 
    queryKey: ["/api/workload-insights"] 
  });
  const { data: projects, isLoading: projectsLoading } = useQuery<any[]>({ 
    queryKey: ["/api/projects"] 
  });
  const { data: invoices, isLoading: invoicesLoading } = useQuery<any[]>({ 
    queryKey: ["/api/invoices"] 
  });
  const { data: timeEntries, isLoading: timeLoading } = useQuery<any[]>({ 
    queryKey: ["/api/time-entries"] 
  });

  // Calculate metrics with real trends
  const metrics = useMemo(() => {
    if (!invoices || !timeEntries || !projects) {
      return {
        revenue: { current: 0, previous: 0, change: 0 },
        hours: { current: 0, previous: 0, change: 0 },
        projects: { active: 0, total: 0, change: 0 },
      };
    }

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));

    // Revenue trends - use 'total' field from schema, not 'amount'
    const currentRevenue = invoices
      .filter(inv => {
        const date = new Date(inv.createdAt || inv.issueDate);
        return isWithinInterval(date, { start: currentMonthStart, end: currentMonthEnd });
      })
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

    const previousRevenue = invoices
      .filter(inv => {
        const date = new Date(inv.createdAt || inv.issueDate);
        return isWithinInterval(date, { start: previousMonthStart, end: previousMonthEnd });
      })
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

    // Guard against division by zero
    const revenueChange = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : currentRevenue > 0 ? 100 : 0;

    // Hours trends - explicitly cast hours to Number for proper addition
    const currentHours = timeEntries
      .filter(entry => {
        const date = new Date(entry.date || entry.createdAt);
        return isWithinInterval(date, { start: currentMonthStart, end: currentMonthEnd });
      })
      .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);

    const previousHours = timeEntries
      .filter(entry => {
        const date = new Date(entry.date || entry.createdAt);
        return isWithinInterval(date, { start: previousMonthStart, end: previousMonthEnd });
      })
      .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);

    // Guard against division by zero
    const hoursChange = previousHours > 0 
      ? ((currentHours - previousHours) / previousHours) * 100 
      : currentHours > 0 ? 100 : 0;

    // Project trends
    const activeProjects = projects.filter(p => p.status === "active").length;
    const completedThisMonth = projects.filter(p => {
      if (p.status !== "completed" || !p.completedAt) return false;
      const date = new Date(p.completedAt);
      return isWithinInterval(date, { start: currentMonthStart, end: currentMonthEnd });
    }).length;

    return {
      revenue: { current: currentRevenue, previous: previousRevenue, change: revenueChange },
      hours: { current: currentHours, previous: previousHours, change: hoursChange },
      projects: { active: activeProjects, total: projects.length, completed: completedThisMonth },
    };
  }, [invoices, timeEntries, projects]);

  // Sort projects by budget - use Number() to ensure numeric comparison
  const topProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects]
      .filter(p => p.budget && Number(p.budget) > 0)
      .sort((a, b) => (Number(b.budget) || 0) - (Number(a.budget) || 0))
      .slice(0, 5);
  }, [projects]);

  const isLoading = workloadLoading || projectsLoading || invoicesLoading || timeLoading;

  const TrendIndicator = ({ value }: { value: number }) => {
    // Guard against NaN or Infinity
    if (!isFinite(value) || Math.abs(value) < 0.1) {
      return <span className="text-muted-foreground text-xs">No change</span>;
    }
    
    const Icon = value > 0 ? TrendingUp : TrendingDown;
    const color = value > 0 ? "text-green-600" : "text-red-600";
    
    return (
      <span className={`flex items-center gap-1 text-xs ${color}`}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}% vs last month
      </span>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Executive Dashboard"
        description="Real-time insights with month-over-month trend analysis"
        icon={BarChart3}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {/* Revenue Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="metric-revenue">
                    ${metrics.revenue.current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <TrendIndicator value={metrics.revenue.change} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Active Projects Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="metric-projects">
                    {metrics.projects.active}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metrics.projects.total} total, {metrics.projects.completed} completed this month
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Team Members Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="metric-team">
                    {workloadData?.totalUsers || workloadData?.users?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across {workloadData?.teamCount || 'all'} teams
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Hours Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hours This Month</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="metric-hours">
                    {metrics.hours.current.toFixed(1)}h
                  </div>
                  <TrendIndicator value={metrics.hours.change} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Projects */}
          <Card>
            <CardHeader>
              <CardTitle>Top Projects by Budget</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : topProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No projects with budgets
                </p>
              ) : (
                <div className="space-y-2">
                  {topProjects.map((project, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1">{project.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {project.status}
                        </Badge>
                        <Badge>${project.budget?.toLocaleString() || 0}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Team Workload */}
          <Card>
            <CardHeader>
              <CardTitle>Team Workload</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !workloadData?.users || workloadData.users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No team workload data available
                </p>
              ) : (
                <div className="space-y-2">
                  {workloadData.users.slice(0, 5).map((user: any, idx: number) => {
                    const capacity = (user.totalHoursLogged || 0) / 160 * 100; // 160 hours = full-time month
                    const isOverloaded = capacity > 80;
                    
                    return (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm truncate flex-1">{user.userName || "User"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {user.totalHoursLogged?.toFixed(1) || 0}h
                          </span>
                          <Badge variant={isOverloaded ? "destructive" : "default"}>
                            {capacity.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
