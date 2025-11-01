import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Search, CreditCard, Building2, TrendingUp, DollarSign, Plus, MoreVertical, Ban, Play, X } from "lucide-react";
import { format, addMonths, addYears } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";

export default function SubscriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSubscription, setNewSubscription] = useState({
    organizationId: "",
    plan: "free",
    billingCycle: "monthly",
    isTrialing: false,
  });
  const { toast } = useToast();

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

  // Fetch organizations for dropdown
  const { data: organizations } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/admin/organizations"],
  });

  // Create subscription mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof newSubscription) => {
      const now = new Date();
      const periodEnd = data.billingCycle === "yearly" ? addYears(now, 1) : addMonths(now, 1);
      
      return await apiRequest("POST", "/api/admin/subscriptions", {
        ...data,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        nextBillingDate: periodEnd.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      setCreateDialogOpen(false);
      setNewSubscription({ organizationId: "", plan: "free", billingCycle: "monthly", isTrialing: false });
      toast({ title: "Subscription created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create subscription", description: error.message, variant: "destructive" });
    },
  });

  // Update subscription status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/subscriptions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({ title: "Subscription status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update subscription", description: error.message, variant: "destructive" });
    },
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
      <GradientHero
        icon={CreditCard}
        title="Subscriptions"
        description="Manage platform subscriptions and billing"
        testId="heading-subscriptions"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>All Subscriptions</CardTitle>
                <CardDescription>View and manage organization subscriptions</CardDescription>
              </div>
              <div className="flex items-center gap-3">
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
                <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-subscription">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Subscription
                </Button>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" data-testid={`button-manage-subscription-${sub.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {sub.status === "active" && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => updateStatusMutation.mutate({ id: sub.id, status: "suspended" })}
                                  data-testid={`action-suspend-${sub.id}`}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend (Non-payment)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateStatusMutation.mutate({ id: sub.id, status: "cancelled" })}
                                  data-testid={`action-cancel-${sub.id}`}
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              </>
                            )}
                            {sub.status === "suspended" && (
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: sub.id, status: "active" })}
                                data-testid={`action-resume-${sub.id}`}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Resume (Manual Override)
                              </DropdownMenuItem>
                            )}
                            {(sub.status === "cancelled" || sub.status === "expired") && (
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: sub.id, status: "active" })}
                                data-testid={`action-reactivate-${sub.id}`}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Subscription Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Subscription</DialogTitle>
            <DialogDescription>
              Create a new subscription for an organization. This will enable platform access based on the selected plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="organization">Organization *</Label>
              <Select 
                value={newSubscription.organizationId} 
                onValueChange={(value) => setNewSubscription({ ...newSubscription, organizationId: value })}
              >
                <SelectTrigger id="organization" data-testid="select-organization">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations?.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan *</Label>
              <Select 
                value={newSubscription.plan} 
                onValueChange={(value) => setNewSubscription({ ...newSubscription, plan: value })}
              >
                <SelectTrigger id="plan" data-testid="select-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (5 users, 10 clients)</SelectItem>
                  <SelectItem value="starter">Starter (10 users, 25 clients)</SelectItem>
                  <SelectItem value="professional">Professional (25 users, 100 clients)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (Unlimited)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing">Billing Cycle *</Label>
              <Select 
                value={newSubscription.billingCycle} 
                onValueChange={(value) => setNewSubscription({ ...newSubscription, billingCycle: value })}
              >
                <SelectTrigger id="billing" data-testid="select-billing-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly (Save 20%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="trial"
                checked={newSubscription.isTrialing}
                onChange={(e) => setNewSubscription({ ...newSubscription, isTrialing: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-trial"
              />
              <Label htmlFor="trial" className="cursor-pointer">
                Start with 30-day free trial
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCreateDialogOpen(false)}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createMutation.mutate(newSubscription)} 
              disabled={!newSubscription.organizationId || createMutation.isPending}
              data-testid="button-submit-create"
            >
              {createMutation.isPending ? "Creating..." : "Create Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
