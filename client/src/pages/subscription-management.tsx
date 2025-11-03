import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Calendar, CreditCard, Users, Building2, AlertCircle, ArrowUpCircle, ArrowDownCircle, Check, Zap, Bot, Crown } from "lucide-react";
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

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  basePriceMonthly: string;
  basePriceYearly: string;
  features: string[];
  maxUsers: number;
  maxClients: number;
  maxWorkflows: number;
  maxAIAgents: number;
  includedSeats: number;
  isPublic: boolean;
  displayOrder: number;
}

export default function SubscriptionManagement() {
  const { toast } = useToast();
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string | null>(null);

  // Fetch current subscription
  const { data: subscription, isLoading, error } = useQuery<PlatformSubscription>({
    queryKey: ["/api/platform-subscriptions/current"],
  });

  // Fetch available subscription plans
  const { data: availablePlans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  // Switch plan mutation
  const switchPlanMutation = useMutation({
    mutationFn: async (planSlug: string) => {
      return await apiRequest("POST", "/api/platform-subscriptions/switch-plan", {
        planSlug,
        billingCycle: subscription?.billingCycle || "monthly"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-subscriptions/current"] });
      setChangePlanDialogOpen(false);
      setSelectedNewPlan(null);
      toast({ title: "Plan switched successfully", description: "Your subscription has been updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to switch plan", description: error.message, variant: "destructive" });
    },
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

  const getPlanIcon = (slug: string) => {
    switch (slug.toLowerCase()) {
      case "core": return Zap;
      case "ai": return Bot;
      case "edge": return Crown;
      default: return CreditCard;
    }
  };

  const isPlanUpgrade = (newPlanSlug: string) => {
    const planOrder = { free: 0, core: 1, ai: 2, edge: 3 };
    const currentOrder = planOrder[subscription?.plan?.toLowerCase() as keyof typeof planOrder] || 0;
    const newOrder = planOrder[newPlanSlug.toLowerCase() as keyof typeof planOrder] || 0;
    return newOrder > currentOrder;
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
          <CardFooter className="flex gap-2 flex-wrap">
            {subscription.status === "active" && (
              <Button
                onClick={() => setChangePlanDialogOpen(true)}
                variant="default"
                data-testid="button-change-plan"
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                {subscription.plan === "free" ? "Upgrade Plan" : "Change Plan"}
              </Button>
            )}
            {subscription.status === "active" && subscription.plan !== "free" && (
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

      {/* Plan Comparison Dialog */}
      <Dialog open={changePlanDialogOpen} onOpenChange={setChangePlanDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-change-plan">
          <DialogHeader>
            <DialogTitle>Change Your Plan</DialogTitle>
            <DialogDescription>
              Compare plans and switch to the one that fits your needs
            </DialogDescription>
          </DialogHeader>

          {plansLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {availablePlans
                ?.filter(plan => plan.slug !== "free" && plan.isPublic)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((plan) => {
                  const Icon = getPlanIcon(plan.slug);
                  const isCurrentPlan = plan.slug === subscription.plan;
                  const isUpgrade = isPlanUpgrade(plan.slug);
                  const pricePerMonth = subscription.billingCycle === "yearly"
                    ? parseFloat(plan.basePriceYearly)
                    : parseFloat(plan.basePriceMonthly);

                  return (
                    <Card
                      key={plan.id}
                      className={isCurrentPlan ? "border-primary" : ""}
                      data-testid={`card-plan-${plan.slug}`}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Icon className="h-8 w-8 text-primary" />
                          {isCurrentPlan && (
                            <Badge variant="default" data-testid={`badge-current-${plan.slug}`}>
                              Current Plan
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="mt-4">{plan.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
                        <div className="pt-4">
                          <div className="text-3xl font-bold">
                            ${pricePerMonth.toFixed(2)}
                            <span className="text-sm font-normal text-muted-foreground">/mo</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Billed {subscription.billingCycle === "yearly" ? "annually" : "monthly"}
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          {plan.features.slice(0, 5).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                          {plan.features.length > 5 && (
                            <li className="text-muted-foreground">+ {plan.features.length - 5} more features</li>
                          )}
                        </ul>
                        <div className="mt-4 pt-4 border-t space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Users:</span>
                            <span className="font-medium">
                              {plan.maxUsers === 999999 ? "Unlimited" : plan.maxUsers}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Clients:</span>
                            <span className="font-medium">
                              {plan.maxClients === 999999 ? "Unlimited" : plan.maxClients}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">AI Agents:</span>
                            <span className="font-medium">{plan.maxAIAgents}</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        {isCurrentPlan ? (
                          <Button
                            className="w-full"
                            variant="outline"
                            disabled
                            data-testid={`button-current-${plan.slug}`}
                          >
                            Current Plan
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            variant={isUpgrade ? "default" : "outline"}
                            onClick={() => setSelectedNewPlan(plan.slug)}
                            disabled={switchPlanMutation.isPending}
                            data-testid={`button-select-${plan.slug}`}
                          >
                            {isUpgrade ? (
                              <>
                                <ArrowUpCircle className="h-4 w-4 mr-2" />
                                Upgrade to {plan.name}
                              </>
                            ) : (
                              <>
                                <ArrowDownCircle className="h-4 w-4 mr-2" />
                                Downgrade to {plan.name}
                              </>
                            )}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
            </div>
          )}

          {selectedNewPlan && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Confirm Plan Change</h4>
              <p className="text-sm text-muted-foreground mb-4">
                {isPlanUpgrade(selectedNewPlan)
                  ? "You're upgrading your plan. The new features will be available immediately and you'll be charged the prorated amount."
                  : "You're downgrading your plan. The change will take effect at the end of your current billing period."}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => switchPlanMutation.mutate(selectedNewPlan)}
                  disabled={switchPlanMutation.isPending}
                  data-testid="button-confirm-switch"
                >
                  {switchPlanMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Switching...
                    </>
                  ) : (
                    "Confirm Change"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedNewPlan(null)}
                  data-testid="button-cancel-switch"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
