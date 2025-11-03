import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, Zap, Bot, Crown, Globe } from "lucide-react";
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
  includedSeats: number;
  isPublic: boolean;
  displayOrder: number;
}

interface PricingRegion {
  id: string;
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  priceMultiplier: string;
  isActive: boolean;
}

export default function SubscriptionPricing() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("USA");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "3year">("monthly");

  // Fetch subscription plans
  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  // Fetch pricing regions
  const { data: regions, isLoading: regionsLoading } = useQuery<PricingRegion[]>({
    queryKey: ["/api/pricing-regions"],
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async (planId: string) => {
      const plan = plans?.find(p => p.id === planId);
      const region = regions?.find(r => r.code === selectedRegion);
      if (!plan || !region) throw new Error("Plan or region not found");

      const basePrice = billingCycle === "monthly" 
        ? parseFloat(plan.basePriceMonthly)
        : billingCycle === "yearly"
        ? parseFloat(plan.basePriceYearly)
        : parseFloat(plan.basePriceYearly) * 3 * 0.9; // 3-year: 3 years total with 10% discount

      const amount = basePrice * parseFloat(region.priceMultiplier) * 100; // Convert to paise/cents

      // Create Razorpay order
      const order = await apiRequest("/api/razorpay/orders/create", {
        method: "POST",
        body: JSON.stringify({
          amount: Math.round(amount),
          currency: region.currency,
          receipt: `receipt_${Date.now()}`,
          notes: {
            planId,
            billingCycle,
            regionCode: region.code,
          },
        }),
      });

      return { order, plan, region };
    },
    onSuccess: ({ order, plan, region }) => {
      loadRazorpayScript(() => {
        openRazorpayCheckout(order, plan, region);
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

  const openRazorpayCheckout = (order: any, plan: SubscriptionPlan, region: PricingRegion) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
      amount: order.amount,
      currency: order.currency,
      name: "Accute",
      description: `${plan.name} Plan - ${billingCycle === "monthly" ? "Monthly" : billingCycle === "yearly" ? "Yearly" : "3-Year"}`,
      order_id: order.id,
      handler: async function (response: any) {
        try {
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
      case "core":
        return <Zap className="h-6 w-6" />;
      case "ai":
        return <Bot className="h-6 w-6" />;
      case "edge":
        return <Crown className="h-6 w-6" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  const calculatePrice = (plan: SubscriptionPlan) => {
    const region = regions?.find(r => r.code === selectedRegion);
    if (!region) return 0;

    const basePrice = billingCycle === "monthly" 
      ? parseFloat(plan.basePriceMonthly)
      : billingCycle === "yearly"
      ? parseFloat(plan.basePriceYearly) / 12 // Show monthly equivalent
      : (parseFloat(plan.basePriceYearly) * 3 * 0.9) / 12; // 3-year: 3 years with 10% discount, shown monthly

    return basePrice * parseFloat(region.priceMultiplier);
  };

  const formatPrice = (price: number, currencySymbol: string) => {
    return `${currencySymbol}${Math.round(price).toLocaleString()}`;
  };

  if (plansLoading || regionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-plans" />
      </div>
    );
  }

  const publicPlans = plans?.filter(p => p.isPublic).sort((a, b) => a.displayOrder - b.displayOrder) || [];
  const activeRegions = regions?.filter(r => r.isActive) || [];
  const currentRegion = regions?.find(r => r.code === selectedRegion);
  const savings = billingCycle === "yearly" ? 20 : billingCycle === "3year" ? 30 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-12 px-4" data-testid="page-subscription-pricing">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="text-pricing-title">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-lg mb-8" data-testid="text-pricing-subtitle">
            AI-native accounting automation for international markets
          </p>

          {/* Region Selector */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-[250px]" data-testid="select-region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeRegions.map((region) => (
                  <SelectItem key={region.id} value={region.code}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Billing Cycle Selector */}
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
            <Button
              variant={billingCycle === "3year" ? "default" : "outline"}
              onClick={() => setBillingCycle("3year")}
              data-testid="button-billing-3year"
            >
              3 Years
              <Badge variant="secondary" className="ml-2">
                Save 30%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {publicPlans.map((plan) => {
            const price = calculatePrice(plan);
            const isPending = createSubscriptionMutation.isPending && selectedPlan === plan.id;
            const isPopular = plan.slug === "ai";

            return (
              <Card
                key={plan.id}
                className={`relative ${isPopular ? "border-primary shadow-lg scale-105" : ""}`}
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
                      {currentRegion && formatPrice(price, currentRegion.currencySymbol)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                    {billingCycle !== "monthly" && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {savings}% savings vs monthly
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        {plan.maxUsers === -1 ? "Unlimited" : plan.maxUsers} users
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        {plan.maxClients === -1 ? "Unlimited" : plan.maxClients} clients
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">
                        {plan.maxWorkflows === -1 ? "Unlimited" : plan.maxWorkflows} workflows
                      </span>
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
                    disabled={isPending}
                    data-testid={`button-subscribe-${plan.slug}`}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Subscribe Now"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-muted-foreground space-y-2">
          <p>All plans include 14-day free trial. No credit card required.</p>
          <p>Payments powered by Razorpay. Secure and PCI-compliant.</p>
          <p className="font-semibold mt-4">Featuring Roundtable AI Orchestration - 2 Years Ahead of Market</p>
        </div>
      </div>
    </div>
  );
}
