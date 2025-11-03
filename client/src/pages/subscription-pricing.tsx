import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Zap, Building, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

declare global {
  interface Window {
    Razorpay: any;
  }
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
  isPublic: boolean;
  displayOrder: number;
}

export default function SubscriptionPricing() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Fetch subscription plans
  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      // First create the Razorpay plan if needed
      const plan = plans?.find(p => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      const amount = billingCycle === "monthly" 
        ? parseFloat(plan.basePriceMonthly) * 100 // Convert to paise
        : parseFloat(plan.basePriceYearly) * 100;

      // Create Razorpay order
      const order = await apiRequest("/api/razorpay/orders/create", {
        method: "POST",
        body: JSON.stringify({
          amount: Math.round(amount),
          currency: "INR",
          receipt: `receipt_${Date.now()}`,
          notes: {
            planId,
            billingCycle,
          },
        }),
      });

      return { order, plan };
    },
    onSuccess: ({ order, plan }) => {
      // Load Razorpay script and open checkout
      loadRazorpayScript(() => {
        openRazorpayCheckout(order, plan);
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    },
  });

  const loadRazorpayScript = (callback: () => void) => {
    if (window.Razorpay) {
      callback();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = callback;
    script.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to load Razorpay SDK",
        variant: "destructive",
      });
    };
    document.body.appendChild(script);
  };

  const openRazorpayCheckout = (order: any, plan: SubscriptionPlan) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      name: "Accute",
      description: `${plan.name} Plan - ${billingCycle === "monthly" ? "Monthly" : "Yearly"}`,
      order_id: order.id,
      handler: async function (response: any) {
        try {
          // Verify payment
          await apiRequest("/api/razorpay/verify-payment", {
            method: "POST",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          toast({
            title: "Success",
            description: "Payment successful! Your subscription is now active.",
          });

          queryClient.invalidateQueries({ queryKey: ["/api/platform-subscriptions"] });
        } catch (error: any) {
          toast({
            title: "Error",
            description: "Payment verification failed",
            variant: "destructive",
          });
        }
      },
      prefill: {
        name: "",
        email: "",
      },
      theme: {
        color: "#e5a660",
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const handleSubscribe = (planId: string) => {
    setSelectedPlan(planId);
    createSubscriptionMutation.mutate(planId);
  };

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case "free":
        return <Zap className="h-6 w-6" />;
      case "starter":
        return <Building className="h-6 w-6" />;
      case "professional":
        return <Crown className="h-6 w-6" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-plans" />
      </div>
    );
  }

  const publicPlans = plans?.filter(p => p.isPublic).sort((a, b) => a.displayOrder - b.displayOrder) || [];

  return (
    <div className="container mx-auto py-12 px-4" data-testid="page-subscription-pricing">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4" data-testid="text-pricing-title">
          Choose Your Plan
        </h1>
        <p className="text-muted-foreground text-lg mb-8" data-testid="text-pricing-subtitle">
          Select the perfect plan for your accounting firm
        </p>

        <div className="flex items-center justify-center gap-4 mb-8">
          <Button
            variant={billingCycle === "monthly" ? "default" : "outline"}
            onClick={() => setBillingCycle("monthly")}
            data-testid="button-billing-monthly"
          >
            Monthly
          </Button>
          <Button
            variant={billingCycle === "yearly" ? "default" : "outline"}
            onClick={() => setBillingCycle("yearly")}
            data-testid="button-billing-yearly"
          >
            Yearly
            <Badge variant="secondary" className="ml-2">
              Save 20%
            </Badge>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {publicPlans.map((plan) => {
          const price = billingCycle === "monthly" 
            ? parseFloat(plan.basePriceMonthly)
            : parseFloat(plan.basePriceYearly) / 12;
          
          const isPending = createSubscriptionMutation.isPending && selectedPlan === plan.id;
          const isPopular = plan.slug === "professional";

          return (
            <Card
              key={plan.id}
              className={`relative ${isPopular ? "border-primary shadow-lg" : ""}`}
              data-testid={`card-plan-${plan.slug}`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="default" data-testid="badge-popular">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  {getPlanIcon(plan.slug)}
                  <CardTitle data-testid={`text-plan-name-${plan.slug}`}>{plan.name}</CardTitle>
                </div>
                <CardDescription data-testid={`text-plan-description-${plan.slug}`}>
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold" data-testid={`text-plan-price-${plan.slug}`}>
                    ₹{price.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {billingCycle === "yearly" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Billed annually at ₹{parseFloat(plan.basePriceYearly).toFixed(0)}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{plan.maxUsers} users included</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{plan.maxClients} clients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{plan.maxWorkflows} workflows</span>
                  </li>
                  {Array.isArray(plan.features) && plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isPending || plan.slug === "free"}
                  data-testid={`button-subscribe-${plan.slug}`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : plan.slug === "free" ? (
                    "Current Plan"
                  ) : (
                    "Subscribe Now"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-16 text-center text-sm text-muted-foreground">
        <p>All plans include 14-day free trial. No credit card required.</p>
        <p className="mt-2">Payments powered by Razorpay. Secure and PCI-compliant.</p>
      </div>
    </div>
  );
}
