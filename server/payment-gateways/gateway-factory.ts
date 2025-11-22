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
  private static orgInstancesMap: Map<string, Set<string>> = new Map();
  
  static {
    this.instances.clear();
    this.orgInstancesMap.clear();
    console.log('[PaymentGatewayFactory] Cache cleared on startup (handles credential rotation & schema migrations)');
  }

  static async getGateway(
    organizationId: string,
    gatewayType?: GatewayType
  ): Promise<{ gateway: BasePaymentGateway; config: any }> {
    const fullConfig = await this.getFullGatewayConfig(organizationId, gatewayType);
    const gatewayConfig = await this.decryptConfig(fullConfig);
    
    const cacheKey = `${organizationId}-${fullConfig.id}`;
    
    if (this.instances.has(cacheKey)) {
      return {
        gateway: this.instances.get(cacheKey)!,
        config: fullConfig,
      };
    }

    const gateway = this.createGatewayInstance(gatewayConfig);
    this.instances.set(cacheKey, gateway);
    
    if (!this.orgInstancesMap.has(organizationId)) {
      this.orgInstancesMap.set(organizationId, new Set());
    }
    this.orgInstancesMap.get(organizationId)!.add(cacheKey);
    
    return {
      gateway,
      config: fullConfig,
    };
  }

  private static async getFullGatewayConfig(
    organizationId: string,
    gatewayType?: GatewayType
  ) {
    let query = db
      .select()
      .from(paymentGatewayConfigs)
      .where(eq(paymentGatewayConfigs.organizationId, organizationId));

    if (gatewayType) {
      query = query.where(
        and(
          eq(paymentGatewayConfigs.organizationId, organizationId),
          eq(paymentGatewayConfigs.gateway, gatewayType),
          eq(paymentGatewayConfigs.isActive, true)
        )
      ) as any;
    } else {
      query = query.where(
        and(
          eq(paymentGatewayConfigs.organizationId, organizationId),
          eq(paymentGatewayConfigs.isDefault, true),
          eq(paymentGatewayConfigs.isActive, true)
        )
      ) as any;
    }

    const [config] = await query;

    if (!config) {
      const fallbackGateway = await this.getFallbackGateway();
      if (fallbackGateway) {
        return {
          id: 'fallback',
          organizationId,
          gateway: fallbackGateway.gateway,
          apiKey: fallbackGateway.apiKey,
          apiSecret: fallbackGateway.apiSecret,
          webhookSecret: fallbackGateway.webhookSecret,
          publicKey: fallbackGateway.publicKey,
          environment: fallbackGateway.environment,
          isActive: true,
          isDefault: true,
        };
      }
      
      throw new Error(
        gatewayType
          ? `Payment gateway '${gatewayType}' not configured for organization`
          : 'No default payment gateway configured for organization'
      );
    }

    return config;
  }

  private static async decryptConfig(config: any): Promise<PaymentGatewayConfig> {
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

  static clearCache(organizationId?: string, configId?: string): void {
    if (organizationId && configId) {
      this.instances.delete(`${organizationId}-${configId}`);
    } else if (organizationId) {
      const keysToDelete: string[] = [];
      for (const key of this.instances.keys()) {
        if (key.startsWith(`${organizationId}-`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.instances.delete(key));
    } else {
      this.instances.clear();
    }
  }

  static async clearCacheForOrganization(organizationId: string): Promise<void> {
    const orgKeys = this.orgInstancesMap.get(organizationId);
    if (orgKeys) {
      orgKeys.forEach(key => this.instances.delete(key));
      this.orgInstancesMap.delete(organizationId);
    }
    
    const keysToDelete: string[] = [];
    for (const key of this.instances.keys()) {
      if (key.startsWith(`${organizationId}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.instances.delete(key));
    
    console.log(`[PaymentGatewayFactory] Cleared ${keysToDelete.length + (orgKeys?.size || 0)} cached instances for org ${organizationId}`);
  }
  
  static clearAllCache(): void {
    const totalInstances = this.instances.size;
    this.instances.clear();
    this.orgInstancesMap.clear();
    console.log(`[PaymentGatewayFactory] Cleared all ${totalInstances} cached gateway instances`);
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
