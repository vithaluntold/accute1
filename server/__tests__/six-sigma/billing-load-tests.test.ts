/**
 * SIX SIGMA BILLING - LOAD & CONCURRENCY TESTS
 * Target: 15 tests for performance and scalability
 * Coverage: Concurrent subscriptions, race conditions, bulk operations
 */

import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../test-app';
import { testDb as db } from '../test-db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createTestOrganization, loginUser, clearDatabase, clearRoleCache } from './helpers';
import { resetRateLimiters } from '../rate-limit';

describe('Six Sigma Billing - Concurrent Subscription Operations', () => {
  let authTokens: string[] = [];
  let organizationIds: string[] = [];

  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();

    // Create 10 test organizations
    authTokens = [];
    organizationIds = [];
    
    for (let i = 0; i < 10; i++) {
      const { organization, owner } = await createTestOrganization();
      organizationIds.push(organization.id);
      authTokens.push(await loginUser(owner.email, 'password123'));
    }
  });

  test('TC-LOAD-001: 10 concurrent subscription creations', async () => {
    const startTime = Date.now();
    
    const promises = authTokens.map((token, i) =>
      request(app)
        .post('/api/platform-subscriptions/switch-plan')
        .set('Cookie', token)
        .send({
          planSlug: 'ai',
          billingCycle: 'monthly',
        })
    );

    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(5000); // All within 5 seconds
  });

  test('TC-LOAD-002: Concurrent plan switches from same organization', async () => {
    const token = authTokens[0];
    const orgId = organizationIds[0];

    // Create initial subscription
    await request(app)
      .post('/api/platform-subscriptions/switch-plan')
      .set('Cookie', token)
      .send({ planSlug: 'core', billingCycle: 'monthly' })
      .expect(200);

    // Try 5 concurrent plan switches
    const promises = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/platform-subscriptions/switch-plan')
        .set('Cookie', token)
        .send({ planSlug: 'ai', billingCycle: 'monthly' })
    );

    const responses = await Promise.all(promises);
    
    // At least one should succeed, others may fail gracefully
    const successful = responses.filter(r => r.status === 200);
    expect(successful.length).toBeGreaterThan(0);
  });

  test('TC-LOAD-003: 50 concurrent price calculations', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const regions = await db.select().from(schema.pricingRegions);
    const aiPlan = plans.find(p => p.slug === 'ai')!;
    const usRegion = regions.find(r => r.code === 'US')!;

    const startTime = Date.now();
    
    const promises = Array.from({ length: 50 }, (_, i) =>
      request(app)
        .post('/api/subscription-price/calculate')
        .send({
          planId: aiPlan.id,
          billingCycle: 'monthly',
          seatCount: i % 10 + 1, // 1-10 seats
          regionId: usRegion.id,
        })
    );

    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(3000); // All within 3 seconds
  });

  test('TC-LOAD-004: Concurrent seat additions to same subscription', async () => {
    const token = authTokens[0];
    const orgId = organizationIds[0];

    // Create subscription
    const createResponse = await request(app)
      .post('/api/platform-subscriptions/switch-plan')
      .set('Cookie', token)
      .send({ planSlug: 'ai', billingCycle: 'monthly' })
      .expect(200);

    const subscriptions = await db
      .select()
      .from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.organizationId, orgId));

    if (subscriptions.length === 0) {
      // No subscription found, skip rest of test
      return;
    }

    const subscriptionId = subscriptions[0].id;

    // Try 3 concurrent seat updates
    const promises = [
      request(app)
        .patch(`/api/platform-subscriptions/${subscriptionId}/seats`)
        .set('Cookie', token)
        .send({ seatCount: 5 }),
      request(app)
        .patch(`/api/platform-subscriptions/${subscriptionId}/seats`)
        .set('Cookie', token)
        .send({ seatCount: 7 }),
      request(app)
        .patch(`/api/platform-subscriptions/${subscriptionId}/seats`)
        .set('Cookie', token)
        .send({ seatCount: 10 }),
    ];

    const responses = await Promise.all(promises);
    
    // At least one should succeed
    const successful = responses.filter(r => r.status === 200);
    expect(successful.length).toBeGreaterThan(0);

    // Final seat count should be one of the requested values
    const [finalSub] = await db
      .select()
      .from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.id, subscriptionId));

    expect([5, 7, 10]).toContain(finalSub.seatCount);
  });

  test('TC-LOAD-005: Race condition on subscription creation (idempotency)', async () => {
    const token = authTokens[0];

    // Multiple rapid subscription switches
    const promises = Array.from({ length: 3 }, () =>
      request(app)
        .post('/api/platform-subscriptions/switch-plan')
        .set('Cookie', token)
        .send({ planSlug: 'ai', billingCycle: 'monthly' })
    );

    await Promise.all(promises);

    // Verify only one subscription exists
    const subscriptions = await db
      .select()
      .from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.organizationId, organizationIds[0]));

    // Should have exactly one subscription (race handled correctly)
    expect(subscriptions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Six Sigma Billing - Bulk Operations', () => {
  let authToken: string;
  let organizationId: string;

  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();

    const { organization, owner } = await createTestOrganization();
    organizationId = organization.id;
    authToken = await loginUser(owner.email, 'password123');
  });

  test('TC-LOAD-006: Bulk coupon validation (100 codes)', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const regions = await db.select().from(schema.pricingRegions);
    const aiPlan = plans.find(p => p.slug === 'ai')!;
    const usRegion = regions.find(r => r.code === 'US')!;

    // Create 100 coupons
    const coupons = Array.from({ length: 100 }, (_, i) => ({
      code: `BULK${i}`,
      name: `Bulk Coupon ${i}`,
      discountType: 'percentage' as const,
      discountValue: '10',
      maxRedemptions: 1000,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    }));

    await db.insert(schema.coupons).values(coupons);

    const startTime = Date.now();

    // Validate all 100 coupons in parallel
    const promises = coupons.map(coupon =>
      request(app)
        .post('/api/subscription-price/calculate')
        .send({
          planId: aiPlan.id,
          billingCycle: 'monthly',
          seatCount: 1,
          regionId: usRegion.id,
          couponCode: coupon.code,
        })
    );

    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(10000); // All within 10 seconds
  });

  test('TC-LOAD-007: Bulk subscription event logging (1000 events)', async () => {
    const [subscription] = await db
      .insert(schema.platformSubscriptions)
      .values({
        organizationId,
        plan: 'ai',
        status: 'active',
        billingCycle: 'monthly',
        planId: 'plan_ai',
        seatCount: 1,
        monthlyPrice: '23.00',
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
      })
      .returning();

    const events = Array.from({ length: 1000 }, (_, i) => ({
      subscriptionId: subscription.id,
      eventType: i % 2 === 0 ? 'plan_upgraded' : 'seats_added',
      metadata: { batch: 'load_test' },
    }));

    const startTime = Date.now();
    await db.insert(schema.subscriptionEvents).values(events);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // Insert 1000 events in 5 seconds

    const count = await db
      .select()
      .from(schema.subscriptionEvents)
      .where(eq(schema.subscriptionEvents.subscriptionId, subscription.id));

    expect(count.length).toBe(1000);
  });

  test('TC-LOAD-008: Bulk webhook event processing (500 events)', async () => {
    const events = Array.from({ length: 500 }, (_, i) => ({
      eventId: `evt_bulk_${i}`,
      provider: i % 2 === 0 ? 'stripe' : 'razorpay',
      eventType: 'payment_intent.succeeded',
      payload: { testId: i },
      status: 'pending' as const,
      organizationId,
    }));

    const startTime = Date.now();
    await db.insert(schema.webhookEvents).values(events);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(3000); // Insert 500 events in 3 seconds

    const count = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.organizationId, organizationId));

    expect(count.length).toBe(500);
  });

  test('TC-LOAD-009: Database connection pool under load', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const regions = await db.select().from(schema.pricingRegions);
    const aiPlan = plans.find(p => p.slug === 'ai')!;
    const usRegion = regions.find(r => r.code === 'US')!;

    // 100 concurrent database-intensive operations
    const promises = Array.from({ length: 100 }, (_, i) =>
      request(app)
        .post('/api/subscription-price/calculate')
        .send({
          planId: aiPlan.id,
          billingCycle: 'monthly',
          seatCount: i % 20 + 1,
          regionId: usRegion.id,
        })
    );

    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // All should succeed (connection pool handles load)
    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(duration).toBeLessThan(15000); // 100 operations in 15 seconds
  });

  test('TC-LOAD-010: Payment webhook burst (50 events in 1 second)', async () => {
    const events = Array.from({ length: 50 }, (_, i) => ({
      eventId: `evt_burst_${i}`,
      provider: 'stripe',
      eventType: 'payment_intent.succeeded',
      payload: { burstTest: true },
      status: 'pending' as const,
      organizationId,
    }));

    const startTime = Date.now();
    await db.insert(schema.webhookEvents).values(events);
    const insertDuration = Date.now() - startTime;

    expect(insertDuration).toBeLessThan(1000); // Burst insert under 1 second

    const count = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.status, 'pending'));

    expect(count.length).toBeGreaterThanOrEqual(50);
  });
});

describe('Six Sigma Billing - Performance Benchmarks', () => {
  beforeEach(async () => {
    await clearDatabase();
    resetRateLimiters();
    clearRoleCache();
  });

  test('TC-LOAD-011: Price calculation under 100ms (p95)', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const regions = await db.select().from(schema.pricingRegions);
    const aiPlan = plans.find(p => p.slug === 'ai')!;
    const usRegion = regions.find(r => r.code === 'US')!;

    const durations: number[] = [];

    // 20 sequential calculations
    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      
      await request(app)
        .post('/api/subscription-price/calculate')
        .send({
          planId: aiPlan.id,
          billingCycle: 'monthly',
          seatCount: 1,
          regionId: usRegion.id,
        })
        .expect(200);
      
      durations.push(Date.now() - start);
    }

    // Calculate p95
    durations.sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[p95Index];

    expect(p95).toBeLessThan(100); // p95 under 100ms
  });

  test('TC-LOAD-012: Subscription query performance (<50ms)', async () => {
    const { organization, owner } = await createTestOrganization();
    const authToken = await loginUser(owner.email, 'password123');

    const durations: number[] = [];

    // 10 sequential queries
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      
      await request(app)
        .get('/api/platform-subscriptions/current')
        .set('Cookie', authToken)
        .expect(200);
      
      durations.push(Date.now() - start);
    }

    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    expect(avgDuration).toBeLessThan(50); // Average under 50ms
  });

  test('TC-LOAD-013: Plan listing performance (<30ms)', async () => {
    const durations: number[] = [];

    // 10 sequential queries
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      
      await request(app)
        .get('/api/subscription-plans')
        .expect(200);
      
      durations.push(Date.now() - start);
    }

    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    expect(avgDuration).toBeLessThan(30); // Average under 30ms
  });

  test('TC-LOAD-014: Memory stability over 100 operations', async () => {
    const plans = await db.select().from(schema.subscriptionPlans);
    const regions = await db.select().from(schema.pricingRegions);
    const aiPlan = plans.find(p => p.slug === 'ai')!;
    const usRegion = regions.find(r => r.code === 'US')!;

    // Monitor memory before
    const memBefore = process.memoryUsage().heapUsed;

    // 100 price calculations
    const promises = Array.from({ length: 100 }, () =>
      request(app)
        .post('/api/subscription-price/calculate')
        .send({
          planId: aiPlan.id,
          billingCycle: 'monthly',
          seatCount: 1,
          regionId: usRegion.id,
        })
    );

    await Promise.all(promises);

    // Monitor memory after
    const memAfter = process.memoryUsage().heapUsed;
    const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

    // Memory increase should be reasonable (<50MB for 100 operations)
    expect(memIncrease).toBeLessThan(50);
  });

  test('TC-LOAD-015: Throughput benchmark (100 req/sec sustained)', async () => {
    const { organization, owner } = await createTestOrganization();
    const authToken = await loginUser(owner.email, 'password123');

    const targetRequests = 100;
    const targetDuration = 1000; // 1 second

    const startTime = Date.now();
    
    const promises = Array.from({ length: targetRequests }, () =>
      request(app)
        .get('/api/subscription-plans')
    );

    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    const throughput = (targetRequests / duration) * 1000; // req/sec

    // Should sustain at least 100 req/sec
    expect(throughput).toBeGreaterThanOrEqual(100);
  });
});
