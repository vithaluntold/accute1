import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, DollarSign, Clock } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

export default function ExecutiveDashboard() {
  const { data: workloadData } = useQuery<any>({ queryKey: ["/api/workload-insights"] });
  const { data: projects } = useQuery<any[]>({ queryKey: ["/api/projects"] });
  const { data: invoices } = useQuery<any[]>({ queryKey: ["/api/invoices"] });
  const { data: timeEntries } = useQuery<any[]>({ queryKey: ["/api/time-entries"] });

  const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
  const totalHours = timeEntries?.reduce((sum, entry) => sum + (entry.hours || 0), 0) || 0;
  const activeProjects = projects?.filter(p => p.status === "active").length || 0;

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Executive Dashboard"
        description="Real-time insights into your organization's performance"
        icon={BarChart3}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-revenue">${totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +20.1% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-projects">{activeProjects}</div>
              <p className="text-xs text-muted-foreground">
                +{projects?.length || 0} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-team">{workloadData?.users?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Across all teams
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="metric-hours">{totalHours.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Projects by Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {projects?.slice(0, 5).map((project, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{project.name}</span>
                    <Badge>${project.budget || 0}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Workload</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workloadData?.users?.slice(0, 5).map((user: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">{user.userName || "User"}</span>
                    <Badge variant={user.workloadScore > 80 ? "destructive" : "default"}>
                      {user.workloadScore || 0}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
