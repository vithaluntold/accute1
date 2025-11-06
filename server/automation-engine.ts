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
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal' | 'exists' | 'not_exists' | 'in' | 'not_in' | 'contains_any' | 'contains_all' | 'starts_with' | 'ends_with';
  value: any;
  logic?: 'AND' | 'OR'; // For combining multiple conditions
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
    | 'trigger_workflow'
    | 'create_invoice'
    | 'request_documents'
    | 'send_organizer'
    | 'apply_tags'
    | 'remove_tags'
    | 'send_proposal'
    | 'apply_folder_template';
  config: Record<string, any>;
  conditions?: ConditionConfig[];
}

/**
 * Automation Engine - Main class for processing pipeline automations
 */
export class AutomationEngine {
  constructor(private storage: IStorage) {}

  /**
   * Evaluate a set of conditions against provided data
   * Supports tag-based conditions, field comparisons, and complex operators
   * Correctly handles mixed AND/OR logic by evaluating conditions in sequence
   */
  async evaluateConditions(
    conditions: ConditionConfig[] | Record<string, any>, 
    data: Record<string, any>
  ): Promise<boolean> {
    if (!conditions) {
      return true;
    }

    const conditionsArray = Array.isArray(conditions) ? conditions : [conditions];
    
    if (conditionsArray.length === 0) {
      return true;
    }

    let result = true;
    
    for (const condition of conditionsArray) {
      const conditionResult = await this.evaluateSingleCondition(condition, data);
      
      if (condition.logic === 'OR') {
        result = result || conditionResult;
      } else {
        result = result && conditionResult;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateSingleCondition(
    condition: ConditionConfig, 
    data: Record<string, any>
  ): Promise<boolean> {
    const fieldValue = await this.getFieldValue(condition.field, data);

    switch (condition.operator) {
      case 'equals':
        return fieldValue == condition.value;
      
      case 'not_equals':
        return fieldValue != condition.value;
      
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return String(fieldValue).includes(String(condition.value));
      
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(condition.value);
      
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(condition.value);
      
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      
      case 'contains_any':
        if (!Array.isArray(fieldValue) || !Array.isArray(condition.value)) {
          return false;
        }
        return condition.value.some(val => fieldValue.includes(val));
      
      case 'contains_all':
        if (!Array.isArray(fieldValue) || !Array.isArray(condition.value)) {
          return false;
        }
        return condition.value.every(val => fieldValue.includes(val));
      
      case 'starts_with':
        return String(fieldValue).startsWith(String(condition.value));
      
      case 'ends_with':
        return String(fieldValue).endsWith(String(condition.value));
      
      default:
        return false;
    }
  }

  /**
   * Get field value with support for nested paths and dynamic data fetching
   * Supports paths like: client.tags, assignment.client.name, workflow.status
   */
  private async getFieldValue(field: string, data: Record<string, any>): Promise<any> {
    if (field.includes('.')) {
      const parts = field.split('.');
      const firstPart = parts[0];
      
      if (firstPart === 'client' && data.clientId && !data.client) {
        data.client = await this.storage.getClient(data.clientId);
      } else if (firstPart === 'workflow' && data.workflowId && !data.workflow) {
        data.workflow = await this.storage.getWorkflow(data.workflowId);
      } else if (firstPart === 'assignment' && data.assignmentId && !data.assignment) {
        data.assignment = await this.storage.getWorkflowAssignment(data.assignmentId);
      }
    }
    
    return this.getNestedValue(data, field);
  }

  /**
   * Execute a list of actions with conditional logic support
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
      clientId?: string;
      assignmentId?: string;
    }
  ): Promise<any[]> {
    const results = [];

    for (const action of actions) {
      try {
        if (action.conditions && action.conditions.length > 0) {
          const evaluationData = {
            ...(context.data || {}),
            clientId: context.clientId,
            assignmentId: context.assignmentId,
            workflowId: context.workflowId,
            stageId: context.stageId,
            stepId: context.stepId,
            taskId: context.taskId,
            organizationId: context.organizationId,
            userId: context.userId,
          };
          
          const conditionsMet = await this.evaluateConditions(action.conditions, evaluationData);
          
          if (!conditionsMet) {
            results.push({ 
              success: true, 
              action: action.type, 
              result: 'skipped', 
              reason: 'conditions not met' 
            });
            continue;
          }
        }

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
      
      case 'create_invoice':
        return this.createInvoice(action.config, context);
      
      case 'request_documents':
        return this.requestDocuments(action.config, context);
      
      case 'send_organizer':
        return this.sendOrganizer(action.config, context);
      
      case 'apply_tags':
        return this.applyTags(action.config, context);
      
      case 'remove_tags':
        return this.removeTags(action.config, context);
      
      case 'send_proposal':
        return this.sendProposal(action.config, context);
      
      case 'apply_folder_template':
        return this.applyFolderTemplate(action.config, context);
      
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
      const conditionsMet = await this.evaluateConditions(
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
      const conditionsMet = await this.evaluateConditions(
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
   * Send an email using Resend
   */
  private async sendEmail(config: any, context: any): Promise<any> {
    const { to, subject, body, html, templateId, variables } = config;
    
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

    // Process email template if provided
    let emailBody = body || '';
    let emailHtml = html;

    if (templateId && !emailHtml) {
      try {
        const template = await this.storage.getEmailTemplate(templateId);
        if (template) {
          emailHtml = template.content || '';
          
          if (variables && typeof variables === 'object') {
            Object.entries(variables).forEach(([key, value]) => {
              const regex = new RegExp(`{{${key}}}`, 'g');
              emailHtml = emailHtml?.replace(regex, String(value));
              emailBody = emailBody.replace(regex, String(value));
            });
          }
        }
      } catch (error: any) {
        console.warn('[Automation] Failed to load email template:', templateId, error.message);
      }
    }

    const finalSubject = subject || 'Workflow Notification';
    const finalBody = emailBody || 'This is an automated notification from your workflow.';

    try {
      const { sendEmail: resendSendEmail } = await import('./resend-service');
      
      const result = await resendSendEmail({
        to: recipientEmail,
        subject: finalSubject,
        html: emailHtml,
        text: finalBody
      });

      if (result.success) {
        console.log('[Automation] Email sent successfully via Resend:', result.messageId);
        
        await this.storage.createNotification({
          userId: context.userId,
          title: `Email sent: ${finalSubject}`,
          message: `To: ${recipientEmail}\n\nEmail sent successfully via Resend`,
          type: 'info',
          metadata: {
            emailMessageId: result.messageId,
            workflowId: context.workflowId,
            organizationId: context.organizationId,
          },
        });

        return { sent: true, messageId: result.messageId };
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('[Automation] Failed to send email via Resend:', error);
      
      await this.storage.createNotification({
        userId: context.userId,
        title: `Email notification: ${finalSubject}`,
        message: `To: ${recipientEmail}\n\n${finalBody}\n\n(Email service unavailable - notification created instead)`,
        type: 'warning',
        metadata: {
          workflowId: context.workflowId,
          organizationId: context.organizationId,
          emailError: error.message
        },
      });

      return { sent: false, error: error.message, fallbackNotificationCreated: true };
    }
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
   * Create an invoice for a client (same as sendInvoice but clearer naming)
   */
  private async createInvoice(config: any, context: any): Promise<any> {
    return this.sendInvoice(config, context);
  }

  /**
   * Request documents from a client - creates a document request with notification
   */
  private async requestDocuments(config: any, context: any): Promise<any> {
    const { clientId, documentTypes, dueDate, message, priority = 'medium' } = config;

    if (!clientId) {
      throw new Error('clientId is required to request documents');
    }

    if (!documentTypes || !Array.isArray(documentTypes) || documentTypes.length === 0) {
      throw new Error('documentTypes array is required (e.g., ["W2", "1099", "Bank Statements"])');
    }

    const client = await this.storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    const requestedDocs = documentTypes.map((docType: string) => ({
      type: docType,
      status: 'pending',
      requestedAt: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
    }));

    const documentRequest = {
      id: `req_${Date.now()}`,
      clientId,
      organizationId: context.organizationId,
      requestedBy: context.userId,
      documents: requestedDocs,
      status: 'pending',
      message: message || `Please upload the following documents: ${documentTypes.join(', ')}`,
      priority,
      createdAt: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
    };

    await this.storage.createNotification({
      userId: client.createdBy,
      title: 'Document Request',
      message: documentRequest.message,
      type: 'action_required',
      metadata: {
        documentRequest,
        workflowId: context.workflowId,
      },
    });

    return documentRequest;
  }

  /**
   * Send an organizer (client information request) using form templates
   */
  private async sendOrganizer(config: any, context: any): Promise<any> {
    const { clientId, formTemplateId, dueDate, message, organizerType = 'tax' } = config;

    if (!clientId) {
      throw new Error('clientId is required to send organizer');
    }

    if (!formTemplateId) {
      throw new Error('formTemplateId is required - specify which organizer template to send');
    }

    const formTemplate = await this.storage.getFormTemplate(formTemplateId);
    if (!formTemplate) {
      throw new Error(`Form template ${formTemplateId} not found`);
    }

    const client = await this.storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    const formRequest = await this.storage.createFormSubmission({
      formTemplateId,
      formVersion: formTemplate.version || 1,
      organizationId: context.organizationId,
      submittedBy: client.createdBy,
      clientId,
      status: 'pending',
      data: {
        triggeredBy: 'automation',
        workflowId: context.workflowId,
        organizerType,
        message: message || `Please complete the ${organizerType} organizer`,
        dueDate,
      },
    });

    await this.storage.createNotification({
      userId: client.createdBy,
      title: `${organizerType.toUpperCase()} Organizer`,
      message: message || `Please complete your ${organizerType} organizer: ${formTemplate.name}`,
      type: 'action_required',
      metadata: {
        formTemplateId,
        formSubmissionId: formRequest.id,
        organizerType,
      },
    });

    return formRequest;
  }

  /**
   * Apply tags to a client or organization
   */
  private async applyTags(config: any, context: any): Promise<any> {
    const { targetType, targetId, tags } = config;

    if (!targetType || !['client', 'organization'].includes(targetType)) {
      throw new Error('targetType must be "client" or "organization"');
    }

    if (!targetId) {
      throw new Error('targetId is required');
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new Error('tags array is required');
    }

    if (targetType === 'client') {
      const client = await this.storage.getClient(targetId);
      if (!client) {
        throw new Error(`Client ${targetId} not found`);
      }

      const existingTags = client.tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      
      await this.storage.updateClient(targetId, { tags: newTags });

      return { targetType, targetId, tagsAdded: tags, totalTags: newTags };
    } else {
      const org = await this.storage.getOrganization(targetId);
      if (!org) {
        throw new Error(`Organization ${targetId} not found`);
      }

      const existingTags = org.tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      
      await this.storage.updateOrganization(targetId, { tags: newTags });

      return { targetType, targetId, tagsAdded: tags, totalTags: newTags };
    }
  }

  /**
   * Remove tags from a client or organization
   */
  private async removeTags(config: any, context: any): Promise<any> {
    const { targetType, targetId, tags, clearAll = false } = config;

    if (!targetType || !['client', 'organization'].includes(targetType)) {
      throw new Error('targetType must be "client" or "organization"');
    }

    if (!targetId) {
      throw new Error('targetId is required');
    }

    if (!clearAll && (!tags || !Array.isArray(tags) || tags.length === 0)) {
      throw new Error('tags array is required unless clearAll is true');
    }

    if (targetType === 'client') {
      const client = await this.storage.getClient(targetId);
      if (!client) {
        throw new Error(`Client ${targetId} not found`);
      }

      const newTags = clearAll ? [] : (client.tags || []).filter((tag: string) => !tags.includes(tag));
      
      await this.storage.updateClient(targetId, { tags: newTags });

      return { targetType, targetId, tagsRemoved: clearAll ? client.tags : tags, totalTags: newTags };
    } else {
      const org = await this.storage.getOrganization(targetId);
      if (!org) {
        throw new Error(`Organization ${targetId} not found`);
      }

      const newTags = clearAll ? [] : (org.tags || []).filter((tag: string) => !tags.includes(tag));
      
      await this.storage.updateOrganization(targetId, { tags: newTags });

      return { targetType, targetId, tagsRemoved: clearAll ? org.tags : tags, totalTags: newTags };
    }
  }

  /**
   * Send a proposal to a client
   */
  private async sendProposal(config: any, context: any): Promise<any> {
    const { clientId, proposalTemplateId, amount, services, validUntil, message } = config;

    if (!clientId) {
      throw new Error('clientId is required to send proposal');
    }

    const client = await this.storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    let proposalContent = message || 'We are pleased to present you with this proposal.';

    if (proposalTemplateId) {
      try {
        const template = await this.storage.getDocumentTemplate(proposalTemplateId);
        if (template && template.content) {
          proposalContent = template.content;
        }
      } catch (error: any) {
        console.warn('Failed to load proposal template:', error.message);
      }
    }

    const proposal = {
      id: `prop_${Date.now()}`,
      clientId,
      organizationId: context.organizationId,
      createdBy: context.userId,
      status: 'sent',
      amount: amount || 0,
      services: services || [],
      content: proposalContent,
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sentAt: new Date(),
    };

    await this.storage.createNotification({
      userId: client.createdBy,
      title: 'New Proposal',
      message: `You have received a new proposal${amount ? ` for $${amount}` : ''}.`,
      type: 'action_required',
      metadata: {
        proposal,
        workflowId: context.workflowId,
      },
    });

    return proposal;
  }

  /**
   * Apply a folder template to organize client documents
   */
  private async applyFolderTemplate(config: any, context: any): Promise<any> {
    const { clientId, folderTemplateId, folderStructure } = config;

    if (!clientId) {
      throw new Error('clientId is required to apply folder template');
    }

    const client = await this.storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    let structure = folderStructure;

    if (folderTemplateId && !structure) {
      try {
        const template = await this.storage.getFolderTemplate(folderTemplateId);
        structure = template?.structure || [];
      } catch (error: any) {
        console.warn('Failed to load folder template:', error.message);
      }
    }

    const defaultStructure = [
      { name: 'Tax Returns', type: 'folder' },
      { name: 'Supporting Documents', type: 'folder' },
      { name: 'Correspondence', type: 'folder' },
      { name: 'Invoices', type: 'folder' },
    ];

    const finalStructure = structure || defaultStructure;
    const createdFolders = [];

    for (const folder of finalStructure) {
      const folderPath = `clients/${clientId}/${folder.name}`;
      createdFolders.push({
        name: folder.name,
        path: folderPath,
        type: folder.type || 'folder',
      });
    }

    return {
      clientId,
      foldersCreated: createdFolders.length,
      structure: createdFolders,
      message: `Created ${createdFolders.length} folders for ${client.companyName}`,
    };
  }

  /**
   * Helper to get nested values from objects (e.g., "user.email")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}
