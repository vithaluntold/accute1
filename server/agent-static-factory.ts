/**
 * Static Agent Factory
 * 
 * Creates agent instances using static imports to work reliably in both dev and production.
 * This replaces the dynamic import approach that had issues with relative paths.
 */

import type { LlmConfiguration } from '@shared/schema';

/**
 * Base interface that all agents must implement
 */
export interface BaseAgent {
  execute(input: any, context?: any): Promise<any>;
  executeStream?(input: any, onChunk: (chunk: string) => void): Promise<string>;
}

// Static imports of all agent classes
import { CadenceAgent } from '../agents/cadence/backend/index';
import { EchoAgent } from '../agents/echo/backend/index';
import { FormaAgent } from '../agents/forma/backend/index';
import { LucaAgent } from '../agents/luca/backend/index';
import { LynkAgent } from '../agents/lynk/backend/index';
import { OmniSpectraAgent } from '../agents/omnispectra/backend/index';
import { ParityAgent } from '../agents/parity/backend/index';
import { RadarAgent } from '../agents/radar/backend/index';
import { RelayAgent } from '../agents/relay/backend/index';
import { ScribeAgent } from '../agents/scribe/backend/index';

// Map of agent names to their constructors
const AGENT_CONSTRUCTORS: Record<string, new (llmConfig: LlmConfiguration) => BaseAgent> = {
  cadence: CadenceAgent,
  echo: EchoAgent,
  forma: FormaAgent,
  luca: LucaAgent,
  lynk: LynkAgent,
  omnispectra: OmniSpectraAgent,
  parity: ParityAgent,
  radar: RadarAgent,
  relay: RelayAgent,
  scribe: ScribeAgent,
};

/**
 * Create an agent instance using static imports
 * 
 * @param agentName - Name of the agent (e.g., 'luca', 'cadence')
 * @param llmConfig - LLM configuration for the agent
 * @returns Instantiated agent
 */
export function createStaticAgentInstance(
  agentName: string,
  llmConfig: LlmConfiguration
): BaseAgent {
  const normalizedName = agentName.toLowerCase();
  const AgentConstructor = AGENT_CONSTRUCTORS[normalizedName];
  
  if (!AgentConstructor) {
    throw new Error(`Unknown agent: ${agentName}. Available agents: ${Object.keys(AGENT_CONSTRUCTORS).join(', ')}`);
  }
  
  return new AgentConstructor(llmConfig);
}

/**
 * Check if an agent exists
 */
export function isStaticAgentAvailable(agentName: string): boolean {
  return agentName.toLowerCase() in AGENT_CONSTRUCTORS;
}

/**
 * Get list of all available agents
 */
export function getStaticAgentNames(): string[] {
  return Object.keys(AGENT_CONSTRUCTORS);
}
