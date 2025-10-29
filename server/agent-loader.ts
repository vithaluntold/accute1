/**
 * Dynamic Agent Loader
 * 
 * Provides utilities for dynamically loading AI agents based on the registry configuration.
 * This enables flexible agent management without hardcoded imports.
 */

import type { LlmConfiguration } from '@shared/schema';
import { getAgentConfig, AGENT_REGISTRY } from './agent-registry';

/**
 * Base interface that all agents must implement
 */
export interface BaseAgent {
  execute(input: any): Promise<any>;
  executeStream?(input: any, onChunk: (chunk: string) => void): Promise<string>;
}

/**
 * Agent instance cache to avoid redundant imports
 */
const agentModuleCache = new Map<string, any>();

/**
 * Load an agent module dynamically based on registry configuration
 * 
 * @param agentName - Name of the agent to load (e.g., 'parity', 'cadence')
 * @returns Agent module with the exported class
 */
export async function loadAgentModule(agentName: string): Promise<any> {
  const normalizedName = agentName.toLowerCase();
  
  // Check cache first
  if (agentModuleCache.has(normalizedName)) {
    return agentModuleCache.get(normalizedName);
  }
  
  // Get agent configuration
  const config = getAgentConfig(normalizedName);
  if (!config) {
    throw new Error(`Agent '${agentName}' not found in registry`);
  }
  
  try {
    // Dynamically import the agent module
    const module = await import(config.path);
    
    // Cache the module
    agentModuleCache.set(normalizedName, module);
    
    return module;
  } catch (error) {
    console.error(`Failed to load agent '${agentName}' from path '${config.path}':`, error);
    throw new Error(`Failed to load agent '${agentName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create an agent instance dynamically
 * 
 * @param agentName - Name of the agent to instantiate
 * @param llmConfig - LLM configuration for the agent
 * @returns Instantiated agent
 */
export async function createAgentInstance(
  agentName: string,
  llmConfig: LlmConfiguration
): Promise<BaseAgent> {
  const config = getAgentConfig(agentName);
  if (!config) {
    throw new Error(`Agent '${agentName}' not found in registry`);
  }
  
  const module = await loadAgentModule(agentName);
  
  // Get the agent class from the module
  const AgentClass = module[config.className];
  if (!AgentClass) {
    throw new Error(`Agent class '${config.className}' not found in module for '${agentName}'`);
  }
  
  // Instantiate and return the agent
  return new AgentClass(llmConfig);
}

/**
 * Check if an agent requires tool execution context
 */
export function agentRequiresToolExecution(agentName: string): boolean {
  const config = getAgentConfig(agentName);
  return config?.requiresToolExecution ?? false;
}

/**
 * Check if an agent supports streaming responses
 */
export function agentSupportsStreaming(agentName: string): boolean {
  const config = getAgentConfig(agentName);
  return config?.supportsStreaming ?? false;
}

/**
 * Clear the agent module cache (useful for development/testing)
 */
export function clearAgentCache(): void {
  agentModuleCache.clear();
}

/**
 * Get all available agent names
 */
export function getAvailableAgents(): string[] {
  return Object.keys(AGENT_REGISTRY);
}
