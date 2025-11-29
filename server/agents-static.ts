/**
 * Static Agent Registry
 * 
 * This file statically imports all agent backends and provides a simple
 * registration interface. No dynamic imports, no path resolution issues.
 * 
 * Production-grade, bulletproof approach.
 */

import { type Express } from 'express';

// Static imports of all agent backends
// In development: tsx will load .ts files
// In production: bundler will resolve to compiled .js
import * as cadenceBackend from '../agents/cadence/backend/index';
import * as echoBackend from '../agents/echo/backend/index';
import * as formaBackend from '../agents/forma/backend/index';
import * as kanbanBackend from '../agents/kanban/backend/index';
import * as lucaBackend from '../agents/luca/backend/index';
import * as lynkBackend from '../agents/lynk/backend/index';
import * as omnispectraBackend from '../agents/omnispectra/backend/index';
import * as onboardBackend from '../agents/onboard/backend/index';
import * as parityBackend from '../agents/parity/backend/index';
import * as radarBackend from '../agents/radar/backend/index';
import * as relayBackend from '../agents/relay/backend/index';
import * as traceBackend from '../agents/trace/backend/index';
import * as scribeBackend from '../agents/scribe/backend/index';

// Agent backend interface
interface AgentBackend {
  registerRoutes: (app: Express) => void;
}

// Static registry of all agent backends
const AGENT_BACKENDS: Record<string, AgentBackend> = {
  'cadence': cadenceBackend as AgentBackend,
  'echo': echoBackend as AgentBackend,
  'forma': formaBackend as AgentBackend,
  'kanban': kanbanBackend as AgentBackend,
  'luca': lucaBackend as AgentBackend,
  'lynk': lynkBackend as AgentBackend,
  'omnispectra': omnispectraBackend as AgentBackend,
  'onboard': onboardBackend as AgentBackend,
  'parity': parityBackend as AgentBackend,
  'radar': radarBackend as AgentBackend,
  'relay': relayBackend as AgentBackend,
  'trace': traceBackend as AgentBackend,
  'scribe': scribeBackend as AgentBackend,
};

/**
 * Register routes for a specific agent
 * @param agentSlug - The agent's slug identifier
 * @param app - Express application instance
 */
export function registerAgentRoutes(agentSlug: string, app: Express): void {
  const backend = AGENT_BACKENDS[agentSlug];
  
  if (!backend) {
    throw new Error(`Agent backend not found: ${agentSlug}`);
  }
  
  if (typeof backend.registerRoutes !== 'function') {
    throw new Error(`Agent ${agentSlug} backend must export a registerRoutes function`);
  }
  
  console.log(`[STATIC AGENT LOADER] Registering routes for: ${agentSlug}`);
  backend.registerRoutes(app);
  console.log(`[STATIC AGENT LOADER] ✅ Successfully registered: ${agentSlug}`);
}

/**
 * Register all agent routes
 * @param agents - Array of agent slugs to register
 * @param app - Express application instance
 */
export function registerAllAgentRoutes(agents: string[], app: Express): void {
  console.log(`[STATIC AGENT LOADER] Registering ${agents.length} agents...`);
  
  for (const agentSlug of agents) {
    try {
      registerAgentRoutes(agentSlug, app);
    } catch (error) {
      console.error(`[STATIC AGENT LOADER] ❌ Failed to register ${agentSlug}:`, error);
      throw error;
    }
  }
  
  console.log(`[STATIC AGENT LOADER] ✅ All ${agents.length} agents registered successfully`);
}

/**
 * Get list of all available agents
 */
export function getAvailableAgents(): string[] {
  return Object.keys(AGENT_BACKENDS);
}
