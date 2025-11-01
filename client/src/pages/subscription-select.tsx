import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";
import { Check, CreditCard, Sparkles, Zap, Crown, AlertCircle, Tag } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SubscriptionPlan, PricingRegion, Coupon } from "@shared/schema";

type PriceCalculation = {
  basePricePerMonth: number;
  regionalMultiplier: number;
  regionalPrice: number;
  seatCount: number;
  totalSeatsPrice: number;
  volumeDiscount: number;
  volumeDiscountAmount: number;
  subtotal: number;
  couponDiscount: number;
  couponDiscountAmount: number;
  finalPrice: number;
  currency: string;
  currencySymbol: string;
  billingCycle: string;
  breakdown: {
    basePlanPrice: string;
    regionalAdjustment: string;
    volumeDiscountApplied: string;
    couponDiscountApplied: string;
  };
};

export default function SubscriptionSelectPage() {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [seatCount, setSeatCount] = useState(1);
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [priceCalculation, setPriceCalculation] = useState<PriceCalculation | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const { data: regions = [], isLoading: regionsLoading } = useQuery<PricingRegion[]>({
    queryKey: ["/api/pricing-regions"],
  });

  // Auto-select first active plan
  useEffect(() => {
    if (plans.length > 0 && !selectedPlanId) {
      const activePlans = plans.filter(p => p.isActive);
      if (activePlans.length > 0) {
        setSelectedPlanId(activePlans[0].id);
      }
    }
  }, [plans, selectedPlanId]);

  // Auto-select default region or first active region
  useEffect(() => {
    if (regions.length > 0 && !selectedRegionId) {
      const activeRegions = regions.filter(r => r.isActive);
      if (activeRegions.length > 0) {
        setSelectedRegionId(activeRegions[0].id);
      }
    }
  }, [regions, selectedRegionId]);

  // Calculate price when inputs change
  useEffect(() => {
    if (selectedPlanId && selectedRegionId && seatCount > 0) {
      calculatePrice();
    }
  }, [selectedPlanId, billingCycle, seatCount, selectedRegionId, appliedCoupon]);

  const calculatePrice = async () => {
    try {
      const response = await apiRequest("POST", "/api/subscription-price/calculate", {
        planId: selectedPlanId,
        billingCycle,
        seatCount,
        regionId: selectedRegionId,
        couponCode: appliedCoupon?.code,
      });
      const priceData = await response.json();
      setPriceCalculation(priceData as PriceCalculation);
    } catch (error: any) {
      console.error("Price calculation error:", error);
      toast({ title: "Failed to calculate price", description: error.message, variant: "destructive" });
    }
  };

  const validateCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/coupons/validate", {
        code,
        planId: selectedPlanId,
        seatCount,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.valid) {
        setAppliedCoupon(data.coupon);
        toast({ title: "Coupon applied successfully", description: `${data.coupon.discountType === 'percentage' ? data.coupon.discountValue + '%' : data.coupon.discountValue} discount applied` });
      } else {
        toast({ title: "Invalid coupon", description: data.reason, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to validate coupon", description: error.message, variant: "destructive" });
    },
  });

  const handleApplyCoupon = () => {
    if (couponCode.trim()) {
      validateCouponMutation.mutate(couponCode.trim().toUpperCase());
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const handleSubscribe = () => {
    toast({ 
      title: "Checkout coming soon", 
      description: "Stripe checkout integration will be implemented next" 
    });
  };

  if (plansLoading || regionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const activePlans = plans.filter(p => p.isActive);
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const activeRegions = regions.filter(r => r.isActive);

  return (
    <div className="min-h-screen bg-background">
      <GradientHero
        title="Choose Your Plan"
        description="Select the perfect plan for your organization with flexible pricing"
        icon={CreditCard}
      />

      <div className="container mx-auto p-6 max-w-7xl">
        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <Card className="p-1">
            <RadioGroup
              value={billingCycle}
              onValueChange={(value) => setBillingCycle(value as "monthly" | "yearly")}
              className="flex gap-1"
            >
              <div>
                <RadioGroupItem value="monthly" id="monthly" className="peer sr-only" />
                <Label
                  htmlFor="monthly"
                  className="flex items-center justify-center rounded-md border-2 border-muted bg-popover px-6 py-3 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                  data-testid="radio-monthly"
                >
                  Monthly
                </Label>
              </div>
              <div>
                <RadioGroupItem value="yearly" id="yearly" className="peer sr-only" />
                <Label
                  htmlFor="yearly"
                  className="flex items-center justify-center rounded-md border-2 border-muted bg-popover px-6 py-3 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                  data-testid="radio-yearly"
                >
                  <span>Yearly</span>
                  <Badge variant="secondary" className="ml-2">Save 17%</Badge>
                </Label>
              </div>
            </RadioGroup>
          </Card>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {activePlans.map((plan: any) => {
            const isSelected = selectedPlanId === plan.id;
            const monthlyPrice = parseFloat(plan.basePriceMonthly || "0");
            const yearlyPrice = parseFloat(plan.basePriceYearly || "0");
            const displayPrice = billingCycle === "monthly" ? monthlyPrice : yearlyPrice / 12;
            const features = Array.isArray(plan.features) ? plan.features : [];

            return (
              <Card
                key={plan.id}
                className={`relative cursor-pointer transition-all ${isSelected ? 'border-primary border-2 shadow-lg' : 'hover-elevate'}`}
                onClick={() => setSelectedPlanId(plan.id)}
                data-testid={`card-plan-${plan.slug}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.name}</span>
                    {isSelected && <Check className="w-5 h-5 text-primary" />}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${displayPrice.toFixed(2)}</span>
                      <span className="text-muted-foreground">/user/month</span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed ${yearlyPrice.toFixed(2)}/year
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {features.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.minSeats && plan.minSeats > 1 && (
                    <Alert className="mt-4">
                      <AlertDescription>
                        Minimum {plan.minSeats} seats
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Configuration & Checkout */}
        {selectedPlan && (
          <Card>
            <CardHeader>
              <CardTitle>Configure Your Subscription</CardTitle>
              <CardDescription>
                Customize your plan with additional seats and apply discounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Seat Count */}
                <div className="space-y-2">
                  <Label htmlFor="seats">Number of Seats</Label>
                  <Input
                    id="seats"
                    type="number"
                    min={(selectedPlan as any).minSeats || 1}
                    value={seatCount}
                    onChange={(e) => setSeatCount(Math.max((selectedPlan as any).minSeats || 1, parseInt(e.target.value) || 1))}
                    data-testid="input-seat-count"
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum: {(selectedPlan as any).minSeats || 1} seats
                  </p>
                </div>

                {/* Region Selection */}
                <div className="space-y-2">
                  <Label htmlFor="region">Pricing Region</Label>
                  <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                    <SelectTrigger data-testid="select-region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeRegions.map((region: any) => (
                        <SelectItem key={region.id} value={region.id} data-testid={`region-${region.id}`}>
                          {region.name} ({region.currencySymbol} {region.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Regional pricing adjustments apply
                  </p>
                </div>
              </div>

              {/* Coupon Code */}
              <div className="space-y-2">
                <Label htmlFor="coupon">Coupon Code (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="coupon"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    disabled={!!appliedCoupon}
                    data-testid="input-coupon-code"
                  />
                  {appliedCoupon ? (
                    <Button
                      variant="outline"
                      onClick={handleRemoveCoupon}
                      data-testid="button-remove-coupon"
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim() || validateCouponMutation.isPending}
                      data-testid="button-apply-coupon"
                    >
                      <Tag className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                  )}
                </div>
                {appliedCoupon && (
                  <Alert>
                    <Check className="w-4 h-4" />
                    <AlertDescription>
                      Coupon "{appliedCoupon.code}" applied - {appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `${appliedCoupon.discountValue}`} discount
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Price Breakdown */}
              {priceCalculation && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Price Breakdown
                  </h3>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Plan Price ({billingCycle})</span>
                      <span data-testid="price-base">{priceCalculation.breakdown.basePlanPrice}</span>
                    </div>
                    {priceCalculation.regionalMultiplier !== 1 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Regional Adjustment ({(priceCalculation.regionalMultiplier * 100).toFixed(0)}%)</span>
                        <span data-testid="price-regional">{priceCalculation.breakdown.regionalAdjustment}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Seats ({priceCalculation.seatCount})</span>
                      <span data-testid="price-seats">{priceCalculation.currencySymbol}{priceCalculation.totalSeatsPrice.toFixed(2)}</span>
                    </div>
                    {priceCalculation.volumeDiscount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Volume Discount ({priceCalculation.volumeDiscount}%)</span>
                        <span data-testid="price-volume-discount">-{priceCalculation.currencySymbol}{priceCalculation.volumeDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {priceCalculation.couponDiscount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Coupon Discount</span>
                        <span data-testid="price-coupon-discount">-{priceCalculation.currencySymbol}{priceCalculation.couponDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span data-testid="price-total">{priceCalculation.currencySymbol}{priceCalculation.finalPrice.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Billed {billingCycle}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                size="lg"
                className="w-full"
                onClick={handleSubscribe}
                data-testid="button-subscribe"
              >
                <Crown className="w-5 h-5 mr-2" />
                Subscribe to {selectedPlan.name}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
