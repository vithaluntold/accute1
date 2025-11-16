/**
 * Subscription API Integration Tests
 * Six Sigma Quality - Target: 40 tests
 * Tests complete API workflows with database
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../test-app';
import { testDb as db } from '../../test-db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createTestOrganization, createTestUser, loginUser, clearDatabase, clearRoleCache } from '../helpers';
import { resetRateLimiters } from '../../rate-limit';

describe('Subscription API - Plan Management', () => {
  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();
  });

  test('TC-API-001: GET /api/subscription-plans returns all active plans', async () => {
    const response = await request(app)
      .get('/api/subscription-plans')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(3); // Core, AI, Edge

    // Verify plan structure
    const corePlan = response.body.find((p: any) => p.slug === 'core');
    expect(corePlan).toBeDefined();
    expect(corePlan.name).toBe('Core');
    expect(corePlan.basePriceMonthly).toBe('9.00');
    expect(corePlan.basePriceYearly).toBe('8.00');
    expect(corePlan.includedSeats).toBe(1);
  });

  test('TC-API-002: GET /api/subscription-plans/:slug returns specific plan', async () => {
    const response = await request(app)
      .get('/api/subscription-plans/ai')
      .expect(200);

    expect(response.body.slug).toBe('ai');
    expect(response.body.name).toBe('AI');
    expect(response.body.basePriceMonthly).toBe('23.00');
    expect(response.body.maxAIAgents).toBe(11);
  });

  test('TC-API-003: GET /api/subscription-plans/invalid returns 404', async () => {
    await request(app)
      .get('/api/subscription-plans/nonexistent')
      .expect(404);
  });

  test('TC-API-004: GET /api/pricing-regions returns all 10 regions', async () => {
    const response = await request(app)
      .get('/api/pricing-regions')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(10);

    // Verify India region
    const india = response.body.find((r: any) => r.code === 'IN');
    expect(india).toBeDefined();
    expect(india.priceMultiplier).toBe('0.350');
    expect(india.currency).toBe('INR');
    expect(india.currencySymbol).toBe('₹');
  });
});

describe('Subscription API - Price Calculation', () => {
  let coreplanId: string;
  let aiPlanId: string;
  let usRegionId: string;
  let inRegionId: string;

  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();

    // Get plan and region IDs
    const plans = await db.select().from(schema.subscriptionPlans);
    const corePlan = plans.find(p => p.slug === 'core');
    const aiPlan = plans.find(p => p.slug === 'ai');
    
    if (!corePlan || !aiPlan) {
      throw new Error('Test plans not found - seed database first');
    }
    
    corePlanId = corePlan.id;
    aiPlanId = aiPlan.id;

    const regions = await db.select().from(schema.pricingRegions);
    const usRegion = regions.find(r => r.code === 'US');
    const inRegion = regions.find(r => r.code === 'IN');
    
    if (!usRegion || !inRegion) {
      throw new Error('Test regions not found - seed database first');
    }
    
    usRegionId = usRegion.id;
    inRegionId = inRegion.id;
  });

  test('TC-API-005: Calculate price for Core plan USA monthly', async () => {
    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: corePlanId,
        billingCycle: 'monthly',
        seatCount: 1,
        regionId: usRegionId,
      })
      .expect(200);

    expect(response.body.basePrice).toBe(9);
    expect(response.body.totalPerMonth).toBe(9);
    expect(response.body.total).toBe(9);
    expect(response.body.currency).toBe('USD');
  });

  test('TC-API-006: Calculate price for AI plan India monthly', async () => {
    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: aiPlanId,
        billingCycle: 'monthly',
        seatCount: 1,
        regionId: inRegionId,
      })
      .expect(200);

    // $23 * 0.35 = $8.05
    expect(response.body.basePrice).toBeCloseTo(8.05, 2);
    expect(response.body.currency).toBe('INR');
    expect(response.body.pppMultiplier).toBe(0.35);
  });

  test('TC-API-007: Calculate price with yearly billing (11% discount)', async () => {
    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: aiPlanId,
        billingCycle: 'yearly',
        seatCount: 1,
        regionId: usRegionId,
      })
      .expect(200);

    expect(response.body.billingCycleDiscount).toBe(11);
    expect(response.body.basePrice).toBe(21); // Yearly base
    // $21 - 11% = $18.69/mo * 12 = $224.28 total
    expect(response.body.total).toBeCloseTo(224.28, 2);
  });

  test('TC-API-008: Calculate price with multiple seats', async () => {
    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: aiPlanId,
        billingCycle: 'monthly',
        seatCount: 5,
        regionId: usRegionId,
      })
      .expect(200);

    expect(response.body.includedSeats).toBe(1);
    expect(response.body.additionalSeats).toBe(4);
    // $23 base + 4*$23 = $115
    expect(response.body.total).toBe(115);
  });

  test('TC-API-009: Missing required fields returns 400', async () => {
    await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: aiPlanId,
        // Missing billingCycle, seatCount, regionId
      })
      .expect(400);
  });

  test('TC-API-010: Invalid plan ID returns 404', async () => {
    await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: 'invalid-plan-id',
        billingCycle: 'monthly',
        seatCount: 1,
        regionId: usRegionId,
      })
      .expect(404);
  });
});

describe('Subscription API - Current Subscription', () => {
  let authToken: string;
  let userId: string;
  let organizationId: string;
  let aiPlanId: string;

  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();

    // Create test organization and user
    const { organization, owner } = await createTestOrganization();
    organizationId = organization.id;
    userId = owner.id;
    authToken = await loginUser(owner.email, 'password123');

    // Get AI plan
    const plans = await db.select().from(schema.subscriptionPlans);
    const aiPlan = plans.find(p => p.slug === 'ai');
    if (!aiPlan) throw new Error('AI plan not found');
    aiPlanId = aiPlan.id;

    // Create active subscription
    await db.insert(schema.platformSubscriptions).values({
      organizationId,
      plan: 'ai',
      status: 'active',
      billingCycle: 'monthly',
      planId: aiPlanId,
      seatCount: 1,
      monthlyPrice: '23.00',
      yearlyPrice: '21.00',
      mrr: '23.00',
      maxUsers: 25,
      maxClients: 250,
      maxStorage: 50,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      regionCode: 'US',
      basePrice: '23.00',
      perSeatPrice: '23.00',
    });
  });

  test('TC-API-011: GET current subscription returns active subscription', async () => {
    const response = await request(app)
      .get('/api/platform-subscriptions/current')
      .set('Cookie', authToken)
      .expect(200);

    expect(response.body.plan).toBe('ai');
    expect(response.body.status).toBe('active');
    expect(response.body.billingCycle).toBe('monthly');
    expect(response.body.mrr).toBe('23.00');
    expect(response.body.maxAIAgents).toBeUndefined(); // Not included by default
  });

  test('TC-API-012: GET current subscription without auth returns 401', async () => {
    await request(app)
      .get('/api/platform-subscriptions/current')
      .expect(401);
  });

  test('TC-API-013: GET current subscription with no subscription returns 404', async () => {
    // Delete subscription
    await db
      .delete(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.organizationId, organizationId));

    await request(app)
      .get('/api/platform-subscriptions/current')
      .set('Cookie', authToken)
      .expect(404);
  });
});

describe('Subscription API - Plan Switching', () => {
  let authToken: string;
  let userId: string;
  let organizationId: string;
  let corePlanId: string;
  let aiPlanId: string;
  let edgePlanId: string;
  let subscriptionId: string;

  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();

    // Create test organization with admin user
    const { organization, owner } = await createTestOrganization();
    organizationId = organization.id;
    userId = owner.id;
    authToken = await loginUser(owner.email, 'password123');

    // Get plans
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

    // Create Core subscription
    const [subscription] = await db.insert(schema.platformSubscriptions).values({
      organizationId,
      plan: 'core',
      status: 'active',
      billingCycle: 'monthly',
      planId: corePlanId,
      seatCount: 1,
      monthlyPrice: '9.00',
      mrr: '9.00',
      maxUsers: 5,
      maxClients: 50,
      maxStorage: 10,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currency: 'USD',
      regionCode: 'US',
      basePrice: '9.00',
      perSeatPrice: '9.00',
    }).returning();
    
    subscriptionId = subscription.id;
  });

  test('TC-API-014: Switch from Core to AI plan', async () => {
    const response = await request(app)
      .post('/api/platform-subscriptions/switch-plan')
      .set('Cookie', authToken)
      .send({
        planSlug: 'ai',
        billingCycle: 'monthly',
      })
      .expect(200);

    expect(response.body.plan).toBe('ai');
    expect(response.body.mrr).toBeCloseTo(23, 1);

    // Verify subscription event logged
    const events = await db
      .select()
      .from(schema.subscriptionEvents)
      .where(eq(schema.subscriptionEvents.subscriptionId, subscriptionId));
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].eventType).toBe('plan_upgraded');
  });

  test('TC-API-015: Switch from Core to Edge plan (double upgrade)', async () => {
    const response = await request(app)
      .post('/api/platform-subscriptions/switch-plan')
      .set('Cookie', authToken)
      .send({
        planSlug: 'edge',
        billingCycle: 'monthly',
      })
      .expect(200);

    expect(response.body.plan).toBe('edge');
    expect(response.body.maxUsers).toBe(999); // Edge unlimited
  });

  test('TC-API-016: Cannot switch to same plan', async () => {
    await request(app)
      .post('/api/platform-subscriptions/switch-plan')
      .set('Cookie', authToken)
      .send({
        planSlug: 'core',
        billingCycle: 'monthly',
      })
      .expect(400);
  });

  test('TC-API-017: Invalid billing cycle returns 400', async () => {
    await request(app)
      .post('/api/platform-subscriptions/switch-plan')
      .set('Cookie', authToken)
      .send({
        planSlug: 'ai',
        billingCycle: 'invalid',
      })
      .expect(400);
  });

  test('TC-API-018: Non-admin cannot switch plans', async () => {
    // Create staff user
    const staffUser = await createTestUser({
      organizationId,
      roleSlug: 'staff',
    });
    const staffToken = await loginUser(staffUser.email, 'password123');

    await request(app)
      .post('/api/platform-subscriptions/switch-plan')
      .set('Cookie', staffToken)
      .send({
        planSlug: 'ai',
        billingCycle: 'monthly',
      })
      .expect(403);
  });
});

describe('Subscription API - Validation & Edge Cases', () => {
  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();
  });

  test('TC-API-019: Price calculation with 0 seats returns 400', async () => {
    const plans = await db.select().from(schema.subscriptionPlans).limit(1);
    const regions = await db.select().from(schema.pricingRegions).limit(1);

    await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: plans[0].id,
        billingCycle: 'monthly',
        seatCount: 0, // Invalid
        regionId: regions[0].id,
      })
      .expect(400);
  });

  test('TC-API-020: Price calculation with negative seats returns 400', async () => {
    const plans = await db.select().from(schema.subscriptionPlans).limit(1);
    const regions = await db.select().from(schema.pricingRegions).limit(1);

    await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: plans[0].id,
        billingCycle: 'monthly',
        seatCount: -5, // Invalid
        regionId: regions[0].id,
      })
      .expect(400);
  });

  test('TC-API-021: Price calculation with 1000 seats succeeds', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const aiPlan = plans.find(p => p.slug === 'ai');
    const regions = await db.select().from(schema.pricingRegions);
    const usRegion = regions.find(r => r.code === 'US');

    if (!aiPlan || !usRegion) throw new Error('Test data not found');

    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: aiPlan.id,
        billingCycle: 'monthly',
        seatCount: 1000,
        regionId: usRegion.id,
      })
      .expect(200);

    expect(response.body.additionalSeats).toBe(999);
    expect(response.body.volumeDiscount).toBe(15); // Maximum tier
    expect(response.body.total).toBeGreaterThan(0);
  });
});

describe('Subscription API - Coupon Validation', () => {
  let planId: string;
  let regionId: string;
  let couponId: string;

  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();

    const plans = await db.select().from(schema.subscriptionPlans);
    const aiPlan = plans.find(p => p.slug === 'ai');
    if (!aiPlan) throw new Error('AI plan not found');
    planId = aiPlan.id;

    const regions = await db.select().from(schema.pricingRegions);
    const usRegion = regions.find(r => r.code === 'US');
    if (!usRegion) throw new Error('US region not found');
    regionId = usRegion.id;

    // Create test coupon
    const [coupon] = await db.insert(schema.coupons).values({
      code: 'TEST25',
      name: 'Test 25% Off',
      discountType: 'percentage',
      discountValue: '25',
      maxRedemptions: 100,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    }).returning();
    
    couponId = coupon.id;
  });

  test('TC-API-022: Valid coupon applies discount', async () => {
    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId,
        billingCycle: 'monthly',
        seatCount: 1,
        regionId,
        couponCode: 'TEST25',
      })
      .expect(200);

    expect(response.body.couponDiscount).toBe(25);
    expect(response.body.couponDiscountAmount).toBeCloseTo(5.75, 2); // 25% of $23
    expect(response.body.total).toBeCloseTo(17.25, 2); // $23 - $5.75
  });

  test('TC-API-023: Invalid coupon code is ignored', async () => {
    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId,
        billingCycle: 'monthly',
        seatCount: 1,
        regionId,
        couponCode: 'INVALID',
      })
      .expect(200);

    expect(response.body.couponDiscount).toBe(0);
    expect(response.body.total).toBe(23); // No discount
  });

  test('TC-API-024: Expired coupon is not applied', async () => {
    // Update coupon to be expired
    await db
      .update(schema.coupons)
      .set({
        validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      })
      .where(eq(schema.coupons.id, couponId));

    const response = await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId,
        billingCycle: 'monthly',
        seatCount: 1,
        regionId,
        couponCode: 'TEST25',
      })
      .expect(200);

    expect(response.body.couponDiscount).toBe(0);
  });
});

describe('Subscription API - Performance & Load', () => {
  test('TC-API-025: Price calculation completes within 500ms', async () => {
    const plans = await db.select().from(schema.subscriptionPlans).limit(1);
    const regions = await db.select().from(schema.pricingRegions).limit(1);

    const start = Date.now();
    
    await request(app)
      .post('/api/subscription-price/calculate')
      .send({
        planId: plans[0].id,
        billingCycle: 'monthly',
        seatCount: 1,
        regionId: regions[0].id,
      })
      .expect(200);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });

  test('TC-API-026: GET plans completes within 200ms', async () => {
    const start = Date.now();
    
    await request(app)
      .get('/api/subscription-plans')
      .expect(200);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });
});
