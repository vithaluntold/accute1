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

export class CashfreeGateway extends BasePaymentGateway {
  constructor(config: PaymentGatewayConfig) {
    super(config);
    
    throw new Error(
      'Cashfree integration not yet implemented. To enable Cashfree:\n' +
      '1. Install package: npm install cashfree-pg\n' +
      '2. Implement the Cashfree SDK integration in this file\n' +
      '3. Add CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET to environment variables\n' +
      '4. Refer to: https://github.com/cashfree/cashfree-pg-sdk-nodejs'
    );
  }

  get gatewayName(): string {
    return 'cashfree';
  }

  async createOrder(_request: CreateOrderRequest): Promise<CreateOrderResponse> {
    throw new Error('Cashfree integration not implemented');
  }

  async getPaymentStatus(_orderId: string): Promise<PaymentStatus> {
    throw new Error('Cashfree integration not implemented');
  }

  async refundPayment(_request: RefundRequest): Promise<RefundResponse> {
    throw new Error('Cashfree integration not implemented');
  }

  verifyWebhookSignature(
    _signature: string,
    _payload: string | Buffer,
    _timestamp?: string
  ): WebhookVerificationResult {
    throw new Error('Cashfree integration not implemented');
  }

  getCheckoutScript(): { src: string; integrity?: string } {
    return {
      src: 'https://sdk.cashfree.com/js/ui/2.0.0/cashfree.prod.js',
    };
  }
}
