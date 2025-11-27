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
import crypto from 'crypto';

// Cashfree SDK imports
import { Cashfree } from 'cashfree-pg';

export class CashfreeGateway extends BasePaymentGateway {
  private cashfree: typeof Cashfree;

  constructor(config: PaymentGatewayConfig) {
    super(config);
    
    // Initialize Cashfree SDK
    Cashfree.XClientId = config.apiKey;
    Cashfree.XClientSecret = config.apiSecret;
    Cashfree.XEnvironment = config.environment === 'production' 
      ? Cashfree.Environment.PRODUCTION 
      : Cashfree.Environment.SANDBOX;
    
    this.cashfree = Cashfree;
  }

  get gatewayName(): string {
    return 'cashfree';
  }

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      const orderRequest = {
        order_id: request.orderId,
        order_amount: request.amount,
        order_currency: request.currency || 'INR',
        customer_details: {
          customer_id: request.customer.id || `cust_${Date.now()}`,
          customer_name: request.customer.name,
          customer_email: request.customer.email,
          customer_phone: request.customer.phone || '',
        },
        order_meta: {
          return_url: request.returnUrl || '',
          notify_url: request.notifyUrl || '',
          payment_methods: null, // Allow all payment methods
        },
        order_note: request.description || '',
      };

      const response = await this.cashfree.PGCreateOrder("2023-08-01", orderRequest);
      
      if (!response.data) {
        throw new Error('Failed to create Cashfree order: No response data');
      }

      const orderData = response.data;
      
      return {
        gatewayOrderId: orderData.cf_order_id?.toString() || request.orderId,
        sessionId: orderData.payment_session_id,
        paymentUrl: orderData.payments?.url,
        amount: request.amount,
        currency: request.currency || 'INR',
        status: this.normalizeCashfreeOrderStatus(orderData.order_status || 'ACTIVE'),
        metadata: {
          cfOrderId: orderData.cf_order_id,
          orderId: request.orderId, // Store merchant order ID for reference
          orderToken: orderData.order_token,
          paymentSessionId: orderData.payment_session_id,
        },
      };
    } catch (error: any) {
      console.error('[CashfreeGateway] Create order error:', error.response?.data || error.message);
      throw new Error(`Cashfree order creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getPaymentStatus(orderId: string): Promise<PaymentStatus> {
    try {
      // Cashfree SDK uses merchant order_id for fetching orders (not cf_order_id)
      // First fetch the order to get the cf_order_id
      const orderResponse = await this.cashfree.PGFetchOrder("2023-08-01", orderId);
      const order = orderResponse.data;
      
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Fetch payments using merchant order_id
      const paymentsResponse = await this.cashfree.PGOrderFetchPayments("2023-08-01", orderId);
      
      if (!paymentsResponse.data || paymentsResponse.data.length === 0) {
        // No payments yet, return order status
        return {
          orderId: orderId,
          gatewayOrderId: order.cf_order_id?.toString() || orderId,
          status: this.normalizeCashfreeOrderStatus(order.order_status || 'ACTIVE'),
          amount: order.order_amount || 0,
          currency: order.order_currency || 'INR',
          metadata: { 
            cfOrderId: order.cf_order_id,
            orderStatus: order.order_status,
          },
        };
      }

      // Get the latest successful payment, or the most recent one
      const payments = paymentsResponse.data;
      const successfulPayment = payments.find((p: any) => p.payment_status === 'SUCCESS');
      const payment = successfulPayment || payments[payments.length - 1];
      
      return {
        orderId: orderId,
        gatewayOrderId: order.cf_order_id?.toString() || orderId,
        gatewayPaymentId: payment.cf_payment_id?.toString(),
        status: this.normalizeCashfreePaymentStatus(payment.payment_status || ''),
        amount: payment.payment_amount || 0,
        currency: payment.payment_currency || 'INR',
        paidAt: payment.payment_completion_time ? new Date(payment.payment_completion_time) : undefined,
        failureReason: payment.payment_message,
        paymentMethod: this.extractPaymentMethod(payment.payment_method),
        metadata: {
          cfOrderId: order.cf_order_id,
          cfPaymentId: payment.cf_payment_id,
          paymentGroup: payment.payment_group,
          bankReference: payment.bank_reference,
          paymentMethod: payment.payment_method,
        },
      };
    } catch (error: any) {
      console.error('[CashfreeGateway] Get payment status error:', error.response?.data || error.message);
      throw new Error(`Cashfree payment status fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      // Request format: paymentId should be "orderId:cfPaymentId" or just "orderId"
      // If cfPaymentId is needed, it should be in request.notes or we fetch it
      const parts = request.paymentId.split(':');
      const orderId = parts[0];
      let cfPaymentId = parts[1];

      // Validate amount - Cashfree requires a positive refund amount
      if (!request.amount || request.amount <= 0) {
        throw new Error('Refund amount must be a positive number');
      }

      // If no cfPaymentId provided, fetch the successful payment for this order
      if (!cfPaymentId) {
        const paymentsResponse = await this.cashfree.PGOrderFetchPayments("2023-08-01", orderId);
        const payments = paymentsResponse.data || [];
        const successfulPayment = payments.find((p: any) => p.payment_status === 'SUCCESS');
        
        if (!successfulPayment) {
          throw new Error('No successful payment found for this order to refund');
        }
        cfPaymentId = successfulPayment.cf_payment_id?.toString();
      }

      if (!cfPaymentId) {
        throw new Error('Cashfree payment ID (cf_payment_id) is required for refund');
      }

      const refundId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const refundRequest = {
        refund_amount: request.amount,
        refund_id: refundId,
        refund_note: request.reason || 'Refund requested',
      };

      const response = await this.cashfree.PGOrderCreateRefund("2023-08-01", orderId, refundRequest);
      
      if (!response.data) {
        throw new Error('Failed to create refund: No response data');
      }

      const refund = response.data;
      
      return {
        refundId: refund.cf_refund_id?.toString() || refundId,
        status: this.normalizeCashfreeRefundStatus(refund.refund_status || ''),
        amount: refund.refund_amount || request.amount,
        currency: refund.refund_currency || 'INR',
        processedAt: refund.processed_at ? new Date(refund.processed_at) : undefined,
      };
    } catch (error: any) {
      console.error('[CashfreeGateway] Refund error:', error.response?.data || error.message);
      throw new Error(`Cashfree refund failed: ${error.response?.data?.message || error.message}`);
    }
  }

  verifyWebhookSignature(
    signature: string,
    payload: string | Buffer,
    timestamp?: string
  ): WebhookVerificationResult {
    try {
      const webhookSecret = this.config.webhookSecret;
      
      if (!webhookSecret) {
        console.warn('[CashfreeGateway] No webhook secret configured');
        return { isValid: false };
      }

      // Cashfree webhook signature verification
      // Format: timestamp + payload
      const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');
      const signaturePayload = timestamp ? `${timestamp}${payloadString}` : payloadString;
      
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signaturePayload)
        .digest('base64');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (isValid) {
        const data = JSON.parse(payloadString);
        return {
          isValid: true,
          event: data.type || data.event,
          data: data.data || data,
        };
      }

      return { isValid: false };
    } catch (error: any) {
      console.error('[CashfreeGateway] Webhook verification error:', error.message);
      return { isValid: false };
    }
  }

  getCheckoutScript(): { src: string; integrity?: string } {
    const isProduction = this.config.environment === 'production';
    return {
      src: isProduction 
        ? 'https://sdk.cashfree.com/js/v3/cashfree.js'
        : 'https://sandbox.cashfree.com/js/v3/cashfree.js',
    };
  }

  // Helper to extract payment method from Cashfree's nested structure
  private extractPaymentMethod(paymentMethod: any): string {
    if (!paymentMethod) return 'unknown';
    
    if (paymentMethod.card) {
      return `card:${paymentMethod.card.card_network || 'card'}`;
    }
    if (paymentMethod.upi) {
      return `upi:${paymentMethod.upi.upi_id || 'upi'}`;
    }
    if (paymentMethod.netbanking) {
      return `netbanking:${paymentMethod.netbanking.netbanking_bank_code || 'bank'}`;
    }
    if (paymentMethod.wallet) {
      return `wallet:${paymentMethod.wallet.channel || 'wallet'}`;
    }
    if (paymentMethod.paylater) {
      return `paylater:${paymentMethod.paylater.channel || 'paylater'}`;
    }
    if (paymentMethod.emi) {
      return `emi:${paymentMethod.emi.emi_bank || 'emi'}`;
    }
    
    return 'unknown';
  }

  // Helper method to normalize Cashfree order status
  private normalizeCashfreeOrderStatus(status: string): PaymentStatus['status'] {
    const normalizedStatus = status.toUpperCase();
    const statusMap: Record<string, PaymentStatus['status']> = {
      'ACTIVE': 'pending',
      'PAID': 'paid',
      'EXPIRED': 'cancelled',
      'TERMINATED': 'cancelled',
      'PARTIALLY_PAID': 'processing',
    };
    
    return statusMap[normalizedStatus] || 'pending';
  }

  // Helper method to normalize Cashfree payment status
  private normalizeCashfreePaymentStatus(status: string): PaymentStatus['status'] {
    const normalizedStatus = status.toUpperCase();
    const statusMap: Record<string, PaymentStatus['status']> = {
      'SUCCESS': 'paid',
      'PAID': 'paid',
      'FAILED': 'failed',
      'CANCELLED': 'cancelled',
      'PENDING': 'pending',
      'NOT_ATTEMPTED': 'pending',
      'USER_DROPPED': 'cancelled',
      'VOID': 'cancelled',
    };
    
    return statusMap[normalizedStatus] || 'pending';
  }

  // Helper method to normalize refund status
  private normalizeCashfreeRefundStatus(status: string): RefundResponse['status'] {
    const normalizedStatus = status.toUpperCase();
    const statusMap: Record<string, RefundResponse['status']> = {
      'SUCCESS': 'processed',
      'PROCESSED': 'processed',
      'PENDING': 'pending',
      'ONHOLD': 'pending',
      'CANCELLED': 'failed',
      'FAILED': 'failed',
    };
    
    return statusMap[normalizedStatus] || 'pending';
  }

  // Additional method: Fetch all payments for an order
  async fetchOrderPayments(orderId: string): Promise<any[]> {
    try {
      const response = await this.cashfree.PGOrderFetchPayments("2023-08-01", orderId);
      return response.data || [];
    } catch (error: any) {
      console.error('[CashfreeGateway] Fetch payments error:', error.response?.data || error.message);
      throw new Error(`Cashfree fetch payments failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Additional method: Get refund status
  async getRefundStatus(orderId: string, refundId: string): Promise<RefundResponse> {
    try {
      const response = await this.cashfree.PGOrderFetchRefund("2023-08-01", orderId, refundId);
      
      if (!response.data) {
        throw new Error('Refund not found');
      }

      const refund = response.data;
      
      return {
        refundId: refund.cf_refund_id?.toString() || refundId,
        status: this.normalizeCashfreeRefundStatus(refund.refund_status || ''),
        amount: refund.refund_amount || 0,
        currency: refund.refund_currency || 'INR',
        processedAt: refund.processed_at ? new Date(refund.processed_at) : undefined,
      };
    } catch (error: any) {
      console.error('[CashfreeGateway] Get refund status error:', error.response?.data || error.message);
      throw new Error(`Cashfree refund status fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Additional method: Create payment link
  async createPaymentLink(request: {
    linkId: string;
    amount: number;
    currency?: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    linkPurpose: string;
    linkExpiryTime?: string;
    returnUrl?: string;
    notifyUrl?: string;
  }): Promise<{
    linkId: string;
    linkUrl: string;
    status: string;
  }> {
    try {
      const linkRequest = {
        link_id: request.linkId,
        link_amount: request.amount,
        link_currency: request.currency || 'INR',
        link_purpose: request.linkPurpose,
        customer_details: {
          customer_name: request.customerName,
          customer_email: request.customerEmail,
          customer_phone: request.customerPhone,
        },
        link_expiry_time: request.linkExpiryTime,
        link_meta: {
          return_url: request.returnUrl,
          notify_url: request.notifyUrl,
        },
      };

      const response = await this.cashfree.PGCreateLink("2023-08-01", linkRequest);
      
      if (!response.data) {
        throw new Error('Failed to create payment link');
      }

      return {
        linkId: response.data.link_id || request.linkId,
        linkUrl: response.data.link_url || '',
        status: response.data.link_status || 'ACTIVE',
      };
    } catch (error: any) {
      console.error('[CashfreeGateway] Create payment link error:', error.response?.data || error.message);
      throw new Error(`Cashfree payment link creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Settlement methods
  async getSettlements(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<any> {
    try {
      const response = await this.cashfree.PGFetchSettlements("2023-08-01", {
        start_date: params?.startDate,
        end_date: params?.endDate,
        limit: params?.limit || 50,
        cursor: params?.cursor,
      });
      
      return response.data;
    } catch (error: any) {
      console.error('[CashfreeGateway] Get settlements error:', error.response?.data || error.message);
      throw new Error(`Cashfree settlements fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }
}
