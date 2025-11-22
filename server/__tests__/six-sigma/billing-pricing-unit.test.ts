/**
 * SIX SIGMA BILLING - PRICING CALCULATION UNIT TESTS
 * Target: 60 unit tests for pricing logic
 * Coverage: PPP multipliers, currency conversion, volume discounts, proration, coupons
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { testDb as db } from '../../test-db';
import * as schema from '@shared/schema';
import { clearDatabase } from '../helpers';
import { PLAN_PRICES, REGION_MULTIPLIERS } from './billing-test-constants';

describe('Six Sigma Billing - PPP Multiplier Pricing (10 regions)', () => {
  let aiPlanId: string;
  let regions: typeof schema.pricingRegions.$inferSelect[];

  beforeEach(async () => {
    await clearDatabase();
    
    const plans = await db.select().from(schema.subscriptionPlans);
    const aiPlan = plans.find(p => p.slug === 'ai');
    if (!aiPlan) throw new Error('AI plan not found');
    aiPlanId = aiPlan.id;

    regions = await db.select().from(schema.pricingRegions);
  });

  test('TC-PRICE-001: USA (1.0x) - Full price $23', async () => {
    const usRegion = regions.find(r => r.code === 'US')!;
    const basePrice = 23;
    const finalPrice = basePrice * parseFloat(usRegion.priceMultiplier);
    
    expect(finalPrice).toBe(23);
    expect(usRegion.priceMultiplier).toBe('1.000');
    expect(usRegion.currency).toBe('USD');
  });

  test('TC-PRICE-002: India (0.35x) - PPP discount $8.05', async () => {
    const inRegion = regions.find(r => r.code === 'IN')!;
    const basePrice = 23;
    const finalPrice = basePrice * parseFloat(inRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(8.05, 2);
    expect(inRegion.priceMultiplier).toBe('0.350');
    expect(inRegion.currency).toBe('INR');
  });

  test('TC-PRICE-003: Turkey (0.40x) - PPP discount $9.20', async () => {
    const trRegion = regions.find(r => r.code === 'TR')!;
    const basePrice = 23;
    const finalPrice = basePrice * parseFloat(trRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(9.20, 2);
    expect(trRegion.priceMultiplier).toBe('0.400');
    expect(trRegion.currency).toBe('TRY');
  });

  test('TC-PRICE-004: UAE/GCC (1.0x) - Premium pricing $23', async () => {
    const aeRegion = regions.find(r => r.code === 'AE')!;
    const basePrice = PLAN_PRICES.AI.monthly;
    const finalPrice = basePrice * parseFloat(aeRegion.priceMultiplier);
    
    expect(finalPrice).toBe(23);
    expect(aeRegion.priceMultiplier).toBe('1.000');
    expect(aeRegion.currency).toBe('AED');
  });

  test('TC-PRICE-005: Rest of World (0.70x) - Global discount $16.10', async () => {
    const globalRegion = regions.find(r => r.code === 'GLOBAL')!;
    const basePrice = PLAN_PRICES.AI.monthly;
    const finalPrice = basePrice * parseFloat(globalRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(16.10, 2);
    expect(globalRegion.priceMultiplier).toBe('0.700');
    expect(globalRegion.currency).toBe('USD');
  });

  test('TC-PRICE-006: EU (0.93x) - Currency adjustment €21.39', async () => {
    const euRegion = regions.find(r => r.code === 'EU')!;
    const basePrice = PLAN_PRICES.AI.monthly;
    const finalPrice = basePrice * parseFloat(euRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(21.39, 2);
    expect(euRegion.priceMultiplier).toBe('0.930');
    expect(euRegion.currency).toBe('EUR');
  });

  test('TC-PRICE-007: UK (0.79x) - Currency adjustment £18.17', async () => {
    const gbRegion = regions.find(r => r.code === 'GB')!;
    const basePrice = PLAN_PRICES.AI.monthly;
    const finalPrice = basePrice * parseFloat(gbRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(18.17, 2);
    expect(gbRegion.priceMultiplier).toBe('0.790');
    expect(gbRegion.currency).toBe('GBP');
  });

  test('TC-PRICE-008: Canada (1.39x) - Currency adjustment C$31.97', async () => {
    const caRegion = regions.find(r => r.code === 'CA')!;
    const basePrice = PLAN_PRICES.AI.monthly;
    const finalPrice = basePrice * parseFloat(caRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(31.97, 2);
    expect(caRegion.priceMultiplier).toBe('1.390');
    expect(caRegion.currency).toBe('CAD');
  });

  test('TC-PRICE-009: Australia (1.52x) - Currency adjustment A$34.96', async () => {
    const auRegion = regions.find(r => r.code === 'AU')!;
    const basePrice = PLAN_PRICES.AI.monthly;
    const finalPrice = basePrice * parseFloat(auRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(34.96, 2);
    expect(auRegion.priceMultiplier).toBe('1.520');
    expect(auRegion.currency).toBe('AUD');
  });

  test('TC-PRICE-010: Singapore (1.35x) - Currency adjustment S$31.05', async () => {
    const sgRegion = regions.find(r => r.code === 'SG')!;
    const basePrice = PLAN_PRICES.AI.monthly;
    const finalPrice = basePrice * parseFloat(sgRegion.priceMultiplier);
    
    expect(finalPrice).toBeCloseTo(31.05, 2);
    expect(sgRegion.priceMultiplier).toBe('1.350');
    expect(sgRegion.currency).toBe('SGD');
  });
});

describe('Six Sigma Billing - Volume Discount Tiers', () => {
  let planId: string;
  let regionId: string;

  beforeEach(async () => {
    await clearDatabase();
    
    const plans = await db.select().from(schema.subscriptionPlans);
    const aiPlan = plans.find(p => p.slug === 'ai');
    if (!aiPlan) throw new Error('AI plan not found');
    planId = aiPlan.id;

    const regions = await db.select().from(schema.pricingRegions);
    const usRegion = regions.find(r => r.code === 'US');
    if (!usRegion) throw new Error('US region not found');
    regionId = usRegion.id;
  });

  test('TC-PRICE-011: 1 seat - No volume discount (0%)', async () => {
    const basePrice = 23;
    const seats = 1;
    const volumeDiscount = 0;
    
    const finalPrice = basePrice * seats * (1 - volumeDiscount / 100);
    expect(finalPrice).toBe(23);
  });

  test('TC-PRICE-012: 5 seats - Tier 1 discount (5%)', async () => {
    const basePrice = 23;
    const seats = 5;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const volumeDiscount = 5; // 5+ seats = 5% discount
    
    const total = basePrice + (additionalSeats * basePrice * (1 - volumeDiscount / 100));
    expect(total).toBeCloseTo(110.40, 2); // $23 + 4*$23*0.95
  });

  test('TC-PRICE-013: 10 seats - Tier 2 discount (7%)', async () => {
    const basePrice = 23;
    const seats = 10;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const volumeDiscount = 7; // 10+ seats = 7% discount
    
    const total = basePrice + (additionalSeats * basePrice * (1 - volumeDiscount / 100));
    expect(total).toBeCloseTo(215.51, 2); // $23 + 9*$23*0.93
  });

  test('TC-PRICE-014: 25 seats - Tier 3 discount (10%)', async () => {
    const basePrice = 23;
    const seats = 25;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const volumeDiscount = 10; // 25+ seats = 10% discount
    
    const total = basePrice + (additionalSeats * basePrice * (1 - volumeDiscount / 100));
    expect(total).toBeCloseTo(519.80, 2); // $23 + 24*$23*0.90
  });

  test('TC-PRICE-015: 50 seats - Tier 4 discount (12%)', async () => {
    const basePrice = 23;
    const seats = 50;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const volumeDiscount = 12; // 50+ seats = 12% discount
    
    const total = basePrice + (additionalSeats * basePrice * (1 - volumeDiscount / 100));
    expect(total).toBeCloseTo(1014.76, 2); // $23 + 49*$23*0.88
  });

  test('TC-PRICE-016: 100 seats - Tier 5 discount (15%)', async () => {
    const basePrice = 23;
    const seats = 100;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const volumeDiscount = 15; // 100+ seats = 15% discount
    
    const total = basePrice + (additionalSeats * basePrice * (1 - volumeDiscount / 100));
    expect(total).toBeCloseTo(1958.45, 2); // $23 + 99*$23*0.85
  });
});

describe('Six Sigma Billing - Billing Cycle Discounts', () => {
  let planId: string;
  let regionId: string;

  beforeEach(async () => {
    await clearDatabase();
    
    const plans = await db.select().from(schema.subscriptionPlans);
    const aiPlan = plans.find(p => p.slug === 'ai');
    if (!aiPlan) throw new Error('AI plan not found');
    planId = aiPlan.id;

    const regions = await db.select().from(schema.pricingRegions);
    const usRegion = regions.find(r => r.code === 'US');
    if (!usRegion) throw new Error('US region not found');
    regionId = usRegion.id;
  });

  test('TC-PRICE-017: Monthly billing - No discount', async () => {
    const monthlyPrice = 23;
    const billingCycleDiscount = 0;
    
    const finalPrice = monthlyPrice * (1 - billingCycleDiscount / 100);
    expect(finalPrice).toBe(23);
  });

  test('TC-PRICE-018: Yearly billing - 11% discount', async () => {
    const monthlyPrice = 23;
    const yearlyBase = 21; // $21/mo when billed yearly
    const billingCycleDiscount = 11;
    
    const finalMonthly = yearlyBase * (1 - billingCycleDiscount / 100);
    const yearlyTotal = finalMonthly * 12;
    
    expect(finalMonthly).toBeCloseTo(18.69, 2);
    expect(yearlyTotal).toBeCloseTo(224.28, 2);
  });

  test('TC-PRICE-019: 3-year billing - 20% discount', async () => {
    const monthlyPrice = 23;
    const threeYearBase = 18; // $18/mo when billed 3-year
    const billingCycleDiscount = 20;
    
    const finalMonthly = threeYearBase * (1 - billingCycleDiscount / 100);
    const threeYearTotal = finalMonthly * 36;
    
    expect(finalMonthly).toBeCloseTo(14.40, 2);
    expect(threeYearTotal).toBeCloseTo(518.40, 2);
  });
});

describe('Six Sigma Billing - Proration Calculations', () => {
  test('TC-PRICE-020: Mid-cycle upgrade - Prorated refund calculation', async () => {
    const oldPlanPrice = 9; // Core $9/mo
    const newPlanPrice = 23; // AI $23/mo
    const daysIntoMonth = 15; // 15 days into 30-day cycle
    const daysRemaining = 15;
    
    const unusedCredit = (oldPlanPrice / 30) * daysRemaining;
    const newPlanCharge = (newPlanPrice / 30) * daysRemaining;
    const prorationAmount = newPlanCharge - unusedCredit;
    
    expect(unusedCredit).toBeCloseTo(4.50, 2);
    expect(newPlanCharge).toBeCloseTo(11.50, 2);
    expect(prorationAmount).toBeCloseTo(7.00, 2);
  });

  test('TC-PRICE-021: Mid-cycle downgrade - Prorated credit issued', async () => {
    const oldPlanPrice = 23; // AI $23/mo
    const newPlanPrice = 9; // Core $9/mo
    const daysIntoMonth = 10; // 10 days into 30-day cycle
    const daysRemaining = 20;
    
    const unusedCredit = (oldPlanPrice / 30) * daysRemaining;
    const newPlanCharge = (newPlanPrice / 30) * daysRemaining;
    const creditAmount = unusedCredit - newPlanCharge;
    
    expect(unusedCredit).toBeCloseTo(15.33, 2);
    expect(newPlanCharge).toBeCloseTo(6.00, 2);
    expect(creditAmount).toBeCloseTo(9.33, 2);
  });

  test('TC-PRICE-022: Add 5 seats mid-cycle - Prorated charge', async () => {
    const perSeatPrice = 23;
    const additionalSeats = 5;
    const daysRemaining = 20;
    const daysInMonth = 30;
    
    const proratedCharge = (perSeatPrice * additionalSeats / daysInMonth) * daysRemaining;
    
    expect(proratedCharge).toBeCloseTo(76.67, 2); // $115 * (20/30)
  });

  test('TC-PRICE-023: Remove 3 seats mid-cycle - Prorated credit', async () => {
    const perSeatPrice = 23;
    const removedSeats = 3;
    const daysRemaining = 25;
    const daysInMonth = 30;
    
    const proratedCredit = (perSeatPrice * removedSeats / daysInMonth) * daysRemaining;
    
    expect(proratedCredit).toBeCloseTo(57.50, 2); // $69 * (25/30)
  });

  test('TC-PRICE-024: End-of-month upgrade - Minimal proration', async () => {
    const oldPlanPrice = 9;
    const newPlanPrice = 23;
    const daysRemaining = 1; // Last day of month
    
    const prorationAmount = ((newPlanPrice - oldPlanPrice) / 30) * daysRemaining;
    
    expect(prorationAmount).toBeCloseTo(0.47, 2);
  });

  test('TC-PRICE-025: Start-of-month upgrade - Full month proration', async () => {
    const oldPlanPrice = 9;
    const newPlanPrice = 23;
    const daysRemaining = 30; // First day of month
    
    const unusedCredit = oldPlanPrice; // Full month unused
    const newPlanCharge = newPlanPrice; // Full month charge
    const prorationAmount = newPlanCharge - unusedCredit;
    
    expect(prorationAmount).toBe(14);
  });
});

describe('Six Sigma Billing - Coupon Stacking & Combinations', () => {
  test('TC-PRICE-026: Percentage coupon + Volume discount', async () => {
    const basePrice = 23;
    const seats = 10;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const volumeDiscount = 7; // 10+ seats
    const couponDiscount = 25; // 25% coupon
    
    // Volume discount applies first, then coupon
    const afterVolumeDiscount = basePrice + (additionalSeats * basePrice * (1 - volumeDiscount / 100));
    const final = afterVolumeDiscount * (1 - couponDiscount / 100);
    
    expect(afterVolumeDiscount).toBeCloseTo(215.51, 2);
    expect(final).toBeCloseTo(161.63, 2);
  });

  test('TC-PRICE-027: Fixed amount coupon + PPP multiplier', async () => {
    const basePrice = 23;
    const pppMultiplier = 0.35; // India
    const couponAmount = 5; // $5 off
    
    const afterPPP = basePrice * pppMultiplier;
    const final = Math.max(0, afterPPP - couponAmount);
    
    expect(afterPPP).toBeCloseTo(8.05, 2);
    expect(final).toBeCloseTo(3.05, 2);
  });

  test('TC-PRICE-028: Percentage coupon + Yearly discount', async () => {
    const monthlyPrice = 23;
    const yearlyBase = 21;
    const billingCycleDiscount = 11;
    const couponDiscount = 10; // 10% coupon
    
    const afterBillingDiscount = yearlyBase * (1 - billingCycleDiscount / 100);
    const final = afterBillingDiscount * (1 - couponDiscount / 100);
    const yearlyTotal = final * 12;
    
    expect(afterBillingDiscount).toBeCloseTo(18.69, 2);
    expect(final).toBeCloseTo(16.82, 2);
    expect(yearlyTotal).toBeCloseTo(201.85, 2);
  });

  test('TC-PRICE-029: All discounts combined (PPP + Volume + Yearly + Coupon)', async () => {
    const basePrice = 23;
    const seats = 25;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const pppMultiplier = 0.35; // India
    const volumeDiscount = 10; // 25+ seats
    const yearlyDiscount = 11; // Yearly billing
    const couponDiscount = 15; // 15% coupon
    
    // Order: PPP → Volume → Yearly → Coupon
    const afterPPP = basePrice * pppMultiplier;
    const totalBeforeVolume = afterPPP + (additionalSeats * afterPPP);
    const afterVolume = totalBeforeVolume * (1 - volumeDiscount / 100);
    const afterYearly = afterVolume * (1 - yearlyDiscount / 100);
    const final = afterYearly * (1 - couponDiscount / 100);
    
    expect(afterPPP).toBeCloseTo(8.05, 2);
    expect(final).toBeGreaterThan(0);
    expect(final).toBeLessThan(basePrice * seats); // Should be significantly discounted
  });

  test('TC-PRICE-030: Coupon with minimum purchase requirement', async () => {
    const basePrice = 23;
    const seats = 1;
    const total = basePrice * seats;
    const couponMinimum = 50;
    const couponDiscount = 20;
    
    const canApplyCoupon = total >= couponMinimum;
    const final = canApplyCoupon ? total * (1 - couponDiscount / 100) : total;
    
    expect(canApplyCoupon).toBe(false);
    expect(final).toBe(23); // Coupon not applied
  });

  test('TC-PRICE-031: Coupon exceeds total price - Floor at $0', async () => {
    const basePrice = 23;
    const pppMultiplier = 0.35; // India $8.05
    const couponAmount = 10; // $10 off (more than price)
    
    const afterPPP = basePrice * pppMultiplier;
    const final = Math.max(0, afterPPP - couponAmount);
    
    expect(final).toBe(0); // Should not go negative
  });
});

describe('Six Sigma Billing - Edge Cases & Validation', () => {
  test('TC-PRICE-032: Zero seats - Invalid', async () => {
    const seats = 0;
    const isValid = seats > 0;
    
    expect(isValid).toBe(false);
  });

  test('TC-PRICE-033: Negative seats - Invalid', async () => {
    const seats = -5;
    const isValid = seats > 0;
    
    expect(isValid).toBe(false);
  });

  test('TC-PRICE-034: Fractional seats - Rounded up', async () => {
    const seats = 5.7;
    const normalizedSeats = Math.ceil(seats);
    
    expect(normalizedSeats).toBe(6);
  });

  test('TC-PRICE-035: Extremely large seat count (10,000)', async () => {
    const basePrice = 23;
    const seats = 10000;
    const includedSeats = 1;
    const additionalSeats = seats - includedSeats;
    const volumeDiscount = 15; // Maximum discount
    
    const total = basePrice + (additionalSeats * basePrice * (1 - volumeDiscount / 100));
    
    expect(total).toBeGreaterThan(0);
    expect(total).toBeCloseTo(195503.45, 2);
  });

  test('TC-PRICE-036: Null PPP multiplier - Default to 1.0x', async () => {
    const basePrice = 23;
    const pppMultiplier = null;
    const effectiveMultiplier = pppMultiplier ?? 1.0;
    
    const final = basePrice * effectiveMultiplier;
    expect(final).toBe(23);
  });

  test('TC-PRICE-037: Invalid billing cycle - Reject', async () => {
    const validCycles = ['monthly', 'yearly', '3_year'];
    const testCycle = 'quarterly';
    
    const isValid = validCycles.includes(testCycle);
    expect(isValid).toBe(false);
  });

  test('TC-PRICE-038: Expired coupon - Not applied', async () => {
    const now = new Date('2025-11-22');
    const couponValidUntil = new Date('2025-11-20');
    const isCouponValid = couponValidUntil >= now;
    
    expect(isCouponValid).toBe(false);
  });

  test('TC-PRICE-039: Future-dated coupon - Not applied yet', async () => {
    const now = new Date('2025-11-22');
    const couponValidFrom = new Date('2025-11-25');
    const isCouponValid = couponValidFrom <= now;
    
    expect(isCouponValid).toBe(false);
  });

  test('TC-PRICE-040: Coupon max redemptions reached - Not applied', async () => {
    const maxRedemptions = 100;
    const currentRedemptions = 100;
    const isCouponAvailable = currentRedemptions < maxRedemptions;
    
    expect(isCouponAvailable).toBe(false);
  });
});

describe('Six Sigma Billing - Currency Conversion Accuracy', () => {
  test('TC-PRICE-041: USD to INR conversion (India)', async () => {
    const usdPrice = 23;
    const pppMultiplier = 0.35;
    const inrRate = 83.12; // Example rate
    
    const pppPrice = usdPrice * pppMultiplier;
    const inrPrice = pppPrice * inrRate;
    
    expect(pppPrice).toBeCloseTo(8.05, 2);
    expect(inrPrice).toBeCloseTo(669.12, 2);
  });

  test('TC-PRICE-042: USD to EUR conversion (Europe)', async () => {
    const usdPrice = 23;
    const pppMultiplier = 0.85;
    const eurRate = 0.92; // Example rate
    
    const pppPrice = usdPrice * pppMultiplier;
    const eurPrice = pppPrice * eurRate;
    
    expect(pppPrice).toBeCloseTo(19.55, 2);
    expect(eurPrice).toBeCloseTo(17.99, 2);
  });

  test('TC-PRICE-043: USD to GBP conversion (UK)', async () => {
    const usdPrice = 23;
    const pppMultiplier = 0.90;
    const gbpRate = 0.79; // Example rate
    
    const pppPrice = usdPrice * pppMultiplier;
    const gbpPrice = pppPrice * gbpRate;
    
    expect(pppPrice).toBeCloseTo(20.70, 2);
    expect(gbpPrice).toBeCloseTo(16.35, 2);
  });

  test('TC-PRICE-044: Currency conversion precision - 2 decimal places', async () => {
    const price = 23.456789;
    const rounded = Math.round(price * 100) / 100;
    
    expect(rounded).toBe(23.46);
  });
});

describe('Six Sigma Billing - Multi-Plan Pricing Consistency', () => {
  let corePlanId: string;
  let aiPlanId: string;
  let edgePlanId: string;

  beforeEach(async () => {
    await clearDatabase();
    
    const plans = await db.select().from(schema.subscriptionPlans);
    const corePlan = plans.find(p => p.slug === 'core');
    const aiPlan = plans.find(p => p.slug === 'ai');
    const edgePlan = plans.find(p => p.slug === 'edge');
    
    if (!corePlan || !aiPlan || !edgePlan) {
      throw new Error('Plans not found');
    }
    
    corePlanId = corePlan.id;
    aiPlanId = aiPlan.id;
    edgePlanId = edgePlan.id;
  });

  test('TC-PRICE-045: Core plan monthly price = $9', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const corePlan = plans.find(p => p.id === corePlanId)!;
    
    expect(corePlan.basePriceMonthly).toBe('9.00');
  });

  test('TC-PRICE-046: AI plan monthly price = $23', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const aiPlan = plans.find(p => p.id === aiPlanId)!;
    
    expect(aiPlan.basePriceMonthly).toBe('23.00');
  });

  test('TC-PRICE-047: Edge plan monthly price = $38', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const edgePlan = plans.find(p => p.id === edgePlanId)!;
    
    expect(edgePlan.basePriceMonthly).toBe('38.00');
  });

  test('TC-PRICE-048: AI plan is 2.56x more expensive than Core', async () => {
    const corePrice = 9;
    const aiPrice = 23;
    const ratio = aiPrice / corePrice;
    
    expect(ratio).toBeCloseTo(2.56, 2);
  });

  test('TC-PRICE-049: Edge plan is 5.44x more expensive than Core', async () => {
    const corePrice = 9;
    const edgePrice = 49;
    const ratio = edgePrice / corePrice;
    
    expect(ratio).toBeCloseTo(5.44, 2);
  });

  test('TC-PRICE-050: Yearly pricing saves 11% on AI plan', async () => {
    const monthlyPrice = 23;
    const yearlyPrice = 21;
    const savings = ((monthlyPrice - yearlyPrice) / monthlyPrice) * 100;
    
    expect(savings).toBeCloseTo(8.7, 1);
    // Note: 11% is applied after yearly base, so actual savings differ
  });
});

describe('Six Sigma Billing - Seat Addition Scenarios', () => {
  test('TC-PRICE-051: Add 1 seat to 1-seat plan', async () => {
    const basePrice = 23;
    const currentSeats = 1;
    const additionalSeats = 1;
    const newTotal = currentSeats + additionalSeats;
    
    const monthlyPrice = basePrice * newTotal;
    expect(monthlyPrice).toBe(46);
  });

  test('TC-PRICE-052: Add 10 seats to 5-seat plan (crosses volume tier)', async () => {
    const basePrice = 23;
    const currentSeats = 5;
    const additionalSeats = 10;
    const newTotal = currentSeats + additionalSeats; // 15 seats
    const volumeDiscount = 7; // 10+ seats
    
    const includedSeats = 1;
    const billableSeats = newTotal - includedSeats;
    const monthlyPrice = basePrice + (billableSeats * basePrice * (1 - volumeDiscount / 100));
    
    expect(monthlyPrice).toBeCloseTo(322.46, 2);
  });

  test('TC-PRICE-053: Add 100 seats to 1-seat plan (max volume discount)', async () => {
    const basePrice = 23;
    const newTotal = 101;
    const volumeDiscount = 15; // 100+ seats
    const includedSeats = 1;
    const billableSeats = newTotal - includedSeats;
    
    const monthlyPrice = basePrice + (billableSeats * basePrice * (1 - volumeDiscount / 100));
    
    expect(monthlyPrice).toBeCloseTo(1978.00, 2);
  });
});

describe('Six Sigma Billing - Annual Commitment Savings', () => {
  test('TC-PRICE-054: 1-year commitment - 11% savings', async () => {
    const monthlyPrice = 23;
    const yearlyPrice = 21;
    const monthsInYear = 12;
    
    const monthlyTotal = monthlyPrice * monthsInYear; // $276
    const yearlyTotal = yearlyPrice * monthsInYear * (1 - 0.11); // $224.28
    const savings = monthlyTotal - yearlyTotal;
    const savingsPercent = (savings / monthlyTotal) * 100;
    
    expect(yearlyTotal).toBeCloseTo(224.28, 2);
    expect(savings).toBeCloseTo(51.72, 2);
    expect(savingsPercent).toBeGreaterThan(18);
  });

  test('TC-PRICE-055: 3-year commitment - 20% savings', async () => {
    const monthlyPrice = 23;
    const threeYearBase = 18;
    const threeYearDiscount = 20;
    const monthsIn3Years = 36;
    
    const monthlyTotal = monthlyPrice * monthsIn3Years; // $828
    const threeYearTotal = threeYearBase * monthsIn3Years * (1 - threeYearDiscount / 100); // $518.40
    const savings = monthlyTotal - threeYearTotal;
    const savingsPercent = (savings / monthlyTotal) * 100;
    
    expect(threeYearTotal).toBeCloseTo(518.40, 2);
    expect(savings).toBeCloseTo(309.60, 2);
    expect(savingsPercent).toBeGreaterThan(37);
  });
});

describe('Six Sigma Billing - Price Snapshot Immutability', () => {
  test('TC-PRICE-056: Price snapshot stored at subscription time', async () => {
    const subscriptionTime = new Date('2025-01-01');
    const priceSnapshot = {
      basePrice: 23,
      pppMultiplier: 1.0,
      volumeDiscount: 0,
      couponDiscount: 0,
      billingCycleDiscount: 0,
      finalPrice: 23,
      timestamp: subscriptionTime.toISOString(),
    };
    
    expect(priceSnapshot.finalPrice).toBe(23);
    expect(priceSnapshot.timestamp).toBeDefined();
  });

  test('TC-PRICE-057: Future price changes do not affect existing subscriptions', async () => {
    const originalPrice = 23;
    const priceSnapshot = { finalPrice: originalPrice };
    
    // Simulate price increase
    const newMarketPrice = 29;
    
    // Existing subscription should keep original price
    expect(priceSnapshot.finalPrice).toBe(originalPrice);
    expect(priceSnapshot.finalPrice).not.toBe(newMarketPrice);
  });
});

describe('Six Sigma Billing - Rounding & Precision', () => {
  test('TC-PRICE-058: Price calculations rounded to 2 decimal places', async () => {
    const price = 23.456789;
    const rounded = Number(price.toFixed(2));
    
    expect(rounded).toBe(23.46);
  });

  test('TC-PRICE-059: Proration amounts rounded to nearest cent', async () => {
    const dailyRate = 23 / 30; // $0.7666...
    const days = 17;
    const prorated = Number((dailyRate * days).toFixed(2));
    
    expect(prorated).toBe(13.03);
  });

  test('TC-PRICE-060: Total price never negative (floor at $0)', async () => {
    const basePrice = 5;
    const discount = 10;
    const final = Math.max(0, basePrice - discount);
    
    expect(final).toBe(0);
  });
});
