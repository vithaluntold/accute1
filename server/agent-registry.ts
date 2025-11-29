/**
 * AI Agent Foundry - Dynamic Agent Registry
 * 
 * Manifest-driven system for registering and managing AI agents.
 * Agents are loaded from /agents/{slug}/manifest.json at runtime.
 */

import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import type { Express } from "express";
import { db } from "./db";
import { aiAgents, organizationAgents, userAgentAccess, aiAgentInstallations, organizations, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { importAgentBackend } from './agent-import-helper';

export interface AgentManifest {
  slug: string;
  name: string;
  description: string;
  category: string;
  provider: string;
  frontendEntry: string;
  backendEntry: string;
  iconPath?: string;
  capabilities: string[];
  subscriptionMinPlan?: string;
  defaultScope?: string;
  pricingModel?: string;
  priceMonthly?: number;
  priceYearly?: number;
  pricePerInstance?: number;
  pricePerToken?: number;
  oneTimeFee?: number;
  version?: string;
  tags?: string[];
  configuration?: Record<string, any>;
}

interface AgentHandler {
  registerRoutes: (app: Express) => void;
}

class AgentRegistry {
  private agents: Map<string, AgentManifest> = new Map();
  private handlers: Map<string, AgentHandler> = new Map();
  private agentsDir = path.join(process.cwd(), "agents");

  async initialize() {
    console.log("Initializing Agent Registry...");
    try {
      // Clear existing agents for clean re-initialization
      this.agents.clear();
      this.handlers.clear();
      
      const entries = await fs.readdir(this.agentsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith("_")) {
          await this.loadAgent(entry.name);
        }
      }
      
      console.log(`Agent Registry initialized with ${this.agents.size} agents`);
    } catch (error) {
      console.error("Failed to initialize Agent Registry:", error);
    }
  }

  async loadAgent(slug: string): Promise<void> {
    try {
      const agentDir = path.join(this.agentsDir, slug);
      const manifestPath = path.join(agentDir, "manifest.json");
      
      // Check if manifest exists before trying to read it
      try {
        await fs.access(manifestPath);
      } catch {
        // Silently skip directories without manifests (agents in development)
        return;
      }
      
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      const manifest: AgentManifest = JSON.parse(manifestContent);
      
      if (manifest.slug !== slug) {
        throw new Error(`Manifest slug "${manifest.slug}" does not match directory name "${slug}"`);
      }
      
      this.agents.set(slug, manifest);
      console.log(`Loaded agent: ${manifest.name} (${slug})`);
      
      await this.syncAgentToDatabase(manifest);
    } catch (error) {
      console.error(`Failed to load agent ${slug}:`, error);
    }
  }

  private async syncAgentToDatabase(manifest: AgentManifest): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, manifest.slug))
        .limit(1);

      // Support both nested pricing object and top-level pricing fields for backward compatibility
      const pricing = (manifest as any).pricing || {};
      const pricingModel = manifest.pricingModel || pricing.model || "free";
      const priceMonthly = manifest.priceMonthly ?? pricing.priceMonthly ?? null;
      const priceYearly = manifest.priceYearly ?? pricing.priceYearly ?? null;
      const pricePerInstance = manifest.pricePerInstance ?? pricing.pricePerInstance ?? null;
      const pricePerToken = manifest.pricePerToken ?? pricing.pricePerToken ?? null;
      const oneTimeFee = manifest.oneTimeFee ?? pricing.oneTimeFee ?? null;

      const agentData = {
        slug: manifest.slug,
        name: manifest.name,
        description: manifest.description,
        category: manifest.category,
        provider: manifest.provider,
        frontendPath: manifest.frontendEntry,
        backendPath: manifest.backendEntry,
        iconPath: manifest.iconPath || null,
        manifestJson: JSON.stringify(manifest),
        subscriptionMinPlan: manifest.subscriptionMinPlan || "free",
        defaultScope: manifest.defaultScope || "admin",
        pricingModel,
        priceMonthly: priceMonthly !== null ? priceMonthly.toString() : null,
        priceYearly: priceYearly !== null ? priceYearly.toString() : null,
        pricePerInstance: pricePerInstance !== null ? pricePerInstance.toString() : null,
        pricePerToken: pricePerToken !== null ? pricePerToken.toString() : null,
        oneTimeFee: oneTimeFee !== null ? oneTimeFee.toString() : null,
        isPublished: true, // Auto-publish registry agents
      };

      let agentId: string;
      
      if (existing.length > 0) {
        await db
          .update(aiAgents)
          .set({ ...agentData, updatedAt: new Date() })
          .where(eq(aiAgents.id, existing[0].id));
        agentId = existing[0].id;
      } else {
        const inserted = await db.insert(aiAgents).values(agentData).returning();
        agentId = inserted[0].id;
      }

      // Auto-install free agents for all organizations
      // NOTE: Temporarily disabled due to tsx compilation caching issues
      // The method is public and can be called manually or via API endpoint
      // await this.autoInstallForOrganizations(agentId, pricingModel, manifest.slug);
    } catch (error) {
      console.error(`Failed to sync agent ${manifest.slug} to database:`, error);
    }
  }

  /**
   * Auto-install agents for all organizations based on pricing model
   * Free agents: Auto-installed immediately
   * Paid agents: Tracked but not auto-installed (user must explicitly install)
   */
  async autoInstallForOrganizations(
    agentId: string,
    pricingModel: string,
    agentSlug: string
  ): Promise<void> {
    try {
      // Only auto-install free agents
      if (pricingModel !== 'free') {
        console.log(`  → Agent ${agentSlug} is paid (${pricingModel}) - skipping auto-install`);
        return;
      }

      // Get all organizations
      const allOrgs = await db.select({ id: organizations.id }).from(organizations);
      
      if (allOrgs.length === 0) {
        return;
      }

      // Get system user (first super admin) to use as installer
      const systemUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'Super Admin'))
        .limit(1);

      if (systemUser.length === 0) {
        console.log(`  → No system user found for auto-install of ${agentSlug}`);
        return;
      }

      const installedBy = systemUser[0].id;

      // Check existing installations
      const existingInstallations = await db
        .select({ organizationId: aiAgentInstallations.organizationId })
        .from(aiAgentInstallations)
        .where(eq(aiAgentInstallations.agentId, agentId));

      const installedOrgIds = new Set(existingInstallations.map(i => i.organizationId));

      // Install for organizations that don't have it yet
      const orgsToInstall = allOrgs.filter(org => !installedOrgIds.has(org.id));

      if (orgsToInstall.length > 0) {
        // Insert installations one by one and enable in organizationAgents
        for (const org of orgsToInstall) {
          // Create installation record
          await db.insert(aiAgentInstallations).values({
            agentId,
            organizationId: org.id,
            installedBy,
            configuration: {},
            isActive: true,
          });

          // Enable agent for organization (required for access checks)
          const existingOrgAgent = await db
            .select()
            .from(organizationAgents)
            .where(
              and(
                eq(organizationAgents.organizationId, org.id),
                eq(organizationAgents.agentId, agentId)
              )
            )
            .limit(1);

          if (existingOrgAgent.length === 0) {
            await db.insert(organizationAgents).values({
              organizationId: org.id,
              agentId,
              status: 'enabled',
              grantedBy: installedBy,
            });
          } else if (existingOrgAgent[0].status !== 'enabled') {
            await db
              .update(organizationAgents)
              .set({ status: 'enabled', updatedAt: new Date() })
              .where(eq(organizationAgents.id, existingOrgAgent[0].id));
          }
        }
        console.log(`  Auto-installed ${agentSlug} for ${orgsToInstall.length} organizations`);
      }
    } catch (error) {
      console.error(`Failed to auto-install agent ${agentSlug}:`, error);
    }
  }

  getAgent(slug: string): AgentManifest | undefined {
    return this.agents.get(slug);
  }

  getAllAgents(): AgentManifest[] {
    return Array.from(this.agents.values());
  }

  async registerAgentRoutes(app: Express, slug: string): Promise<void> {
    try {
      const manifest = this.agents.get(slug);
      if (!manifest) {
        throw new Error(`Agent ${slug} not found`);
      }

      if (this.handlers.has(slug)) {
        console.log(`Agent ${slug} routes already registered`);
        return;
      }

      // Use the helper function to import agent backend (handles dev/prod paths)
      const handler = await importAgentBackend(slug);
      
      if (typeof handler.registerRoutes !== "function") {
        throw new Error(`Agent ${slug} backend must export a registerRoutes function`);
      }

      handler.registerRoutes(app);
      this.handlers.set(slug, handler);
      
      console.log(`Registered routes for agent: ${slug}`);
    } catch (error) {
      console.error(`Failed to register agent ${slug} routes:`, error);
      throw error;
    }
  }

  async checkUserAccess(
    userId: string,
    agentSlug: string,
    organizationId: string | null,
    userRole: string
  ): Promise<boolean> {
    try {
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, agentSlug))
        .limit(1);

      if (agent.length === 0) {
        return false;
      }

      // Agent must be published
      if (!agent[0].isPublished) {
        return false;
      }

      const agentId = agent[0].id;

      // Platform admins (Super Admin with organizationId === null) have access to all published agents
      if (organizationId === null && (userRole.toLowerCase() === "super admin" || userRole.toLowerCase() === "admin")) {
        return true;
      }

      // For organization users, check if organization has agent enabled
      if (organizationId) {
        const orgAgent = await db
          .select()
          .from(organizationAgents)
          .where(
            and(
              eq(organizationAgents.organizationId, organizationId),
              eq(organizationAgents.agentId, agentId),
              eq(organizationAgents.status, "enabled")
            )
          )
          .limit(1);

        if (orgAgent.length === 0) {
          return false;
        }
      }

      // Organization admins have access if organization has agent enabled
      if (userRole.toLowerCase() === "admin") {
        return true;
      }

      // Regular users need explicit permission
      if (organizationId) {
        const userAccess = await db
          .select()
          .from(userAgentAccess)
          .where(
            and(
              eq(userAgentAccess.userId, userId),
              eq(userAgentAccess.agentId, agentId),
              eq(userAgentAccess.organizationId, organizationId)
            )
          )
          .limit(1);

        return userAccess.length > 0 && userAccess[0].revokedAt === null;
      }

      return false;
    } catch (error) {
      console.error("Error checking user access:", error);
      return false;
    }
  }

  async getAvailableAgents(
    userId: string,
    organizationId: string | null,
    userRole: string,
    subscriptionPlan: string = "free"
  ): Promise<AgentManifest[]> {
    try {
      const allAgents = this.getAllAgents();
      const available: AgentManifest[] = [];

      for (const agent of allAgents) {
        if (!this.meetsSubscriptionRequirement(subscriptionPlan, agent.subscriptionMinPlan || "free")) {
          continue;
        }

        const hasAccess = await this.checkUserAccess(userId, agent.slug, organizationId, userRole);
        if (hasAccess) {
          available.push(agent);
        }
      }

      return available;
    } catch (error) {
      console.error("Error getting available agents:", error);
      return [];
    }
  }

  private meetsSubscriptionRequirement(userPlan: string, requiredPlan: string): boolean {
    const planHierarchy = ["free", "starter", "professional", "enterprise"];
    const userLevel = planHierarchy.indexOf(userPlan);
    const requiredLevel = planHierarchy.indexOf(requiredPlan);
    
    return userLevel >= requiredLevel;
  }

  async enableAgentForOrganization(
    agentSlug: string,
    organizationId: string,
    grantedBy: string
  ): Promise<void> {
    try {
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, agentSlug))
        .limit(1);

      if (agent.length === 0) {
        throw new Error("Agent not found");
      }

      const existing = await db
        .select()
        .from(organizationAgents)
        .where(
          and(
            eq(organizationAgents.organizationId, organizationId),
            eq(organizationAgents.agentId, agent[0].id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(organizationAgents)
          .set({
            status: "enabled",
            enabledAt: new Date(),
            disabledAt: null,
            updatedAt: new Date(),
          })
          .where(eq(organizationAgents.id, existing[0].id));
      } else {
        await db.insert(organizationAgents).values({
          organizationId,
          agentId: agent[0].id,
          status: "enabled",
          grantedBy,
        });
      }
    } catch (error) {
      console.error("Error enabling agent for organization:", error);
      throw error;
    }
  }

  async grantUserAccess(
    agentSlug: string,
    userId: string,
    organizationId: string,
    grantedBy: string,
    accessLevel: "use" | "manage" = "use"
  ): Promise<void> {
    try {
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, agentSlug))
        .limit(1);

      if (agent.length === 0) {
        throw new Error("Agent not found");
      }

      const existing = await db
        .select()
        .from(userAgentAccess)
        .where(
          and(
            eq(userAgentAccess.userId, userId),
            eq(userAgentAccess.agentId, agent[0].id),
            eq(userAgentAccess.organizationId, organizationId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(userAgentAccess)
          .set({
            accessLevel,
            revokedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(userAgentAccess.id, existing[0].id));
      } else {
        await db.insert(userAgentAccess).values({
          userId,
          agentId: agent[0].id,
          organizationId,
          accessLevel,
          grantedBy,
        });
      }
    } catch (error) {
      console.error("Error granting user access:", error);
      throw error;
    }
  }
}

export const agentRegistry = new AgentRegistry();
