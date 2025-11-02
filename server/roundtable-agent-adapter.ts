import type { IStorage } from './storage';
import type { RoundtableDeliverable, RoundtableMessage } from '@shared/schema';

/**
 * Agent capability definition
 */
export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

/**
 * Agent metadata for registry
 */
export interface AgentMetadata {
  slug: string;
  name: string;
  role: string;
  avatar?: string;
  description: string;
  capabilities: AgentCapability[];
  deliverableTypes: string[];
}

/**
 * Context passed to agents during roundtable sessions
 */
export interface RoundtableAgentContext {
  sessionId: string;
  organizationId: string;
  userId: string;
  objective: string;
  knowledgeBase: Array<{
    key: string;
    value: any;
    source: string;
  }>;
  recentMessages: RoundtableMessage[];
  existingDeliverables: RoundtableDeliverable[];
}

/**
 * Response from agent processing
 */
export interface AgentResponse {
  message?: string;
  deliverable?: {
    type: string;
    title: string;
    description?: string;
    payload: Record<string, unknown>;
  };
  knowledgeUpdates?: Array<{
    key: string;
    value: any;
  }>;
}

/**
 * Abstract base class for agent adapters
 */
export abstract class RoundtableAgentAdapter {
  protected storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Get agent metadata
   */
  abstract getMetadata(): AgentMetadata;

  /**
   * Process a user message and generate response
   */
  abstract processMessage(
    message: string,
    context: RoundtableAgentContext
  ): Promise<AgentResponse>;

  /**
   * Execute a specific capability
   */
  abstract executeCapability(
    capability: string,
    params: Record<string, any>,
    context: RoundtableAgentContext
  ): Promise<AgentResponse>;

  /**
   * Handle approval of a deliverable
   * This is called when a deliverable created by this agent is approved
   */
  async onDeliverableApproved(
    deliverable: RoundtableDeliverable,
    organizationId: string
  ): Promise<void> {
    // Default implementation - subclasses can override
    console.log(`Deliverable ${deliverable.id} approved for agent ${this.getMetadata().slug}`);
  }
}

/**
 * Cadence AI - Workflow automation builder
 */
export class CadenceAdapter extends RoundtableAgentAdapter {
  getMetadata(): AgentMetadata {
    return {
      slug: 'cadence',
      name: 'Cadence',
      role: 'Workflow Specialist',
      avatar: '/agents/cadence-avatar.png',
      description: 'Creates and manages operational workflows, processes, and automations. God of operations.',
      capabilities: [
        {
          name: 'create_workflow',
          description: 'Design and create a new workflow template',
          parameters: { name: 'string', description: 'string', stages: 'array' },
        },
        {
          name: 'optimize_workflow',
          description: 'Analyze and optimize existing workflow efficiency',
          parameters: { workflowId: 'string' },
        },
      ],
      deliverableTypes: ['workflow'],
    };
  }

  async processMessage(
    message: string,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    // For now, return a simple acknowledgment
    // In production, this would call the actual Cadence AI agent
    return {
      message: `I'm Cadence, and I can help build workflows. ${message.includes('workflow') ? 'I see you mentioned workflows - I can help with that!' : 'What kind of automation do you need?'}`,
    };
  }

  async executeCapability(
    capability: string,
    params: Record<string, any>,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    if (capability === 'create_workflow') {
      return {
        message: `Creating workflow: ${params.name}`,
        deliverable: {
          type: 'workflow',
          title: params.name || 'New Workflow',
          description: params.description,
          payload: {
            stages: params.stages || [],
            createdInRoundtable: true,
          },
        },
      };
    }

    return { message: `Capability ${capability} not implemented yet` };
  }

  async onDeliverableApproved(
    deliverable: RoundtableDeliverable,
    organizationId: string
  ): Promise<void> {
    // Save approved workflow as a template
    const payload = deliverable.payload as any;
    
    // Create workflow (workflows ARE templates in this system)
    await this.storage.createWorkflow({
      organizationId,
      name: deliverable.title,
      description: deliverable.description,
      category: 'automation',
      scope: 'organization',
      status: 'draft',
      createdBy: organizationId, // This should be the user ID in production
    });

    console.log(`Workflow created from roundtable deliverable ${deliverable.id}`);
  }
}

/**
 * Forma AI - Form builder specialist
 */
export class FormaAdapter extends RoundtableAgentAdapter {
  getMetadata(): AgentMetadata {
    return {
      slug: 'forma',
      name: 'Forma',
      role: 'Form Builder',
      avatar: '/agents/forma-avatar.png',
      description: 'Designs dynamic forms with validation, conditional logic, and field types. OG of Organizers.',
      capabilities: [
        {
          name: 'create_form',
          description: 'Design and create a new form template',
          parameters: { title: 'string', description: 'string', fields: 'array' },
        },
        {
          name: 'add_conditional_logic',
          description: 'Add conditional field logic to forms',
          parameters: { formId: 'string', rules: 'array' },
        },
      ],
      deliverableTypes: ['form'],
    };
  }

  async processMessage(
    message: string,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    return {
      message: `I'm Forma, the form building specialist. ${message.includes('form') ? 'I can help you create that form!' : 'What kind of form do you need?'}`,
    };
  }

  async executeCapability(
    capability: string,
    params: Record<string, any>,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    if (capability === 'create_form') {
      return {
        message: `Creating form: ${params.title}`,
        deliverable: {
          type: 'form',
          title: params.title || 'New Form',
          description: params.description,
          payload: {
            fields: params.fields || [],
            createdInRoundtable: true,
          },
        },
      };
    }

    return { message: `Capability ${capability} not implemented yet` };
  }

  async onDeliverableApproved(
    deliverable: RoundtableDeliverable,
    organizationId: string
  ): Promise<void> {
    // Save approved form as a template
    const payload = deliverable.payload as any;
    
    await this.storage.createFormTemplate({
      organizationId,
      name: deliverable.title,
      description: deliverable.description,
      category: 'general',
      scope: 'organization',
      createdBy: organizationId, // This should be the user ID in production
      fields: payload.fields || [],
    });

    console.log(`Form template created from roundtable deliverable ${deliverable.id}`);
  }
}

/**
 * Parity AI - Legal document creation specialist
 */
export class ParityAdapter extends RoundtableAgentAdapter {
  getMetadata(): AgentMetadata {
    return {
      slug: 'parity',
      name: 'Parity',
      role: 'Legal Document Specialist',
      avatar: '/agents/parity-avatar.png',
      description: 'Drafts legal documents, contracts, compliance forms, and agreements. Like having the world\'s best lawyer panel.',
      capabilities: [
        {
          name: 'create_document',
          description: 'Draft a legal document or contract',
          parameters: { type: 'string', title: 'string', content: 'string' },
        },
        {
          name: 'review_compliance',
          description: 'Review document for compliance requirements',
          parameters: { documentId: 'string' },
        },
      ],
      deliverableTypes: ['document'],
    };
  }

  async processMessage(
    message: string,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    return {
      message: `I'm Parity, your legal document specialist. ${message.includes('contract') || message.includes('document') ? 'I can help draft that for you!' : 'What kind of legal document do you need?'}`,
    };
  }

  async executeCapability(
    capability: string,
    params: Record<string, any>,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    if (capability === 'create_document') {
      return {
        message: `Creating ${params.type || 'document'}: ${params.title}`,
        deliverable: {
          type: 'document',
          title: params.title || 'New Document',
          description: `${params.type || 'Document'} created by Parity`,
          payload: {
            content: params.content || '',
            documentType: params.type,
            createdInRoundtable: true,
          },
        },
      };
    }

    return { message: `Capability ${capability} not implemented yet` };
  }

  async onDeliverableApproved(
    deliverable: RoundtableDeliverable,
    organizationId: string
  ): Promise<void> {
    // Save approved document as a template
    const payload = deliverable.payload as any;
    
    await this.storage.createDocumentTemplate({
      organizationId,
      name: deliverable.title,
      description: deliverable.description,
      category: 'legal',
      scope: 'organization',
      createdBy: organizationId, // This should be the user ID in production
      content: payload.content || '',
    });

    console.log(`Document template created from roundtable deliverable ${deliverable.id}`);
  }
}

/**
 * Luca AI - Project Manager
 */
export class LucaAdapter extends RoundtableAgentAdapter {
  getMetadata(): AgentMetadata {
    return {
      slug: 'luca',
      name: 'Luca',
      role: 'Project Manager',
      avatar: '/agents/luca-avatar.png',
      description: 'Coordinates the team, manages timelines, and ensures deliverables meet requirements.',
      capabilities: [
        {
          name: 'coordinate_agents',
          description: 'Coordinate multiple agents to work on a complex task',
          parameters: { task: 'string', agents: 'array' },
        },
        {
          name: 'review_deliverable',
          description: 'Review a deliverable for quality and completeness',
          parameters: { deliverableId: 'string' },
        },
      ],
      deliverableTypes: ['project_plan', 'review'],
    };
  }

  async processMessage(
    message: string,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    return {
      message: `I'm Luca, your project manager. I'll help coordinate the team to achieve your objective: ${context.objective}`,
    };
  }

  async executeCapability(
    capability: string,
    params: Record<string, any>,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    if (capability === 'coordinate_agents') {
      return {
        message: `Coordinating ${params.agents?.length || 0} agents to work on: ${params.task}`,
        knowledgeUpdates: [
          {
            key: 'coordination_plan',
            value: {
              task: params.task,
              agents: params.agents,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      };
    }

    return { message: `Capability ${capability} not implemented yet` };
  }
}

/**
 * Agent Registry - manages all available agents
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, RoundtableAgentAdapter>;

  private constructor(storage: IStorage) {
    this.agents = new Map();
    
    // Register all available agents
    this.registerAgent(new CadenceAdapter(storage));
    this.registerAgent(new FormaAdapter(storage));
    this.registerAgent(new ParityAdapter(storage));
    this.registerAgent(new LucaAdapter(storage));
  }

  static getInstance(storage: IStorage): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry(storage);
    }
    return AgentRegistry.instance;
  }

  registerAgent(adapter: RoundtableAgentAdapter): void {
    const metadata = adapter.getMetadata();
    this.agents.set(metadata.slug, adapter);
  }

  getAgent(slug: string): RoundtableAgentAdapter | undefined {
    return this.agents.get(slug);
  }

  getAllAgents(): AgentMetadata[] {
    return Array.from(this.agents.values()).map(agent => agent.getMetadata());
  }

  getAgentsByRole(role: string): AgentMetadata[] {
    return this.getAllAgents().filter(agent => agent.role === role);
  }

  async processAgentMessage(
    agentSlug: string,
    message: string,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    const agent = this.getAgent(agentSlug);
    if (!agent) {
      throw new Error(`Agent ${agentSlug} not found in registry`);
    }

    return agent.processMessage(message, context);
  }

  async executeAgentCapability(
    agentSlug: string,
    capability: string,
    params: Record<string, any>,
    context: RoundtableAgentContext
  ): Promise<AgentResponse> {
    const agent = this.getAgent(agentSlug);
    if (!agent) {
      throw new Error(`Agent ${agentSlug} not found in registry`);
    }

    return agent.executeCapability(capability, params, context);
  }
}
