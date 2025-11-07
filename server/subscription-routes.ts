import { Router, Response } from 'express';
import { requireAuth, type AuthRequest } from './auth';
import { getOrganizationEntitlements } from './feature-gating';

/**
 * Subscription & Feature Gating Routes
 * Provides frontend access to subscription status and feature entitlements
 */
export function registerSubscriptionRoutes(app: Router) {
  
  /**
   * GET /api/subscription/entitlements
   * Get current user's organization subscription entitlements
   * Returns features, limits, and usage information
   */
  app.get('/api/subscription/entitlements', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user?.organizationId) {
        // Platform admins with no org get unlimited access
        return res.json({
          plan: 'platform',
          features: ['*'], // All features
          limits: {
            maxUsers: 999999,
            maxClients: 999999,
            maxStorage: 999999,
            maxWorkflows: 999999,
            maxAIAgents: 999999
          },
          usage: {
            users: 0,
            clients: 0,
            storage: 0,
            workflows: 0,
            aiAgents: 0
          }
        });
      }

      const entitlements = await getOrganizationEntitlements(req.user.organizationId);
      res.json(entitlements);
    } catch (error: any) {
      console.error('[Subscription] Failed to get entitlements:', error);
      res.status(500).json({ error: 'Failed to fetch subscription entitlements' });
    }
  });
}
