import type { IStorage } from "./storage";
import type {
  RoundtableSession,
  RoundtableParticipant,
  RoundtableMessage,
  RoundtableDeliverable,
  RoundtableKnowledgeEntry,
  InsertRoundtableMessage,
  InsertRoundtableDeliverable,
  InsertRoundtableKnowledgeEntry,
} from "@shared/schema";

export interface AgentCapability {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface AgentMetadata {
  slug: string;
  name: string;
  role: string;
  avatar: string;
  capabilities: AgentCapability[];
}

export interface RoundtableContext {
  sessionId: string;
  organizationId: string;
  userId: string;
  objective: string;
  knowledgeBase: RoundtableKnowledgeEntry[];
  participants: RoundtableParticipant[];
  deliverables: RoundtableDeliverable[];
}

export interface AgentTask {
  id: string;
  sessionId: string;
  agentSlug: string;
  taskType: 'create_deliverable' | 'respond_to_question' | 'review_deliverable' | 'update_knowledge';
  payload: Record<string, unknown>;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
}

/**
 * RoundtableOrchestrator - Coordinates multi-agent collaboration
 * 
 * Responsibilities:
 * - Manage agent participation lifecycle
 * - Route messages between main and private channels
 * - Maintain shared knowledge base
 * - Queue and distribute tasks to agents
 * - Coordinate deliverable creation and approval
 * - Provide context to agents for decision-making
 */
export class RoundtableOrchestrator {
  private storage: IStorage;
  private agentRegistry: Map<string, AgentMetadata>;
  private taskQueue: Map<string, AgentTask[]>; // sessionId -> tasks
  private activeAgents: Map<string, Set<string>>; // sessionId -> agent slugs

  constructor(storage: IStorage) {
    this.storage = storage;
    this.agentRegistry = new Map();
    this.taskQueue = new Map();
    this.activeAgents = new Map();
    this.initializeAgentRegistry();
  }

  /**
   * Initialize the registry of available AI agents
   */
  private initializeAgentRegistry() {
    const agents: AgentMetadata[] = [
      {
        slug: 'luca',
        name: 'Luca',
        role: 'Project Manager',
        avatar: '👔',
        capabilities: [
          { name: 'session_management', description: 'Manage session objectives and facilitate discussions' },
          { name: 'coordination', description: 'Coordinate between agents and assign tasks' },
          { name: 'summarization', description: 'Summarize discussions and decisions' },
        ],
      },
      {
        slug: 'cadence',
        name: 'Cadence AI',
        role: 'Workflow Specialist',
        avatar: '⚙️',
        capabilities: [
          { name: 'workflow_creation', description: 'Build automated workflow processes' },
          { name: 'process_optimization', description: 'Optimize operational workflows' },
          { name: 'automation_design', description: 'Design workflow automations' },
        ],
      },
      {
        slug: 'forma',
        name: 'Forma AI',
        role: 'Form Builder',
        avatar: '📝',
        capabilities: [
          { name: 'form_creation', description: 'Create dynamic forms with validation' },
          { name: 'field_design', description: 'Design custom form fields' },
          { name: 'conditional_logic', description: 'Implement conditional form logic' },
        ],
      },
      {
        slug: 'parity',
        name: 'Parity AI',
        role: 'Legal Document Specialist',
        avatar: '⚖️',
        capabilities: [
          { name: 'document_drafting', description: 'Draft legal documents and contracts' },
          { name: 'compliance_review', description: 'Review documents for compliance' },
          { name: 'agreement_creation', description: 'Create legal agreements' },
        ],
      },
      {
        slug: 'email-agent',
        name: 'Email AI',
        role: 'Email Specialist',
        avatar: '📧',
        capabilities: [
          { name: 'template_creation', description: 'Create email templates' },
          { name: 'automation_setup', description: 'Set up email automations' },
          { name: 'inbox_management', description: 'Manage email inbox integration' },
        ],
      },
      {
        slug: 'message-agent',
        name: 'Message AI',
        role: 'Messaging Specialist',
        avatar: '💬',
        capabilities: [
          { name: 'template_creation', description: 'Create message templates' },
          { name: 'communication_design', description: 'Design client communication flows' },
          { name: 'notification_setup', description: 'Set up messaging notifications' },
        ],
      },
    ];

    agents.forEach(agent => {
      this.agentRegistry.set(agent.slug, agent);
    });
  }

  /**
   * Get metadata for a specific agent
   */
  getAgentMetadata(agentSlug: string): AgentMetadata | undefined {
    return this.agentRegistry.get(agentSlug);
  }

  /**
   * Get all available agents
   */
  getAllAgents(): AgentMetadata[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Add an agent to a roundtable session
   */
  async addAgentToSession(
    sessionId: string,
    agentSlug: string,
    addedByUserId: string
  ): Promise<RoundtableParticipant> {
    const agent = this.agentRegistry.get(agentSlug);
    if (!agent) {
      throw new Error(`Agent ${agentSlug} not found in registry`);
    }

    const participant = await this.storage.createRoundtableParticipant({
      sessionId,
      participantType: 'agent',
      participantId: agentSlug,
      displayName: agent.name,
      role: agent.role,
      status: 'active',
    });

    // Track active agent
    if (!this.activeAgents.has(sessionId)) {
      this.activeAgents.set(sessionId, new Set());
    }
    this.activeAgents.get(sessionId)!.add(agentSlug);

    // Create system message announcing the agent joined
    await this.createSystemMessage(
      sessionId,
      `${agent.name} (${agent.role}) joined the roundtable`,
      'agent_joined',
      { participantId: participant.id, agentSlug }
    );

    return participant;
  }

  /**
   * Remove an agent from a session
   */
  async removeAgentFromSession(
    sessionId: string,
    participantId: string
  ): Promise<void> {
    const participant = await this.storage.getRoundtableParticipant(participantId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    await this.storage.updateRoundtableParticipant(participantId, {
      status: 'left',
      leftAt: new Date(),
    });

    // Remove from active agents tracking
    if (participant.participantType === 'agent' && participant.participantId && this.activeAgents.has(sessionId)) {
      this.activeAgents.get(sessionId)!.delete(participant.participantId);
    }

    // Create system message
    await this.createSystemMessage(
      sessionId,
      `${participant.displayName} left the roundtable`,
      'agent_left',
      { participantId, agentSlug: participant.participantType === 'agent' ? participant.participantId : undefined }
    );
  }

  /**
   * Get the full context for a roundtable session
   */
  async getSessionContext(sessionId: string): Promise<RoundtableContext> {
    const session = await this.storage.getRoundtableSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const [knowledgeBase, participants, deliverables] = await Promise.all([
      this.storage.getRoundtableKnowledgeEntriesBySession(sessionId),
      this.storage.getRoundtableParticipantsBySession(sessionId),
      this.storage.getRoundtableDeliverablesBySession(sessionId),
    ]);

    return {
      sessionId,
      organizationId: session.organizationId,
      userId: session.userId,
      objective: session.objective || '',
      knowledgeBase,
      participants,
      deliverables,
    };
  }

  /**
   * Create a message in the main channel or private channel
   */
  async createMessage(
    sessionId: string,
    senderId: string,
    senderName: string,
    senderType: 'user' | 'agent',
    content: string,
    channelType: 'main' | 'private' = 'main',
    recipientParticipantId?: string,
    metadata?: Record<string, unknown>
  ): Promise<RoundtableMessage> {
    const messageData: InsertRoundtableMessage = {
      sessionId,
      senderId,
      senderName,
      senderType,
      channelType,
      content,
      recipientParticipantId,
      metadata,
    };

    return await this.storage.createRoundtableMessage(messageData);
  }

  /**
   * Create a system message (announcements, status updates)
   */
  private async createSystemMessage(
    sessionId: string,
    content: string,
    eventType: string,
    metadata?: Record<string, unknown>
  ): Promise<RoundtableMessage> {
    return await this.storage.createRoundtableMessage({
      sessionId,
      senderId: 'system',
      senderName: 'System',
      senderType: 'agent',
      channelType: 'main',
      content,
      metadata: {
        ...metadata,
        eventType,
        isSystemMessage: true,
      },
    });
  }

  /**
   * Add entry to shared knowledge base
   */
  async addKnowledgeEntry(
    sessionId: string,
    title: string,
    content: string,
    sourceType: string,
    sourceParticipantId?: string,
    entryType: 'requirement' | 'constraint' | 'decision' | 'reference' | 'context' = 'context',
    metadata?: Record<string, unknown>
  ): Promise<RoundtableKnowledgeEntry> {
    const entry: InsertRoundtableKnowledgeEntry = {
      sessionId,
      title,
      content,
      entryType,
      sourceType,
      sourceParticipantId,
      metadata,
    };

    const created = await this.storage.createRoundtableKnowledgeEntry(entry);

    // Notify all agents about new knowledge
    await this.createSystemMessage(
      sessionId,
      `New knowledge entry added: ${title}`,
      'knowledge_added',
      { entryId: created.id, entryType }
    );

    return created;
  }

  /**
   * Create a deliverable (workflow, form, document)
   */
  async createDeliverable(
    sessionId: string,
    creatorParticipantId: string,
    creatorAgentSlug: string,
    deliverableType: 'workflow' | 'form' | 'document' | 'email_template' | 'message_template',
    title: string,
    payload: Record<string, unknown>,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<RoundtableDeliverable> {
    const deliverable: InsertRoundtableDeliverable = {
      sessionId,
      creatorParticipantId,
      creatorAgentSlug,
      deliverableType,
      title,
      description,
      payload,
      status: 'draft',
    };

    const created = await this.storage.createRoundtableDeliverable(deliverable);

    // Announce deliverable creation
    await this.createSystemMessage(
      sessionId,
      `New ${deliverableType} created: ${title}`,
      'deliverable_created',
      { deliverableId: created.id, deliverableType }
    );

    return created;
  }

  /**
   * Update deliverable status
   */
  async updateDeliverableStatus(
    deliverableId: string,
    status: 'draft' | 'review' | 'approved' | 'rejected' | 'implemented'
  ): Promise<RoundtableDeliverable | undefined> {
    return await this.storage.updateRoundtableDeliverable(deliverableId, { status });
  }

  /**
   * Set a deliverable as currently presenting (screenshare)
   */
  async presentDeliverable(
    sessionId: string,
    deliverableId: string
  ): Promise<void> {
    await this.storage.setCurrentPresentation(sessionId, deliverableId);

    const deliverable = await this.storage.getRoundtableDeliverable(deliverableId);
    if (deliverable) {
      await this.createSystemMessage(
        sessionId,
        `Now presenting: ${deliverable.title}`,
        'presentation_started',
        { deliverableId }
      );
    }
  }

  /**
   * Clear current presentation
   */
  async stopPresentation(sessionId: string): Promise<void> {
    await this.storage.clearCurrentPresentation(sessionId);
    await this.createSystemMessage(
      sessionId,
      'Presentation ended',
      'presentation_stopped'
    );
  }

  /**
   * Queue a task for an agent
   */
  queueAgentTask(task: AgentTask): void {
    if (!this.taskQueue.has(task.sessionId)) {
      this.taskQueue.set(task.sessionId, []);
    }
    this.taskQueue.get(task.sessionId)!.push(task);
  }

  /**
   * Get pending tasks for a specific agent in a session
   */
  getAgentTasks(sessionId: string, agentSlug: string): AgentTask[] {
    const tasks = this.taskQueue.get(sessionId) || [];
    return tasks.filter(t => t.agentSlug === agentSlug && t.status === 'pending');
  }

  /**
   * Mark a task as completed
   */
  completeTask(taskId: string, result?: unknown): void {
    for (const tasks of Array.from(this.taskQueue.values())) {
      const task = tasks.find((t: AgentTask) => t.id === taskId);
      if (task) {
        task.status = 'completed';
        task.completedAt = new Date();
        task.result = result;
        break;
      }
    }
  }

  /**
   * Mark a task as failed
   */
  failTask(taskId: string, error: string): void {
    for (const tasks of Array.from(this.taskQueue.values())) {
      const task = tasks.find((t: AgentTask) => t.id === taskId);
      if (task) {
        task.status = 'failed';
        task.completedAt = new Date();
        task.error = error;
        break;
      }
    }
  }

  /**
   * Get active agents in a session
   */
  getActiveAgents(sessionId: string): string[] {
    return Array.from(this.activeAgents.get(sessionId) || []);
  }

  /**
   * Process a user message and trigger agent responses
   */
  async processUserMessage(
    sessionId: string,
    message: RoundtableMessage
  ): Promise<void> {
    // Only process main channel user messages
    if (message.channelType !== 'main' || message.senderType !== 'user') {
      return;
    }

    const activeAgents = this.getActiveAgents(sessionId);
    
    // If no agents are active, nothing to do
    if (activeAgents.length === 0) {
      return;
    }

    // For now, trigger all active agents to respond
    // In the future, could implement intelligent routing based on message content
    console.log(`[Roundtable] Triggering ${activeAgents.length} agents for session ${sessionId}`);
    
    // Store for async agent execution
    for (const agentSlug of activeAgents) {
      this.queueTask({
        id: `${sessionId}-${agentSlug}-${Date.now()}`,
        sessionId,
        agentSlug,
        taskType: 'respond_to_question',
        payload: {
          messageId: message.id,
          content: message.content,
          senderName: message.senderName
        },
        priority: 1,
        status: 'pending',
        createdAt: new Date(),
      });
    }
  }

  /**
   * Clean up session data
   */
  async cleanupSession(sessionId: string): Promise<void> {
    this.taskQueue.delete(sessionId);
    this.activeAgents.delete(sessionId);
  }
}
