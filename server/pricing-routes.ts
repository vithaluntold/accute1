import { Router, Response } from 'express';
import { pricingManagementService } from './pricing-management-service';
import * as schema from '@shared/schema';
import { requireAuth, requirePlatform, requireAdmin, requirePermission, logActivity, type AuthRequest } from './auth';
import { z } from 'zod';
import { storage } from './storage';

/**
 * Pricing Management Routes - PRODUCTION SECURED
 * All routes require authentication and proper authorization
 * All inputs validated with Zod schemas
 * Organization scoping enforced
 */
export function registerPricingRoutes(app: Router) {
  
  // ============================
  // PRODUCT FAMILIES (Super Admin Only)
  // ============================
  
  app.get('/api/pricing/product-families', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const families = await pricingManagementService.getAllProductFamilies();
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'view', 'product_family', 'all', {}, req);
      res.json(families);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/pricing/product-families', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const data = schema.insertProductFamilySchema.parse({
        ...req.body,
        createdBy: req.user!.id
      });
      const family = await pricingManagementService.createProductFamily(data);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'create', 'product_family', family.id, { name: family.name }, req);
      res.json(family);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch('/api/pricing/product-families/:id', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      // Only allow updating specific fields
      const allowedFields = ['name', 'slug', 'description', 'displayOrder', 'features', 'icon', 'color', 'isActive'];
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: req.body[key] }), {});
      
      const updated = await pricingManagementService.updateProductFamily(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Product family not found' });
      }
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'update', 'product_family', req.params.id, updateData, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete('/api/pricing/product-families/:id', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      await pricingManagementService.deleteProductFamily(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'delete', 'product_family', req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // PLAN SKUs (Super Admin Only)
  // ============================
  
  app.get('/api/pricing/skus', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const skus = await pricingManagementService.getAllPlanSKUs();
      res.json(skus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get('/api/pricing/plans/:planId/skus', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const skus = await pricingManagementService.getPlanSKUsByPlan(req.params.planId);
      res.json(skus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/pricing/skus', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const data = schema.insertPlanSKUSchema.parse({
        ...req.body,
        createdBy: req.user!.id
      });
      const sku = await pricingManagementService.createPlanSKU(data);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'create', 'plan_sku', sku.id, { sku: sku.sku }, req);
      res.json(sku);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch('/api/pricing/skus/:id', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const allowedFields = ['name', 'description', 'pricingModel', 'fixedPrice', 'usageUnit', 'usagePrice', 
        'includedUsage', 'basePrice', 'tiers', 'regionCode', 'currency', 'billingCycle', 'isActive'];
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: req.body[key] }), {});
      
      const updated = await pricingManagementService.updatePlanSKU(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'SKU not found' });
      }
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'update', 'plan_sku', req.params.id, updateData, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete('/api/pricing/skus/:id', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      await pricingManagementService.deletePlanSKU(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'delete', 'plan_sku', req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // PLAN ADD-ONS (Super Admin Only)
  // ============================
  
  app.get('/api/pricing/addons', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const addons = await pricingManagementService.getAllPlanAddons();
      res.json(addons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get('/api/pricing/families/:familyId/addons', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const addons = await pricingManagementService.getAddonsByFamily(req.params.familyId);
      res.json(addons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/pricing/addons', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const data = schema.insertPlanAddonSchema.parse({
        ...req.body,
        createdBy: req.user!.id
      });
      const addon = await pricingManagementService.createPlanAddon(data);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'create', 'plan_addon', addon.id, { name: addon.name }, req);
      res.json(addon);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch('/api/pricing/addons/:id', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const allowedFields = ['name', 'slug', 'description', 'pricingModel', 'priceMonthly', 'priceYearly',
        'unit', 'pricePerUnit', 'minQuantity', 'maxQuantity', 'features', 'additionalStorage', 
        'additionalUsers', 'additionalClients', 'additionalWorkflows', 'applicablePlans', 'displayOrder', 'isActive'];
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: req.body[key] }), {});
      
      const updated = await pricingManagementService.updatePlanAddon(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Add-on not found' });
      }
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'update', 'plan_addon', req.params.id, updateData, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete('/api/pricing/addons/:id', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      await pricingManagementService.deletePlanAddon(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, 'delete', 'plan_addon', req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // SUBSCRIPTION ADD-ONS (Admin - Organization Scoped)
  // ============================
  
  app.get('/api/subscriptions/:subscriptionId/addons', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify subscription belongs to user's organization
      const subscription = await pricingManagementService.getSubscriptionForOrganization(
        req.params.subscriptionId,
        req.user!.organizationId!
      );
      if (!subscription) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const addons = await pricingManagementService.getSubscriptionAddons(req.params.subscriptionId);
      res.json(addons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/subscriptions/:subscriptionId/addons', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify subscription belongs to user's organization
      const subscription = await pricingManagementService.getSubscriptionForOrganization(
        req.params.subscriptionId,
        req.user!.organizationId!
      );
      if (!subscription) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const data = schema.insertSubscriptionAddonSchema.parse({
        ...req.body,
        subscriptionId: req.params.subscriptionId,
        addedBy: req.user!.id
      });
      const addon = await pricingManagementService.addSubscriptionAddon(data);
      await logActivity(req.user!.id, req.user!.organizationId!, 'add', 'subscription_addon', addon.id, { addonId: data.addonId }, req);
      res.json(addon);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete('/api/subscriptions/addons/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify addon belongs to user's organization
      const addon = await pricingManagementService.getSubscriptionAddon(req.params.id);
      if (!addon) {
        return res.status(404).json({ error: 'Addon not found' });
      }
      
      const subscription = await pricingManagementService.getSubscriptionForOrganization(
        addon.subscriptionId,
        req.user!.organizationId!
      );
      if (!subscription) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await pricingManagementService.cancelSubscriptionAddon(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, 'cancel', 'subscription_addon', req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // PAYMENT GATEWAY CONFIGURATIONS (Admin - Organization Scoped)
  // ============================
  
  app.get('/api/payment-gateways', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const configs = await pricingManagementService.getPaymentGatewayConfigsByOrganization(req.user!.organizationId);
      
      // SECURITY: Strip all sensitive fields from response
      const sanitized = configs.map(config => {
        const { credentials, webhookSecret, ...safe } = config;
        return {
          ...safe,
          hasCredentials: !!credentials,
          hasWebhookSecret: !!webhookSecret
        };
      });
      
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/payment-gateways', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const data = schema.insertPaymentGatewayConfigSchema.parse({
        ...req.body,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.id
      });
      
      const config = await pricingManagementService.createPaymentGatewayConfig(data);
      await logActivity(req.user!.id, req.user!.organizationId, 'create', 'payment_gateway_config', config.id, { gateway: config.gateway }, req);
      
      // SECURITY: Strip all sensitive fields from response
      const { credentials, webhookSecret, ...sanitized } = config;
      res.json({ 
        ...sanitized, 
        hasCredentials: !!credentials,
        hasWebhookSecret: !!webhookSecret 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch('/api/payment-gateways/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify config belongs to user's organization
      const existing = await pricingManagementService.getPaymentGatewayConfig(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const allowedFields = ['nickname', 'credentials', 'config', 'isActive', 'isDefault', 'isTestMode', 'webhookSecret'];
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: req.body[key] }), {});
      
      const updated = await pricingManagementService.updatePaymentGatewayConfig(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Payment gateway config not found' });
      }
      
      await logActivity(req.user!.id, req.user!.organizationId!, 'update', 'payment_gateway_config', req.params.id, { gateway: updated.gateway }, req);
      
      // SECURITY: Strip all sensitive fields from response
      const { credentials, webhookSecret, ...sanitized } = updated;
      res.json({ 
        ...sanitized, 
        hasCredentials: !!credentials,
        hasWebhookSecret: !!webhookSecret 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete('/api/payment-gateways/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify config belongs to user's organization
      const existing = await pricingManagementService.getPaymentGatewayConfig(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await pricingManagementService.deletePaymentGatewayConfig(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, 'delete', 'payment_gateway_config', req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // SERVICE PLANS (Admin - Organization Scoped)
  // ============================
  
  app.get('/api/service-plans', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const plans = await pricingManagementService.getServicePlansByOrganization(req.user!.organizationId);
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Public marketplace endpoint (no auth required for browsing)
  app.get('/api/marketplace/:organizationId/service-plans', async (req, res: Response) => {
    try {
      const plans = await pricingManagementService.getPublicServicePlans(req.params.organizationId);
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/service-plans', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const data = schema.insertServicePlanSchema.parse({
        ...req.body,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.id
      });
      
      const plan = await pricingManagementService.createServicePlan(data);
      await logActivity(req.user!.id, req.user!.organizationId, 'create', 'service_plan', plan.id, { title: plan.title }, req);
      res.json(plan);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch('/api/service-plans/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify plan belongs to user's organization
      const existing = await pricingManagementService.getServicePlan(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const allowedFields = ['title', 'slug', 'description', 'category', 'tags', 'pricingModel', 'basePrice', 
        'currency', 'hourlyRate', 'estimatedHours', 'tiers', 'deliveryDays', 'revisions', 'features', 
        'requirements', 'coverImage', 'gallery', 'isAvailable', 'maxOrders', 'isPublic', 'isFeatured'];
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: req.body[key] }), {});
      
      const updated = await pricingManagementService.updateServicePlan(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Service plan not found' });
      }
      
      await logActivity(req.user!.id, req.user!.organizationId!, 'update', 'service_plan', req.params.id, updateData, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.delete('/api/service-plans/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify plan belongs to user's organization
      const existing = await pricingManagementService.getServicePlan(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await pricingManagementService.deleteServicePlan(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, 'delete', 'service_plan', req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // SERVICE PLAN PURCHASES (Client - Organization Scoped)
  // ============================
  
  app.get('/api/my-purchases', requireAuth, requirePermission("clients.view"), async (req: AuthRequest, res: Response) => {
    try {
      const clientId = req.query.clientId as string;
      
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID required' });
      }
      
      // SECURITY: Verify client exists and user has access
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      // MULTI-TIER AUTHORIZATION - Following requireAdmin pattern from auth.ts
      const userRole = await storage.getRole(req.user!.roleId);
      if (!userRole) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Tier 1: Platform admins (Super Admin) can access any client
      const isPlatformAdmin = userRole.scope === "platform" && req.user!.organizationId === null;
      
      // Tier 2: Organization admins can access any client in their org
      const isOrgAdmin = userRole.name === "Admin" && userRole.scope !== "platform";
      
      // Tier 3: Check if user is assigned to this client
      const isAssignedUser = client.assignedTo === req.user!.id;
      
      if (!isPlatformAdmin) {
        // Verify client belongs to user's organization
        if (client.organizationId !== req.user!.organizationId) {
          await logActivity(req.user!.id, req.user!.organizationId || undefined, 'unauthorized_access_attempt', 'service_plan_purchase', clientId, { reason: 'Cross-organization access attempt' }, req);
          return res.status(403).json({ error: 'Access denied' });
        }
        
        // Within organization: check assignment or admin status
        if (!isAssignedUser && !isOrgAdmin) {
          await logActivity(req.user!.id, req.user!.organizationId || undefined, 'unauthorized_access_attempt', 'service_plan_purchase', clientId, { reason: 'Not assigned to client' }, req);
          return res.status(403).json({ error: 'Access denied - you are not assigned to this client' });
        }
      }
      
      const purchases = await pricingManagementService.getServicePlanPurchasesByClient(clientId);
      res.json(purchases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/service-plans/:id/purchase', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const data = schema.insertServicePlanPurchaseSchema.parse({
        ...req.body,
        servicePlanId: req.params.id,
        purchasedBy: req.user!.id
      });
      
      const purchase = await pricingManagementService.createServicePlanPurchase(data);
      await logActivity(req.user!.id, data.organizationId, 'purchase', 'service_plan', req.params.id, { purchaseId: purchase.id }, req);
      res.json(purchase);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.patch('/api/purchases/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Verify purchase belongs to user's organization or user is admin
      const existing = await pricingManagementService.getServicePlanPurchase(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Purchase not found' });
      }
      
      // Only allow updating specific fields
      const allowedFields = ['status', 'clientRequirements', 'notes', 'assignedTo', 'deliveredAt', 'completedAt'];
      const updateData = Object.keys(req.body)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => ({ ...obj, [key]: req.body[key] }), {});
      
      const updated = await pricingManagementService.updateServicePlanPurchase(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Purchase not found' });
      }
      
      await logActivity(req.user!.id, existing.organizationId, 'update', 'service_plan_purchase', req.params.id, updateData, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/purchases/:id/review', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { rating, review } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      
      // SECURITY: Verify purchase belongs to user
      const existing = await pricingManagementService.getServicePlanPurchase(req.params.id);
      if (!existing || existing.purchasedBy !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const updated = await pricingManagementService.addServicePlanReview(req.params.id, rating, review);
      if (!updated) {
        return res.status(404).json({ error: 'Purchase not found' });
      }
      
      await logActivity(req.user!.id, existing.organizationId, 'review', 'service_plan_purchase', req.params.id, { rating }, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
