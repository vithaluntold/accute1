export interface PaymentGatewayConfig {
  gateway: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret?: string;
  environment?: 'sandbox' | 'production';
  publicKey?: string;
}

export interface CreateOrderRequest {
  amount: number;
  currency: string;
  orderId: string;
  description?: string;
  customer: {
    id?: string;
    name: string;
    email: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
  returnUrl?: string;
  notifyUrl?: string;
}

export interface CreateOrderResponse {
  gatewayOrderId: string;
  sessionId?: string;
  paymentUrl?: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, any>;
}

export interface PaymentStatus {
  orderId: string;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  amount: number;
  currency: string;
  paidAt?: Date;
  failureReason?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
  notes?: Record<string, string>;
}

export interface RefundResponse {
  refundId: string;
  status: 'pending' | 'processed' | 'failed';
  amount: number;
  currency: string;
  processedAt?: Date;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: string;
  data?: any;
}

export abstract class BasePaymentGateway {
  protected config: PaymentGatewayConfig;
  
  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  abstract get gatewayName(): string;
  
  abstract createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse>;
  
  abstract getPaymentStatus(orderId: string): Promise<PaymentStatus>;
  
  abstract refundPayment(request: RefundRequest): Promise<RefundResponse>;
  
  abstract verifyWebhookSignature(
    signature: string,
    payload: string | Buffer,
    timestamp?: string
  ): WebhookVerificationResult;

  abstract getCheckoutScript(): {
    src: string;
    integrity?: string;
  };

  protected normalizeStatus(gatewayStatus: string): PaymentStatus['status'] {
    const statusMap: Record<string, PaymentStatus['status']> = {
      'created': 'pending',
      'active': 'pending',
      'pending': 'pending',
      'processing': 'processing',
      'authorized': 'processing',
      'captured': 'paid',
      'paid': 'paid',
      'success': 'paid',
      'failed': 'failed',
      'cancelled': 'cancelled',
      'expired': 'cancelled',
      'refunded': 'refunded',
    };
    
    return statusMap[gatewayStatus.toLowerCase()] || 'pending';
  }
}
