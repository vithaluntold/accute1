/**
 * Pricing Engine
 * Calculates subscription pricing with PPP multipliers, volume discounts, and proration
 */

export interface PricingRegion {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  priceMultiplier: number; // PPP multiplier (1.0 = baseline, 0.35 = 65% discount)
}

export interface SubscriptionPlan {
  slug: string;
  name: string;
  basePriceMonthly: number; // USD baseline price
  basePriceYearly: number; // USD baseline price
  perSeatPriceMonthly: number;
  perSeatPriceYearly: number;
  includedSeats: number;
}

export interface PricingInput {
  plan: SubscriptionPlan;
  region: PricingRegion;
  billingCycle: 'monthly' | 'yearly' | '3_year';
  seatCount: number;
  couponDiscount?: number; // Percentage discount (0-100)
}

export interface PricingBreakdown {
  // Base pricing
  basePrice: number;
  perSeatPrice: number;
  includedSeats: number;
  additionalSeats: number;
  
  // Calculations
  basePriceTotal: number;
  additionalSeatsTotal: number;
  subtotal: number;
  
  // Discounts
  billingCycleDiscount: number; // Percentage (0-18%)
  billingCycleDiscountAmount: number;
  couponDiscount: number; // Percentage
  couponDiscountAmount: number;
  volumeDiscount: number; // Percentage
  volumeDiscountAmount: number;
  totalDiscount: number;
  
  // Final pricing
  total: number;
  totalPerMonth: number; // For display (even if billed yearly/3-year)
  
  // Metadata
  currency: string;
  currencySymbol: string;
  billingCycle: string;
  regionCode: string;
  pppMultiplier: number;
}

export class PricingEngine {
  /**
   * Regional pricing data with PPP multipliers
   * Based on PENETRATION_PRICING_STRATEGY.md
   */
  private readonly REGIONS: Record<string, PricingRegion> = {
    US: {
      code: 'US',
      name: 'United States',
      currency: 'USD',
      currencySymbol: '$',
      priceMultiplier: 1.0,
    },
    IN: {
      code: 'IN',
      name: 'India',
      currency: 'INR',
      currencySymbol: '₹',
      priceMultiplier: 0.35, // 65% discount for purchasing power parity
    },
    AE: {
      code: 'AE',
      name: 'UAE',
      currency: 'AED',
      currencySymbol: 'د.إ',
      priceMultiplier: 1.0, // Premium market
    },
    TR: {
      code: 'TR',
      name: 'Turkey',
      currency: 'TRY',
      currencySymbol: '₺',
      priceMultiplier: 0.40, // 60% discount for emerging market
    },
    GB: {
      code: 'GB',
      name: 'United Kingdom',
      currency: 'GBP',
      currencySymbol: '£',
      priceMultiplier: 0.79,
    },
    EU: {
      code: 'EU',
      name: 'European Union',
      currency: 'EUR',
      currencySymbol: '€',
      priceMultiplier: 0.93,
    },
    AU: {
      code: 'AU',
      name: 'Australia',
      currency: 'AUD',
      currencySymbol: 'A$',
      priceMultiplier: 1.52,
    },
    CA: {
      code: 'CA',
      name: 'Canada',
      currency: 'CAD',
      currencySymbol: 'C$',
      priceMultiplier: 1.39,
    },
    SG: {
      code: 'SG',
      name: 'Singapore',
      currency: 'SGD',
      currencySymbol: 'S$',
      priceMultiplier: 1.35,
    },
    GLOBAL: {
      code: 'GLOBAL',
      name: 'Rest of World',
      currency: 'USD',
      currencySymbol: '$',
      priceMultiplier: 0.70, // 30% discount for other markets
    },
  };

  /**
   * Billing cycle discounts
   * Monthly: 20% margin (no discount)
   * Yearly: 15% margin (11% discount vs monthly)
   * 3-Year: 12% margin (18% discount vs monthly)
   */
  private readonly BILLING_DISCOUNTS: Record<string, number> = {
    monthly: 0, // No discount
    yearly: 11, // 11% discount
    '3_year': 18, // 18% discount
  };

  /**
   * Volume discount tiers for additional seats
   */
  private readonly VOLUME_TIERS = [
    { minSeats: 1, maxSeats: 10, discount: 0 }, // No discount for 1-10 seats
    { minSeats: 11, maxSeats: 25, discount: 5 }, // 5% discount for 11-25 seats
    { minSeats: 26, maxSeats: 50, discount: 10 }, // 10% discount for 26-50 seats
    { minSeats: 51, maxSeats: null, discount: 15 }, // 15% discount for 51+ seats
  ];

  /**
   * Calculate complete pricing breakdown
   */
  calculatePrice(input: PricingInput): PricingBreakdown {
    const {
 plan,
      region,
      billingCycle,
      seatCount,
      couponDiscount = 0,
    } = input;

    // Determine base monthly price based on billing cycle
    const baseMonthly = billingCycle === 'yearly' || billingCycle === '3_year'
      ? plan.basePriceYearly
      : plan.basePriceMonthly;

    const perSeatMonthly = billingCycle === 'yearly' || billingCycle === '3_year'
      ? plan.perSeatPriceYearly
      : plan.perSeatPriceMonthly;

    // Apply regional PPP multiplier
    const basePrice = this.applyRegionalPricing(baseMonthly, region.priceMultiplier);
    const perSeatPrice = this.applyRegionalPricing(perSeatMonthly, region.priceMultiplier);

    // Calculate seats
    const includedSeats = plan.includedSeats;
    const additionalSeats = Math.max(0, seatCount - includedSeats);

    // Calculate subtotal before discounts
    const basePriceTotal = basePrice;
    const additionalSeatsTotal = additionalSeats * perSeatPrice;
    let subtotal = basePriceTotal + additionalSeatsTotal;

    // Apply billing cycle discount
    const billingDiscountPercent = this.BILLING_DISCOUNTS[billingCycle] || 0;
    const billingDiscountAmount = (subtotal * billingDiscountPercent) / 100;
    subtotal -= billingDiscountAmount;

    // Apply volume discount (on additional seats only)
    const volumeDiscountPercent = this.getVolumeDiscount(seatCount);
    const volumeDiscountAmount = (additionalSeatsTotal * volumeDiscountPercent) / 100;
    subtotal -= volumeDiscountAmount;

    // Apply coupon discount
    const couponDiscountAmount = (subtotal * couponDiscount) / 100;
    subtotal -= couponDiscountAmount;

    // Calculate total discount
    const totalDiscount = billingDiscountAmount + volumeDiscountAmount + couponDiscountAmount;

    // Final total (per month)
    const totalPerMonth = Math.round(subtotal * 100) / 100; // Round to 2 decimals

    // Calculate total billing amount based on cycle
    let total: number;
    if (billingCycle === 'monthly') {
      total = totalPerMonth;
    } else if (billingCycle === 'yearly') {
      total = totalPerMonth * 12;
    } else if (billingCycle === '3_year') {
      total = totalPerMonth * 36;
    } else {
      total = totalPerMonth;
    }

    return {
      basePrice,
      perSeatPrice,
      includedSeats,
      additionalSeats,
      basePriceTotal,
      additionalSeatsTotal,
      subtotal: basePriceTotal + additionalSeatsTotal,
      billingCycleDiscount: billingDiscountPercent,
      billingCycleDiscountAmount: billingDiscountAmount,
      couponDiscount,
      couponDiscountAmount,
      volumeDiscount: volumeDiscountPercent,
      volumeDiscountAmount,
      totalDiscount,
      total: Math.round(total * 100) / 100,
      totalPerMonth,
      currency: region.currency,
      currencySymbol: region.currencySymbol,
      billingCycle,
      regionCode: region.code,
      pppMultiplier: region.priceMultiplier,
    };
  }

  /**
   * Calculate proration for plan changes mid-cycle
   */
  calculateProration(params: {
    oldPlan: SubscriptionPlan;
    newPlan: SubscriptionPlan;
    region: PricingRegion;
    billingCycle: 'monthly' | 'yearly' | '3_year';
    oldSeats: number;
    newSeats: number;
    daysRemainingInCycle: number;
    totalDaysInCycle: number;
  }): {
    credit: number; // Amount to credit from old plan
    charge: number; // Amount to charge for new plan
    netAmount: number; // Net amount to charge (charge - credit)
    description: string;
  } {
    const {
      oldPlan,
      newPlan,
      region,
      billingCycle,
      oldSeats,
      newSeats,
      daysRemainingInCycle,
      totalDaysInCycle,
    } = params;

    // Calculate remaining fraction of billing cycle
    const remainingFraction = daysRemainingInCycle / totalDaysInCycle;

    // Calculate old plan monthly cost
    const oldPricing = this.calculatePrice({
      plan: oldPlan,
      region,
      billingCycle,
      seatCount: oldSeats,
    });

    // Calculate new plan monthly cost
    const newPricing = this.calculatePrice({
      plan: newPlan,
      region,
      billingCycle,
      seatCount: newSeats,
    });

    // Calculate credit for unused time on old plan
    const credit = oldPricing.totalPerMonth * remainingFraction;

    // Calculate charge for new plan for remaining time
    const charge = newPricing.totalPerMonth * remainingFraction;

    // Net amount (positive = charge user, negative = credit user)
    const netAmount = charge - credit;

    // Description
    let description = '';
    if (netAmount > 0) {
      description = `Upgrade from ${oldPlan.name} to ${newPlan.name} (${Math.round(remainingFraction * 100)}% of billing cycle remaining)`;
    } else if (netAmount < 0) {
      description = `Downgrade from ${oldPlan.name} to ${newPlan.name} (${Math.round(remainingFraction * 100)}% of billing cycle remaining) - Credit applied`;
    } else {
      description = `Plan change from ${oldPlan.name} to ${newPlan.name} (no proration needed)`;
    }

    return {
      credit: Math.round(credit * 100) / 100,
      charge: Math.round(charge * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      description,
    };
  }

  /**
   * Apply regional pricing multiplier
   */
  private applyRegionalPricing(basePrice: number, multiplier: number): number {
    return Math.round(basePrice * multiplier * 100) / 100;
  }

  /**
   * Get volume discount percentage based on seat count
   */
  private getVolumeDiscount(seatCount: number): number {
    for (const tier of this.VOLUME_TIERS) {
      if (seatCount >= tier.minSeats && (tier.maxSeats === null || seatCount <= tier.maxSeats)) {
        return tier.discount;
      }
    }
    return 0;
  }

  /**
   * Get region by country code
   */
  getRegion(countryCode: string): PricingRegion {
    return this.REGIONS[countryCode.toUpperCase()] || this.REGIONS.GLOBAL;
  }

  /**
   * Get all available regions
   */
  getAllRegions(): PricingRegion[] {
    return Object.values(this.REGIONS);
  }

  /**
   * Format price for display
   */
  formatPrice(amount: number, currency: string, currencySymbol: string): string {
    // Format with proper currency symbol and decimal places
    const formatted = amount.toFixed(2);
    
    // Currency-specific formatting
    if (currency === 'USD' || currency === 'AUD' || currency === 'CAD' || currency === 'SGD') {
      return `${currencySymbol}${formatted}`;
    } else if (currency === 'EUR' || currency === 'GBP') {
      return `${currencySymbol}${formatted}`;
    } else if (currency === 'INR') {
      // Indian Rupee formatting with lakhs/crores
      return `${currencySymbol}${formatted}`;
    } else if (currency === 'AED' || currency === 'TRY') {
      return `${formatted} ${currencySymbol}`;
    }
    
    return `${currencySymbol}${formatted}`;
  }
}

// Export singleton instance
export const pricingEngine = new PricingEngine();
