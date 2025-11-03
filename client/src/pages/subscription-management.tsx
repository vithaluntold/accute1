import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, CreditCard, Users, Building2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PlatformSubscription {
  id: string;
  organizationId: string;
  plan: string;
  status: string;
  billingCycle: string;
  monthlyPrice: string | null;
  yearlyPrice: string | null;
  mrr: string;
  maxUsers: number;
  maxClients: number;
  maxStorage: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string | null;
  currentUsers: number;
  currentClients: number;
  currentStorage: string;
  paymentGateway: string;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
  createdAt: string;
  cancelledAt: string | null;
}

export default function SubscriptionManagement() {
  const { toast } = useToast();

  // Fetch current subscription
  const { data: subscription, isLoading, error } = useQuery<PlatformSubscription>({
    queryKey: ["/api/platform-subscriptions/current"],
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!subscription?.razorpaySubscriptionId) {
        throw new Error("No active Razorpay subscription found");
      }

      return apiRequest(`/api/razorpay/subscriptions/${subscription.razorpaySubscriptionId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancelAtCycleEnd: true }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will be cancelled at the end of the current billing period.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/platform-subscriptions/current"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      pending: "secondary",
      cancelled: "destructive",
      suspended: "outline",
    };

    return (
      <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-subscription" />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>You don't have an active subscription yet.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.href = "/subscription-pricing"} data-testid="button-view-plans">
              View Plans
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const usagePercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  return (
    <div className="container mx-auto py-12 px-4" data-testid="page-subscription-management">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-subscription-title">
          Subscription Management
        </h1>
        <p className="text-muted-foreground" data-testid="text-subscription-subtitle">
          Manage your subscription and billing details
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card data-testid="card-subscription-details">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Current Plan</span>
              {getStatusBadge(subscription.status)}
            </CardTitle>
            <CardDescription>
              {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {subscription.billingCycle === "monthly" ? "Monthly" : "Yearly"} billing
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Current period: {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>

            {subscription.nextBillingDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Next billing date: {formatDate(subscription.nextBillingDate)}
                </span>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="text-2xl font-bold" data-testid="text-subscription-price">
                ₹{parseFloat(subscription.mrr).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            {subscription.status === "active" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" data-testid="button-cancel-subscription">
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your subscription will be cancelled at the end of the current billing period on{" "}
                      {formatDate(subscription.currentPeriodEnd)}. You'll continue to have access until then.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-dialog">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelSubscriptionMutation.mutate()}
                      disabled={cancelSubscriptionMutation.isPending}
                      data-testid="button-confirm-cancel"
                    >
                      {cancelSubscriptionMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        "Confirm Cancellation"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardFooter>
        </Card>

        <Card data-testid="card-payment-method">
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>How you pay for your subscription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-16 bg-primary/10 rounded flex items-center justify-center">
                <span className="text-xs font-bold">Razorpay</span>
              </div>
              <div>
                <p className="text-sm font-medium">Razorpay Payment Gateway</p>
                <p className="text-xs text-muted-foreground">
                  Customer ID: {subscription.razorpayCustomerId?.slice(0, 20)}...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-usage-limits">
        <CardHeader>
          <CardTitle>Usage & Limits</CardTitle>
          <CardDescription>Track your usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Users</span>
              </div>
              <span className="text-sm text-muted-foreground" data-testid="text-users-usage">
                {subscription.currentUsers} / {subscription.maxUsers}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${usagePercentage(subscription.currentUsers, subscription.maxUsers)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Clients</span>
              </div>
              <span className="text-sm text-muted-foreground" data-testid="text-clients-usage">
                {subscription.currentClients} / {subscription.maxClients}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${usagePercentage(subscription.currentClients, subscription.maxClients)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Storage</span>
              </div>
              <span className="text-sm text-muted-foreground" data-testid="text-storage-usage">
                {parseFloat(subscription.currentStorage).toFixed(2)} GB / {subscription.maxStorage} GB
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${usagePercentage(parseFloat(subscription.currentStorage), subscription.maxStorage)}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {subscription.status === "cancelled" && subscription.cancelledAt && (
        <Card className="mt-6 border-destructive" data-testid="card-cancellation-notice">
          <CardHeader>
            <CardTitle className="text-destructive">Subscription Cancelled</CardTitle>
            <CardDescription>
              Your subscription was cancelled on {formatDate(subscription.cancelledAt)}.
              You have access until {formatDate(subscription.currentPeriodEnd)}.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.href = "/subscription-pricing"} data-testid="button-resubscribe">
              Resubscribe
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
