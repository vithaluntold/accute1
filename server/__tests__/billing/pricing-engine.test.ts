/**
 * Pricing Engine Unit Tests
 * Six Sigma Quality - Target: 60 tests
 * Success Criteria: 100% pricing accuracy across all regions
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { pricingEngine, PricingEngine } from '../../pricing-engine';

describe('Pricing Engine - Regional PPP Multipliers', () => {
  test('TC-PRICING-001: USA baseline pricing (1.0x multiplier)', () => {
    const region = pricingEngine.getRegion('US');
    
    expect(region.code).toBe('US');
    expect(region.priceMultiplier).toBe(1.0);
    expect(region.currency).toBe('USD');
    expect(region.currencySymbol).toBe('$');
  });

  test('TC-PRICING-002: India PPP pricing (0.35x multiplier, 65% discount)', () => {
    const region = pricingEngine.getRegion('IN');
    
    expect(region.code).toBe('IN');
    expect(region.priceMultiplier).toBe(0.35);
    expect(region.currency).toBe('INR');
    expect(region.currencySymbol).toBe('₹');
  });

  test('TC-PRICING-003: Turkey PPP pricing (0.40x multiplier, 60% discount)', () => {
    const region = pricingEngine.getRegion('TR');
    
    expect(region.code).toBe('TR');
    expect(region.priceMultiplier).toBe(0.40);
    expect(region.currency).toBe('TRY');
    expect(region.currencySymbol).toBe('₺');
  });

  test('TC-PRICING-004: UAE premium pricing (1.0x multiplier)', () => {
    const region = pricingEngine.getRegion('AE');
    
    expect(region.code).toBe('AE');
    expect(region.priceMultiplier).toBe(1.0);
    expect(region.currency).toBe('AED');
    expect(region.currencySymbol).toBe('د.إ');
  });

  test('TC-PRICING-005: UK pricing (0.79x multiplier)', () => {
    const region = pricingEngine.getRegion('GB');
    
    expect(region.priceMultiplier).toBe(0.79);
    expect(region.currency).toBe('GBP');
  });

  test('TC-PRICING-006: EU pricing (0.93x multiplier)', () => {
    const region = pricingEngine.getRegion('EU');
    
    expect(region.priceMultiplier).toBe(0.93);
    expect(region.currency).toBe('EUR');
  });

  test('TC-PRICING-007: Australia pricing (1.52x multiplier)', () => {
    const region = pricingEngine.getRegion('AU');
    
    expect(region.priceMultiplier).toBe(1.52);
    expect(region.currency).toBe('AUD');
  });

  test('TC-PRICING-008: Canada pricing (1.39x multiplier)', () => {
    const region = pricingEngine.getRegion('CA');
    
    expect(region.priceMultiplier).toBe(1.39);
    expect(region.currency).toBe('CAD');
  });

  test('TC-PRICING-009: Singapore pricing (1.35x multiplier)', () => {
    const region = pricingEngine.getRegion('SG');
    
    expect(region.priceMultiplier).toBe(1.35);
    expect(region.currency).toBe('SGD');
  });

  test('TC-PRICING-010: Unknown region defaults to GLOBAL (0.70x, 30% discount)', () => {
    const region = pricingEngine.getRegion('XX');
    
    expect(region.code).toBe('GLOBAL');
    expect(region.priceMultiplier).toBe(0.70);
    expect(region.currency).toBe('USD');
  });
});

describe('Pricing Engine - Core Plan Calculations', () => {
  const corePlan = {
    slug: 'core',
    name: 'Core',
    basePriceMonthly: 9.00,
    basePriceYearly: 8.00,
    perSeatPriceMonthly: 9.00,
    perSeatPriceYearly: 8.00,
    includedSeats: 1,
  };

  test('TC-PRICING-011: Core Plan - USA monthly pricing for 1 seat', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: corePlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    expect(pricing.basePrice).toBe(9.00);
    expect(pricing.additionalSeats).toBe(0);
    expect(pricing.totalPerMonth).toBe(9.00);
    expect(pricing.total).toBe(9.00);
    expect(pricing.currency).toBe('USD');
  });

  test('TC-PRICING-012: Core Plan - USA yearly pricing with 11% discount', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: corePlan,
      region,
      billingCycle: 'yearly',
      seatCount: 1,
    });

    expect(pricing.basePrice).toBe(8.00);
    expect(pricing.billingCycleDiscount).toBe(11);
    expect(pricing.totalPerMonth).toBeCloseTo(7.12, 2); // $8 - 11% = $7.12/mo
    expect(pricing.total).toBeCloseTo(85.44, 2); // $7.12 * 12
  });

  test('TC-PRICING-013: Core Plan - India monthly pricing (0.35x multiplier)', () => {
    const region = pricingEngine.getRegion('IN');
    const pricing = pricingEngine.calculatePrice({
      plan: corePlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    expect(pricing.basePrice).toBeCloseTo(3.15, 2); // $9 * 0.35
    expect(pricing.totalPerMonth).toBeCloseTo(3.15, 2);
    expect(pricing.currency).toBe('INR');
    expect(pricing.pppMultiplier).toBe(0.35);
  });

  test('TC-PRICING-014: Core Plan - Turkey monthly pricing (0.40x multiplier)', () => {
    const region = pricingEngine.getRegion('TR');
    const pricing = pricingEngine.calculatePrice({
      plan: corePlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    expect(pricing.basePrice).toBeCloseTo(3.60, 2); // $9 * 0.40
    expect(pricing.totalPerMonth).toBeCloseTo(3.60, 2);
    expect(pricing.currency).toBe('TRY');
  });

  test('TC-PRICING-015: Core Plan - 3-year pricing with 18% discount', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: corePlan,
      region,
      billingCycle: '3_year',
      seatCount: 1,
    });

    expect(pricing.billingCycleDiscount).toBe(18);
    expect(pricing.totalPerMonth).toBeCloseTo(6.56, 2); // $8 - 18% = $6.56/mo
    expect(pricing.total).toBeCloseTo(236.16, 2); // $6.56 * 36 months
  });
});

describe('Pricing Engine - AI Plan Calculations', () => {
  const aiPlan = {
    slug: 'ai',
    name: 'AI',
    basePriceMonthly: 23.00,
    basePriceYearly: 21.00,
    perSeatPriceMonthly: 23.00,
    perSeatPriceYearly: 21.00,
    includedSeats: 1,
  };

  test('TC-PRICING-016: AI Plan - USA monthly pricing for 1 seat', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    expect(pricing.totalPerMonth).toBe(23.00);
    expect(pricing.total).toBe(23.00);
  });

  test('TC-PRICING-017: AI Plan - USA yearly pricing ($21/mo)', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'yearly',
      seatCount: 1,
    });

    expect(pricing.basePrice).toBe(21.00);
    expect(pricing.totalPerMonth).toBeCloseTo(18.69, 2); // $21 - 11% discount
    expect(pricing.total).toBeCloseTo(224.28, 2); // $18.69 * 12
  });

  test('TC-PRICING-018: AI Plan - India monthly pricing (0.35x)', () => {
    const region = pricingEngine.getRegion('IN');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    expect(pricing.basePrice).toBeCloseTo(8.05, 2); // $23 * 0.35
    expect(pricing.totalPerMonth).toBeCloseTo(8.05, 2);
    expect(pricing.currency).toBe('INR');
  });
});

describe('Pricing Engine - Edge Plan Calculations', () => {
  const edgePlan = {
    slug: 'edge',
    name: 'Edge',
    basePriceMonthly: 38.00,
    basePriceYearly: 35.00,
    perSeatPriceMonthly: 38.00,
    perSeatPriceYearly: 35.00,
    includedSeats: 1,
  };

  test('TC-PRICING-019: Edge Plan - USA monthly pricing', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: edgePlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    expect(pricing.totalPerMonth).toBe(38.00);
  });

  test('TC-PRICING-020: Edge Plan - UAE premium pricing (1.0x)', () => {
    const region = pricingEngine.getRegion('AE');
    const pricing = pricingEngine.calculatePrice({
      plan: edgePlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    expect(pricing.basePrice).toBe(38.00); // Same as USA
    expect(pricing.currency).toBe('AED');
  });
});

describe('Pricing Engine - Multi-Seat Calculations', () => {
  const aiPlan = {
    slug: 'ai',
    name: 'AI',
    basePriceMonthly: 23.00,
    basePriceYearly: 21.00,
    perSeatPriceMonthly: 23.00,
    perSeatPriceYearly: 21.00,
    includedSeats: 1,
  };

  test('TC-PRICING-021: 5 seats - no volume discount', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 5,
    });

    expect(pricing.includedSeats).toBe(1);
    expect(pricing.additionalSeats).toBe(4);
    expect(pricing.additionalSeatsTotal).toBe(92.00); // 4 * $23
    expect(pricing.volumeDiscount).toBe(0); // No discount for 1-10 seats
    expect(pricing.totalPerMonth).toBe(115.00); // $23 base + $92 additional
  });

  test('TC-PRICING-022: 15 seats - 5% volume discount (11-25 tier)', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 15,
    });

    expect(pricing.additionalSeats).toBe(14);
    expect(pricing.additionalSeatsTotal).toBe(322.00); // 14 * $23
    expect(pricing.volumeDiscount).toBe(5);
    expect(pricing.volumeDiscountAmount).toBeCloseTo(16.10, 2); // 5% of $322
    expect(pricing.totalPerMonth).toBeCloseTo(328.90, 2); // $23 + $322 - $16.10
  });

  test('TC-PRICING-023: 30 seats - 10% volume discount (26-50 tier)', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 30,
    });

    expect(pricing.additionalSeats).toBe(29);
    expect(pricing.volumeDiscount).toBe(10);
    expect(pricing.volumeDiscountAmount).toBeCloseTo(66.70, 2); // 10% of 29 * $23
  });

  test('TC-PRICING-024: 60 seats - 15% volume discount (51+ tier)', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 60,
    });

    expect(pricing.additionalSeats).toBe(59);
    expect(pricing.volumeDiscount).toBe(15);
    expect(pricing.volumeDiscountAmount).toBeCloseTo(203.55, 2); // 15% of 59 * $23
  });
});

describe('Pricing Engine - Coupon Discounts', () => {
  const aiPlan = {
    slug: 'ai',
    name: 'AI',
    basePriceMonthly: 23.00,
    basePriceYearly: 21.00,
    perSeatPriceMonthly: 23.00,
    perSeatPriceYearly: 21.00,
    includedSeats: 1,
  };

  test('TC-PRICING-025: 10% coupon discount applied', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
      couponDiscount: 10,
    });

    expect(pricing.couponDiscount).toBe(10);
    expect(pricing.couponDiscountAmount).toBeCloseTo(2.30, 2); // 10% of $23
    expect(pricing.totalPerMonth).toBeCloseTo(20.70, 2); // $23 - $2.30
  });

  test('TC-PRICING-026: 25% coupon discount applied', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
      couponDiscount: 25,
    });

    expect(pricing.couponDiscountAmount).toBeCloseTo(5.75, 2); // 25% of $23
    expect(pricing.totalPerMonth).toBeCloseTo(17.25, 2);
  });

  test('TC-PRICING-027: Coupon stacks with billing cycle discount', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'yearly',
      seatCount: 1,
      couponDiscount: 10,
    });

    // Yearly: $21/mo base
    // - 11% billing discount = $18.69/mo
    // - 10% coupon on $18.69 = $1.87
    // Final: $16.82/mo
    expect(pricing.billingCycleDiscount).toBe(11);
    expect(pricing.couponDiscount).toBe(10);
    expect(pricing.totalPerMonth).toBeCloseTo(16.82, 1);
  });

  test('TC-PRICING-028: Coupon stacks with volume discount', () => {
    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 15, // 5% volume discount tier
      couponDiscount: 10,
    });

    // Base: $23, Additional 14 seats: $322
    // Volume discount 5%: -$16.10
    // Subtotal: $328.90
    // Coupon 10%: -$32.89
    // Final: $296.01
    expect(pricing.volumeDiscount).toBe(5);
    expect(pricing.couponDiscount).toBe(10);
    expect(pricing.totalPerMonth).toBeCloseTo(296.01, 2);
  });
});

describe('Pricing Engine - Proration Calculations', () => {
  const corePlan = {
    slug: 'core',
    name: 'Core',
    basePriceMonthly: 9.00,
    basePriceYearly: 8.00,
    perSeatPriceMonthly: 9.00,
    perSeatPriceYearly: 8.00,
    includedSeats: 1,
  };

  const aiPlan = {
    slug: 'ai',
    name: 'AI',
    basePriceMonthly: 23.00,
    basePriceYearly: 21.00,
    perSeatPriceMonthly: 23.00,
    perSeatPriceYearly: 21.00,
    includedSeats: 1,
  };

  test('TC-PRICING-029: Upgrade Core to AI - 50% of cycle remaining', () => {
    const region = pricingEngine.getRegion('US');
    const proration = pricingEngine.calculateProration({
      oldPlan: corePlan,
      newPlan: aiPlan,
      region,
      billingCycle: 'monthly',
      oldSeats: 1,
      newSeats: 1,
      daysRemainingInCycle: 15,
      totalDaysInCycle: 30,
    });

    // Old plan: $9/mo * 50% = $4.50 credit
    // New plan: $23/mo * 50% = $11.50 charge
    // Net: $7.00 charge
    expect(proration.credit).toBeCloseTo(4.50, 2);
    expect(proration.charge).toBeCloseTo(11.50, 2);
    expect(proration.netAmount).toBeCloseTo(7.00, 2);
    expect(proration.description).toContain('Upgrade');
    expect(proration.description).toContain('50%');
  });

  test('TC-PRICING-030: Downgrade AI to Core - 25% of cycle remaining', () => {
    const region = pricingEngine.getRegion('US');
    const proration = pricingEngine.calculateProration({
      oldPlan: aiPlan,
      newPlan: corePlan,
      region,
      billingCycle: 'monthly',
      oldSeats: 1,
      newSeats: 1,
      daysRemainingInCycle: 7,
      totalDaysInCycle: 30,
    });

    // Old plan: $23/mo * 23% = $5.37 credit
    // New plan: $9/mo * 23% = $2.10 charge
    // Net: -$3.27 (credit to user)
    expect(proration.credit).toBeCloseTo(5.37, 1);
    expect(proration.charge).toBeCloseTo(2.10, 1);
    expect(proration.netAmount).toBeLessThan(0); // User gets credit
    expect(proration.description).toContain('Downgrade');
  });

  test('TC-PRICING-031: Add seats mid-cycle - 10 days remaining', () => {
    const region = pricingEngine.getRegion('US');
    const proration = pricingEngine.calculateProration({
      oldPlan: aiPlan,
      newPlan: aiPlan,
      region,
      billingCycle: 'monthly',
      oldSeats: 5,
      newSeats: 10,
      daysRemainingInCycle: 10,
      totalDaysInCycle: 30,
    });

    // Old: 5 seats = $23 + 4*$23 = $115/mo
    // New: 10 seats = $23 + 9*$23 = $230/mo
    // Difference: $115/mo
    // 33% of cycle: $115 * 0.33 = ~$38
    expect(proration.netAmount).toBeGreaterThan(0); // Charge for additional seats
    expect(proration.charge).toBeGreaterThan(proration.credit);
  });

  test('TC-PRICING-032: Proration with regional pricing (India)', () => {
    const region = pricingEngine.getRegion('IN');
    const proration = pricingEngine.calculateProration({
      oldPlan: corePlan,
      newPlan: aiPlan,
      region,
      billingCycle: 'monthly',
      oldSeats: 1,
      newSeats: 1,
      daysRemainingInCycle: 15,
      totalDaysInCycle: 30,
    });

    // India 0.35x multiplier should apply
    // Core: $9 * 0.35 = $3.15
    // AI: $23 * 0.35 = $8.05
    // 50% proration
    expect(proration.credit).toBeCloseTo(1.58, 2); // $3.15 * 50%
    expect(proration.charge).toBeCloseTo(4.03, 2); // $8.05 * 50%
    expect(proration.netAmount).toBeCloseTo(2.45, 2);
  });
});

describe('Pricing Engine - Accuracy Validation (Six Sigma)', () => {
  test('TC-PRICING-033: Price accuracy within $0.01 tolerance', () => {
    const corePlan = {
      slug: 'core',
      name: 'Core',
      basePriceMonthly: 9.00,
      basePriceYearly: 8.00,
      perSeatPriceMonthly: 9.00,
      perSeatPriceYearly: 8.00,
      includedSeats: 1,
    };

    const region = pricingEngine.getRegion('US');
    const pricing = pricingEngine.calculatePrice({
      plan: corePlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    // Total should be exactly $9.00 with no rounding errors
    expect(pricing.total).toBeCloseTo(9.00, 2);
    expect(Math.abs(pricing.total - 9.00)).toBeLessThanOrEqual(0.01);
  });

  test('TC-PRICING-034: India pricing matches PENETRATION_PRICING_STRATEGY.md', () => {
    const aiPlan = {
      slug: 'ai',
      name: 'AI',
      basePriceMonthly: 23.00,
      basePriceYearly: 21.00,
      perSeatPriceMonthly: 23.00,
      perSeatPriceYearly: 21.00,
      includedSeats: 1,
    };

    const region = pricingEngine.getRegion('IN');
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: 'monthly',
      seatCount: 1,
    });

    // According to strategy: AI Plan India = $23 * 0.35 = $8.05 ≈ ₹670
    // Our calculation should match
    expect(pricing.basePrice).toBeCloseTo(8.05, 2);
    expect(pricing.totalPerMonth).toBeCloseTo(8.05, 2);
  });

  test('TC-PRICING-035: All 10 regions return valid pricing', () => {
    const aiPlan = {
      slug: 'ai',
      name: 'AI',
      basePriceMonthly: 23.00,
      basePriceYearly: 21.00,
      perSeatPriceMonthly: 23.00,
      perSeatPriceYearly: 21.00,
      includedSeats: 1,
    };

    const regions = pricingEngine.getAllRegions();
    expect(regions.length).toBe(10);

    regions.forEach(region => {
      const pricing = pricingEngine.calculatePrice({
        plan: aiPlan,
        region,
        billingCycle: 'monthly',
        seatCount: 1,
      });

      expect(pricing.total).toBeGreaterThan(0);
      expect(pricing.currency).toBeTruthy();
      expect(pricing.currencySymbol).toBeTruthy();
    });
  });

  test('TC-PRICING-036: No negative pricing under any combination', () => {
    const aiPlan = {
      slug: 'ai',
      name: 'AI',
      basePriceMonthly: 23.00,
      basePriceYearly: 21.00,
      perSeatPriceMonthly: 23.00,
      perSeatPriceYearly: 21.00,
      includedSeats: 1,
    };

    const region = pricingEngine.getRegion('US');
    
    // Even with maximum discounts
    const pricing = pricingEngine.calculatePrice({
      plan: aiPlan,
      region,
      billingCycle: '3_year', // 18% discount
      seatCount: 60, // 15% volume discount
      couponDiscount: 50, // 50% coupon
    });

    expect(pricing.total).toBeGreaterThan(0);
    expect(pricing.totalPerMonth).toBeGreaterThan(0);
  });
});

describe('Pricing Engine - Currency Formatting', () => {
  test('TC-PRICING-037: USD formatting', () => {
    const formatted = pricingEngine.formatPrice(23.50, 'USD', '$');
    expect(formatted).toBe('$23.50');
  });

  test('TC-PRICING-038: INR formatting', () => {
    const formatted = pricingEngine.formatPrice(670.00, 'INR', '₹');
    expect(formatted).toBe('₹670.00');
  });

  test('TC-PRICING-039: EUR formatting', () => {
    const formatted = pricingEngine.formatPrice(21.40, 'EUR', '€');
    expect(formatted).toBe('€21.40');
  });

  test('TC-PRICING-040: AED formatting', () => {
    const formatted = pricingEngine.formatPrice(84.00, 'AED', 'د.إ');
    expect(formatted).toBe('84.00 د.إ');
  });
});
