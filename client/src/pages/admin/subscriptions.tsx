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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Search, CreditCard, Building2, TrendingUp, DollarSign, MoreVertical, Ban, Play, Eye, RefreshCw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";

interface Subscription {
  id: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  planId: string;
  planSlug: string;
  status: string;
  billingCycle: string;
  mrr: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionDetails extends Subscription {
  plan: {
    id: string;
    name: string;
    slug: string;
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    eventData: any;
    createdAt: string;
  }>;
}

export default function SubscriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<string | null>(null);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState({ status: "", reason: "" });
  const [cancelData, setCancelData] = useState({ reason: "", immediate: false });
  const { toast } = useToast();

  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/admin/subscriptions"],
  });

  const { data: subscriptionDetails } = useQuery<SubscriptionDetails>({
    queryKey: [`/api/admin/subscriptions/${selectedSubscription}`],
    enabled: !!selectedSubscription && detailsDialogOpen,
  });

  // Update subscription status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/subscriptions/${id}/status`, { status, reason });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      if (selectedSubscription) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/subscriptions/${selectedSubscription}`] });
      }
      setUpdateStatusDialogOpen(false);
      setStatusUpdateData({ status: "", reason: "" });
      toast({ title: "Subscription status updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update subscription", description: error.message, variant: "destructive" });
    },
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason, immediate }: { id: string; reason: string; immediate: boolean }) => {
      const response = await apiRequest("POST", `/api/admin/subscriptions/${id}/cancel`, { reason, immediate });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      if (selectedSubscription) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/subscriptions/${selectedSubscription}`] });
      }
      setCancelDialogOpen(false);
      setCancelData({ reason: "", immediate: false });
      toast({ title: "Subscription canceled successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to cancel subscription", description: error.message, variant: "destructive" });
    },
  });

  const filteredSubs = subscriptions?.filter(sub => {
    const matchesSearch = sub.organization?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.planSlug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.organization?.slug.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active": return "default";
      case "trial": return "outline";
      case "past_due": return "destructive";
      case "canceled": return "secondary";
      case "paused": return "secondary";
      default: return "secondary";
    }
  };

  const stats = {
    totalMRR: subscriptions?.filter(s => s.status === 'active').reduce((sum, sub) => {
      return sum + parseFloat(sub.mrr || "0");
    }, 0) || 0,
    activeSubscriptions: subscriptions?.filter(s => s.status === 'active').length || 0,
    trialSubscriptions: subscriptions?.filter(s => s.status === 'trial').length || 0,
    pastDueSubscriptions: subscriptions?.filter(s => s.status === 'past_due').length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <GradientHero
        title="Subscription Management"
        description="Manage platform subscriptions, billing, and revenue"
        icon={CreditCard}
      />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-mrr-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-mrr-value">
                ${stats.totalMRR.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                From {stats.activeSubscriptions} active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-count">
                {stats.activeSubscriptions}
              </div>
              <p className="text-xs text-muted-foreground">
                ARR: ${(stats.totalMRR * 12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-trial-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trial Subscriptions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-trial-count">
                {stats.trialSubscriptions}
              </div>
              <p className="text-xs text-muted-foreground">
                Potential customers
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-past-due-metric">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Past Due</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-past-due-count">
                {stats.pastDueSubscriptions}
              </div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Subscriptions</CardTitle>
            <CardDescription>
              View and manage all organization subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filters */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search organizations or plans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-subscriptions"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading subscriptions...</div>
            ) : filteredSubs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || statusFilter !== "all" ? "No subscriptions match your filters" : "No subscriptions found"}
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing Cycle</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead>Current Period</TableHead>
                      <TableHead>Payment Provider</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubs.map((subscription) => (
                      <TableRow key={subscription.id} data-testid={`row-subscription-${subscription.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-org-name-${subscription.id}`}>
                              {subscription.organization?.name || 'Unknown'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {subscription.organization?.slug || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-plan-${subscription.id}`}>
                            {subscription.planSlug}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(subscription.status)} data-testid={`badge-status-${subscription.id}`}>
                            {subscription.status}
                          </Badge>
                          {subscription.cancelAtPeriodEnd && (
                            <div className="text-xs text-destructive mt-1">
                              Cancels at period end
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{subscription.billingCycle}</TableCell>
                        <TableCell className="font-mono" data-testid={`text-mrr-${subscription.id}`}>
                          ${parseFloat(subscription.mrr || '0').toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(subscription.currentPeriodStart), 'MMM d, yyyy')}
                            <span className="text-muted-foreground"> to </span>
                            {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
                          </div>
                          {subscription.trialEndsAt && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Trial ends: {format(new Date(subscription.trialEndsAt), 'MMM d, yyyy')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {subscription.stripeSubscriptionId ? (
                            <Badge variant="outline">Stripe</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Manual</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-actions-${subscription.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSubscription(subscription.id);
                                  setDetailsDialogOpen(true);
                                }}
                                data-testid={`menu-view-details-${subscription.id}`}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {subscription.status !== 'canceled' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedSubscription(subscription.id);
                                      setStatusUpdateData({ status: subscription.status, reason: "" });
                                      setUpdateStatusDialogOpen(true);
                                    }}
                                    data-testid={`menu-update-status-${subscription.id}`}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Update Status
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedSubscription(subscription.id);
                                      setCancelData({ reason: "", immediate: false });
                                      setCancelDialogOpen(true);
                                    }}
                                    className="text-destructive"
                                    data-testid={`menu-cancel-${subscription.id}`}
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Cancel Subscription
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* View Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
            <DialogDescription>
              Detailed information about this subscription
            </DialogDescription>
          </DialogHeader>
          {subscriptionDetails ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Organization</Label>
                  <div className="mt-1 font-medium">{subscriptionDetails.organization?.name}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Plan</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{subscriptionDetails.plan?.name || subscriptionDetails.planSlug}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(subscriptionDetails.status)}>
                      {subscriptionDetails.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Billing Cycle</Label>
                  <div className="mt-1 capitalize">{subscriptionDetails.billingCycle}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">MRR</Label>
                  <div className="mt-1 font-mono font-medium">${parseFloat(subscriptionDetails.mrr || '0').toFixed(2)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Current Period</Label>
                  <div className="mt-1 text-sm">
                    {format(new Date(subscriptionDetails.currentPeriodStart), 'MMM d, yyyy')} - {format(new Date(subscriptionDetails.currentPeriodEnd), 'MMM d, yyyy')}
                  </div>
                </div>
                {subscriptionDetails.stripeCustomerId && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Stripe Customer ID</Label>
                    <div className="mt-1 font-mono text-sm">{subscriptionDetails.stripeCustomerId}</div>
                  </div>
                )}
                {subscriptionDetails.stripeSubscriptionId && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Stripe Subscription ID</Label>
                    <div className="mt-1 font-mono text-sm">{subscriptionDetails.stripeSubscriptionId}</div>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <div className="mt-1 text-sm">{format(new Date(subscriptionDetails.createdAt), 'MMM d, yyyy HH:mm')}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                  <div className="mt-1 text-sm">{format(new Date(subscriptionDetails.updatedAt), 'MMM d, yyyy HH:mm')}</div>
                </div>
              </div>

              {subscriptionDetails.events && subscriptionDetails.events.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Recent Events</Label>
                  <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                    {subscriptionDetails.events.map((event: any, index: number) => (
                      <div key={index} className="text-sm pb-2 border-b last:border-0">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="text-xs">{event.eventType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.createdAt), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                        {event.eventData && (
                          <div className="mt-1 text-xs text-muted-foreground font-mono">
                            {JSON.stringify(event.eventData, null, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Loading details...</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Subscription Status</DialogTitle>
            <DialogDescription>
              Manually update the subscription status (admin override)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-status">New Status</Label>
              <Select
                value={statusUpdateData.status}
                onValueChange={(value) => setStatusUpdateData({ ...statusUpdateData, status: value })}
              >
                <SelectTrigger id="new-status" data-testid="select-new-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status-reason">Reason (for audit trail)</Label>
              <Textarea
                id="status-reason"
                placeholder="Enter reason for status change..."
                value={statusUpdateData.reason}
                onChange={(e) => setStatusUpdateData({ ...statusUpdateData, reason: e.target.value })}
                data-testid="textarea-status-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpdateStatusDialogOpen(false)}
              data-testid="button-cancel-status-update"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedSubscription) {
                  updateStatusMutation.mutate({
                    id: selectedSubscription,
                    status: statusUpdateData.status,
                    reason: statusUpdateData.reason,
                  });
                }
              }}
              disabled={!statusUpdateData.status || updateStatusMutation.isPending}
              data-testid="button-submit-status-update"
            >
              {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Cancel this subscription. This action will be logged for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cancel-reason">Reason for Cancellation</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Enter reason for cancellation..."
                value={cancelData.reason}
                onChange={(e) => setCancelData({ ...cancelData, reason: e.target.value })}
                data-testid="textarea-cancel-reason"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="immediate-cancel"
                checked={cancelData.immediate}
                onChange={(e) => setCancelData({ ...cancelData, immediate: e.target.checked })}
                className="h-4 w-4"
                data-testid="checkbox-immediate-cancel"
              />
              <Label htmlFor="immediate-cancel" className="text-sm font-normal cursor-pointer">
                Cancel immediately (instead of at period end)
              </Label>
            </div>
            {!cancelData.immediate && (
              <div className="bg-muted p-3 rounded-md text-sm">
                The subscription will remain active until the end of the current billing period.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              data-testid="button-cancel-cancellation"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedSubscription) {
                  cancelMutation.mutate({
                    id: selectedSubscription,
                    reason: cancelData.reason,
                    immediate: cancelData.immediate,
                  });
                }
              }}
              disabled={!cancelData.reason || cancelMutation.isPending}
              data-testid="button-submit-cancellation"
            >
              {cancelMutation.isPending ? "Canceling..." : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
