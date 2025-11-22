import type { Express } from 'express';
import { z } from 'zod';
import { PaymentGatewayFactory } from './payment-gateways';
import { requireAuthWithOrg } from './routes';
import { db } from './db';
import { paymentGatewayConfigs, subscriptionInvoices, invoices } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt } from './auth';

const createOrderSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('INR'),
  description: z.string().optional(),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
  metadata: z.record(z.any()).optional(),
  gateway: z.enum(['razorpay', 'stripe', 'cashfree']).optional(),
});

const refundSchema = z.object({
  paymentId: z.string(),
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
  notes: z.record(z.string()).optional(),
});

const gatewayConfigSchema = z.object({
  gateway: z.enum(['razorpay', 'stripe', 'cashfree', 'payu', 'payoneer']),
  apiKey: z.string(),
  apiSecret: z.string(),
  webhookSecret: z.string().optional(),
  publicKey: z.string().optional(),
  environment: z.enum(['sandbox', 'production']).default('production'),
  isDefault: z.boolean().default(false),
});

export function registerUnifiedPaymentRoutes(app: Express) {
  
  app.post('/api/payment/create-order', requireAuthWithOrg, async (req, res) => {
    try {
      const validation = createOrderSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const organizationId = (req as any).organizationId;

      const gateway = await PaymentGatewayFactory.getGateway(
        organizationId,
        data.gateway as any
      );

      const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const order = await gateway.createOrder({
        orderId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        customer: data.customer,
        metadata: data.metadata,
      });

      res.json({
        success: true,
        gateway: gateway.gatewayName,
        order: {
          orderId,
          gatewayOrderId: order.gatewayOrderId,
          sessionId: order.sessionId,
          paymentUrl: order.paymentUrl,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
        },
        checkoutScript: gateway.getCheckoutScript(),
      });
    } catch (error: any) {
      console.error('Payment order creation error:', error);
      res.status(500).json({
        error: 'Failed to create payment order',
        message: error.message,
      });
    }
  });

  app.get('/api/payment/status/:orderId', requireAuthWithOrg, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { gateway: gatewayType } = req.query;
      const organizationId = (req as any).organizationId;

      const gateway = await PaymentGatewayFactory.getGateway(
        organizationId,
        gatewayType as any
      );

      const status = await gateway.getPaymentStatus(orderId);

      res.json({
        success: true,
        gateway: gateway.gatewayName,
        payment: status,
      });
    } catch (error: any) {
      console.error('Payment status fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch payment status',
        message: error.message,
      });
    }
  });

  app.post('/api/payment/refund', requireAuthWithOrg, async (req, res) => {
    try {
      const validation = refundSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const { gateway: gatewayType } = req.query;
      const organizationId = (req as any).organizationId;

      const gateway = await PaymentGatewayFactory.getGateway(
        organizationId,
        gatewayType as any
      );

      const refund = await gateway.refundPayment(data);

      res.json({
        success: true,
        gateway: gateway.gatewayName,
        refund,
      });
    } catch (error: any) {
      console.error('Payment refund error:', error);
      res.status(500).json({
        error: 'Failed to process refund',
        message: error.message,
      });
    }
  });

  app.post('/api/payment/webhook/:gateway', async (req, res) => {
    try {
      const { gateway: gatewayType } = req.params;
      const signature = req.headers['x-razorpay-signature'] || 
                       req.headers['stripe-signature'] || 
                       req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;

      if (!signature) {
        return res.status(400).json({ error: 'Missing webhook signature' });
      }

      const payload = typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);

      const organizationId = (req as any).organizationId;

      const gateway = await PaymentGatewayFactory.getGateway(
        organizationId,
        gatewayType as any
      );

      const verification = gateway.verifyWebhookSignature(
        signature,
        payload,
        timestamp
      );

      if (!verification.isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      res.status(200).json({
        success: true,
        event: verification.event,
      });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        error: 'Failed to process webhook',
        message: error.message,
      });
    }
  });

  app.get('/api/payment/gateways', requireAuthWithOrg, async (_req, res) => {
    try {
      const gateways = PaymentGatewayFactory.getSupportedGateways();
      
      res.json({
        success: true,
        gateways,
      });
    } catch (error: any) {
      console.error('Fetch gateways error:', error);
      res.status(500).json({
        error: 'Failed to fetch supported gateways',
        message: error.message,
      });
    }
  });

  app.get('/api/payment-gateway-configs', requireAuthWithOrg, async (req, res) => {
    try {
      const organizationId = (req as any).organizationId;

      const configs = await db
        .select({
          id: paymentGatewayConfigs.id,
          gateway: paymentGatewayConfigs.gateway,
          environment: paymentGatewayConfigs.environment,
          isDefault: paymentGatewayConfigs.isDefault,
          isActive: paymentGatewayConfigs.isActive,
          createdAt: paymentGatewayConfigs.createdAt,
        })
        .from(paymentGatewayConfigs)
        .where(eq(paymentGatewayConfigs.organizationId, organizationId));

      res.json(configs);
    } catch (error: any) {
      console.error('Fetch gateway configs error:', error);
      res.status(500).json({
        error: 'Failed to fetch gateway configurations',
        message: error.message,
      });
    }
  });

  app.post('/api/payment-gateway-configs', requireAuthWithOrg, async (req, res) => {
    try {
      const validation = gatewayConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const organizationId = (req as any).organizationId;

      if (data.isDefault) {
        await db
          .update(paymentGatewayConfigs)
          .set({ isDefault: false })
          .where(eq(paymentGatewayConfigs.organizationId, organizationId));
      }

      const [config] = await db
        .insert(paymentGatewayConfigs)
        .values({
          organizationId,
          gateway: data.gateway,
          apiKey: encrypt(data.apiKey),
          apiSecret: encrypt(data.apiSecret),
          webhookSecret: data.webhookSecret ? encrypt(data.webhookSecret) : null,
          publicKey: data.publicKey ? encrypt(data.publicKey) : null,
          environment: data.environment,
          isDefault: data.isDefault,
          isActive: true,
        })
        .returning();

      PaymentGatewayFactory.clearCache(organizationId);

      res.json({
        success: true,
        config: {
          id: config.id,
          gateway: config.gateway,
          environment: config.environment,
          isDefault: config.isDefault,
          isActive: config.isActive,
        },
      });
    } catch (error: any) {
      console.error('Create gateway config error:', error);
      res.status(500).json({
        error: 'Failed to create gateway configuration',
        message: error.message,
      });
    }
  });

  app.patch('/api/payment-gateway-configs/:id', requireAuthWithOrg, async (req, res) => {
    try {
      const { id } = req.params;
      const organizationId = (req as any).organizationId;
      const { isDefault, isActive } = req.body;

      const [existingConfig] = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.id, id),
            eq(paymentGatewayConfigs.organizationId, organizationId)
          )
        );

      if (!existingConfig) {
        return res.status(404).json({ error: 'Gateway configuration not found' });
      }

      if (isDefault) {
        await db
          .update(paymentGatewayConfigs)
          .set({ isDefault: false })
          .where(eq(paymentGatewayConfigs.organizationId, organizationId));
      }

      const [updated] = await db
        .update(paymentGatewayConfigs)
        .set({
          isDefault: isDefault ?? existingConfig.isDefault,
          isActive: isActive ?? existingConfig.isActive,
          updatedAt: new Date(),
        })
        .where(eq(paymentGatewayConfigs.id, id))
        .returning();

      PaymentGatewayFactory.clearCache(organizationId);

      res.json({
        success: true,
        config: {
          id: updated.id,
          gateway: updated.gateway,
          environment: updated.environment,
          isDefault: updated.isDefault,
          isActive: updated.isActive,
        },
      });
    } catch (error: any) {
      console.error('Update gateway config error:', error);
      res.status(500).json({
        error: 'Failed to update gateway configuration',
        message: error.message,
      });
    }
  });

  app.delete('/api/payment-gateway-configs/:id', requireAuthWithOrg, async (req, res) => {
    try {
      const { id } = req.params;
      const organizationId = (req as any).organizationId;

      const [config] = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.id, id),
            eq(paymentGatewayConfigs.organizationId, organizationId)
          )
        );

      if (!config) {
        return res.status(404).json({ error: 'Gateway configuration not found' });
      }

      await db
        .delete(paymentGatewayConfigs)
        .where(eq(paymentGatewayConfigs.id, id));

      PaymentGatewayFactory.clearCache(organizationId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete gateway config error:', error);
      res.status(500).json({
        error: 'Failed to delete gateway configuration',
        message: error.message,
      });
    }
  });
}
