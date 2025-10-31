import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CreditCard, Building2, TrendingUp, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function SubscriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: subscriptions, isLoading } = useQuery<Array<{
    id: string;
    organizationId: string;
    organization: {
      name: string;
      slug: string;
    };
    plan: string;
    status: string;
    billingCycle: string;
    monthlyPrice?: string;
    yearlyPrice?: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingDate?: string;
    currentUsers: number;
    currentClients: number;
    maxUsers: number;
    maxClients: number;
    isTrialing: boolean;
    trialEndsAt?: string;
  }>>({
    queryKey: ["/api/admin/subscriptions"],
  });

  const filteredSubs = subscriptions?.filter(sub =>
    sub.organization.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.plan.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case "free": return "secondary";
      case "starter": return "default";
      case "professional": return "default";
      case "enterprise": return "default";
      default: return "secondary";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "suspended": return "destructive";
      case "cancelled": return "secondary";
      case "expired": return "destructive";
      default: return "secondary";
    }
  };

  const stats = {
    totalRevenue: subscriptions?.reduce((sum, sub) => {
      const price = sub.billingCycle === "yearly" ? parseFloat(sub.yearlyPrice || "0") : parseFloat(sub.monthlyPrice || "0");
      return sum + (sub.status === "active" ? price : 0);
    }, 0) || 0,
    activeSubscriptions: subscriptions?.filter(s => s.status === "active").length || 0,
    totalOrganizations: subscriptions?.length || 0,
    trialing: subscriptions?.filter(s => s.isTrialing).length || 0,
  };

  return (
    <div className="h-full overflow-auto">
      {/* Gradient Hero Section */}
      <div className="relative mb-8">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="h-10 w-10 text-white" />
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white" data-testid="heading-subscriptions">Subscriptions</h1>
              </div>
              <p className="text-white/90 text-lg">Manage platform subscriptions and billing</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 space-y-6">

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-monthly-revenue">${stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Active subscriptions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-active-count">{stats.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">of {stats.totalOrganizations} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trialing</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-trialing-count">{stats.trialing}</div>
              <p className="text-xs text-muted-foreground">Trial subscriptions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orgs</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-total-orgs">{stats.totalOrganizations}</div>
              <p className="text-xs text-muted-foreground">Organizations</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Subscriptions</CardTitle>
                <CardDescription>View and manage organization subscriptions</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-subscriptions"
                  placeholder="Search subscriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-subscriptions">Loading subscriptions...</div>
            ) : filteredSubs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-subscriptions">
                No subscriptions found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Next Billing</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.map((sub) => (
                    <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                      <TableCell>
                        <div className="font-medium" data-testid={`text-org-name-${sub.id}`}>{sub.organization.name}</div>
                        <div className="text-sm text-muted-foreground">@{sub.organization.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPlanBadgeVariant(sub.plan)} data-testid={`badge-plan-${sub.id}`}>
                          {sub.plan.toUpperCase()}
                        </Badge>
                        {sub.isTrialing && (
                          <Badge variant="secondary" className="ml-2">
                            Trial
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(sub.status)} data-testid={`badge-status-${sub.id}`}>
                          {sub.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          ${sub.billingCycle === "yearly" ? sub.yearlyPrice : sub.monthlyPrice}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {sub.billingCycle === "yearly" ? "per year" : "per month"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div>{sub.currentUsers}/{sub.maxUsers} users</div>
                          <div>{sub.currentClients}/{sub.maxClients} clients</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.nextBillingDate && (
                          <div className="text-sm">
                            {format(new Date(sub.nextBillingDate), "MMM d, yyyy")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" data-testid={`button-manage-subscription-${sub.id}`}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
