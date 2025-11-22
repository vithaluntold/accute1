import type { Express } from 'express';
import { z } from 'zod';
import { PaymentGatewayFactory } from './payment-gateways';
import { requireAuthWithOrg } from './routes';
import { db } from './db';
import { paymentGatewayConfigs, payments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt } from './auth';

// Sanitized error codes
enum PaymentErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  GATEWAY_CONFIG_NOT_FOUND = 'GATEWAY_CONFIG_NOT_FOUND',
  ORDER_CREATION_FAILED = 'ORDER_CREATION_FAILED',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  PAYMENT_VERIFICATION_FAILED = 'PAYMENT_VERIFICATION_FAILED',
  REFUND_FAILED = 'REFUND_FAILED',
  WEBHOOK_INVALID_SIGNATURE = 'WEBHOOK_INVALID_SIGNATURE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

function sanitizeError(error: any, code: PaymentErrorCode, defaultMessage: string) {
  console.error(`[Payment Error] ${code}:`, error);
  
  return {
    error: code,
    message: defaultMessage,
    ...(process.env.NODE_ENV === 'development' && { debug: error.message }),
  };
}

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
        return res.status(400).json(
          sanitizeError(
            validation.error,
            PaymentErrorCode.VALIDATION_ERROR,
            'Invalid payment request data'
          )
        );
      }

      const data = validation.data;
      const organizationId = (req as any).organizationId;
      const userId = (req as any).user?.id;

      const { gateway: gatewayInstance, config: gatewayConfig } = await PaymentGatewayFactory.getGateway(
        organizationId,
        data.gateway as any
      );

      const internalOrderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const gatewayOrder = await gatewayInstance.createOrder({
        orderId: internalOrderId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        customer: data.customer,
        metadata: data.metadata,
      });

      const [storedPayment] = await db
        .insert(payments)
        .values({
          organizationId,
          amount: data.amount,
          currency: data.currency,
          method: 'gateway_payment',
          status: 'pending',
          gateway: gatewayConfig.gateway,
          internalOrderId,
          gatewayOrderId: gatewayOrder.gatewayOrderId,
          gatewayConfigId: gatewayConfig.id,
          customerName: data.customer.name,
          customerEmail: data.customer.email,
          customerPhone: data.customer.phone,
          metadata: data.metadata || {},
          transactionDate: new Date(),
          createdBy: userId,
        })
        .returning();

      res.json({
        success: true,
        gateway: gatewayInstance.gatewayName,
        order: {
          orderId: storedPayment.id,
          gatewayOrderId: gatewayOrder.gatewayOrderId,
          sessionId: gatewayOrder.sessionId,
          paymentUrl: gatewayOrder.paymentUrl,
          amount: gatewayOrder.amount,
          currency: gatewayOrder.currency,
          status: gatewayOrder.status,
        },
        checkoutScript: gatewayInstance.getCheckoutScript(),
      });
    } catch (error: any) {
      res.status(500).json(
        sanitizeError(
          error,
          PaymentErrorCode.ORDER_CREATION_FAILED,
          'Unable to create payment order. Please try again.'
        )
      );
    }
  });

  app.get('/api/payment/status/:orderId', requireAuthWithOrg, async (req, res) => {
    try {
      const { orderId } = req.params;
      const organizationId = (req as any).organizationId;

      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, orderId),
            eq(payments.organizationId, organizationId)
          )
        );

      if (!payment || !payment.gatewayOrderId) {
        return res.status(404).json(
          sanitizeError(
            new Error('Payment not found'),
            PaymentErrorCode.ORDER_NOT_FOUND,
            'Payment order not found'
          )
        );
      }

      const { gateway: gatewayInstance } = await PaymentGatewayFactory.getGateway(
        organizationId,
        payment.gateway as any
      );

      const status = await gatewayInstance.getPaymentStatus(payment.gatewayOrderId);

      if (status.status !== payment.status) {
        await db
          .update(payments)
          .set({
            status: status.status,
            gatewayPaymentId: status.paymentId || payment.gatewayPaymentId,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, orderId));
      }

      res.json({
        success: true,
        gateway: gatewayInstance.gatewayName,
        payment: {
          ...status,
          orderId,
          gatewayOrderId: payment.gatewayOrderId,
        },
      });
    } catch (error: any) {
      res.status(500).json(
        sanitizeError(
          error,
          PaymentErrorCode.PAYMENT_VERIFICATION_FAILED,
          'Unable to fetch payment status'
        )
      );
    }
  });

  app.post('/api/payment/refund', requireAuthWithOrg, async (req, res) => {
    try {
      const validation = refundSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json(
          sanitizeError(
            validation.error,
            PaymentErrorCode.VALIDATION_ERROR,
            'Invalid refund request data'
          )
        );
      }

      const data = validation.data;
      const organizationId = (req as any).organizationId;

      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, data.paymentId),
            eq(payments.organizationId, organizationId)
          )
        );

      if (!payment || !payment.gatewayPaymentId) {
        return res.status(404).json(
          sanitizeError(
            new Error('Payment not found'),
            PaymentErrorCode.ORDER_NOT_FOUND,
            'Payment not found for refund'
          )
        );
      }

      const { gateway: gatewayInstance } = await PaymentGatewayFactory.getGateway(
        organizationId,
        payment.gateway as any
      );

      const refund = await gatewayInstance.refundPayment({
        paymentId: payment.gatewayPaymentId,
        amount: data.amount,
        reason: data.reason,
        notes: data.notes,
      });

      await db
        .update(payments)
        .set({
          status: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, data.paymentId));

      res.json({
        success: true,
        gateway: gatewayInstance.gatewayName,
        refund,
      });
    } catch (error: any) {
      res.status(500).json(
        sanitizeError(
          error,
          PaymentErrorCode.REFUND_FAILED,
          'Unable to process refund'
        )
      );
    }
  });

  app.post('/api/payment/webhook/:webhookToken', async (req, res) => {
    try {
      const { webhookToken } = req.params;
      const signature = req.headers['x-razorpay-signature'] || 
                       req.headers['stripe-signature'] || 
                       req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;

      if (!signature) {
        return res.status(400).json(
          sanitizeError(
            new Error('Missing signature'),
            PaymentErrorCode.WEBHOOK_INVALID_SIGNATURE,
            'Webhook signature missing'
          )
        );
      }

      if (!webhookToken) {
        return res.status(400).json(
          sanitizeError(
            new Error('Missing webhook token'),
            PaymentErrorCode.VALIDATION_ERROR,
            'Webhook token required'
          )
        );
      }

      const payload = typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);

      const [gatewayConfig] = await db
        .select()
        .from(paymentGatewayConfigs)
        .where(
          and(
            eq(paymentGatewayConfigs.webhookToken, webhookToken),
            eq(paymentGatewayConfigs.isActive, true)
          )
        )
        .limit(1);

      if (!gatewayConfig) {
        console.warn(
          `[Webhook Security] Invalid webhook token attempted: ${webhookToken.substring(0, 8)}...`
        );
        return res.status(404).json(
          sanitizeError(
            new Error('Gateway config not found'),
            PaymentErrorCode.GATEWAY_CONFIG_NOT_FOUND,
            'Invalid webhook configuration'
          )
        );
      }

      const { gateway: gatewayInstance } = await PaymentGatewayFactory.getGateway(
        gatewayConfig.organizationId,
        gatewayConfig.gateway as any
      );

      const verification = gatewayInstance.verifyWebhookSignature(
        signature,
        payload,
        timestamp
      );

      if (!verification.isValid) {
        console.warn(
          `[Webhook Security] Invalid signature for ${gatewayConfig.gateway} webhook token ${webhookToken.substring(0, 8)}...`
        );
        return res.status(401).json(
          sanitizeError(
            new Error('Invalid signature'),
            PaymentErrorCode.WEBHOOK_INVALID_SIGNATURE,
            'Invalid webhook signature - signature verification failed'
          )
        );
      }

      if (verification.event?.type.includes('payment')) {
        const gatewayOrderId = verification.event.data.orderId || 
                               verification.event.data.order_id;
        const internalOrderId = verification.event.data.internalOrderId ||
                                verification.event.data.notes?.internalOrderId;
        
        if (gatewayOrderId || internalOrderId) {
          const conditions: any[] = [
            eq(payments.gatewayConfigId, gatewayConfig.id)
          ];
          
          if (gatewayOrderId) {
            conditions.push(eq(payments.gatewayOrderId, gatewayOrderId));
          }
          
          if (internalOrderId) {
            conditions.push(eq(payments.internalOrderId, internalOrderId));
          }
          
          const [payment] = await db
            .select()
            .from(payments)
            .where(and(...conditions))
            .limit(1);

          if (payment) {
            const newStatus = verification.event.type.includes('success') || 
                             verification.event.type.includes('paid') ||
                             verification.event.type.includes('captured')
              ? 'completed'
              : verification.event.type.includes('fail')
              ? 'failed'
              : payment.status;

            await db
              .update(payments)
              .set({
                status: newStatus,
                gatewayPaymentId: verification.event.data.paymentId || payment.gatewayPaymentId,
                updatedAt: new Date(),
              })
              .where(eq(payments.id, payment.id));
          }
        }
      }

      res.status(200).json({
        success: true,
        event: verification.event?.type,
      });
    } catch (error: any) {
      res.status(500).json(
        sanitizeError(
          error,
          PaymentErrorCode.INTERNAL_ERROR,
          'Webhook processing failed'
        )
      );
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

      await PaymentGatewayFactory.clearCacheForOrganization(organizationId);

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

      await PaymentGatewayFactory.clearCacheForOrganization(organizationId);

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

      await PaymentGatewayFactory.clearCacheForOrganization(organizationId);

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
