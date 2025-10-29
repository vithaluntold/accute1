/**
 * Agent Registry - Configurable Agent Management System
 * 
 * This registry provides a centralized configuration for all AI agents in the platform.
 * It enables dynamic agent loading, path configuration, and metadata management.
 */

export interface AgentConfig {
  name: string;
  displayName: string;
  category: string;
  path: string; // Relative path from project root
  className: string; // Name of the exported class
  capabilities: string[];
  requiresToolExecution?: boolean; // Whether agent needs tool execution context
  supportsStreaming?: boolean; // Whether agent supports streaming responses
}

/**
 * Central Agent Registry
 * Add new agents here to make them available throughout the platform
 */
export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  parity: {
    name: 'parity',
    displayName: 'Parity',
    category: 'legal',
    path: '../agents/parity/backend/index',
    className: 'ParityAgent',
    capabilities: ['document_generation', 'engagement_letters', 'contracts', 'compliance_docs', 'legal_templates'],
    requiresToolExecution: false,
    supportsStreaming: true,
  },
  cadence: {
    name: 'cadence',
    displayName: 'Cadence',
    category: 'workflow',
    path: '../agents/cadence/backend/index',
    className: 'CadenceAgent',
    capabilities: ['workflow_generation', 'process_automation', 'tax_workflows', 'audit_workflows', 'bookkeeping_automation'],
    requiresToolExecution: false,
    supportsStreaming: true,
  },
  forma: {
    name: 'forma',
    displayName: 'Forma',
    category: 'forms',
    path: '../agents/forma/backend/index',
    className: 'FormaAgent',
    capabilities: ['form_generation', 'questionnaires', 'organizers', 'conditional_logic', 'validation_rules'],
    requiresToolExecution: false,
    supportsStreaming: true,
  },
  kanban: {
    name: 'kanban',
    displayName: 'Kanban View',
    category: 'visualization',
    path: '../agents/kanban/backend/index',
    className: 'KanbanAgent',
    capabilities: ['kanban_visualization', 'workflow_analysis', 'task_organization'],
    requiresToolExecution: false,
    supportsStreaming: true,
  },
  luca: {
    name: 'luca',
    displayName: 'Luca',
    category: 'accounting',
    path: '../agents/luca/backend/index',
    className: 'LucaAgent',
    capabilities: ['accounting_guidance', 'tax_planning', 'financial_analysis', 'compliance_support', 'support_tickets', 'audit_preparation'],
    requiresToolExecution: true,
    supportsStreaming: true,
  },
};

/**
 * Get agent configuration by name
 * Handles name normalization (lowercase, spaces removed) to match UI-provided names
 */
export function getAgentConfig(agentName: string): AgentConfig | null {
  const normalizedName = agentName.toLowerCase().replace(/\s+/g, '');
  
  // Try exact match first
  if (AGENT_REGISTRY[normalizedName]) {
    return AGENT_REGISTRY[normalizedName];
  }
  
  // Try finding agent by comparing normalized names
  for (const [key, config] of Object.entries(AGENT_REGISTRY)) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
    const normalizedDisplayName = config.displayName.toLowerCase().replace(/\s+/g, '');
    
    if (normalizedKey === normalizedName || normalizedDisplayName === normalizedName) {
      return config;
    }
  }
  
  return null;
}

/**
 * Get all registered agents
 */
export function getAllAgents(): AgentConfig[] {
  return Object.values(AGENT_REGISTRY);
}

/**
 * Get agents by category
 */
export function getAgentsByCategory(category: string): AgentConfig[] {
  return getAllAgents().filter(agent => agent.category === category);
}

/**
 * Check if agent exists in registry
 */
export function isAgentRegistered(agentName: string): boolean {
  return getAgentConfig(agentName) !== null;
}
