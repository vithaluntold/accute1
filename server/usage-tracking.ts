import { storage } from './storage';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq, and, count } from 'drizzle-orm';

/**
 * Usage Tracking Service
 * Provides real-time resource usage counts for organizations
 */

export class UsageTrackingService {
  /**
   * Get current workflow count for organization
   */
  static async getWorkflowCount(organizationId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(schema.workflows)
        .where(
          and(
            eq(schema.workflows.organizationId, organizationId),
            eq(schema.workflows.status, 'active') // Only count active workflows
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('[Usage Tracking] Error counting workflows:', error);
      return 0;
    }
  }

  /**
   * Get current AI agent installation count for organization
   */
  static async getAIAgentCount(organizationId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(schema.marketplaceInstallations)
        .where(
          and(
            eq(schema.marketplaceInstallations.organizationId, organizationId),
            eq(schema.marketplaceInstallations.status, 'active')
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('[Usage Tracking] Error counting AI agents:', error);
      return 0;
    }
  }

  /**
   * Get current user count for organization
   */
  static async getUserCount(organizationId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(schema.users)
        .where(eq(schema.users.organizationId, organizationId));
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('[Usage Tracking] Error counting users:', error);
      return 0;
    }
  }

  /**
   * Get current client count for organization
   */
  static async getClientCount(organizationId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(schema.clients)
        .where(eq(schema.clients.organizationId, organizationId));
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('[Usage Tracking] Error counting clients:', error);
      return 0;
    }
  }

  /**
   * Get current storage usage for organization (in GB)
   * NOTE: Requires implementing document size tracking
   */
  static async getStorageUsage(organizationId: string): Promise<number> {
    try {
      // TODO: Implement actual storage calculation from documents table
      // For now, return 0 as storage tracking needs to be implemented
      return 0;
    } catch (error) {
      console.error('[Usage Tracking] Error calculating storage:', error);
      return 0;
    }
  }

  /**
   * Get all usage metrics for organization
   * Uses real-time queries for ALL metrics (no cached values)
   */
  static async getOrganizationUsage(organizationId: string): Promise<{
    users: number;
    clients: number;
    storage: number;
    workflows: number;
    aiAgents: number;
  }> {
    try {
      // CRITICAL: Query ALL counts in real-time (no cached values)
      // This ensures free-tier quotas are enforced correctly
      const [users, clients, storage, workflows, aiAgents] = await Promise.all([
        this.getUserCount(organizationId),
        this.getClientCount(organizationId),
        this.getStorageUsage(organizationId),
        this.getWorkflowCount(organizationId),
        this.getAIAgentCount(organizationId)
      ]);

      return {
        users,
        clients,
        storage,
        workflows,
        aiAgents
      };
    } catch (error) {
      console.error('[Usage Tracking] Error getting organization usage:', error);
      return {
        users: 0,
        clients: 0,
        storage: 0,
        workflows: 0,
        aiAgents: 0
      };
    }
  }

  /**
   * Update cached usage counts in subscription
   * Call this when users/clients/storage changes
   */
  static async updateCachedUsage(
    organizationId: string,
    updates: {
      currentUsers?: number;
      currentClients?: number;
      currentStorage?: number;
    }
  ): Promise<void> {
    try {
      const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
      
      if (subscription) {
        await storage.updatePlatformSubscription(subscription.id, {
          ...updates,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('[Usage Tracking] Error updating cached usage:', error);
    }
  }

  /**
   * Increment user count
   */
  static async incrementUsers(organizationId: string, amount: number = 1): Promise<void> {
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    if (subscription) {
      await this.updateCachedUsage(organizationId, {
        currentUsers: (subscription.currentUsers || 0) + amount
      });
    }
  }

  /**
   * Decrement user count
   */
  static async decrementUsers(organizationId: string, amount: number = 1): Promise<void> {
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    if (subscription) {
      await this.updateCachedUsage(organizationId, {
        currentUsers: Math.max(0, (subscription.currentUsers || 0) - amount)
      });
    }
  }

  /**
   * Increment client count
   */
  static async incrementClients(organizationId: string, amount: number = 1): Promise<void> {
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    if (subscription) {
      await this.updateCachedUsage(organizationId, {
        currentClients: (subscription.currentClients || 0) + amount
      });
    }
  }

  /**
   * Decrement client count
   */
  static async decrementClients(organizationId: string, amount: number = 1): Promise<void> {
    const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
    if (subscription) {
      await this.updateCachedUsage(organizationId, {
        currentClients: Math.max(0, (subscription.currentClients || 0) - amount)
      });
    }
  }

  /**
   * Update storage usage (in GB)
   */
  static async updateStorage(organizationId: string, storageGB: number): Promise<void> {
    await this.updateCachedUsage(organizationId, {
      currentStorage: storageGB
    });
  }
}
