import { BasePaymentGateway, type PaymentGatewayConfig } from './base-gateway';
import { RazorpayGateway } from './razorpay-gateway';
import { StripeGateway } from './stripe-gateway';
import { CashfreeGateway } from './cashfree-gateway';
import { db } from '../db';
import { paymentGatewayConfigs } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { safeDecrypt } from '../encryption-service';

type GatewayType = 'razorpay' | 'stripe' | 'cashfree' | 'payu' | 'payoneer';

export class PaymentGatewayFactory {
  private static instances: Map<string, BasePaymentGateway> = new Map();

  static async getGateway(
    organizationId: string,
    gatewayType?: GatewayType
  ): Promise<BasePaymentGateway> {
    const config = await this.getGatewayConfig(organizationId, gatewayType);
    
    const cacheKey = `${organizationId}-${config.gateway}`;
    
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }

    const gateway = this.createGatewayInstance(config);
    this.instances.set(cacheKey, gateway);
    
    return gateway;
  }

  static async getGatewayConfig(
    organizationId: string,
    gatewayType?: GatewayType
  ): Promise<PaymentGatewayConfig> {
    let query = db
      .select()
      .from(paymentGatewayConfigs)
      .where(eq(paymentGatewayConfigs.organizationId, organizationId));

    if (gatewayType) {
      query = query.where(
        and(
          eq(paymentGatewayConfigs.organizationId, organizationId),
          eq(paymentGatewayConfigs.gateway, gatewayType)
        )
      ) as any;
    } else {
      query = query.where(
        and(
          eq(paymentGatewayConfigs.organizationId, organizationId),
          eq(paymentGatewayConfigs.isDefault, true)
        )
      ) as any;
    }

    const [config] = await query;

    if (!config) {
      const fallbackGateway = await this.getFallbackGateway();
      if (fallbackGateway) {
        return fallbackGateway;
      }
      
      throw new Error(
        gatewayType
          ? `Payment gateway '${gatewayType}' not configured for organization`
          : 'No default payment gateway configured for organization'
      );
    }

    const apiKey = config.apiKey ? safeDecrypt(config.apiKey) : '';
    const apiSecret = config.apiSecret ? safeDecrypt(config.apiSecret) : '';
    const webhookSecret = config.webhookSecret ? safeDecrypt(config.webhookSecret) : undefined;
    const publicKey = config.publicKey ? safeDecrypt(config.publicKey) : undefined;

    return {
      gateway: config.gateway,
      apiKey,
      apiSecret,
      webhookSecret,
      publicKey,
      environment: config.environment as 'sandbox' | 'production',
    };
  }

  private static async getFallbackGateway(): Promise<PaymentGatewayConfig | null> {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      return {
        gateway: 'razorpay',
        apiKey: process.env.RAZORPAY_KEY_ID,
        apiSecret: process.env.RAZORPAY_KEY_SECRET,
        environment: 'production',
      };
    }

    if (process.env.STRIPE_SECRET_KEY) {
      return {
        gateway: 'stripe',
        apiKey: process.env.VITE_STRIPE_PUBLIC_KEY || '',
        apiSecret: process.env.STRIPE_SECRET_KEY,
        publicKey: process.env.VITE_STRIPE_PUBLIC_KEY,
        environment: 'production',
      };
    }

    return null;
  }

  private static createGatewayInstance(config: PaymentGatewayConfig): BasePaymentGateway {
    switch (config.gateway.toLowerCase()) {
      case 'razorpay':
        return new RazorpayGateway(config);
      
      case 'stripe':
        return new StripeGateway(config);
      
      case 'cashfree':
        return new CashfreeGateway(config);
      
      case 'payu':
      case 'payoneer':
        throw new Error(
          `Payment gateway '${config.gateway}' is not yet implemented. ` +
          'Supported gateways: razorpay, stripe, cashfree (coming soon)'
        );
      
      default:
        throw new Error(`Unsupported payment gateway: ${config.gateway}`);
    }
  }

  static clearCache(organizationId?: string): void {
    if (organizationId) {
      for (const key of this.instances.keys()) {
        if (key.startsWith(`${organizationId}-`)) {
          this.instances.delete(key);
        }
      }
    } else {
      this.instances.clear();
    }
  }

  static getSupportedGateways(): Array<{
    id: GatewayType;
    name: string;
    description: string;
    implemented: boolean;
  }> {
    return [
      {
        id: 'razorpay',
        name: 'Razorpay',
        description: 'India\'s leading payment gateway with UPI, cards, netbanking support',
        implemented: true,
      },
      {
        id: 'stripe',
        name: 'Stripe',
        description: 'Global payment platform supporting 135+ currencies and payment methods',
        implemented: true,
      },
      {
        id: 'cashfree',
        name: 'Cashfree',
        description: 'Indian payment gateway with instant settlements and low fees',
        implemented: false,
      },
      {
        id: 'payu',
        name: 'PayU',
        description: 'Popular payment gateway in India and emerging markets',
        implemented: false,
      },
      {
        id: 'payoneer',
        name: 'Payoneer',
        description: 'Global payment platform for cross-border transactions',
        implemented: false,
      },
    ];
  }
}
