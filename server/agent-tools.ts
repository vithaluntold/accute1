/**
 * AI Agent Tool Execution System
 * 
 * This module defines the tools (functions) that AI agents can call to perform actions
 * like creating workflows, forms, documents, etc.
 */

import { storage } from "./storage";
import type { AuthRequest } from "./auth";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: any;
    }>;
    required: string[];
  };
}

export interface ToolExecutionContext {
  organizationId: string;
  userId: string;
  req: AuthRequest;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Available tools for Cadence agent (Workflow automation)
 */
export const cadenceTools: ToolDefinition[] = [
  {
    name: "create_workflow",
    description: "Create a new workflow with stages, steps, and tasks",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The workflow name"
        },
        description: {
          type: "string",
          description: "Description of what this workflow does"
        },
        category: {
          type: "string",
          description: "Category of workflow",
          enum: ["tax", "audit", "bookkeeping", "custom"]
        },
        stages: {
          type: "array",
          description: "Array of stages in the workflow",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              order: { type: "number" },
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    order: { type: "number" },
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                          dueDate: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      required: ["name", "category"]
    }
  },
  {
    name: "add_workflow_stage",
    description: "Add a new stage to an existing workflow",
    parameters: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description: "The workflow ID"
        },
        name: {
          type: "string",
          description: "Stage name"
        },
        description: {
          type: "string",
          description: "Stage description"
        },
        order: {
          type: "number",
          description: "Order/position of this stage"
        }
      },
      required: ["workflowId", "name", "order"]
    }
  },
  {
    name: "add_workflow_task",
    description: "Add a task to a workflow step",
    parameters: {
      type: "object",
      properties: {
        stepId: {
          type: "string",
          description: "The step ID to add task to"
        },
        title: {
          type: "string",
          description: "Task title"
        },
        description: {
          type: "string",
          description: "Task description"
        },
        priority: {
          type: "string",
          description: "Task priority level",
          enum: ["low", "medium", "high", "urgent"]
        },
        dueDate: {
          type: "string",
          description: "ISO date string for when task is due"
        }
      },
      required: ["stepId", "title"]
    }
  }
];

/**
 * Available tools for Forma agent (Form creation)
 */
export const formaTools: ToolDefinition[] = [
  {
    name: "create_form",
    description: "Create a new form template with fields",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Form name"
        },
        description: {
          type: "string",
          description: "Form description"
        },
        category: {
          type: "string",
          description: "Form category",
          enum: ["tax", "onboarding", "survey", "intake", "custom"]
        },
        fields: {
          type: "array",
          description: "Array of form fields",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              type: { 
                type: "string",
                enum: ["text", "email", "number", "textarea", "select", "checkbox", "radio", "date", "file"]
              },
              required: { type: "boolean" },
              placeholder: { type: "string" },
              options: { 
                type: "array",
                items: { type: "string" }
              }
            }
          }
        }
      },
      required: ["name", "category", "fields"]
    }
  },
  {
    name: "add_form_field",
    description: "Add a field to an existing form template",
    parameters: {
      type: "object",
      properties: {
        formId: {
          type: "string",
          description: "The form template ID"
        },
        label: {
          type: "string",
          description: "Field label"
        },
        type: {
          type: "string",
          description: "Field type",
          enum: ["text", "email", "number", "textarea", "select", "checkbox", "radio", "date", "file"]
        },
        required: {
          type: "boolean",
          description: "Whether field is required"
        },
        options: {
          type: "array",
          description: "Options for select/radio fields",
          items: { type: "string" }
        }
      },
      required: ["formId", "label", "type"]
    }
  }
];

/**
 * Available tools for Parity agent (Document management)
 */
export const parityTools: ToolDefinition[] = [
  {
    name: "list_documents",
    description: "List documents in the system with optional filters",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by document status",
          enum: ["pending", "approved", "rejected"]
        },
        workflowId: {
          type: "string",
          description: "Filter by workflow ID"
        },
        limit: {
          type: "number",
          description: "Maximum number of documents to return"
        }
      },
      required: []
    }
  },
  {
    name: "update_document_status",
    description: "Update the status of a document",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The document ID"
        },
        status: {
          type: "string",
          description: "New status",
          enum: ["pending", "approved", "rejected"]
        }
      },
      required: ["documentId", "status"]
    }
  }
];

/**
 * Available tools for Luca agent (Accounting/Finance/Taxation expert + Support Tickets)
 */
export const lucaTools: ToolDefinition[] = [
  {
    name: "create_support_ticket",
    description: "Create a customer support ticket for accounting, finance, or taxation questions",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Ticket subject/title"
        },
        description: {
          type: "string",
          description: "Detailed description of the issue or question"
        },
        category: {
          type: "string",
          description: "Category of the ticket",
          enum: ["accounting", "taxation", "finance", "technical", "billing", "other"]
        },
        priority: {
          type: "string",
          description: "Priority level",
          enum: ["low", "medium", "high", "urgent"]
        },
        contextType: {
          type: "string",
          description: "Type of related resource (optional)",
          enum: ["workflow", "client", "document", "form"]
        },
        contextId: {
          type: "string",
          description: "ID of the related resource (optional)"
        }
      },
      required: ["subject", "description", "category"]
    }
  },
  {
    name: "list_support_tickets",
    description: "List support tickets with optional filters",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by ticket status",
          enum: ["open", "in_progress", "waiting_response", "resolved", "closed"]
        },
        category: {
          type: "string",
          description: "Filter by category",
          enum: ["accounting", "taxation", "finance", "technical", "billing", "other"]
        },
        priority: {
          type: "string",
          description: "Filter by priority",
          enum: ["low", "medium", "high", "urgent"]
        },
        limit: {
          type: "number",
          description: "Maximum number of tickets to return"
        }
      },
      required: []
    }
  },
  {
    name: "add_ticket_comment",
    description: "Add a comment or update to an existing support ticket",
    parameters: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "The support ticket ID"
        },
        content: {
          type: "string",
          description: "Comment content"
        },
        isInternal: {
          type: "boolean",
          description: "Whether this is an internal note (not visible to customer)"
        }
      },
      required: ["ticketId", "content"]
    }
  },
  {
    name: "update_ticket_status",
    description: "Update the status of a support ticket",
    parameters: {
      type: "object",
      properties: {
        ticketId: {
          type: "string",
          description: "The support ticket ID"
        },
        status: {
          type: "string",
          description: "New status",
          enum: ["open", "in_progress", "waiting_response", "resolved", "closed"]
        },
        resolution: {
          type: "string",
          description: "Resolution notes (required when marking as resolved)"
        }
      },
      required: ["ticketId", "status"]
    }
  }
];

/**
 * Tool executors - Map tool names to their execution functions
 */
export const toolExecutors: Record<string, (args: any, context: ToolExecutionContext) => Promise<ToolExecutionResult>> = {
  // Cadence tools
  async create_workflow(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { name, description, category, stages } = args;
      
      // Create the workflow with multi-tenant context
      const workflow = await storage.createWorkflow({
        name,
        description: description || "",
        category: category || "custom",
        status: "draft",
        organizationId: context.organizationId,
        createdBy: context.userId
      });

      // Create stages, steps, and tasks if provided
      if (stages && Array.isArray(stages)) {
        for (const stageData of stages) {
          const stage = await storage.createWorkflowStage({
            workflowId: workflow.id,
            name: stageData.name,
            description: stageData.description || "",
            order: stageData.order || 0
          });

          if (stageData.steps && Array.isArray(stageData.steps)) {
            for (const stepData of stageData.steps) {
              const step = await storage.createWorkflowStep({
                stageId: stage.id,
                name: stepData.name,
                description: stepData.description || "",
                order: stepData.order || 0
              });

              if (stepData.tasks && Array.isArray(stepData.tasks)) {
                for (const taskData of stepData.tasks) {
                  await storage.createWorkflowTask({
                    stepId: step.id,
                    name: taskData.title,
                    description: taskData.description || "",
                    priority: taskData.priority || "medium",
                    status: "pending",
                    order: 0,
                    dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined
                  });
                }
              }
            }
          }
        }
      }

      return {
        success: true,
        data: {
          workflowId: workflow.id,
          name: workflow.name,
          message: `Workflow "${workflow.name}" created successfully with ${stages?.length || 0} stages`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async add_workflow_stage(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { workflowId, name, description, order } = args;
      
      const stage = await storage.createWorkflowStage({
        workflowId,
        name,
        description: description || "",
        order: order || 0
      });

      return {
        success: true,
        data: {
          stageId: stage.id,
          name: stage.name,
          message: `Stage "${stage.name}" added successfully`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async add_workflow_task(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { stepId, title, description, priority, dueDate } = args;
      
      const task = await storage.createWorkflowTask({
        stepId,
        name: title,
        description: description || "",
        priority: priority || "medium",
        status: "pending",
        order: 0,
        dueDate: dueDate ? new Date(dueDate) : undefined
      });

      return {
        success: true,
        data: {
          taskId: task.id,
          title: task.name,
          message: `Task "${task.name}" added successfully`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Forma tools
  async create_form(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { name, description, category, fields } = args;
      
      const form = await storage.createFormTemplate({
        name,
        description: description || "",
        category: category || "custom",
        fields: fields || [],
        organizationId: context.organizationId,
        createdBy: context.userId,
        status: "draft"
      });

      return {
        success: true,
        data: {
          formId: form.id,
          name: form.name,
          fieldCount: fields?.length || 0,
          message: `Form "${form.name}" created successfully with ${fields?.length || 0} fields`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async add_form_field(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { formId, label, type, required, options } = args;
      
      // Get existing form
      const form = await storage.getFormTemplate(formId);
      if (!form) {
        return {
          success: false,
          error: "Form template not found"
        };
      }

      // Add new field to existing fields
      const newField = {
        id: `field_${Date.now()}`,
        label,
        type,
        required: required || false,
        options: options || []
      };

      const updatedFields = [...(form.fields as any[]), newField];
      
      await storage.updateFormTemplate(formId, {
        fields: updatedFields
      });

      return {
        success: true,
        data: {
          fieldId: newField.id,
          label: newField.label,
          message: `Field "${label}" added to form successfully`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Parity tools
  async list_documents(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { status, workflowId, limit } = args;
      
      let documents;
      if (workflowId) {
        documents = await storage.getDocumentsByWorkflow(workflowId);
      } else {
        documents = await storage.getDocumentsByOrganization(context.organizationId);
      }

      // Filter by status if provided
      if (status) {
        documents = documents.filter(doc => doc.status === status);
      }

      // Limit results if specified
      if (limit && limit > 0) {
        documents = documents.slice(0, limit);
      }

      return {
        success: true,
        data: {
          documents: documents.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: doc.type,
            status: doc.status,
            createdAt: doc.createdAt
          })),
          count: documents.length,
          message: `Found ${documents.length} documents`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async update_document_status(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { documentId, status } = args;
      
      const document = await storage.updateDocument(documentId, { status });
      
      if (!document) {
        return {
          success: false,
          error: "Document not found"
        };
      }

      return {
        success: true,
        data: {
          documentId: document.id,
          name: document.name,
          newStatus: document.status,
          message: `Document status updated to "${status}"`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Luca tools - Support Tickets
  async create_support_ticket(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { subject, description, category, priority, contextType, contextId } = args;
      
      const ticket = await storage.createSupportTicket({
        organizationId: context.organizationId,
        subject,
        description,
        category,
        priority: priority || "medium",
        status: "open",
        createdBy: context.userId,
        contextType: contextType || null,
        contextId: contextId || null,
        tags: [],
        metadata: {}
      });

      return {
        success: true,
        data: {
          ticketId: ticket.id,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          message: `Support ticket "${subject}" created successfully`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async list_support_tickets(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { status, category, priority, limit } = args;
      
      let tickets = await storage.getSupportTickets(context.organizationId);

      // Apply filters
      if (status) {
        tickets = tickets.filter(t => t.status === status);
      }
      if (category) {
        tickets = tickets.filter(t => t.category === category);
      }
      if (priority) {
        tickets = tickets.filter(t => t.priority === priority);
      }

      // Limit results
      if (limit && limit > 0) {
        tickets = tickets.slice(0, limit);
      }

      return {
        success: true,
        data: {
          tickets: tickets.map(t => ({
            id: t.id,
            subject: t.subject,
            category: t.category,
            priority: t.priority,
            status: t.status,
            createdAt: t.createdAt
          })),
          count: tickets.length,
          message: `Found ${tickets.length} support tickets`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async add_ticket_comment(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { ticketId, content, isInternal } = args;
      
      const comment = await storage.createSupportTicketComment({
        ticketId,
        content,
        createdBy: context.userId,
        isInternal: isInternal || false,
        attachments: []
      });

      return {
        success: true,
        data: {
          commentId: comment.id,
          ticketId: comment.ticketId,
          message: `Comment added to ticket successfully`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async update_ticket_status(args: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    try {
      const { ticketId, status, resolution } = args;
      
      const updateData: any = { status };
      
      if (status === "resolved" || status === "closed") {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = context.userId;
        if (resolution) {
          updateData.resolution = resolution;
        }
      }
      
      const ticket = await storage.updateSupportTicket(ticketId, updateData);
      
      if (!ticket) {
        return {
          success: false,
          error: "Support ticket not found"
        };
      }

      return {
        success: true,
        data: {
          ticketId: ticket.id,
          subject: ticket.subject,
          newStatus: ticket.status,
          message: `Ticket status updated to "${status}"`
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

/**
 * Execute a tool call
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const executor = toolExecutors[toolName];
  
  if (!executor) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }

  return await executor(args, context);
}

/**
 * Get tools available for a specific agent
 */
export function getAgentTools(agentName: string): ToolDefinition[] {
  switch (agentName.toLowerCase()) {
    case "cadence":
      return cadenceTools;
    case "forma":
      return formaTools;
    case "parity":
      return parityTools;
    case "luca":
      return lucaTools;
    default:
      return [];
  }
}
