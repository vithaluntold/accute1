/**
 * AI Agent Foundry - Dynamic Agent Registry
 * 
 * Manifest-driven system for registering and managing AI agents.
 * Agents are loaded from /agents/{slug}/manifest.json at runtime.
 */

import { promises as fs } from "fs";
import path from "path";
import type { Express } from "express";
import { db } from "./db";
import { aiAgents, organizationAgents, userAgentAccess } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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
        pricingModel: manifest.pricingModel || "free",
        priceMonthly: manifest.priceMonthly || null,
        priceYearly: manifest.priceYearly || null,
      };

      if (existing.length > 0) {
        await db
          .update(aiAgents)
          .set({ ...agentData, updatedAt: new Date() })
          .where(eq(aiAgents.id, existing[0].id));
      } else {
        await db.insert(aiAgents).values(agentData);
      }
    } catch (error) {
      console.error(`Failed to sync agent ${manifest.slug} to database:`, error);
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

      const agentDir = path.join(this.agentsDir, slug);
      const backendPath = path.join(agentDir, manifest.backendEntry);
      
      const handler = await import(backendPath);
      
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
      if (organizationId === null && userRole === "admin") {
        return true;
      }

      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, agentSlug))
        .limit(1);

      if (agent.length === 0) {
        return false;
      }

      const agentId = agent[0].id;

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

      if (userRole === "admin") {
        return true;
      }

      const userAccess = await db
        .select()
        .from(userAgentAccess)
        .where(
          and(
            eq(userAgentAccess.userId, userId),
            eq(userAgentAccess.agentId, agentId),
            eq(userAgentAccess.organizationId, organizationId!)
          )
        )
        .limit(1);

      return userAccess.length > 0 && userAccess[0].revokedAt === null;
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
