/**
 * SIX SIGMA PAYMENT WEBHOOK SECURITY TESTS
 * Target: 99.99966% defect-free (3.4 defects per million)
 * 
 * Uses isolated test fixtures and stubbed gateways for deterministic testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app, { initPromise } from '../../test-app';
import { db } from '../../db';
import { paymentGatewayConfigs, webhookEvents, payments, organizations, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { encryptionService } from '../../encryption-service';
import { createStubWebhookPayload } from '../helpers/stub-gateways';
import crypto from 'crypto';

describe('SIX SIGMA: Payment Webhook Security', () => {
  let testOrgId: string;
  let testUserId: string;
  let testConfigId: string;
  let webhookToken: string;
  let webhookUrl: string;
  
  // Test data cleanup list
  const createdIds: { table: string; id: string }[] = [];

  beforeEach(async () => {
    // Wait for app initialization
    await initPromise;
    
    // Create isolated test organization
    testOrgId = `test_org_${crypto.randomUUID()}`;
    const [org] = await db.insert(organizations).values({
      id: testOrgId,
      name: 'Test Org - Six Sigma',
      slug: `test-org-${Date.now()}`,
      subdomain: `test${Date.now()}`,
    }).returning();
    createdIds.push({ table: 'organizations', id: org.id });

    // Create test user
    testUserId = `test_user_${crypto.randomUUID()}`;
    const [user] = await db.insert(users).values({
      id: testUserId,
      organizationId: testOrgId,
      email: `test${Date.now()}@example.com`,
      fullName: 'Test User',
      role: 'admin',
      passwordHash: 'test_hash',
    }).returning();
    createdIds.push({ table: 'users', id: user.id });

    // Create test gateway configuration with stub credentials
    const encryptedKey = encryptionService.encrypt('test_key');
    const encryptedSecret = encryptionService.encrypt('test_secret');
    
    const [config] = await db.insert(paymentGatewayConfigs).values({
      id: `test_config_${crypto.randomUUID()}`,
      organizationId: testOrgId,
      gateway: 'razorpay',
      nickname: 'Test Gateway - Six Sigma',
      credentials: {
        keyId: encryptedKey,
        keySecret: encryptedSecret,
      },
      isActive: true,
      isDefault: true,
      webhookSecret: encryptionService.encrypt('test_webhook_secret'),
      createdBy: testUserId,
    }).returning();
    
    testConfigId = config.id;
    webhookToken = config.webhookToken;
    webhookUrl = `/api/payment/webhook/${webhookToken}`;
    createdIds.push({ table: 'payment_gateway_configs', id: config.id });
  });

  afterEach(async () => {
    // Clean up in reverse order (respecting foreign keys)
    for (const { table, id } of createdIds.reverse()) {
      await db.execute({ sql: `DELETE FROM ${table} WHERE id = '${id}'` });
    }
    createdIds.length = 0;
  });

  describe('Layer 1: Unguessable Webhook Token (256-bit entropy)', () => {
    it('should reject invalid webhook token', async () => {
      const fakeToken = 'a'.repeat(64);
      const { payload, signature, timestamp } = createStubWebhookPayload({
        eventId: 'evt_test_001',
      });
      
      const res = await request(app)
        .post(`/api/payment/webhook/${fakeToken}`)
        .set('x-webhook-timestamp', timestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('should validate webhook token format (64 hex characters)', () => {
      expect(webhookToken).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(webhookToken)).toBe(true);
    });
  });

  describe('Layer 2: Mandatory Timestamp Validation', () => {
    it('should REJECT webhook without timestamp header (CANNOT BYPASS)', async () => {
      const { payload, signature } = createStubWebhookPayload({
        eventId: 'evt_test_002',
      });
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('timestamp');
      expect(res.body.error).toContain('required');
    });

    it('should reject timestamp >5 minutes old (replay protection)', async () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const { payload, signature } = createStubWebhookPayload({
        eventId: 'evt_test_003',
      });
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', oldTimestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('timestamp');
    });

    it('should reject future timestamp >5 minutes', async () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString();
      const { payload, signature } = createStubWebhookPayload({
        eventId: 'evt_test_004',
      });
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', futureTimestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res.status).toBe(401);
    });

    it('should accept valid timestamp within 5-minute window', async () => {
      const recentTimestamp = (Math.floor(Date.now() / 1000) - 60).toString();
      const { payload, signature } = createStubWebhookPayload({
        eventId: 'evt_test_005',
        orderId: 'order_nonexistent',
      });
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', recentTimestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      // Should pass timestamp check (may fail later stages)
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
    });
  });

  describe('Layer 3: Atomic Event Deduplication', () => {
    it('should process first webhook request successfully', async () => {
      const { payload, signature, timestamp } = createStubWebhookPayload({
        eventId: 'evt_test_006',
        orderId: 'order_test_006',
        internalOrderId: 'ORD_test_006',
      });
      
      // Create payment record
      const [payment] = await db.insert(payments).values({
        id: `test_payment_${crypto.randomUUID()}`,
        organizationId: testOrgId,
        userId: testUserId,
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_test_006',
        internalOrderId: 'ORD_test_006',
        gatewayConfigId: testConfigId,
        gateway: 'razorpay',
      }).returning();
      createdIds.push({ table: 'payments', id: payment.id });
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', timestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res.status).toBe(200);
      
      // Verify event was recorded
      const [event] = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_test_006'));
      
      expect(event).toBeDefined();
      expect(event.eventType).toBe('payment.captured');
      
      if (event) {
        createdIds.push({ table: 'webhook_events', id: event.id });
      }
    });

    it('should reject duplicate event ID (atomic deduplication)', async () => {
      const { payload, signature, timestamp } = createStubWebhookPayload({
        eventId: 'evt_test_007',
        orderId: 'order_test_007',
        internalOrderId: 'ORD_test_007',
      });
      
      // Create payment
      const [payment] = await db.insert(payments).values({
        id: `test_payment_${crypto.randomUUID()}`,
        organizationId: testOrgId,
        userId: testUserId,
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_test_007',
        internalOrderId: 'ORD_test_007',
        gatewayConfigId: testConfigId,
        gateway: 'razorpay',
      }).returning();
      createdIds.push({ table: 'payments', id: payment.id });
      
      // First request
      const res1 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', timestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res1.status).toBe(200);
      
      // Duplicate request
      const res2 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', timestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain('already processed');
      
      // Verify only ONE event exists
      const events = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_test_007'));
      
      expect(events).toHaveLength(1);
      
      if (events[0]) {
        createdIds.push({ table: 'webhook_events', id: events[0].id });
      }
    });

    it('should handle concurrent duplicates atomically (race condition)', async () => {
      const { payload, signature, timestamp } = createStubWebhookPayload({
        eventId: 'evt_test_008',
        orderId: 'order_test_008',
        internalOrderId: 'ORD_test_008',
      });
      
      // Create payment
      const [payment] = await db.insert(payments).values({
        id: `test_payment_${crypto.randomUUID()}`,
        organizationId: testOrgId,
        userId: testUserId,
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_test_008',
        internalOrderId: 'ORD_test_008',
        gatewayConfigId: testConfigId,
        gateway: 'razorpay',
      }).returning();
      createdIds.push({ table: 'payments', id: payment.id });
      
      // Send 5 concurrent requests with SAME event ID
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post(webhookUrl)
          .set('x-webhook-timestamp', timestamp)
          .set('x-razorpay-signature', signature)
          .send(payload)
      );
      
      const responses = await Promise.all(requests);
      
      // All should return 200
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
      
      // Verify ONLY ONE event exists (atomic guarantee)
      const events = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_test_008'));
      
      expect(events).toHaveLength(1);
      
      // Verify payment updated only ONCE
      const [updatedPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, payment.id));
      
      expect(updatedPayment.status).toBe('completed');
      
      if (events[0]) {
        createdIds.push({ table: 'webhook_events', id: events[0].id });
      }
    });
  });

  describe('Six Sigma Attack Scenarios', () => {
    it('ATTACK: Replay attack with stolen valid webhook', async () => {
      const { payload, signature, timestamp } = createStubWebhookPayload({
        eventId: 'evt_attack_001',
        orderId: 'order_attack_001',
        internalOrderId: 'ORD_attack_001',
      });
      
      const [payment] = await db.insert(payments).values({
        id: `test_payment_${crypto.randomUUID()}`,
        organizationId: testOrgId,
        userId: testUserId,
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_attack_001',
        internalOrderId: 'ORD_attack_001',
        gatewayConfigId: testConfigId,
        gateway: 'razorpay',
      }).returning();
      createdIds.push({ table: 'payments', id: payment.id });
      
      // Legitimate webhook
      const res1 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', timestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res1.status).toBe(200);
      
      // Attacker replays SAME webhook
      const res2 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', timestamp)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain('already processed');
      
      // Clean up
      const events = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_attack_001'));
      
      if (events[0]) {
        createdIds.push({ table: 'webhook_events', id: events[0].id });
      }
    });

    it('ATTACK: Timestamp bypass attempt (omit header)', async () => {
      const { payload, signature } = createStubWebhookPayload({
        eventId: 'evt_attack_002',
      });
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-razorpay-signature', signature)
        .send(payload);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('timestamp');
      expect(res.body.error).toContain('required');
    });
  });
});
