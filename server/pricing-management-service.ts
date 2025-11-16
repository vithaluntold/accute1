import { db } from './db';
import { eq, and, desc, asc } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { encrypt, decrypt } from './crypto-utils';

/**
 * Pricing Management Service
 * Handles product families, SKUs, add-ons, payment gateways, and service plans
 */
export class PricingManagementService {
  
  // ============================
  // SECURITY HELPERS
  // ============================
  
  async getSubscriptionForOrganization(subscriptionId: string, organizationId: string): Promise<schema.PlatformSubscription | undefined> {
    const [subscription] = await db.select()
      .from(schema.platformSubscriptions)
      .where(and(
        eq(schema.platformSubscriptions.id, subscriptionId),
        eq(schema.platformSubscriptions.organizationId, organizationId)
      ));
    return subscription;
  }
  
  // ============================
  // PRODUCT FAMILIES
  // ============================
  
  async createProductFamily(data: schema.InsertProductFamily): Promise<schema.ProductFamily> {
    const [family] = await db.insert(schema.productFamilies)
      .values(data)
      .returning();
    return family;
  }
  
  async getProductFamily(id: string): Promise<schema.ProductFamily | undefined> {
    const [family] = await db.select()
      .from(schema.productFamilies)
      .where(eq(schema.productFamilies.id, id));
    return family;
  }
  
  async getAllProductFamilies(): Promise<schema.ProductFamily[]> {
    return await db.select()
      .from(schema.productFamilies)
      .where(eq(schema.productFamilies.isActive, true))
      .orderBy(asc(schema.productFamilies.displayOrder));
  }
  
  async updateProductFamily(id: string, data: Partial<schema.InsertProductFamily>): Promise<schema.ProductFamily | undefined> {
    const [updated] = await db.update(schema.productFamilies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.productFamilies.id, id))
      .returning();
    return updated;
  }
  
  async deleteProductFamily(id: string): Promise<void> {
    await db.delete(schema.productFamilies)
      .where(eq(schema.productFamilies.id, id));
  }
  
  // ============================
  // PLAN SKUs
  // ============================
  
  async createPlanSKU(data: schema.InsertPlanSKU): Promise<schema.PlanSKU> {
    const [sku] = await db.insert(schema.planSKUs)
      .values(data)
      .returning();
    return sku;
  }
  
  async getPlanSKU(id: string): Promise<schema.PlanSKU | undefined> {
    const [sku] = await db.select()
      .from(schema.planSKUs)
      .where(eq(schema.planSKUs.id, id));
    return sku;
  }
  
  async getPlanSKUBySKU(sku: string): Promise<schema.PlanSKU | undefined> {
    const [result] = await db.select()
      .from(schema.planSKUs)
      .where(eq(schema.planSKUs.sku, sku));
    return result;
  }
  
  async getPlanSKUsByPlan(planId: string): Promise<schema.PlanSKU[]> {
    return await db.select()
      .from(schema.planSKUs)
      .where(and(
        eq(schema.planSKUs.planId, planId),
        eq(schema.planSKUs.isActive, true)
      ))
      .orderBy(asc(schema.planSKUs.billingCycle));
  }
  
  async getAllPlanSKUs(): Promise<schema.PlanSKU[]> {
    return await db.select()
      .from(schema.planSKUs)
      .where(eq(schema.planSKUs.isActive, true));
  }
  
  async updatePlanSKU(id: string, data: Partial<schema.InsertPlanSKU>): Promise<schema.PlanSKU | undefined> {
    const [updated] = await db.update(schema.planSKUs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.planSKUs.id, id))
      .returning();
    return updated;
  }
  
  async deletePlanSKU(id: string): Promise<void> {
    await db.delete(schema.planSKUs)
      .where(eq(schema.planSKUs.id, id));
  }
  
  // ============================
  // PLAN ADD-ONS
  // ============================
  
  async createPlanAddon(data: schema.InsertPlanAddon): Promise<schema.PlanAddon> {
    const [addon] = await db.insert(schema.planAddons)
      .values(data)
      .returning();
    return addon;
  }
  
  async getPlanAddon(id: string): Promise<schema.PlanAddon | undefined> {
    const [addon] = await db.select()
      .from(schema.planAddons)
      .where(eq(schema.planAddons.id, id));
    return addon;
  }
  
  async getAllPlanAddons(): Promise<schema.PlanAddon[]> {
    return await db.select()
      .from(schema.planAddons)
      .where(eq(schema.planAddons.isActive, true))
      .orderBy(asc(schema.planAddons.displayOrder));
  }
  
  async getAddonsByFamily(familyId: string): Promise<schema.PlanAddon[]> {
    return await db.select()
      .from(schema.planAddons)
      .where(and(
        eq(schema.planAddons.productFamilyId, familyId),
        eq(schema.planAddons.isActive, true)
      ))
      .orderBy(asc(schema.planAddons.displayOrder));
  }
  
  async updatePlanAddon(id: string, data: Partial<schema.InsertPlanAddon>): Promise<schema.PlanAddon | undefined> {
    const [updated] = await db.update(schema.planAddons)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.planAddons.id, id))
      .returning();
    return updated;
  }
  
  async deletePlanAddon(id: string): Promise<void> {
    await db.delete(schema.planAddons)
      .where(eq(schema.planAddons.id, id));
  }
  
  // ============================
  // SUBSCRIPTION ADD-ONS
  // ============================
  
  async addSubscriptionAddon(data: schema.InsertSubscriptionAddon): Promise<schema.SubscriptionAddon> {
    const [addon] = await db.insert(schema.subscriptionAddons)
      .values(data)
      .returning();
    return addon;
  }
  
  async getSubscriptionAddon(id: string): Promise<schema.SubscriptionAddon | undefined> {
    const [addon] = await db.select()
      .from(schema.subscriptionAddons)
      .where(eq(schema.subscriptionAddons.id, id));
    return addon;
  }
  
  async getSubscriptionAddons(subscriptionId: string): Promise<schema.SubscriptionAddon[]> {
    return await db.select()
      .from(schema.subscriptionAddons)
      .where(and(
        eq(schema.subscriptionAddons.subscriptionId, subscriptionId),
        eq(schema.subscriptionAddons.status, 'active')
      ));
  }
  
  async updateSubscriptionAddon(id: string, data: Partial<schema.InsertSubscriptionAddon>): Promise<schema.SubscriptionAddon | undefined> {
    const [updated] = await db.update(schema.subscriptionAddons)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.subscriptionAddons.id, id))
      .returning();
    return updated;
  }
  
  async cancelSubscriptionAddon(id: string): Promise<void> {
    await db.update(schema.subscriptionAddons)
      .set({ 
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.subscriptionAddons.id, id));
  }
  
  // ============================
  // PAYMENT GATEWAY CONFIGURATIONS
  // ============================
  
  async createPaymentGatewayConfig(data: schema.InsertPaymentGatewayConfig): Promise<schema.PaymentGatewayConfig> {
    // Encrypt credentials before storing
    const encryptedCredentials = encrypt(JSON.stringify(data.credentials));
    const encryptedWebhookSecret = data.webhookSecret ? encrypt(data.webhookSecret) : undefined;
    
    const [config] = await db.insert(schema.paymentGatewayConfigs)
      .values({
        ...data,
        credentials: encryptedCredentials as any,
        webhookSecret: encryptedWebhookSecret
      })
      .returning();
    
    return config;
  }
  
  async getPaymentGatewayConfig(id: string): Promise<schema.PaymentGatewayConfig | undefined> {
    const [config] = await db.select()
      .from(schema.paymentGatewayConfigs)
      .where(eq(schema.paymentGatewayConfigs.id, id));
    
    // Return with encrypted credentials - DO NOT decrypt for API responses
    return config;
  }
  
  // INTERNAL USE ONLY: Decrypt credentials for payment processing
  async getDecryptedPaymentGatewayConfig(id: string): Promise<schema.PaymentGatewayConfig | undefined> {
    const config = await this.getPaymentGatewayConfig(id);
    if (!config) return undefined;
    
    const decryptedCredentials = decrypt(config.credentials as any);
    const decryptedWebhookSecret = config.webhookSecret ? decrypt(config.webhookSecret) : undefined;
    
    return {
      ...config,
      credentials: JSON.parse(decryptedCredentials),
      webhookSecret: decryptedWebhookSecret
    };
  }
  
  async getPaymentGatewayConfigsByOrganization(organizationId: string): Promise<schema.PaymentGatewayConfig[]> {
    const configs = await db.select()
      .from(schema.paymentGatewayConfigs)
      .where(and(
        eq(schema.paymentGatewayConfigs.organizationId, organizationId),
        eq(schema.paymentGatewayConfigs.isActive, true)
      ));
    
    // Return with encrypted credentials - DO NOT decrypt for API responses
    return configs;
  }
  
  async getDefaultPaymentGateway(organizationId: string): Promise<schema.PaymentGatewayConfig | undefined> {
    const [config] = await db.select()
      .from(schema.paymentGatewayConfigs)
      .where(and(
        eq(schema.paymentGatewayConfigs.organizationId, organizationId),
        eq(schema.paymentGatewayConfigs.isDefault, true),
        eq(schema.paymentGatewayConfigs.isActive, true)
      ));
    
    // Return with encrypted credentials - DO NOT decrypt for API responses
    return config;
  }
  
  // INTERNAL USE ONLY: Decrypt default gateway for payment processing
  async getDecryptedDefaultPaymentGateway(organizationId: string): Promise<schema.PaymentGatewayConfig | undefined> {
    const config = await this.getDefaultPaymentGateway(organizationId);
    if (!config) return undefined;
    
    const decryptedCredentials = decrypt(config.credentials as any);
    const decryptedWebhookSecret = config.webhookSecret ? decrypt(config.webhookSecret) : undefined;
    
    return {
      ...config,
      credentials: JSON.parse(decryptedCredentials),
      webhookSecret: decryptedWebhookSecret
    };
  }
  
  async updatePaymentGatewayConfig(id: string, data: Partial<schema.InsertPaymentGatewayConfig>): Promise<schema.PaymentGatewayConfig | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // Encrypt credentials if provided
    if (data.credentials) {
      updateData.credentials = encrypt(JSON.stringify(data.credentials));
    }
    
    if (data.webhookSecret) {
      updateData.webhookSecret = encrypt(data.webhookSecret);
    }
    
    const [updated] = await db.update(schema.paymentGatewayConfigs)
      .set(updateData)
      .where(eq(schema.paymentGatewayConfigs.id, id))
      .returning();
    
    // Return with encrypted credentials - DO NOT decrypt for API responses
    return updated;
  }
  
  async deletePaymentGatewayConfig(id: string): Promise<void> {
    await db.delete(schema.paymentGatewayConfigs)
      .where(eq(schema.paymentGatewayConfigs.id, id));
  }
  
  // ============================
  // SERVICE PLANS
  // ============================
  
  async createServicePlan(data: schema.InsertServicePlan): Promise<schema.ServicePlan> {
    const [plan] = await db.insert(schema.servicePlans)
      .values(data)
      .returning();
    return plan;
  }
  
  async getServicePlan(id: string): Promise<schema.ServicePlan | undefined> {
    const [plan] = await db.select()
      .from(schema.servicePlans)
      .where(eq(schema.servicePlans.id, id));
    return plan;
  }
  
  async getServicePlansByOrganization(organizationId: string): Promise<schema.ServicePlan[]> {
    return await db.select()
      .from(schema.servicePlans)
      .where(eq(schema.servicePlans.organizationId, organizationId))
      .orderBy(desc(schema.servicePlans.createdAt));
  }
  
  async getPublicServicePlans(organizationId: string): Promise<schema.ServicePlan[]> {
    return await db.select()
      .from(schema.servicePlans)
      .where(and(
        eq(schema.servicePlans.organizationId, organizationId),
        eq(schema.servicePlans.isPublic, true),
        eq(schema.servicePlans.isAvailable, true)
      ))
      .orderBy(desc(schema.servicePlans.isFeatured), desc(schema.servicePlans.rating));
  }
  
  async updateServicePlan(id: string, data: Partial<schema.InsertServicePlan>): Promise<schema.ServicePlan | undefined> {
    const [updated] = await db.update(schema.servicePlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.servicePlans.id, id))
      .returning();
    return updated;
  }
  
  async deleteServicePlan(id: string): Promise<void> {
    await db.delete(schema.servicePlans)
      .where(eq(schema.servicePlans.id, id));
  }
  
  // ============================
  // SERVICE PLAN PURCHASES
  // ============================
  
  async createServicePlanPurchase(data: schema.InsertServicePlanPurchase): Promise<schema.ServicePlanPurchase> {
    // Increment current orders on service plan
    await db.update(schema.servicePlans)
      .set({ 
        currentOrders: db.raw(`current_orders + 1`),
        totalOrders: db.raw(`total_orders + 1`),
        updatedAt: new Date()
      } as any)
      .where(eq(schema.servicePlans.id, data.servicePlanId));
    
    const [purchase] = await db.insert(schema.servicePlanPurchases)
      .values(data)
      .returning();
    return purchase;
  }
  
  async getServicePlanPurchase(id: string): Promise<schema.ServicePlanPurchase | undefined> {
    const [purchase] = await db.select()
      .from(schema.servicePlanPurchases)
      .where(eq(schema.servicePlanPurchases.id, id));
    return purchase;
  }
  
  async getServicePlanPurchasesByClient(clientId: string): Promise<schema.ServicePlanPurchase[]> {
    return await db.select()
      .from(schema.servicePlanPurchases)
      .where(eq(schema.servicePlanPurchases.clientId, clientId))
      .orderBy(desc(schema.servicePlanPurchases.createdAt));
  }
  
  async getServicePlanPurchasesByOrganization(organizationId: string): Promise<schema.ServicePlanPurchase[]> {
    return await db.select()
      .from(schema.servicePlanPurchases)
      .where(eq(schema.servicePlanPurchases.organizationId, organizationId))
      .orderBy(desc(schema.servicePlanPurchases.createdAt));
  }
  
  async updateServicePlanPurchase(id: string, data: Partial<schema.InsertServicePlanPurchase>): Promise<schema.ServicePlanPurchase | undefined> {
    const [updated] = await db.update(schema.servicePlanPurchases)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.servicePlanPurchases.id, id))
      .returning();
    
    // If status changed to completed or cancelled, decrement current orders
    if (data.status && ['completed', 'cancelled', 'refunded'].includes(data.status)) {
      const purchase = await this.getServicePlanPurchase(id);
      if (purchase) {
        await db.update(schema.servicePlans)
          .set({ 
            currentOrders: db.raw(`GREATEST(current_orders - 1, 0)`) as any,
            updatedAt: new Date()
          })
          .where(eq(schema.servicePlans.id, purchase.servicePlanId));
      }
    }
    
    return updated;
  }
  
  async addServicePlanReview(purchaseId: string, rating: number, review: string): Promise<schema.ServicePlanPurchase | undefined> {
    const purchase = await this.getServicePlanPurchase(purchaseId);
    if (!purchase) return undefined;
    
    // Update purchase with review
    const [updated] = await db.update(schema.servicePlanPurchases)
      .set({ 
        rating: rating.toString(),
        review,
        reviewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.servicePlanPurchases.id, purchaseId))
      .returning();
    
    // Update service plan rating and review count
    const servicePlan = await this.getServicePlan(purchase.servicePlanId);
    if (servicePlan) {
      const newReviewCount = servicePlan.reviewCount + 1;
      const currentRating = Number(servicePlan.rating || 0);
      const newRating = ((currentRating * servicePlan.reviewCount) + rating) / newReviewCount;
      
      await db.update(schema.servicePlans)
        .set({ 
          rating: newRating.toFixed(2),
          reviewCount: newReviewCount,
          updatedAt: new Date()
        })
        .where(eq(schema.servicePlans.id, purchase.servicePlanId));
    }
    
    return updated;
  }
}

// Export singleton instance
export const pricingManagementService = new PricingManagementService();
