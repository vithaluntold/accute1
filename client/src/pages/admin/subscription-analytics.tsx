import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Users, AlertTriangle, CreditCard, Target, BarChart as BarChartIcon } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { GradientHero } from "@/components/gradient-hero";
import { useState } from "react";

interface SubscriptionMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  pastDueSubscriptions: number;
  newThisMonth: number;
  canceledThisMonth: number;
  churnRate: number;
  planDistribution: Array<{ planName: string; count: number }>;
}

interface RevenueTrend {
  month: string;
  mrr: number;
  newSubs: number;
  canceledSubs: number;
}

interface LifecycleMetrics {
  statusDistribution: {
    active: number;
    trial: number;
    past_due: number;
    canceled: number;
    paused: number;
  };
  billingCycleDistribution: {
    monthly: number;
    annual: number;
  };
  avgMonthlyValue: number;
  avgAnnualValue: number;
  trialConversionRate: number;
  totalSubscriptions: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function SubscriptionAnalyticsPage() {
  const [revenueTrendMonths, setRevenueTrendMonths] = useState<string>("12");

  const { data: metrics, isLoading: metricsLoading } = useQuery<SubscriptionMetrics>({
    queryKey: ["/api/admin/analytics/subscription-metrics"],
  });

  const { data: revenueTrends, isLoading: trendsLoading } = useQuery<RevenueTrend[]>({
    queryKey: [`/api/admin/analytics/revenue-trends?months=${revenueTrendMonths}`],
  });

  const { data: lifecycleMetrics, isLoading: lifecycleLoading } = useQuery<LifecycleMetrics>({
    queryKey: ["/api/admin/analytics/subscription-lifecycle"],
  });

  const isLoading = metricsLoading || trendsLoading || lifecycleLoading;

  // Prepare status distribution data for pie chart
  const statusData = lifecycleMetrics ? [
    { name: 'Active', value: lifecycleMetrics.statusDistribution.active },
    { name: 'Trial', value: lifecycleMetrics.statusDistribution.trial },
    { name: 'Past Due', value: lifecycleMetrics.statusDistribution.past_due },
    { name: 'Canceled', value: lifecycleMetrics.statusDistribution.canceled },
    { name: 'Paused', value: lifecycleMetrics.statusDistribution.paused },
  ].filter(item => item.value > 0) : [];

  // Prepare billing cycle data for pie chart
  const billingCycleData = lifecycleMetrics ? [
    { name: 'Monthly', value: lifecycleMetrics.billingCycleDistribution.monthly },
    { name: 'Annual', value: lifecycleMetrics.billingCycleDistribution.annual },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="min-h-screen bg-background">
      <GradientHero
        title="Subscription Analytics"
        description="Comprehensive insights into subscription revenue, growth, and customer metrics"
        icon={BarChartIcon}
      />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Key Metrics Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-mrr-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-mrr">
                ${metrics?.mrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{metrics?.newThisMonth || 0} new this month
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-arr-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual Recurring Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-arr">
                ${metrics?.arr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                MRR × 12
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-subs-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-count">
                {metrics?.activeSubscriptions || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.trialSubscriptions || 0} in trial
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-churn-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-churn-rate">
                {metrics?.churnRate.toFixed(2) || '0.00'}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics?.canceledThisMonth || 0} canceled this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="revenue" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue Trends</TabsTrigger>
            <TabsTrigger value="distribution" data-testid="tab-distribution">Distribution</TabsTrigger>
            <TabsTrigger value="lifecycle" data-testid="tab-lifecycle">Lifecycle</TabsTrigger>
          </TabsList>

          {/* Revenue Trends Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Revenue Trends</CardTitle>
                  <CardDescription>Monthly recurring revenue over time</CardDescription>
                </div>
                <Select value={revenueTrendMonths} onValueChange={setRevenueTrendMonths}>
                  <SelectTrigger className="w-[180px]" data-testid="select-revenue-months">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Last 3 Months</SelectItem>
                    <SelectItem value="6">Last 6 Months</SelectItem>
                    <SelectItem value="12">Last 12 Months</SelectItem>
                    <SelectItem value="24">Last 24 Months</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Loading revenue data...
                  </div>
                ) : revenueTrends && revenueTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={revenueTrends}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: number) => `$${value.toFixed(2)}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="mrr"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        name="MRR"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No revenue data available
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>New vs Canceled Subscriptions</CardTitle>
                  <CardDescription>Monthly subscription changes</CardDescription>
                </CardHeader>
                <CardContent>
                  {trendsLoading ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Loading data...
                    </div>
                  ) : revenueTrends && revenueTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={revenueTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="newSubs" fill="hsl(var(--chart-2))" name="New" />
                        <Bar dataKey="canceledSubs" fill="hsl(var(--chart-5))" name="Canceled" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Metrics</CardTitle>
                  <CardDescription>Current performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Average MRR per Customer</span>
                    </div>
                    <span className="text-sm font-bold">
                      ${lifecycleMetrics && metrics && metrics.activeSubscriptions > 0 
                        ? (metrics.mrr / metrics.activeSubscriptions).toFixed(2) 
                        : '0.00'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Trial Conversion Rate</span>
                    </div>
                    <span className="text-sm font-bold">
                      {lifecycleMetrics?.trialConversionRate.toFixed(2) || '0.00'}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Net Growth (This Month)</span>
                    </div>
                    <span className="text-sm font-bold">
                      +{(metrics?.newThisMonth || 0) - (metrics?.canceledThisMonth || 0)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">At Risk (Past Due)</span>
                    </div>
                    <span className="text-sm font-bold text-destructive">
                      {metrics?.pastDueSubscriptions || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Distribution Tab */}
          <TabsContent value="distribution" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Subscriptions by Plan</CardTitle>
                  <CardDescription>Active subscription distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Loading data...
                    </div>
                  ) : metrics && metrics.planDistribution.length > 0 ? (
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={metrics.planDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {metrics.planDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 w-full lg:w-auto">
                        {metrics.planDistribution.map((plan, index) => (
                          <div key={plan.planName} className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm">{plan.planName}: {plan.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No plan data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Billing Cycle Distribution</CardTitle>
                  <CardDescription>Monthly vs annual subscriptions</CardDescription>
                </CardHeader>
                <CardContent>
                  {lifecycleLoading ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Loading data...
                    </div>
                  ) : billingCycleData.length > 0 ? (
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={billingCycleData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {billingCycleData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 w-full lg:w-auto">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[0] }} />
                          <span className="text-sm">Monthly: {lifecycleMetrics?.billingCycleDistribution.monthly || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[1] }} />
                          <span className="text-sm">Annual: {lifecycleMetrics?.billingCycleDistribution.annual || 0}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No billing cycle data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Average Subscription Values</CardTitle>
                <CardDescription>Average revenue per subscription type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-md">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Average Monthly Subscription</div>
                    <div className="text-3xl font-bold">
                      ${lifecycleMetrics?.avgMonthlyValue.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">per month</div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-muted rounded-md">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Average Annual Subscription</div>
                    <div className="text-3xl font-bold">
                      ${lifecycleMetrics?.avgAnnualValue.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">per year</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lifecycle Tab */}
          <TabsContent value="lifecycle" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Subscription Status</CardTitle>
                  <CardDescription>Current status distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  {lifecycleLoading ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      Loading data...
                    </div>
                  ) : statusData.length > 0 ? (
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={100}
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
                      <div className="space-y-2 w-full lg:w-auto">
                        {statusData.map((status, index) => (
                          <div key={status.name} className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm">{status.name}: {status.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No status data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lifecycle Metrics</CardTitle>
                  <CardDescription>Key subscription lifecycle indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Total Subscriptions</span>
                    <span className="text-sm font-bold">
                      {lifecycleMetrics?.totalSubscriptions || 0}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Active Rate</span>
                    <span className="text-sm font-bold">
                      {lifecycleMetrics && lifecycleMetrics.totalSubscriptions > 0
                        ? ((lifecycleMetrics.statusDistribution.active / lifecycleMetrics.totalSubscriptions) * 100).toFixed(2)
                        : '0.00'}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Trial to Paid Conversion</span>
                    <span className="text-sm font-bold">
                      {lifecycleMetrics?.trialConversionRate.toFixed(2) || '0.00'}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Cancellation Rate</span>
                    <span className="text-sm font-bold">
                      {lifecycleMetrics && lifecycleMetrics.totalSubscriptions > 0
                        ? ((lifecycleMetrics.statusDistribution.canceled / lifecycleMetrics.totalSubscriptions) * 100).toFixed(2)
                        : '0.00'}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Monthly vs Annual Ratio</span>
                    <span className="text-sm font-bold">
                      {lifecycleMetrics && lifecycleMetrics.billingCycleDistribution.annual > 0
                        ? (lifecycleMetrics.billingCycleDistribution.monthly / lifecycleMetrics.billingCycleDistribution.annual).toFixed(2)
                        : 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
                <CardDescription>Detailed count by status</CardDescription>
              </CardHeader>
              <CardContent>
                {lifecycleLoading ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Loading data...
                  </div>
                ) : lifecycleMetrics ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        { status: 'Active', count: lifecycleMetrics.statusDistribution.active },
                        { status: 'Trial', count: lifecycleMetrics.statusDistribution.trial },
                        { status: 'Past Due', count: lifecycleMetrics.statusDistribution.past_due },
                        { status: 'Canceled', count: lifecycleMetrics.statusDistribution.canceled },
                        { status: 'Paused', count: lifecycleMetrics.statusDistribution.paused },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="status" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--chart-1))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
