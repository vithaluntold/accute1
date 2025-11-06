/**
 * Event-based Workflow Triggers
 * Auto-advance workflows based on events: payment_received, document_uploaded, organizer_submitted, invoice_paid
 * Implements TaxDome-style "Jobs Automove" feature
 */

import { AutomationEngine, type ActionConfig } from './automation-engine';
import { AutoProgressionEngine } from './auto-progression';
import type { IStorage } from './storage';

export type TriggerEvent = 
  | 'payment_received'
  | 'invoice_paid'
  | 'document_uploaded'
  | 'organizer_submitted'
  | 'form_submitted'
  | 'proposal_accepted'
  | 'task_completed'
  | 'step_completed'
  | 'stage_completed';

export interface EventTriggerConfig {
  id: string;
  event: TriggerEvent;
  workflowId?: string;
  stageId?: string;
  stepId?: string;
  conditions?: any[];
  actions?: ActionConfig[];
  autoAdvance?: {
    enabled: boolean;
    targetStageId?: string;
    targetStepId?: string;
  };
}

export class EventTriggersEngine {
  private automationEngine: AutomationEngine;
  private autoProgressionEngine: AutoProgressionEngine;
  private eventListeners: Map<TriggerEvent, EventTriggerConfig[]> = new Map();

  constructor(private storage: IStorage) {
    this.automationEngine = new AutomationEngine(storage);
    this.autoProgressionEngine = new AutoProgressionEngine();
  }

  /**
   * Register an event trigger
   */
  registerTrigger(config: EventTriggerConfig): void {
    const existing = this.eventListeners.get(config.event) || [];
    existing.push(config);
    this.eventListeners.set(config.event, existing);
    
    console.log(`[EventTriggers] Registered trigger for ${config.event}`, config.id);
  }

  /**
   * Unregister an event trigger
   */
  unregisterTrigger(triggerId: string): void {
    for (const [event, triggers] of this.eventListeners.entries()) {
      const filtered = triggers.filter(t => t.id !== triggerId);
      if (filtered.length !== triggers.length) {
        this.eventListeners.set(event, filtered);
        console.log(`[EventTriggers] Unregistered trigger ${triggerId} from ${event}`);
      }
    }
  }

  /**
   * Handle payment received event - auto-advance workflow
   */
  async handlePaymentReceived(data: {
    invoiceId: string;
    clientId: string;
    organizationId: string;
    amount: number;
    assignmentId?: string;
    workflowId?: string;
  }): Promise<void> {
    console.log('[EventTriggers] Payment received:', data);

    await this.processEvent('payment_received', {
      ...data,
      invoice: await this.storage.getInvoice(data.invoiceId),
      client: await this.storage.getClient(data.clientId),
    });

    await this.processEvent('invoice_paid', {
      ...data,
      invoice: await this.storage.getInvoice(data.invoiceId),
    });

    if (data.assignmentId) {
      await this.autoAdvanceAssignment(data.assignmentId, 'payment_received');
    }
  }

  /**
   * Handle document uploaded event
   */
  async handleDocumentUploaded(data: {
    documentId: string;
    clientId: string;
    organizationId: string;
    documentType: string;
    assignmentId?: string;
    workflowId?: string;
  }): Promise<void> {
    console.log('[EventTriggers] Document uploaded:', data);

    await this.processEvent('document_uploaded', {
      ...data,
      document: await this.storage.getDocument(data.documentId),
      client: await this.storage.getClient(data.clientId),
    });

    if (data.assignmentId) {
      await this.autoAdvanceAssignment(data.assignmentId, 'document_uploaded');
    }
  }

  /**
   * Handle organizer/form submitted event
   */
  async handleOrganizerSubmitted(data: {
    formSubmissionId: string;
    clientId: string;
    organizationId: string;
    formTemplateId: string;
    assignmentId?: string;
    workflowId?: string;
  }): Promise<void> {
    console.log('[EventTriggers] Organizer submitted:', data);

    await this.processEvent('organizer_submitted', {
      ...data,
      formSubmission: await this.storage.getFormSubmission(data.formSubmissionId),
      client: await this.storage.getClient(data.clientId),
    });

    await this.processEvent('form_submitted', {
      ...data,
      formSubmission: await this.storage.getFormSubmission(data.formSubmissionId),
    });

    if (data.assignmentId) {
      await this.autoAdvanceAssignment(data.assignmentId, 'organizer_submitted');
    }
  }

  /**
   * Handle proposal accepted event
   */
  async handleProposalAccepted(data: {
    proposalId: string;
    clientId: string;
    organizationId: string;
    assignmentId?: string;
    workflowId?: string;
  }): Promise<void> {
    console.log('[EventTriggers] Proposal accepted:', data);

    await this.processEvent('proposal_accepted', {
      ...data,
      client: await this.storage.getClient(data.clientId),
    });

    if (data.assignmentId) {
      await this.autoAdvanceAssignment(data.assignmentId, 'proposal_accepted');
    }
  }

  /**
   * Handle task completed event
   */
  async handleTaskCompleted(data: {
    taskId: string;
    stepId: string;
    organizationId: string;
    assignmentId?: string;
  }): Promise<void> {
    console.log('[EventTriggers] Task completed:', data);

    await this.processEvent('task_completed', data);

    try {
      await this.autoProgressionEngine.tryAutoProgressTask(data.taskId);
    } catch (error: any) {
      console.error('[EventTriggers] Failed to auto-progress task:', error);
    }
  }

  /**
   * Handle step completed event
   */
  async handleStepCompleted(data: {
    stepId: string;
    stageId: string;
    organizationId: string;
    assignmentId?: string;
  }): Promise<void> {
    console.log('[EventTriggers] Step completed:', data);

    await this.processEvent('step_completed', data);

    try {
      await this.autoProgressionEngine.tryAutoProgressStep(data.stepId);
    } catch (error: any) {
      console.error('[EventTriggers] Failed to auto-progress step:', error);
    }
  }

  /**
   * Handle stage completed event
   */
  async handleStageCompleted(data: {
    stageId: string;
    workflowId: string;
    organizationId: string;
    assignmentId?: string;
  }): Promise<void> {
    console.log('[EventTriggers] Stage completed:', data);

    await this.processEvent('stage_completed', data);

    try {
      await this.autoProgressionEngine.tryAutoProgressStage(data.stageId);
    } catch (error: any) {
      console.error('[EventTriggers] Failed to auto-progress stage:', error);
    }
  }

  /**
   * Process an event - find matching triggers and execute actions
   */
  private async processEvent(event: TriggerEvent, data: Record<string, any>): Promise<void> {
    const triggers = this.eventListeners.get(event) || [];
    
    for (const trigger of triggers) {
      try {
        if (trigger.workflowId && data.workflowId && trigger.workflowId !== data.workflowId) {
          continue;
        }

        if (trigger.conditions && trigger.conditions.length > 0) {
          const conditionsMet = await this.automationEngine.evaluateConditions(
            trigger.conditions,
            data
          );
          
          if (!conditionsMet) {
            console.log(`[EventTriggers] Conditions not met for trigger ${trigger.id}`);
            continue;
          }
        }

        if (trigger.actions && trigger.actions.length > 0) {
          const context = {
            workflowId: data.workflowId || '',
            stageId: data.stageId,
            stepId: data.stepId,
            organizationId: data.organizationId,
            userId: data.userId || data.submittedBy || '',
            data,
            clientId: data.clientId,
            assignmentId: data.assignmentId,
          };

          await this.automationEngine.executeActions(trigger.actions, context);
        }

        if (trigger.autoAdvance?.enabled && data.assignmentId) {
          await this.autoAdvanceToStage(
            data.assignmentId,
            trigger.autoAdvance.targetStageId
          );
        }

      } catch (error: any) {
        console.error(`[EventTriggers] Error processing trigger ${trigger.id}:`, error);
      }
    }
  }

  /**
   * Auto-advance a workflow assignment to the next stage
   */
  private async autoAdvanceAssignment(assignmentId: string, reason: string): Promise<void> {
    try {
      const assignment = await this.storage.getWorkflowAssignment(assignmentId);
      if (!assignment) {
        console.warn('[EventTriggers] Assignment not found:', assignmentId);
        return;
      }

      const stages = await this.storage.getStagesByWorkflow(assignment.workflowId);
      const sortedStages = stages.sort((a, b) => a.order - b.order);
      
      const currentStageIndex = sortedStages.findIndex(s => 
        assignment.currentStageId === s.id
      );

      if (currentStageIndex === -1 || currentStageIndex >= sortedStages.length - 1) {
        console.log('[EventTriggers] Assignment already at final stage or stage not found');
        return;
      }

      const nextStage = sortedStages[currentStageIndex + 1];

      await this.storage.updateWorkflowAssignment(assignmentId, {
        currentStageId: nextStage.id,
        currentStepId: null,
        status: 'active',
        completedStages: assignment.completedStages + 1,
        progress: Math.round(((assignment.completedStages + 1) / assignment.totalStages) * 100),
      });

      console.log(`[EventTriggers] Auto-advanced assignment ${assignmentId} to stage ${nextStage.name} (reason: ${reason})`);

      await this.storage.createNotification({
        userId: assignment.assignedTo,
        title: 'Workflow Advanced',
        message: `Your workflow has automatically advanced to: ${nextStage.name}`,
        type: 'info',
        metadata: {
          assignmentId,
          stageId: nextStage.id,
          reason,
        },
      });

    } catch (error: any) {
      console.error('[EventTriggers] Failed to auto-advance assignment:', error);
    }
  }

  /**
   * Auto-advance to a specific stage
   */
  private async autoAdvanceToStage(assignmentId: string, targetStageId?: string): Promise<void> {
    if (!targetStageId) {
      return this.autoAdvanceAssignment(assignmentId, 'event_trigger');
    }

    try {
      const assignment = await this.storage.getWorkflowAssignment(assignmentId);
      if (!assignment) {
        console.warn('[EventTriggers] Assignment not found:', assignmentId);
        return;
      }

      const stage = await this.storage.getWorkflowStage(targetStageId);
      if (!stage) {
        console.warn('[EventTriggers] Target stage not found:', targetStageId);
        return;
      }

      const stages = await this.storage.getStagesByWorkflow(assignment.workflowId);
      const targetStageIndex = stages.findIndex(s => s.id === targetStageId);

      await this.storage.updateWorkflowAssignment(assignmentId, {
        currentStageId: targetStageId,
        currentStepId: null,
        status: 'active',
        completedStages: targetStageIndex,
        progress: Math.round((targetStageIndex / assignment.totalStages) * 100),
      });

      console.log(`[EventTriggers] Moved assignment ${assignmentId} to stage ${stage.name}`);

      await this.storage.createNotification({
        userId: assignment.assignedTo,
        title: 'Workflow Advanced',
        message: `Your workflow has been moved to: ${stage.name}`,
        type: 'info',
        metadata: {
          assignmentId,
          stageId: targetStageId,
        },
      });

    } catch (error: any) {
      console.error('[EventTriggers] Failed to advance to specific stage:', error);
    }
  }

  /**
   * Get all registered triggers for an event
   */
  getTriggersForEvent(event: TriggerEvent): EventTriggerConfig[] {
    return this.eventListeners.get(event) || [];
  }

  /**
   * Clear all triggers
   */
  clearAllTriggers(): void {
    this.eventListeners.clear();
    console.log('[EventTriggers] All triggers cleared');
  }
}

let eventTriggersInstance: EventTriggersEngine | null = null;

export function getEventTriggersEngine(storage: IStorage): EventTriggersEngine {
  if (!eventTriggersInstance) {
    eventTriggersInstance = new EventTriggersEngine(storage);
  }
  return eventTriggersInstance;
}
