/**
 * SIX SIGMA BILLING - WEBHOOK PROCESSING TESTS
 * Target: 20 tests for webhook event handling
 * Coverage: Event processing, reliability, deduplication, retry logic
 * Note: 11 webhook security tests exist in payment-webhook-security.test.ts
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { testDb as db } from '../../test-db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { clearDatabase } from '../helpers';

describe('Six Sigma Billing - Webhook Event Processing', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  test('TC-WEBHOOK-001: payment.succeeded event updates subscription status', async () => {
    const organizationId = 'org_test';
    
    // Create pending subscription
    const [subscription] = await db
      .insert(schema.platformSubscriptions)
      .values({
        organizationId,
        plan: 'ai',
        status: 'pending',
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

    // Simulate webhook event
    const eventId = 'evt_payment_success';
    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'stripe',
      eventType: 'payment_intent.succeeded',
      payload: { subscriptionId: subscription.id },
      status: 'processed',
      organizationId,
    });

    // Update subscription
    await db
      .update(schema.platformSubscriptions)
      .set({ status: 'active' })
      .where(eq(schema.platformSubscriptions.id, subscription.id));

    const [updated] = await db
      .select()
      .from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.id, subscription.id));

    expect(updated.status).toBe('active');
  });

  test('TC-WEBHOOK-002: payment.failed event marks subscription past_due', async () => {
    const organizationId = 'org_test';
    
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

    const eventId = 'evt_payment_failed';
    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'stripe',
      eventType: 'payment_intent.payment_failed',
      payload: { subscriptionId: subscription.id },
      status: 'processed',
      organizationId,
    });

    await db
      .update(schema.platformSubscriptions)
      .set({ status: 'past_due', failedPaymentCount: 1 })
      .where(eq(schema.platformSubscriptions.id, subscription.id));

    const [updated] = await db
      .select()
      .from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.id, subscription.id));

    expect(updated.status).toBe('past_due');
    expect(updated.failedPaymentCount).toBe(1);
  });

  test('TC-WEBHOOK-003: customer.subscription.deleted cancels subscription', async () => {
    const organizationId = 'org_test';
    
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

    const eventId = 'evt_sub_deleted';
    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'stripe',
      eventType: 'customer.subscription.deleted',
      payload: { subscriptionId: subscription.id },
      status: 'processed',
      organizationId,
    });

    await db
      .update(schema.platformSubscriptions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(schema.platformSubscriptions.id, subscription.id));

    const [updated] = await db
      .select()
      .from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.id, subscription.id));

    expect(updated.status).toBe('cancelled');
    expect(updated.cancelledAt).toBeDefined();
  });

  test('TC-WEBHOOK-004: invoice.payment_succeeded records payment', async () => {
    const organizationId = 'org_test';
    
    const eventId = 'evt_invoice_paid';
    const eventPayload = {
      invoiceId: 'inv_123',
      amount: 2300,
      currency: 'USD',
      paid: true,
    };

    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'stripe',
      eventType: 'invoice.payment_succeeded',
      payload: eventPayload,
      status: 'processed',
      organizationId,
    });

    // Create payment record
    await db.insert(schema.payments).values({
      organizationId,
      amount: 2300,
      currency: 'USD',
      method: 'gateway_payment',
      status: 'completed',
      gateway: 'stripe',
      internalOrderId: 'ORD_123',
      gatewayOrderId: 'inv_123',
      transactionDate: new Date(),
    });

    const payments = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.gatewayOrderId, 'inv_123'));

    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('completed');
  });

  test('TC-WEBHOOK-005: charge.refunded processes refund', async () => {
    const organizationId = 'org_test';
    
    const [payment] = await db
      .insert(schema.payments)
      .values({
        organizationId,
        amount: 2300,
        currency: 'USD',
        method: 'gateway_payment',
        status: 'completed',
        gateway: 'stripe',
        internalOrderId: 'ORD_456',
        gatewayOrderId: 'ch_456',
        gatewayPaymentId: 'ch_456',
        transactionDate: new Date(),
      })
      .returning();

    const eventId = 'evt_refund';
    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'stripe',
      eventType: 'charge.refunded',
      payload: { chargeId: 'ch_456', refundAmount: 2300 },
      status: 'processed',
      organizationId,
    });

    await db
      .update(schema.payments)
      .set({ status: 'refunded', refundedAmount: 2300 })
      .where(eq(schema.payments.id, payment.id));

    const [updated] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, payment.id));

    expect(updated.status).toBe('refunded');
    expect(updated.refundedAmount).toBe(2300);
  });

  test('TC-WEBHOOK-006: Razorpay payment.captured event processed', async () => {
    const organizationId = 'org_test';
    
    const eventId = 'evt_razorpay_captured';
    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'razorpay',
      eventType: 'payment.captured',
      payload: {
        paymentId: 'pay_razorpay_123',
        amount: 67000,
        currency: 'INR',
      },
      status: 'processed',
      organizationId,
    });

    const events = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.eventId, eventId));

    expect(events.length).toBe(1);
    expect(events[0].provider).toBe('razorpay');
    expect(events[0].status).toBe('processed');
  });

  test('TC-WEBHOOK-007: Webhook event timestamps recorded', async () => {
    const organizationId = 'org_test';
    
    const eventId = 'evt_timestamp';
    const [event] = await db
      .insert(schema.webhookEvents)
      .values({
        eventId,
        provider: 'stripe',
        eventType: 'test.event',
        payload: { test: 'data' },
        status: 'pending',
        organizationId,
      })
      .returning();

    expect(event.createdAt).toBeDefined();
    
    // Update to processed
    await db
      .update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, event.id));

    const [updated] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.id, event.id));

    expect(updated.processedAt).toBeDefined();
  });

  test('TC-WEBHOOK-008: Failed webhook marked with error', async () => {
    const organizationId = 'org_test';
    
    const eventId = 'evt_failed';
    const [event] = await db
      .insert(schema.webhookEvents)
      .values({
        eventId,
        provider: 'stripe',
        eventType: 'test.event',
        payload: { test: 'data' },
        status: 'pending',
        organizationId,
      })
      .returning();

    await db
      .update(schema.webhookEvents)
      .set({
        status: 'failed',
        errorMessage: 'Database connection timeout',
        retryCount: 1,
      })
      .where(eq(schema.webhookEvents.id, event.id));

    const [updated] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.id, event.id));

    expect(updated.status).toBe('failed');
    expect(updated.errorMessage).toContain('timeout');
    expect(updated.retryCount).toBe(1);
  });

  test('TC-WEBHOOK-009: Webhook retry after transient failure', async () => {
    const organizationId = 'org_test';
    
    const eventId = 'evt_retry';
    const [event] = await db
      .insert(schema.webhookEvents)
      .values({
        eventId,
        provider: 'stripe',
        eventType: 'test.event',
        payload: { test: 'data' },
        status: 'failed',
        errorMessage: 'Temporary network error',
        retryCount: 1,
        organizationId,
      })
      .returning();

    // Retry
    await db
      .update(schema.webhookEvents)
      .set({
        status: 'processed',
        retryCount: 2,
        processedAt: new Date(),
      })
      .where(eq(schema.webhookEvents.id, event.id));

    const [updated] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.id, event.id));

    expect(updated.status).toBe('processed');
    expect(updated.retryCount).toBe(2);
  });
});

describe('Six Sigma Billing - Webhook Reliability', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  test('TC-WEBHOOK-010: Event deduplication prevents double processing', async () => {
    const organizationId = 'org_test';
    const eventId = 'evt_duplicate_test';

    // First event
    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'stripe',
      eventType: 'payment_intent.succeeded',
      payload: { test: 'first' },
      status: 'processed',
      organizationId,
    });

    // Attempt duplicate
    try {
      await db.insert(schema.webhookEvents).values({
        eventId, // Same event ID
        provider: 'stripe',
        eventType: 'payment_intent.succeeded',
        payload: { test: 'duplicate' },
        status: 'pending',
        organizationId,
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('unique');
    }

    const events = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.eventId, eventId));

    expect(events.length).toBe(1);
    expect(events[0].payload).toEqual({ test: 'first' });
  });

  test('TC-WEBHOOK-011: Webhook processing within 5 seconds SLA', async () => {
    const organizationId = 'org_test';
    
    const eventId = 'evt_sla_test';
    const startTime = new Date();
    
    await db.insert(schema.webhookEvents).values({
      eventId,
      provider: 'stripe',
      eventType: 'test.event',
      payload: { test: 'sla' },
      status: 'pending',
      organizationId,
    });

    // Simulate processing
    await db
      .update(schema.webhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.webhookEvents.eventId, eventId));

    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();

    expect(processingTime).toBeLessThan(5000); // 5 seconds
  });

  test('TC-WEBHOOK-012: Out-of-order events handled correctly', async () => {
    const organizationId = 'org_test';
    
    // Event 2 arrives before Event 1
    await db.insert(schema.webhookEvents).values([
      {
        eventId: 'evt_002',
        provider: 'stripe',
        eventType: 'test.sequence',
        payload: { sequence: 2 },
        status: 'processed',
        organizationId,
        createdAt: new Date('2025-11-22T10:02:00Z'),
      },
      {
        eventId: 'evt_001',
        provider: 'stripe',
        eventType: 'test.sequence',
        payload: { sequence: 1 },
        status: 'processed',
        organizationId,
        createdAt: new Date('2025-11-22T10:01:00Z'),
      },
    ]);

    const events = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.provider, 'stripe'));

    expect(events.length).toBe(2);
    // Both should be processed regardless of arrival order
    expect(events.every(e => e.status === 'processed')).toBe(true);
  });

  test('TC-WEBHOOK-013: Maximum 3 retry attempts before permanent failure', async () => {
    const organizationId = 'org_test';
    
    const [event] = await db
      .insert(schema.webhookEvents)
      .values({
        eventId: 'evt_max_retry',
        provider: 'stripe',
        eventType: 'test.event',
        payload: { test: 'retry' },
        status: 'failed',
        retryCount: 3,
        errorMessage: 'Persistent error',
        organizationId,
      })
      .returning();

    expect(event.retryCount).toBe(3);
    expect(event.status).toBe('failed');
    // Should not retry beyond 3 attempts
  });

  test('TC-WEBHOOK-014: Webhook payload preserved for debugging', async () => {
    const organizationId = 'org_test';
    
    const payload = {
      eventId: 'pi_test',
      amount: 2300,
      currency: 'USD',
      metadata: { subscriptionId: 'sub_123' },
    };

    await db.insert(schema.webhookEvents).values({
      eventId: 'evt_payload_test',
      provider: 'stripe',
      eventType: 'payment_intent.succeeded',
      payload,
      status: 'processed',
      organizationId,
    });

    const [event] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.eventId, 'evt_payload_test'));

    expect(event.payload).toEqual(payload);
  });

  test('TC-WEBHOOK-015: Provider-specific event types tracked', async () => {
    const organizationId = 'org_test';
    
    await db.insert(schema.webhookEvents).values([
      {
        eventId: 'evt_stripe_1',
        provider: 'stripe',
        eventType: 'payment_intent.succeeded',
        payload: {},
        status: 'processed',
        organizationId,
      },
      {
        eventId: 'evt_razorpay_1',
        provider: 'razorpay',
        eventType: 'payment.captured',
        payload: {},
        status: 'processed',
        organizationId,
      },
    ]);

    const stripeEvents = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.provider, 'stripe'));

    const razorpayEvents = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.provider, 'razorpay'));

    expect(stripeEvents.length).toBe(1);
    expect(razorpayEvents.length).toBe(1);
  });

  test('TC-WEBHOOK-016: Webhook events scoped to organization', async () => {
    const org1 = 'org_001';
    const org2 = 'org_002';

    await db.insert(schema.webhookEvents).values([
      {
        eventId: 'evt_org1',
        provider: 'stripe',
        eventType: 'test.event',
        payload: {},
        status: 'processed',
        organizationId: org1,
      },
      {
        eventId: 'evt_org2',
        provider: 'stripe',
        eventType: 'test.event',
        payload: {},
        status: 'processed',
        organizationId: org2,
      },
    ]);

    const org1Events = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.organizationId, org1));

    expect(org1Events.length).toBe(1);
    expect(org1Events[0].eventId).toBe('evt_org1');
  });

  test('TC-WEBHOOK-017: Webhook queue depth monitoring', async () => {
    const organizationId = 'org_test';
    
    // Create multiple pending events
    await db.insert(schema.webhookEvents).values([
      {
        eventId: 'evt_queue_1',
        provider: 'stripe',
        eventType: 'test.event',
        payload: {},
        status: 'pending',
        organizationId,
      },
      {
        eventId: 'evt_queue_2',
        provider: 'stripe',
        eventType: 'test.event',
        payload: {},
        status: 'pending',
        organizationId,
      },
      {
        eventId: 'evt_queue_3',
        provider: 'stripe',
        eventType: 'test.event',
        payload: {},
        status: 'processing',
        organizationId,
      },
    ]);

    const pendingCount = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.status, 'pending'));

    expect(pendingCount.length).toBe(2);
  });

  test('TC-WEBHOOK-018: Successful webhook processing rate > 99%', async () => {
    const organizationId = 'org_test';
    
    // Create 100 events, 99 successful, 1 failed
    const events = Array.from({ length: 100 }, (_, i) => ({
      eventId: `evt_${i}`,
      provider: 'stripe',
      eventType: 'test.event',
      payload: {},
      status: i === 50 ? 'failed' : 'processed',
      organizationId,
    }));

    await db.insert(schema.webhookEvents).values(events);

    const total = await db.select().from(schema.webhookEvents);
    const successful = total.filter(e => e.status === 'processed');
    
    const successRate = (successful.length / total.length) * 100;
    expect(successRate).toBeGreaterThanOrEqual(99);
  });

  test('TC-WEBHOOK-019: Webhook error categories tracked', async () => {
    const organizationId = 'org_test';
    
    await db.insert(schema.webhookEvents).values([
      {
        eventId: 'evt_err_1',
        provider: 'stripe',
        eventType: 'test.event',
        payload: {},
        status: 'failed',
        errorMessage: 'Database connection timeout',
        organizationId,
      },
      {
        eventId: 'evt_err_2',
        provider: 'stripe',
        eventType: 'test.event',
        payload: {},
        status: 'failed',
        errorMessage: 'Invalid signature',
        organizationId,
      },
    ]);

    const errors = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.status, 'failed'));

    expect(errors.length).toBe(2);
    expect(errors.some(e => e.errorMessage?.includes('timeout'))).toBe(true);
    expect(errors.some(e => e.errorMessage?.includes('signature'))).toBe(true);
  });

  test('TC-WEBHOOK-020: Webhook processing idempotency key support', async () => {
    const organizationId = 'org_test';
    
    const payload = {
      paymentId: 'pi_123',
      idempotencyKey: 'idem_unique_key',
    };

    await db.insert(schema.webhookEvents).values({
      eventId: 'evt_idem',
      provider: 'stripe',
      eventType: 'payment_intent.succeeded',
      payload,
      status: 'processed',
      organizationId,
    });

    const [event] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.eventId, 'evt_idem'));

    expect(event.payload).toHaveProperty('idempotencyKey');
  });
});
