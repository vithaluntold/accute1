/**
 * Stubbed Payment Gateways for Testing
 * Provides deterministic, controllable gateway behavior without external dependencies
 */

import crypto from 'crypto';
import { BasePaymentGateway, PaymentOrder, PaymentStatus, RefundResult, WebhookVerification } from '../../payment-gateways/base-gateway';

export class StubRazorpayGateway extends BasePaymentGateway {
  async createOrder(amount: number, currency: string, notes?: Record<string, any>): Promise<PaymentOrder> {
    return {
      id: `stub_order_${Date.now()}`,
      amount,
      currency,
      status: 'created' as PaymentStatus,
      createdAt: new Date(),
      notes,
    };
  }

  async getOrderStatus(orderId: string): Promise<PaymentStatus> {
    // Deterministic: orders ending in 'fail' return failed
    if (orderId.includes('fail')) return 'failed';
    if (orderId.includes('pending')) return 'pending';
    return 'completed';
  }

  async refund(paymentId: string, amount?: number, notes?: Record<string, any>): Promise<RefundResult> {
    return {
      refundId: `stub_refund_${Date.now()}`,
      status: 'processed',
      amount: amount || 0,
      currency: 'INR',
      processedAt: new Date(),
    };
  }

  verifyWebhookSignature(signature: string, payload: string, timestamp?: string): WebhookVerification {
    // Deterministic verification
    const expectedSignature = this.generateStubSignature(payload, timestamp);
    
    if (signature === expectedSignature) {
      const parsedPayload = JSON.parse(payload);
      return {
        isValid: true,
        event: parsedPayload.event || parsedPayload,
      };
    }
    
    return {
      isValid: false,
      error: 'Invalid signature',
    };
  }

  /**
   * Generate deterministic stub signature for testing
   */
  generateStubSignature(payload: string, timestamp?: string): string {
    const secret = 'test_webhook_secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    if (timestamp) {
      hmac.update(timestamp);
    }
    return hmac.digest('hex');
  }
}

/**
 * Create stub gateway with predictable behavior
 */
export function createStubGateway(gateway: 'razorpay' | 'stripe' = 'razorpay'): BasePaymentGateway {
  if (gateway === 'razorpay') {
    return new StubRazorpayGateway('test_key', 'test_secret');
  }
  throw new Error(`Stub gateway not implemented: ${gateway}`);
}

/**
 * Generate valid webhook payload for testing
 */
export function createStubWebhookPayload(options: {
  eventId?: string;
  eventType?: string;
  orderId?: string;
  internalOrderId?: string;
  amount?: number;
  status?: string;
}): { payload: string; signature: string; timestamp: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const payload = JSON.stringify({
    event: {
      id: options.eventId || `evt_stub_${Date.now()}`,
      type: options.eventType || 'payment.captured',
      data: {
        orderId: options.orderId || `order_stub_${Date.now()}`,
        internalOrderId: options.internalOrderId,
        status: options.status || 'captured',
        amount: options.amount || 10000,
      },
    },
  });
  
  const stubGateway = new StubRazorpayGateway('test_key', 'test_secret');
  const signature = stubGateway.generateStubSignature(payload, timestamp);
  
  return { payload, signature, timestamp };
}
