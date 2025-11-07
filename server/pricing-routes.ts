import { Router, Request, Response } from 'express';
import { pricingManagementService } from './pricing-management-service';
import * as schema from '../shared/schema';
import { requireAuth, requirePlatform, type AuthRequest } from './auth';

/**
 * Pricing Management Routes
 * Handles product families, SKUs, add-ons, payment gateways, and service plans
 */
export function registerPricingRoutes(app: Router) {
  
  // ============================
  // PRODUCT FAMILIES (Super Admin Only)
  // ============================
  
  // Get all product families
  app.get('/api/pricing/product-families', requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const families = await pricingManagementService.getAllProductFamilies();
      res.json(families);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create product family
  app.post('/api/pricing/product-families', async (req: Request, res: Response) => {
    try {
      const data: schema.InsertProductFamily = req.body;
      const family = await pricingManagementService.createProductFamily(data);
      res.json(family);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update product family
  app.patch('/api/pricing/product-families/:id', async (req: Request, res: Response) => {
    try {
      const updated = await pricingManagementService.updateProductFamily(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Product family not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete product family
  app.delete('/api/pricing/product-families/:id', async (req: Request, res: Response) => {
    try {
      await pricingManagementService.deleteProductFamily(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // PLAN SKUs (Super Admin Only)
  // ============================
  
  // Get all SKUs
  app.get('/api/pricing/skus', async (req: Request, res: Response) => {
    try {
      const skus = await pricingManagementService.getAllPlanSKUs();
      res.json(skus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get SKUs by plan
  app.get('/api/pricing/plans/:planId/skus', async (req: Request, res: Response) => {
    try {
      const skus = await pricingManagementService.getPlanSKUsByPlan(req.params.planId);
      res.json(skus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create SKU
  app.post('/api/pricing/skus', async (req: Request, res: Response) => {
    try {
      const data: schema.InsertPlanSKU = req.body;
      const sku = await pricingManagementService.createPlanSKU(data);
      res.json(sku);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update SKU
  app.patch('/api/pricing/skus/:id', async (req: Request, res: Response) => {
    try {
      const updated = await pricingManagementService.updatePlanSKU(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'SKU not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete SKU
  app.delete('/api/pricing/skus/:id', async (req: Request, res: Response) => {
    try {
      await pricingManagementService.deletePlanSKU(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // PLAN ADD-ONS (Super Admin Only)
  // ============================
  
  // Get all add-ons
  app.get('/api/pricing/addons', async (req: Request, res: Response) => {
    try {
      const addons = await pricingManagementService.getAllPlanAddons();
      res.json(addons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get add-ons by family
  app.get('/api/pricing/families/:familyId/addons', async (req: Request, res: Response) => {
    try {
      const addons = await pricingManagementService.getAddonsByFamily(req.params.familyId);
      res.json(addons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create add-on
  app.post('/api/pricing/addons', async (req: Request, res: Response) => {
    try {
      const data: schema.InsertPlanAddon = req.body;
      const addon = await pricingManagementService.createPlanAddon(data);
      res.json(addon);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update add-on
  app.patch('/api/pricing/addons/:id', async (req: Request, res: Response) => {
    try {
      const updated = await pricingManagementService.updatePlanAddon(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Add-on not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete add-on
  app.delete('/api/pricing/addons/:id', async (req: Request, res: Response) => {
    try {
      await pricingManagementService.deletePlanAddon(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // SUBSCRIPTION ADD-ONS (Admin)
  // ============================
  
  // Get subscription add-ons
  app.get('/api/subscriptions/:subscriptionId/addons', async (req: Request, res: Response) => {
    try {
      const addons = await pricingManagementService.getSubscriptionAddons(req.params.subscriptionId);
      res.json(addons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Add subscription add-on
  app.post('/api/subscriptions/:subscriptionId/addons', async (req: Request, res: Response) => {
    try {
      const data: schema.InsertSubscriptionAddon = {
        ...req.body,
        subscriptionId: req.params.subscriptionId
      };
      const addon = await pricingManagementService.addSubscriptionAddon(data);
      res.json(addon);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Cancel subscription add-on
  app.delete('/api/subscriptions/addons/:id', async (req: Request, res: Response) => {
    try {
      await pricingManagementService.cancelSubscriptionAddon(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // PAYMENT GATEWAY CONFIGURATIONS (Admin)
  // ============================
  
  // Get organization's payment gateway configs
  app.get('/api/payment-gateways', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const configs = await pricingManagementService.getPaymentGatewayConfigsByOrganization(user.organizationId);
      
      // Don't expose credentials in list view
      const sanitized = configs.map(({ credentials, webhookSecret, ...config }) => ({
        ...config,
        hasCredentials: true,
        gateway: config.gateway
      }));
      
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create payment gateway config
  app.post('/api/payment-gateways', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const data: schema.InsertPaymentGatewayConfig = {
        ...req.body,
        organizationId: user.organizationId,
        createdBy: user.id
      };
      
      const config = await pricingManagementService.createPaymentGatewayConfig(data);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update payment gateway config
  app.patch('/api/payment-gateways/:id', async (req: Request, res: Response) => {
    try {
      const updated = await pricingManagementService.updatePaymentGatewayConfig(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Payment gateway config not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete payment gateway config
  app.delete('/api/payment-gateways/:id', async (req: Request, res: Response) => {
    try {
      await pricingManagementService.deletePaymentGatewayConfig(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // SERVICE PLANS (Admin)
  // ============================
  
  // Get organization's service plans
  app.get('/api/service-plans', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const plans = await pricingManagementService.getServicePlansByOrganization(user.organizationId);
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get public service plans for an organization (client-facing)
  app.get('/api/marketplace/:organizationId/service-plans', async (req: Request, res: Response) => {
    try {
      const plans = await pricingManagementService.getPublicServicePlans(req.params.organizationId);
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Create service plan
  app.post('/api/service-plans', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user || !user.organizationId) {
        return res.status(403).json({ error: 'Organization required' });
      }
      
      const data: schema.InsertServicePlan = {
        ...req.body,
        organizationId: user.organizationId,
        createdBy: user.id
      };
      
      const plan = await pricingManagementService.createServicePlan(data);
      res.json(plan);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update service plan
  app.patch('/api/service-plans/:id', async (req: Request, res: Response) => {
    try {
      const updated = await pricingManagementService.updateServicePlan(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Service plan not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Delete service plan
  app.delete('/api/service-plans/:id', async (req: Request, res: Response) => {
    try {
      await pricingManagementService.deleteServicePlan(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ============================
  // SERVICE PLAN PURCHASES (Client)
  // ============================
  
  // Get client's purchases
  app.get('/api/my-purchases', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const clientId = req.query.clientId as string;
      
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID required' });
      }
      
      const purchases = await pricingManagementService.getServicePlanPurchasesByClient(clientId);
      res.json(purchases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Purchase service plan
  app.post('/api/service-plans/:id/purchase', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      const data: schema.InsertServicePlanPurchase = {
        ...req.body,
        servicePlanId: req.params.id,
        purchasedBy: user.id
      };
      
      const purchase = await pricingManagementService.createServicePlanPurchase(data);
      res.json(purchase);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Update purchase status
  app.patch('/api/purchases/:id', async (req: Request, res: Response) => {
    try {
      const updated = await pricingManagementService.updateServicePlanPurchase(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Purchase not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Add review to purchase
  app.post('/api/purchases/:id/review', async (req: Request, res: Response) => {
    try {
      const { rating, review } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      
      const updated = await pricingManagementService.addServicePlanReview(req.params.id, rating, review);
      if (!updated) {
        return res.status(404).json({ error: 'Purchase not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
