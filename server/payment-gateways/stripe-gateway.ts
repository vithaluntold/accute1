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
import Stripe from 'stripe';

export class StripeGateway extends BasePaymentGateway {
  private stripe: Stripe;

  constructor(config: PaymentGatewayConfig) {
    super(config);
    
    this.stripe = new Stripe(config.apiSecret, {
      apiVersion: '2024-11-20.acacia',
    });
  }

  get gatewayName(): string {
    return 'stripe';
  }

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100),
        currency: request.currency.toLowerCase(),
        description: request.description,
        metadata: {
          orderId: request.orderId,
          ...request.metadata,
        },
        receipt_email: request.customer.email,
      });

      return {
        gatewayOrderId: paymentIntent.id,
        sessionId: paymentIntent.client_secret || undefined,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        status: this.normalizeStatus(paymentIntent.status),
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
        },
      };
    } catch (error: any) {
      throw new Error(`Stripe payment intent creation failed: ${error.message}`);
    }
  }

  async getPaymentStatus(orderId: string): Promise<PaymentStatus> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(orderId);

      return {
        orderId: paymentIntent.metadata.orderId || orderId,
        gatewayOrderId: paymentIntent.id,
        gatewayPaymentId: paymentIntent.id,
        status: this.normalizeStatus(paymentIntent.status),
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paidAt: paymentIntent.status === 'succeeded' && paymentIntent.created
          ? new Date(paymentIntent.created * 1000)
          : undefined,
        paymentMethod: paymentIntent.payment_method_types?.[0],
        failureReason: paymentIntent.last_payment_error?.message,
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch Stripe payment status: ${error.message}`);
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: request.paymentId,
        amount: request.amount ? Math.round(request.amount * 100) : undefined,
        reason: request.reason as any,
        metadata: request.notes,
      });

      return {
        refundId: refund.id,
        status: this.normalizeStatus(refund.status),
        amount: refund.amount / 100,
        currency: refund.currency.toUpperCase(),
        processedAt: refund.created ? new Date(refund.created * 1000) : undefined,
      };
    } catch (error: any) {
      throw new Error(`Stripe refund failed: ${error.message}`);
    }
  }

  verifyWebhookSignature(
    signature: string,
    payload: string | Buffer,
    _timestamp?: string
  ): WebhookVerificationResult {
    try {
      if (!this.config.webhookSecret) {
        throw new Error('Webhook secret not configured for Stripe');
      }

      const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');
      
      const event = this.stripe.webhooks.constructEvent(
        payloadString,
        signature,
        this.config.webhookSecret
      );

      return {
        isValid: true,
        event: event.type,
        data: event.data.object,
      };
    } catch (error: any) {
      console.error('Stripe webhook verification failed:', error);
      return { isValid: false };
    }
  }

  getCheckoutScript(): { src: string; integrity?: string } {
    return {
      src: 'https://js.stripe.com/v3/',
    };
  }
}
