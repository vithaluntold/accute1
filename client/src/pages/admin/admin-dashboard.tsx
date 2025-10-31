import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  Users, 
  ShoppingBag, 
  TicketIcon, 
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardMetrics {
  organizations: {
    total: number;
  };
  users: {
    total: number;
    active: number;
  };
  marketplace: {
    totalItems: number;
    published: number;
    installations: number;
  };
  support: {
    total: number;
    open: number;
    urgent: number;
  };
  subscriptions: {
    total: number;
    active: number;
    trial: number;
    mrr: number;
  };
}

export default function AdminDashboard() {
  const { data: metrics, isLoading, error, isError } = useQuery<DashboardMetrics>({
    queryKey: ["/api/admin/dashboard/metrics"],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time data
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-display font-bold mb-6">Super Admin Dashboard</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-8 w-8 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-32"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-display font-bold mb-6">Super Admin Dashboard</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load dashboard metrics</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : "You may not have platform administrator access or your session may have expired."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
      {/* Gradient Hero Section */}
      <div className="relative mb-8">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto p-6 md:p-8">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-10 w-10 text-white" />
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white">Platform Overview</h1>
            </div>
            <p className="text-white/90 text-lg">Monitor platform-wide metrics and system health</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">

      {/* Top Row - Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total Organizations */}
        <Card data-testid="card-organizations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-org-total">{metrics.organizations.total}</div>
            <p className="text-xs text-muted-foreground">
              Total platform accounts
            </p>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card data-testid="card-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-user-total">{metrics.users.total}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-primary font-medium">{metrics.users.active}</span> active users
            </p>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card data-testid="card-mrr">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-mrr">{formatCurrency(metrics.subscriptions.mrr)}</div>
            <p className="text-xs text-muted-foreground">
              Monthly recurring revenue
            </p>
          </CardContent>
        </Card>

        {/* Marketplace Installations */}
        <Card data-testid="card-installations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Installations</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-installations">{metrics.marketplace.installations}</div>
            <p className="text-xs text-muted-foreground">
              Total marketplace installs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second Row - Subscriptions & Support */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {/* Active Subscriptions */}
        <Card data-testid="card-subscriptions">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-2xl font-bold" data-testid="text-sub-active">{metrics.subscriptions.active}</div>
              <span className="text-sm text-muted-foreground">active</span>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>{metrics.subscriptions.total} total</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                <span>{metrics.subscriptions.trial} trial</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Tickets */}
        <Card data-testid="card-support">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Support Tickets</CardTitle>
            <TicketIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-2xl font-bold" data-testid="text-tickets-open">{metrics.support.open}</div>
              <span className="text-sm text-muted-foreground">open</span>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <TicketIcon className="h-3 w-3" />
                <span>{metrics.support.total} total</span>
              </div>
              {metrics.support.urgent > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  <span className="text-red-500 font-medium">{metrics.support.urgent} urgent</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Templates */}
        <Card data-testid="card-marketplace">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marketplace</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-2xl font-bold" data-testid="text-marketplace-published">{metrics.marketplace.published}</div>
              <span className="text-sm text-muted-foreground">published</span>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                <span>{metrics.marketplace.totalItems} total items</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <a
              href="/admin/organizations"
              className="flex items-center gap-3 p-4 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-manage-orgs"
            >
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Manage Organizations</div>
                <div className="text-xs text-muted-foreground">View all accounts</div>
              </div>
            </a>

            <a
              href="/admin/users"
              className="flex items-center gap-3 p-4 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-manage-users"
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Manage Users</div>
                <div className="text-xs text-muted-foreground">Platform users</div>
              </div>
            </a>

            <a
              href="/marketplace"
              className="flex items-center gap-3 p-4 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-marketplace"
            >
              <ShoppingBag className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Marketplace</div>
                <div className="text-xs text-muted-foreground">Manage templates</div>
              </div>
            </a>

            <a
              href="/admin/tickets"
              className="flex items-center gap-3 p-4 rounded-lg border hover-elevate active-elevate-2 transition-colors"
              data-testid="link-support"
            >
              <TicketIcon className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Support Tickets</div>
                <div className="text-xs text-muted-foreground">
                  {metrics.support.urgent > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {metrics.support.urgent} urgent
                    </Badge>
                  )}
                  {metrics.support.urgent === 0 && "All clear"}
                </div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
