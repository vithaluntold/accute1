import type {
  SubscriptionPlan,
  PricingRegion,
  PlanVolumeTier,
  Coupon,
} from "./schema";

/**
 * Price calculation result with detailed breakdown
 */
export interface PriceCalculation {
  // Base prices (before seats and discounts)
  basePriceMonthly: number;
  basePriceYearly: number;

  // Per-seat prices
  perSeatPriceMonthly: number;
  perSeatPriceYearly: number;

  // Calculated totals
  totalBeforeDiscount: number;
  volumeDiscount: number;
  couponDiscount: number;
  totalDiscount: number;
  finalPrice: number;

  // Breakdown details
  seatCount: number;
  additionalSeats: number; // Seats beyond included
  billingCycle: "monthly" | "yearly";
  currency: string;
  currencySymbol: string;
  regionMultiplier: number;

  // Applied discounts
  appliedCoupon?: {
    code: string;
    discountType: string;
    discountValue: number;
  };
  volumeTier?: {
    minSeats: number;
    maxSeats: number | null;
    discountPercentage: number;
  };

  // Snapshot for storage
  snapshot: PriceSnapshot;
}

/**
 * Immutable price snapshot stored with subscription
 */
export interface PriceSnapshot {
  planId: string;
  planName: string;
  planSlug: string;
  seatCount: number;
  billingCycle: "monthly" | "yearly";
  currency: string;
  currencySymbol: string;
  regionCode?: string;
  regionMultiplier: number;
  basePriceUSD: number;
  perSeatPriceUSD: number;
  basePrice: number;
  perSeatPrice: number;
  volumeDiscount: number;
  couponDiscount: number;
  totalDiscount: number;
  finalPrice: number;
  calculatedAt: string;
}

/**
 * Shared pricing service for subscription calculations
 */
export class PricingService {
  /**
   * Calculate subscription price with all factors
   */
  static calculatePrice(params: {
    plan: SubscriptionPlan;
    billingCycle: "monthly" | "yearly";
    seatCount: number;
    region?: PricingRegion;
    volumeTiers?: PlanVolumeTier[];
    coupon?: Coupon;
  }): PriceCalculation {
    const {
      plan,
      billingCycle,
      seatCount,
      region,
      volumeTiers = [],
      coupon,
    } = params;

    // Validate seat count
    if (seatCount < 1) {
      throw new Error("Seat count must be at least 1");
    }

    // Get base prices in USD
    const basePriceUSD =
      billingCycle === "monthly"
        ? Number(plan.basePriceMonthly)
        : Number(plan.basePriceYearly);
    const perSeatPriceUSD =
      billingCycle === "monthly"
        ? Number(plan.perSeatPriceMonthly)
        : Number(plan.perSeatPriceYearly);

    // Apply regional multiplier
    const regionMultiplier = region ? Number(region.priceMultiplier) : 1.0;
    const currency = region?.currency || "USD";
    const currencySymbol = region?.currencySymbol || "$";

    const basePrice = basePriceUSD * regionMultiplier;
    const perSeatPrice = perSeatPriceUSD * regionMultiplier;

    // Calculate additional seats (beyond included)
    const additionalSeats = Math.max(0, seatCount - plan.includedSeats);

    // Calculate seat cost before volume discount
    const seatCost = additionalSeats * perSeatPrice;

    // Calculate total before discounts
    const totalBeforeDiscount = basePrice + seatCost;

    // Apply volume discount (if applicable)
    let volumeDiscount = 0;
    let appliedVolumeTier: PlanVolumeTier | undefined;

    if (volumeTiers.length > 0 && additionalSeats > 0) {
      // Find applicable volume tier
      const applicableTier = this.findVolumeTier(
        seatCount,
        volumeTiers
      );

      if (applicableTier) {
        const discountPercentage = Number(applicableTier.discountPercentage);
        volumeDiscount = (seatCost * discountPercentage) / 100;
        appliedVolumeTier = applicableTier;
      }
    }

    // Calculate total after volume discount
    const totalAfterVolumeDiscount = totalBeforeDiscount - volumeDiscount;

    // Apply coupon discount (if applicable and valid)
    let couponDiscount = 0;
    let appliedCoupon: PriceCalculation["appliedCoupon"];

    if (coupon && this.isCouponValid(coupon, plan.id, seatCount)) {
      const discountValue = Number(coupon.discountValue);

      if (coupon.discountType === "percentage") {
        couponDiscount = (totalAfterVolumeDiscount * discountValue) / 100;
      } else if (coupon.discountType === "fixed_amount") {
        // Fixed amount discount (in USD, then converted to local currency)
        couponDiscount = discountValue * regionMultiplier;
      }

      // Ensure discount doesn't exceed total
      couponDiscount = Math.min(couponDiscount, totalAfterVolumeDiscount);

      appliedCoupon = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: discountValue,
      };
    }

    // Calculate final price
    const totalDiscount = volumeDiscount + couponDiscount;
    const finalPrice = Math.max(0, totalBeforeDiscount - totalDiscount);

    // Generate snapshot
    const snapshot: PriceSnapshot = {
      planId: plan.id,
      planName: plan.name,
      planSlug: plan.slug,
      seatCount,
      billingCycle,
      currency,
      currencySymbol,
      regionCode: region?.id,
      regionMultiplier,
      basePriceUSD,
      perSeatPriceUSD,
      basePrice,
      perSeatPrice,
      volumeDiscount,
      couponDiscount,
      totalDiscount,
      finalPrice,
      calculatedAt: new Date().toISOString(),
    };

    return {
      basePriceMonthly: Number(plan.basePriceMonthly),
      basePriceYearly: Number(plan.basePriceYearly),
      perSeatPriceMonthly: Number(plan.perSeatPriceMonthly),
      perSeatPriceYearly: Number(plan.perSeatPriceYearly),
      totalBeforeDiscount,
      volumeDiscount,
      couponDiscount,
      totalDiscount,
      finalPrice,
      seatCount,
      additionalSeats,
      billingCycle,
      currency,
      currencySymbol,
      regionMultiplier,
      appliedCoupon,
      volumeTier: appliedVolumeTier
        ? {
            minSeats: appliedVolumeTier.minSeats,
            maxSeats: appliedVolumeTier.maxSeats ?? null,
            discountPercentage: Number(appliedVolumeTier.discountPercentage),
          }
        : undefined,
      snapshot,
    };
  }

  /**
   * Find applicable volume tier for given seat count
   */
  private static findVolumeTier(
    seatCount: number,
    tiers: PlanVolumeTier[]
  ): PlanVolumeTier | undefined {
    // Sort tiers by minSeats descending
    const sortedTiers = [...tiers].sort((a, b) => b.minSeats - a.minSeats);

    // Find the first tier where seatCount >= minSeats and (maxSeats is null or seatCount <= maxSeats)
    return sortedTiers.find((tier) => {
      const meetsMin = seatCount >= tier.minSeats;
      const meetsMax = tier.maxSeats === null || seatCount <= tier.maxSeats;
      return meetsMin && meetsMax;
    });
  }

  /**
   * Validate if a coupon can be applied
   */
  static isCouponValid(
    coupon: Coupon,
    planId: string,
    seatCount: number
  ): boolean {
    // Check if coupon is active
    if (!coupon.isActive) {
      return false;
    }

    // Check validity period
    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;

    if (now < validFrom) {
      return false;
    }

    if (validUntil && now > validUntil) {
      return false;
    }

    // Check redemption limits
    if (
      coupon.maxRedemptions !== null &&
      coupon.currentRedemptions >= coupon.maxRedemptions
    ) {
      return false;
    }

    // Check plan applicability
    const applicablePlans = coupon.applicablePlans as string[] | null;
    if (applicablePlans && applicablePlans.length > 0) {
      if (!applicablePlans.includes(planId)) {
        return false;
      }
    }

    // Check minimum seats
    if (coupon.minimumSeats !== null && seatCount < coupon.minimumSeats) {
      return false;
    }

    return true;
  }

  /**
   * Validate coupon code and return coupon details with validation result
   */
  static validateCoupon(
    coupon: Coupon | null,
    planId: string,
    seatCount: number
  ): { valid: boolean; message: string; coupon?: Coupon } {
    if (!coupon) {
      return {
        valid: false,
        message: "Coupon not found",
      };
    }

    if (!coupon.isActive) {
      return {
        valid: false,
        message: "This coupon is no longer active",
        coupon,
      };
    }

    const now = new Date();
    const validFrom = new Date(coupon.validFrom);
    const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;

    if (now < validFrom) {
      return {
        valid: false,
        message: `This coupon is not yet valid. It will be available from ${validFrom.toLocaleDateString()}`,
        coupon,
      };
    }

    if (validUntil && now > validUntil) {
      return {
        valid: false,
        message: `This coupon expired on ${validUntil.toLocaleDateString()}`,
        coupon,
      };
    }

    if (
      coupon.maxRedemptions !== null &&
      coupon.currentRedemptions >= coupon.maxRedemptions
    ) {
      return {
        valid: false,
        message: "This coupon has reached its redemption limit",
        coupon,
      };
    }

    const applicablePlans = coupon.applicablePlans as string[] | null;
    if (applicablePlans && applicablePlans.length > 0) {
      if (!applicablePlans.includes(planId)) {
        return {
          valid: false,
          message: "This coupon is not applicable to the selected plan",
          coupon,
        };
      }
    }

    if (coupon.minimumSeats !== null && seatCount < coupon.minimumSeats) {
      return {
        valid: false,
        message: `This coupon requires a minimum of ${coupon.minimumSeats} seats`,
        coupon,
      };
    }

    return {
      valid: true,
      message: "Coupon applied successfully",
      coupon,
    };
  }

  /**
   * Format price with currency symbol
   */
  static formatPrice(
    amount: number,
    currency: string = "USD",
    currencySymbol: string = "$"
  ): string {
    // Round to 2 decimal places
    const rounded = Math.round(amount * 100) / 100;

    // Format with thousands separator
    const formatted = rounded.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Add currency symbol
    if (currency === "USD" || currency === "EUR" || currency === "GBP") {
      return `${currencySymbol}${formatted}`;
    } else {
      // For other currencies, put symbol after amount
      return `${formatted} ${currencySymbol}`;
    }
  }

  /**
   * Calculate potential savings (yearly vs monthly)
   */
  static calculateYearlySavings(
    monthlyPrice: number,
    yearlyPrice: number
  ): { amount: number; percentage: number } {
    const monthlyTotal = monthlyPrice * 12;
    const savings = monthlyTotal - yearlyPrice;
    const percentage = (savings / monthlyTotal) * 100;

    return {
      amount: Math.max(0, savings),
      percentage: Math.max(0, percentage),
    };
  }
}
