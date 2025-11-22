import {
  BasePaymentGateway,
  type PaymentGatewayConfig,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type PaymentStatus,
  type RefundRequest,
  type RefundResponse,
  type WebhookVerificationResult,
} from './base-gateway';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export class RazorpayGateway extends BasePaymentGateway {
  private razorpay: Razorpay;

  constructor(config: PaymentGatewayConfig) {
    super(config);
    
    this.razorpay = new Razorpay({
      key_id: config.apiKey,
      key_secret: config.apiSecret,
    });
  }

  get gatewayName(): string {
    return 'razorpay';
  }

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(request.amount * 100),
        currency: request.currency,
        receipt: request.orderId,
        notes: request.metadata,
      });

      return {
        gatewayOrderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        status: this.normalizeStatus(order.status),
        metadata: {
          razorpayOrderId: order.id,
          receipt: order.receipt,
        },
      };
    } catch (error: any) {
      throw new Error(`Razorpay order creation failed: ${error.message}`);
    }
  }

  async getPaymentStatus(orderId: string): Promise<PaymentStatus> {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      const payments = await this.razorpay.orders.fetchPayments(orderId);

      const latestPayment = payments.items?.[0];

      return {
        orderId: order.receipt || orderId,
        gatewayOrderId: order.id,
        gatewayPaymentId: latestPayment?.id,
        status: this.normalizeStatus(latestPayment?.status || order.status),
        amount: order.amount / 100,
        currency: order.currency,
        paidAt: latestPayment?.created_at ? new Date(latestPayment.created_at * 1000) : undefined,
        paymentMethod: latestPayment?.method,
        metadata: {
          razorpayOrderId: order.id,
          razorpayPaymentId: latestPayment?.id,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch Razorpay payment status: ${error.message}`);
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refund = await this.razorpay.payments.refund(request.paymentId, {
        amount: request.amount ? Math.round(request.amount * 100) : undefined,
        notes: request.notes,
      });

      return {
        refundId: refund.id,
        status: this.normalizeStatus(refund.status),
        amount: refund.amount / 100,
        currency: refund.currency || 'INR',
        processedAt: refund.created_at ? new Date(refund.created_at * 1000) : undefined,
      };
    } catch (error: any) {
      throw new Error(`Razorpay refund failed: ${error.message}`);
    }
  }

  verifyWebhookSignature(
    signature: string,
    payload: string | Buffer,
    _timestamp?: string
  ): WebhookVerificationResult {
    try {
      if (!this.config.webhookSecret) {
        throw new Error('Webhook secret not configured for Razorpay');
      }

      const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');
      
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payloadString)
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (isValid) {
        const data = JSON.parse(payloadString);
        return {
          isValid: true,
          event: data.event,
          data: data.payload,
        };
      }

      return { isValid: false };
    } catch (error: any) {
      console.error('Razorpay webhook verification failed:', error);
      return { isValid: false };
    }
  }

  getCheckoutScript(): { src: string; integrity?: string } {
    return {
      src: 'https://checkout.razorpay.com/v1/checkout.js',
    };
  }

  verifyPaymentSignature(data: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    try {
      const text = `${data.orderId}|${data.paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.config.apiSecret)
        .update(text)
        .digest('hex');
      
      return expectedSignature === data.signature;
    } catch (error: any) {
      console.error('Error verifying Razorpay payment signature:', error);
      return false;
    }
  }
}
