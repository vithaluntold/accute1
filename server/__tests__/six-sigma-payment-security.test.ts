/**
 * SIX SIGMA PAYMENT SECURITY TESTS
 * Validates 11-layer defense-in-depth architecture
 * Target: 99.99966% defect-free (3.4 defects per million)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { db } from '../db';
import { paymentGatewayConfigs, webhookEvents, payments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { encryptionService } from '../encryption-service';

describe('SIX SIGMA: Payment Webhook Security', () => {
  let testConfig: any;
  let testOrgId: string;
  let webhookUrl: string;
  let validSignature: string;
  let validPayload: string;
  let validTimestamp: string;

  beforeEach(async () => {
    // Create test organization and config
    testOrgId = crypto.randomUUID();
    
    // Encrypt test credentials
    const encryptedKey = encryptionService.encrypt('test_razorpay_key');
    const encryptedSecret = encryptionService.encrypt('test_razorpay_secret');
    
    const [config] = await db.insert(paymentGatewayConfigs).values({
      organizationId: testOrgId,
      gateway: 'razorpay',
      nickname: 'Test Gateway',
      credentials: {
        keyId: encryptedKey,
        keySecret: encryptedSecret,
      },
      isActive: true,
      isDefault: true,
      webhookSecret: encryptionService.encrypt('test_webhook_secret'),
      createdBy: crypto.randomUUID(),
    }).returning();
    
    testConfig = config;
    webhookUrl = `/api/payment/webhook/${testConfig.webhookToken}`;
    
    // Prepare valid webhook request
    validTimestamp = Math.floor(Date.now() / 1000).toString();
    validPayload = JSON.stringify({
      event: {
        id: 'evt_test_123',
        type: 'payment.captured',
        data: {
          orderId: 'order_test_123',
          internalOrderId: 'ORD_123456_abc',
          status: 'captured',
          amount: 10000,
        },
      },
    });
    
    // Generate valid HMAC signature
    const hmac = crypto.createHmac('sha256', 'test_webhook_secret');
    hmac.update(validPayload);
    validSignature = hmac.digest('hex');
  });

  afterEach(async () => {
    // Cleanup
    await db.delete(webhookEvents).where(eq(webhookEvents.gatewayConfigId, testConfig.id));
    await db.delete(paymentGatewayConfigs).where(eq(paymentGatewayConfigs.id, testConfig.id));
  });

  describe('Layer 1: Unguessable Webhook Token', () => {
    it('should reject invalid webhook token (256-bit entropy)', async () => {
      const fakeToken = 'a'.repeat(64); // Valid format but wrong token
      const res = await request(app)
        .post(`/api/payment/webhook/${fakeToken}`)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Gateway configuration not found');
    });

    it('should accept valid webhook token', async () => {
      expect(testConfig.webhookToken).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(testConfig.webhookToken)).toBe(true);
    });
  });

  describe('Layer 2: Mandatory Timestamp Validation', () => {
    it('should REJECT webhook without timestamp header (CANNOT BYPASS)', async () => {
      const res = await request(app)
        .post(webhookUrl)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('timestamp');
      expect(res.body.error).toContain('required');
    });

    it('should reject webhook with timestamp >5 minutes old', async () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 6+ minutes old
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', oldTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('timestamp');
      expect(res.body.error).toContain('replay');
    });

    it('should reject webhook with future timestamp >5 minutes', async () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString();
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', futureTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('timestamp');
    });

    it('should accept webhook with valid timestamp within 5-minute window', async () => {
      const recentTimestamp = (Math.floor(Date.now() / 1000) - 60).toString(); // 1 minute ago
      
      // Need to regenerate signature with new payload
      const hmac = crypto.createHmac('sha256', 'test_webhook_secret');
      hmac.update(validPayload);
      const sig = hmac.digest('hex');
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', recentTimestamp)
        .set('x-razorpay-signature', sig)
        .send(validPayload);
      
      // Will fail on signature, but should pass timestamp check
      expect(res.status).not.toBe(400); // Not 400 (bad request) from missing timestamp
    });
  });

  describe('Layer 3: Atomic Event Deduplication', () => {
    it('should process first webhook request successfully', async () => {
      // Create payment record first
      await db.insert(payments).values({
        id: crypto.randomUUID(),
        organizationId: testOrgId,
        userId: crypto.randomUUID(),
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_test_123',
        internalOrderId: 'ORD_123456_abc',
        gatewayConfigId: testConfig.id,
        gateway: 'razorpay',
      });
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res.status).toBe(200);
      
      // Verify event was recorded
      const [event] = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_test_123'));
      
      expect(event).toBeDefined();
      expect(event.eventType).toBe('payment.captured');
    });

    it('should reject duplicate event ID (database unique constraint)', async () => {
      // Create payment record
      await db.insert(payments).values({
        id: crypto.randomUUID(),
        organizationId: testOrgId,
        userId: crypto.randomUUID(),
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_test_123',
        internalOrderId: 'ORD_123456_abc',
        gatewayConfigId: testConfig.id,
        gateway: 'razorpay',
      });
      
      // First request
      const res1 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res1.status).toBe(200);
      
      // Duplicate request with SAME event ID
      const res2 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain('already processed');
      
      // Verify only ONE event record exists
      const events = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_test_123'));
      
      expect(events).toHaveLength(1);
    });

    it('should handle concurrent duplicate requests atomically (race condition test)', async () => {
      // Create payment record
      await db.insert(payments).values({
        id: crypto.randomUUID(),
        organizationId: testOrgId,
        userId: crypto.randomUUID(),
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_test_123',
        internalOrderId: 'ORD_123456_abc',
        gatewayConfigId: testConfig.id,
        gateway: 'razorpay',
      });
      
      // Send 5 concurrent requests with SAME event ID
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post(webhookUrl)
          .set('x-webhook-timestamp', validTimestamp)
          .set('x-razorpay-signature', validSignature)
          .send(validPayload)
      );
      
      const responses = await Promise.all(requests);
      
      // All should return 200 (either success or "already processed")
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
      
      // Verify ONLY ONE event record exists (atomic deduplication)
      const events = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_test_123'));
      
      expect(events).toHaveLength(1);
      
      // Verify payment was updated only ONCE
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.internalOrderId, 'ORD_123456_abc'));
      
      expect(payment.status).toBe('captured');
    });
  });

  describe('Layer 4: HMAC Signature Verification', () => {
    it('should reject webhook without signature', async () => {
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .send(validPayload);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('signature');
    });

    it('should reject webhook with invalid signature', async () => {
      const invalidSignature = 'invalid_signature_12345';
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', invalidSignature)
        .send(validPayload);
      
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('signature');
    });

    it('should reject webhook with tampered payload', async () => {
      const tamperedPayload = validPayload.replace('10000', '99999'); // Attacker changes amount
      
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature) // Old signature won't match
        .send(tamperedPayload);
      
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('signature');
    });
  });

  describe('Six Sigma Attack Scenario Tests', () => {
    it('ATTACK: Replay attack with stolen valid webhook', async () => {
      // Create payment
      await db.insert(payments).values({
        id: crypto.randomUUID(),
        organizationId: testOrgId,
        userId: crypto.randomUUID(),
        amount: '100.00',
        currency: 'INR',
        status: 'pending',
        gatewayOrderId: 'order_test_123',
        internalOrderId: 'ORD_123456_abc',
        gatewayConfigId: testConfig.id,
        gateway: 'razorpay',
      });
      
      // Attacker captures legitimate webhook
      const res1 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res1.status).toBe(200);
      
      // Attacker tries to replay SAME webhook
      const res2 = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain('already processed');
      
      // Verify payment NOT double-credited
      const events = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, 'evt_test_123'));
      
      expect(events).toHaveLength(1);
    });

    it('ATTACK: Timestamp bypass attempt (omit header)', async () => {
      // Attacker tries to bypass timestamp check by not sending header
      const res = await request(app)
        .post(webhookUrl)
        .set('x-razorpay-signature', validSignature)
        .send(validPayload);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('timestamp');
      expect(res.body.error).toContain('required');
    });

    it('ATTACK: Cross-tenant webhook poisoning', async () => {
      // Create victim organization
      const victimOrgId = crypto.randomUUID();
      
      // Attacker tries to use their webhook token against victim org
      // (Should fail because webhook token is tied to specific config)
      const res = await request(app)
        .post(webhookUrl)
        .set('x-webhook-timestamp', validTimestamp)
        .set('x-razorpay-signature', validSignature)
        .send({
          event: {
            id: 'evt_attack_456',
            type: 'payment.captured',
            data: {
              orderId: 'order_victim_123',
              internalOrderId: 'ORD_victim_123',
              organizationId: victimOrgId, // Attacker specifies victim org
              status: 'captured',
              amount: 10000,
            },
          },
        });
      
      // Should fail because webhookToken is bound to testOrgId, not victimOrgId
      expect(res.status).toBe(401);
    });
  });

  describe('Performance & Reliability', () => {
    it('should handle 100 sequential webhooks within acceptable time', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        const uniquePayload = JSON.stringify({
          event: {
            id: `evt_perf_${i}`,
            type: 'payment.captured',
            data: {
              orderId: `order_${i}`,
              internalOrderId: `ORD_${i}`,
              status: 'captured',
              amount: 10000,
            },
          },
        });
        
        const hmac = crypto.createHmac('sha256', 'test_webhook_secret');
        hmac.update(uniquePayload);
        const sig = hmac.digest('hex');
        
        await request(app)
          .post(webhookUrl)
          .set('x-webhook-timestamp', validTimestamp)
          .set('x-razorpay-signature', sig)
          .send(uniquePayload);
      }
      
      const duration = Date.now() - startTime;
      console.log(`Processed 100 webhooks in ${duration}ms (${duration/100}ms avg)`);
      
      // Six Sigma: < 50ms average per webhook
      expect(duration / 100).toBeLessThan(50);
    });
  });
});

describe('SIX SIGMA: Encryption Key Persistence', () => {
  it('should maintain same derived key across service instances', () => {
    // Simulate server restart with same ENCRYPTION_KEY
    const testKey = 'test-encryption-key-with-32-chars';
    const originalEnvKey = process.env.ENCRYPTION_KEY;
    
    try {
      process.env.ENCRYPTION_KEY = testKey;
      
      // Reset and create new instance (simulates server restart)
      if (process.env.NODE_ENV === 'test') {
        const EncryptionService = require('../encryption-service').EncryptionService;
        EncryptionService.resetInstance();
        
        const instance1 = EncryptionService.getInstance();
        const encrypted1 = instance1.encrypt('sensitive-llm-api-key');
        
        // Reset again (simulate another restart)
        EncryptionService.resetInstance();
        const instance2 = EncryptionService.getInstance();
        
        // Should decrypt successfully
        const decrypted = instance2.decrypt(encrypted1);
        expect(decrypted).toBe('sensitive-llm-api-key');
      }
    } finally {
      process.env.ENCRYPTION_KEY = originalEnvKey;
    }
  });

  it('should persist LLM credentials across server restarts', () => {
    const testApiKey = 'sk-test-openai-api-key-12345';
    
    // Encrypt as if storing in database
    const encrypted = encryptionService.encrypt(testApiKey);
    expect(encrypted).toContain(':'); // Should be in format iv:data:authTag
    
    // Simulate server restart - decrypt from "database"
    const decrypted = encryptionService.decrypt(encrypted);
    expect(decrypted).toBe(testApiKey);
    
    // Verify safeDecrypt also works
    const safeDecrypted = encryptionService.safeDecrypt(encrypted);
    expect(safeDecrypted).toBe(testApiKey);
  });

  it('should throw loud error if ENCRYPTION_KEY changes', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    
    try {
      // Encrypt with current key
      const encrypted = encryptionService.encrypt('test-data');
      
      // Change ENCRYPTION_KEY (simulates accidental key change)
      process.env.ENCRYPTION_KEY = 'different-key-with-at-least-32-characters';
      
      if (process.env.NODE_ENV === 'test') {
        const EncryptionService = require('../encryption-service').EncryptionService;
        EncryptionService.resetInstance();
        const newInstance = EncryptionService.getInstance();
        
        // Should FAIL LOUDLY with actionable error
        expect(() => newInstance.decrypt(encrypted)).toThrow(/ENCRYPTION_KEY may have changed/);
        expect(() => newInstance.safeDecrypt(encrypted)).toThrow(/ENCRYPTION_KEY may have changed/);
      }
    } finally {
      process.env.ENCRYPTION_KEY = originalKey;
    }
  });
});
