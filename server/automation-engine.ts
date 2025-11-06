/**
 * Automation Engine - Processes triggers, evaluates conditions, executes actions
 * for the unified pipeline system with automation capabilities
 */

import { LLMService } from './llm-service';
import type { IStorage } from './storage';

export interface TriggerConfig {
  type: 'email' | 'form' | 'webhook' | 'schedule' | 'manual' | 'completion';
  config: Record<string, any>;
}

export interface ConditionConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
}

export interface ActionConfig {
  type: 
    | 'create_task' 
    | 'send_notification' 
    | 'call_api' 
    | 'run_ai_agent' 
    | 'update_field'
    | 'send_email'
    | 'trigger_form'
    | 'send_invoice'
    | 'schedule_followup'
    | 'trigger_workflow';
  config: Record<string, any>;
}

/**
 * Automation Engine - Main class for processing pipeline automations
 */
export class AutomationEngine {
  constructor(private storage: IStorage) {}

  /**
   * Evaluate a set of conditions against provided data
   */
  evaluateConditions(conditions: ConditionConfig[], data: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions means always true
    }

    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);

      switch (condition.operator) {
        case 'equals':
          return fieldValue == condition.value;
        case 'not_equals':
          return fieldValue != condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'exists':
          return fieldValue !== undefined && fieldValue !== null;
        default:
          return false;
      }
    });
  }

  /**
   * Execute a list of actions
   */
  async executeActions(
    actions: ActionConfig[],
    context: {
      workflowId: string;
      stageId?: string;
      stepId?: string;
      taskId?: string;
      organizationId: string;
      userId: string;
      data?: Record<string, any>;
    }
  ): Promise<any[]> {
    const results = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, context);
        results.push({ success: true, action: action.type, result });
      } catch (error: any) {
        results.push({ success: false, action: action.type, error: error.message });
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: ActionConfig,
    context: {
      workflowId: string;
      stageId?: string;
      stepId?: string;
      taskId?: string;
      organizationId: string;
      userId: string;
      data?: Record<string, any>;
    }
  ): Promise<any> {
    switch (action.type) {
      case 'create_task':
        return this.createTask(action.config, context);
      
      case 'send_notification':
        return this.sendNotification(action.config, context);
      
      case 'call_api':
        return this.callApi(action.config, context);
      
      case 'run_ai_agent':
        return this.runAiAgent(action.config, context);
      
      case 'update_field':
        return this.updateField(action.config, context);
      
      case 'send_email':
        return this.sendEmail(action.config, context);
      
      case 'trigger_form':
        return this.triggerForm(action.config, context);
      
      case 'send_invoice':
        return this.sendInvoice(action.config, context);
      
      case 'schedule_followup':
        return this.scheduleFollowup(action.config, context);
      
      case 'trigger_workflow':
        return this.triggerWorkflow(action.config, context);
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Create a new task in the pipeline
   * Supports targeting a specific step from action config for pipeline/stage-level automations
   */
  private async createTask(config: any, context: any): Promise<any> {
    // Get stepId from action config or context
    const targetStepId = config.stepId || context.stepId;
    
    if (!targetStepId) {
      throw new Error('stepId required to create task - provide it in action config or context');
    }

    // Verify step exists and belongs to same organization (multi-tenant security)
    const step = await this.storage.getWorkflowStep(targetStepId);
    if (!step) {
      throw new Error(`Step ${targetStepId} not found`);
    }

    // Verify organization ownership (get pipeline through stage)
    const stage = await this.storage.getWorkflowStage(step.stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    const workflow = await this.storage.getWorkflow(stage.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (workflow.organizationId !== context.organizationId) {
      throw new Error('Unauthorized: Cannot create task in different organization');
    }

    // Create the task
    const task = await this.storage.createWorkflowTask({
      stepId: targetStepId,
      name: config.name || 'Auto-created Task',
      description: config.description || '',
      type: config.type || 'manual',
      assignedTo: config.assignedTo || null,
      priority: config.priority || 'medium',
      order: config.order || 0,
    });

    return task;
  }

  /**
   * Send a notification
   */
  private async sendNotification(config: any, context: any): Promise<any> {
    // Create a notification in the database
    const notification = await this.storage.createNotification({
      userId: config.userId || context.userId,
      title: config.title || 'Pipeline Notification',
      message: config.message || '',
      type: config.notificationType || 'info',
      metadata: {
        workflowId: context.workflowId,
        stageId: context.stageId,
        stepId: context.stepId,
        taskId: context.taskId,
      },
    });

    return notification;
  }

  /**
   * Call an external API
   */
  private async callApi(config: any, context: any): Promise<any> {
    const { url, method = 'POST', headers = {}, body } = config;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return await response.json();
  }

  /**
   * Run an AI agent
   */
  private async runAiAgent(config: any, context: any): Promise<any> {
    const { agentName, input, llmConfigId } = config;

    // Get LLM configuration using centralized service
    const { getLLMConfigService } = await import('./llm-config-service');
    const llmConfigService = getLLMConfigService();
    const llmConfig = await llmConfigService.getConfig(context.organizationId, llmConfigId);

    // Load and execute agent (simplified - actual implementation would use dynamic imports)
    const llmService = new LLMService(llmConfig);
    const result = await llmService.sendPrompt(
      JSON.stringify(input),
      `You are executing the ${agentName} agent. Process the input and provide a response.`
    );

    return { agentName, result };
  }

  /**
   * Update a field in the pipeline/task/etc
   */
  private async updateField(config: any, context: any): Promise<any> {
    const { entity, field, value } = config;

    switch (entity) {
      case 'task':
        if (!context.taskId) throw new Error('taskId required');
        return this.storage.updateWorkflowTask(context.taskId, { [field]: value });
      
      case 'step':
        if (!context.stepId) throw new Error('stepId required');
        return this.storage.updateWorkflowStep(context.stepId, { [field]: value });
      
      case 'stage':
        if (!context.stageId) throw new Error('stageId required');
        return this.storage.updateWorkflowStage(context.stageId, { [field]: value });
      
      case 'pipeline':
        return this.storage.updateWorkflow(context.workflowId, { [field]: value });
      
      default:
        throw new Error(`Unknown entity: ${entity}`);
    }
  }

  /**
   * Process task completion - check if step/stage should auto-progress
   */
  async processTaskCompletion(taskId: string): Promise<void> {
    const task = await this.storage.getWorkflowTask(taskId);
    if (!task) return;

    const step = await this.storage.getWorkflowStep(task.stepId);
    if (!step) return;

    const stage = await this.storage.getWorkflowStage(step.stageId);
    if (!stage) return;

    const workflow = await this.storage.getWorkflow(stage.workflowId);
    if (!workflow) return;

    // Check if all tasks in step are completed
    const tasks = await this.storage.getTasksByStep(step.id);
    const allComplete = tasks.every(t => t.status === 'completed');

    if (allComplete && step.autoProgress) {
      // Evaluate step's progress conditions
      const conditionsMet = this.evaluateConditions(
        (step.progressConditions as any) || [],
        { allTasksComplete: true, step }
      );

      if (conditionsMet) {
        // Execute step completion actions with proper context
        if (step.onCompleteActions && Array.isArray(step.onCompleteActions)) {
          await this.executeActions(step.onCompleteActions as ActionConfig[], {
            workflowId: workflow.id,
            stepId: step.id,
            stageId: stage.id,
            organizationId: workflow.organizationId,
            userId: workflow.createdBy,
          });
        }

        // Mark step as completed
        await this.storage.updateWorkflowStep(step.id, {
          status: 'completed',
        } as any);

        // Check if stage should auto-progress
        await this.processStepCompletion(step.stageId);
      }
    }
  }

  /**
   * Process step completion - check if stage should auto-progress
   */
  async processStepCompletion(stageId: string): Promise<void> {
    const stage = await this.storage.getWorkflowStage(stageId);
    if (!stage) return;

    const workflow = await this.storage.getWorkflow(stage.workflowId);
    if (!workflow) return;

    // Check if all steps in stage are completed
    const steps = await this.storage.getStepsByStage(stage.id);
    const allComplete = steps.every(s => s.status === 'completed');

    if (allComplete && stage.autoProgress) {
      // Evaluate stage's progress conditions
      const conditionsMet = this.evaluateConditions(
        (stage.progressConditions as any) || [],
        { allStepsComplete: true, stage }
      );

      if (conditionsMet) {
        // Execute stage completion actions with proper context
        if (stage.onCompleteActions && Array.isArray(stage.onCompleteActions)) {
          await this.executeActions(stage.onCompleteActions as ActionConfig[], {
            workflowId: workflow.id,
            stageId: stage.id,
            organizationId: workflow.organizationId,
            userId: workflow.createdBy,
          });
        }

        // Mark stage as completed
        await this.storage.updateWorkflowStage(stage.id, {
          status: 'completed',
        } as any);
      }
    }
  }

  /**
   * Send an email
   */
  private async sendEmail(config: any, context: any): Promise<any> {
    const { to, subject, body, templateId, variables } = config;
    
    // Get recipient email
    let recipientEmail = to;
    if (!recipientEmail && config.recipientType) {
      // Fetch recipient based on type (client, assignee, etc.)
      if (config.recipientType === 'client' && config.clientId) {
        const client = await this.storage.getClient(config.clientId);
        recipientEmail = client?.email;
      } else if (config.recipientType === 'assignee' && context.taskId) {
        const task = await this.storage.getWorkflowTask(context.taskId);
        if (task?.assignedTo) {
          const user = await this.storage.getUser(task.assignedTo);
          recipientEmail = user?.email;
        }
      }
    }

    if (!recipientEmail) {
      throw new Error('No recipient email address specified');
    }

    // Create email record (in production, integrate with email service like SendGrid, AWS SES, etc.)
    const email = {
      to: recipientEmail,
      subject: subject || 'Workflow Notification',
      body: body || '',
      templateId,
      variables,
      status: 'pending',
      sentAt: null,
      metadata: {
        workflowId: context.workflowId,
        organizationId: context.organizationId,
      },
    };

    // Log the email action
    console.log('[Automation] Email scheduled:', email);
    
    // In a real implementation, this would integrate with an email service
    // For now, create a notification as fallback
    await this.storage.createNotification({
      userId: context.userId,
      title: `Email sent: ${subject}`,
      message: `To: ${recipientEmail}\n\n${body}`,
      type: 'info',
      metadata: email,
    });

    return { sent: true, email };
  }

  /**
   * Trigger a form to be sent to a client or user
   */
  private async triggerForm(config: any, context: any): Promise<any> {
    const { formTemplateId, recipientId, recipientType, dueDate, message } = config;

    if (!formTemplateId) {
      throw new Error('formTemplateId is required to trigger a form');
    }

    // Verify form template exists
    const formTemplate = await this.storage.getFormTemplate(formTemplateId);
    if (!formTemplate) {
      throw new Error(`Form template ${formTemplateId} not found`);
    }

    // Create form submission request
    const formRequest = await this.storage.createFormSubmission({
      formTemplateId,
      formVersion: formTemplate.version || 1,
      organizationId: context.organizationId,
      submittedBy: recipientId || context.userId,
      clientId: recipientType === 'client' ? recipientId : undefined,
      status: 'pending',
      data: {
        triggeredBy: 'automation',
        workflowId: context.workflowId,
        taskId: context.taskId,
        message,
        dueDate,
      },
    });

    // Send notification to recipient
    if (recipientId) {
      await this.storage.createNotification({
        userId: recipientId,
        title: 'Form Submission Required',
        message: message || `Please complete the form: ${formTemplate.name}`,
        type: 'action_required',
        metadata: {
          formTemplateId,
          formSubmissionId: formRequest.id,
        },
      });
    }

    return formRequest;
  }

  /**
   * Send an invoice (based on time entries, assignment, or engagement letter)
   */
  private async sendInvoice(config: any, context: any): Promise<any> {
    const { clientId, basedOn, assignmentId, projectId, timeEntryIds, amount, dueDate, description } = config;

    if (!clientId) {
      throw new Error('clientId is required to send an invoice');
    }

    // Verify client exists
    const client = await this.storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Calculate invoice amount based on configuration
    let calculatedAmount = amount || 0;
    let invoiceItems: any[] = [];

    if (basedOn === 'time_entries' && clientId) {
      // Fetch time entries for client and calculate amount
      const timeEntries = await this.storage.getTimeEntriesByClient(clientId);
      calculatedAmount = timeEntries.reduce((sum: number, entry: any) => {
        const hours = entry.hours || 0;
        const rate = entry.hourlyRate || 0;
        return sum + (hours * rate);
      }, 0);

      invoiceItems = timeEntries.map((entry: any) => ({
        description: entry.description || 'Time Entry',
        quantity: entry.hours,
        rate: entry.hourlyRate,
        amount: (entry.hours || 0) * (entry.hourlyRate || 0),
      }));
    } else if (basedOn === 'assignment' && assignmentId) {
      // Create invoice for entire assignment - amount should be provided in config
      invoiceItems = [{
        description: description || 'Workflow Assignment',
        quantity: 1,
        rate: calculatedAmount,
        amount: calculatedAmount,
      }];
    }

    // Create invoice
    const invoice = await this.storage.createInvoice({
      clientId,
      organizationId: context.organizationId,
      invoiceNumber: `INV-${Date.now()}`, // Auto-generate invoice number
      status: 'draft',
      issueDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      subtotal: calculatedAmount.toString(),
      total: calculatedAmount.toString(),
      createdBy: context.userId,
      notes: description,
    });

    // Add invoice items
    for (const item of invoiceItems) {
      await this.storage.createInvoiceItem({
        invoiceId: invoice.id,
        ...item,
      });
    }

    // Send notification to client
    await this.storage.createNotification({
      userId: client.createdBy, // Notify client contact
      title: 'New Invoice',
      message: `An invoice for $${calculatedAmount.toFixed(2)} has been generated.`,
      type: 'info',
      metadata: {
        invoiceId: invoice.id,
      },
    });

    return invoice;
  }

  /**
   * Schedule a follow-up task or reminder
   */
  private async scheduleFollowup(config: any, context: any): Promise<any> {
    const { delay, delayUnit = 'days', taskName, assignedTo, priority = 'medium', stepId } = config;

    if (!delay) {
      throw new Error('delay is required to schedule a follow-up');
    }

    // Calculate follow-up date
    const now = new Date();
    let followupDate = new Date(now);
    
    switch (delayUnit) {
      case 'minutes':
        followupDate.setMinutes(now.getMinutes() + delay);
        break;
      case 'hours':
        followupDate.setHours(now.getHours() + delay);
        break;
      case 'days':
        followupDate.setDate(now.getDate() + delay);
        break;
      case 'weeks':
        followupDate.setDate(now.getDate() + (delay * 7));
        break;
      case 'months':
        followupDate.setMonth(now.getMonth() + delay);
        break;
      default:
        followupDate.setDate(now.getDate() + delay);
    }

    // Create follow-up task
    const targetStepId = stepId || context.stepId;
    
    if (!targetStepId) {
      throw new Error('stepId required to create follow-up task');
    }

    const followupTask = await this.storage.createWorkflowTask({
      stepId: targetStepId,
      name: taskName || 'Follow-up',
      description: `Scheduled follow-up after ${delay} ${delayUnit}`,
      type: 'manual',
      assignedTo: assignedTo || context.userId,
      priority,
      dueDate: followupDate,
      order: 999, // Place at end
    });

    // Create reminder notification
    await this.storage.createNotification({
      userId: assignedTo || context.userId,
      title: 'Follow-up Scheduled',
      message: `A follow-up task "${taskName || 'Follow-up'}" has been scheduled for ${followupDate.toLocaleDateString()}`,
      type: 'info',
      metadata: {
        taskId: followupTask.id,
        dueDate: followupDate.toISOString(),
      },
    });

    return followupTask;
  }

  /**
   * Trigger another workflow (for complex multi-workflow automations)
   */
  private async triggerWorkflow(config: any, context: any): Promise<any> {
    const { workflowId, clientId, assignedTo, name, priority = 'medium' } = config;

    if (!workflowId) {
      throw new Error('workflowId is required to trigger a workflow');
    }

    if (!clientId) {
      throw new Error('clientId is required to trigger a workflow');
    }

    // Verify workflow exists
    const workflow = await this.storage.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Verify client exists
    const client = await this.storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    // Get workflow stages for total count
    const stages = await this.storage.getStagesByWorkflow(workflowId);

    // Create workflow assignment
    const assignment = await this.storage.createWorkflowAssignment({
      workflowId,
      clientId,
      organizationId: context.organizationId,
      name: name || `${client.companyName} - ${workflow.name}`,
      assignedBy: context.userId,
      assignedTo: assignedTo || context.userId,
      status: 'not_started',
      priority,
      totalStages: stages.length,
      progress: 0,
      completedStages: 0,
    });

    // Send notification
    await this.storage.createNotification({
      userId: assignedTo || context.userId,
      title: 'New Workflow Assignment',
      message: `You have been assigned to workflow: ${workflow.name}`,
      type: 'action_required',
      metadata: {
        assignmentId: assignment.id,
        workflowId,
      },
    });

    return assignment;
  }

  /**
   * Helper to get nested values from objects (e.g., "user.email")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
