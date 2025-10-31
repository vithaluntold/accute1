import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Briefcase, CheckCircle2, DollarSign, Ticket, Bot, Clock, BarChart3 } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// Type definitions for analytics API responses
interface AnalyticsOverview {
  users: { total: number; active: number; inactive: number };
  clients: { total: number; active: number };
  workflows: { total: number; active: number; draft: number };
  assignments: { total: number; active: number; completed: number; completionRate: string };
  revenue: { total: string; paid: string; outstanding: string };
  support: { total: number; open: number; closed: number };
}

interface WorkflowCompletionMetrics {
  name: string;
  total: number;
  completed: number;
  inProgress: number;
}

interface AssignmentTrend {
  date: string;
  created: number;
  completed: number;
}

interface RevenueTrend {
  month: string;
  invoiced: number;
  paid: number;
}

interface SupportMetrics {
  total: number;
  byStatus: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  byCategory: Record<string, number>;
}

interface AgentUsage {
  agent: string;
  conversations: number;
  messages: number;
}

interface TimeTracking {
  totalHours: string;
  billableHours: string;
  nonBillableHours: string;
  billablePercentage: string;
  byUser: Record<string, number>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: string;
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card data-testid={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-1 text-xs text-primary">
            <TrendingUp className="h-3 w-3" />
            <span>{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const [filterBy, setFilterBy] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const queryParams = filterBy === "user" && selectedUserId 
    ? `?userId=${selectedUserId}` 
    : filterBy === "admin" 
    ? "?role=admin" 
    : filterBy === "team_manager" 
    ? "?role=team_manager" 
    : "";

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/analytics/overview", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: workflowCompletion = [], isLoading: workflowLoading } = useQuery<WorkflowCompletionMetrics[]>({
    queryKey: ["/api/analytics/workflow-completion", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/workflow-completion${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: assignmentTrends = [], isLoading: trendsLoading } = useQuery<AssignmentTrend[]>({
    queryKey: ["/api/analytics/assignment-trends", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/assignment-trends${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: revenueTrends = [], isLoading: revenueLoading } = useQuery<RevenueTrend[]>({
    queryKey: ["/api/analytics/revenue-trends", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/revenue-trends${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: supportMetrics, isLoading: supportLoading } = useQuery<SupportMetrics>({
    queryKey: ["/api/analytics/support-metrics", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/support-metrics${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: agentUsage = [], isLoading: agentLoading } = useQuery<AgentUsage[]>({
    queryKey: ["/api/analytics/agent-usage", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/agent-usage${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: timeTracking, isLoading: timeLoading } = useQuery<TimeTracking>({
    queryKey: ["/api/analytics/time-tracking", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/time-tracking${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  if (overviewLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Prepare data for status pie chart
  const statusData = supportMetrics ? [
    { name: 'Open', value: supportMetrics.byStatus.open },
    { name: 'In Progress', value: supportMetrics.byStatus.in_progress },
    { name: 'Resolved', value: supportMetrics.byStatus.resolved },
    { name: 'Closed', value: supportMetrics.byStatus.closed },
  ].filter(item => item.value > 0) : [];

  // Prepare priority data
  const priorityData = supportMetrics ? [
    { name: 'Low', value: supportMetrics.byPriority.low },
    { name: 'Medium', value: supportMetrics.byPriority.medium },
    { name: 'High', value: supportMetrics.byPriority.high },
    { name: 'Urgent', value: supportMetrics.byPriority.urgent },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={BarChart3}
        title="Analytics Dashboard"
        description="Comprehensive insights into your practice performance"
        testId="hero-analytics"
        actions={
          <div className="flex gap-2">
            <Select value={filterBy} onValueChange={(value) => { setFilterBy(value); setSelectedUserId(""); }}>
              <SelectTrigger className="w-48 bg-white/20 backdrop-blur-sm text-white border-white/30" data-testid="select-filter-type">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Data</SelectItem>
                <SelectItem value="user">Specific User</SelectItem>
                <SelectItem value="admin">Admins Only</SelectItem>
                <SelectItem value="team_manager">Team Managers</SelectItem>
              </SelectContent>
            </Select>
            {filterBy === "user" && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-48 bg-white/20 backdrop-blur-sm text-white border-white/30" data-testid="select-user">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        }
      />
      
      <div className="p-6 space-y-6">

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={overview?.users.total || 0}
          description={`${overview?.users.active || 0} active, ${overview?.users.inactive || 0} inactive`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="Total Clients"
          value={overview?.clients.total || 0}
          description={`${overview?.clients.active || 0} active`}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          title="Total Workflows"
          value={overview?.workflows.total || 0}
          description={`${overview?.workflows.active || 0} active, ${overview?.workflows.draft || 0} draft`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          title="Completion Rate"
          value={`${overview?.assignments.completionRate || 0}%`}
          description={`${overview?.assignments.completed || 0} of ${overview?.assignments.total || 0} assignments`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Revenue Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Revenue"
          value={`$${overview?.revenue.total || '0.00'}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Paid Amount"
          value={`$${overview?.revenue.paid || '0.00'}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          title="Outstanding"
          value={`$${overview?.revenue.outstanding || '0.00'}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Support & Time Tracking */}
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Support Tickets"
          value={overview?.support.total || 0}
          description={`${overview?.support.open || 0} open, ${overview?.support.closed || 0} closed`}
          icon={<Ticket className="h-4 w-4" />}
        />
        <StatCard
          title="Time Tracked"
          value={`${timeTracking?.totalHours || '0'} hrs`}
          description={`${timeTracking?.billablePercentage || 0}% billable`}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList data-testid="tabs-analytics">
          <TabsTrigger value="workflows" data-testid="tab-workflows">Workflows</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
          <TabsTrigger value="support" data-testid="tab-support">Support</TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">AI Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Completion</CardTitle>
              <CardDescription>Completion rates by workflow type</CardDescription>
            </CardHeader>
            <CardContent>
              {workflowLoading ? (
                <Skeleton className="h-80" />
              ) : workflowCompletion && workflowCompletion.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={workflowCompletion}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-sm" />
                    <YAxis className="text-sm" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="total" fill={COLORS[0]} name="Total" />
                    <Bar dataKey="completed" fill={COLORS[1]} name="Completed" />
                    <Bar dataKey="inProgress" fill={COLORS[2]} name="In Progress" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-80 text-muted-foreground">
                  No workflow data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Trends</CardTitle>
              <CardDescription>Created and completed assignments over time</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-80" />
              ) : assignmentTrends && assignmentTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={assignmentTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-sm" />
                    <YAxis className="text-sm" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="created" stroke={COLORS[0]} name="Created" strokeWidth={2} />
                    <Line type="monotone" dataKey="completed" stroke={COLORS[1]} name="Completed" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-80 text-muted-foreground">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Monthly invoiced vs paid amounts</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <Skeleton className="h-80" />
              ) : revenueTrends && revenueTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={revenueTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-sm" />
                    <YAxis className="text-sm" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="invoiced" stroke={COLORS[0]} name="Invoiced" strokeWidth={2} />
                    <Line type="monotone" dataKey="paid" stroke={COLORS[1]} name="Paid" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-80 text-muted-foreground">
                  No revenue data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tickets by Status</CardTitle>
                <CardDescription>Distribution of support tickets by status</CardDescription>
              </CardHeader>
              <CardContent>
                {supportLoading ? (
                  <Skeleton className="h-80" />
                ) : statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.name}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-80 text-muted-foreground">
                    No support ticket data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tickets by Priority</CardTitle>
                <CardDescription>Distribution of support tickets by priority</CardDescription>
              </CardHeader>
              <CardContent>
                {supportLoading ? (
                  <Skeleton className="h-80" />
                ) : priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.name}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-80 text-muted-foreground">
                    No priority data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Agent Usage</CardTitle>
              <CardDescription>Conversations and messages by agent</CardDescription>
            </CardHeader>
            <CardContent>
              {agentLoading ? (
                <Skeleton className="h-80" />
              ) : agentUsage && agentUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={agentUsage}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="agent" className="text-sm" />
                    <YAxis className="text-sm" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="conversations" fill={COLORS[0]} name="Conversations" />
                    <Bar dataKey="messages" fill={COLORS[1]} name="Messages" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-80 text-muted-foreground">
                  No agent usage data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
