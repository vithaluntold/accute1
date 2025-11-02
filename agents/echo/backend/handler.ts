import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { LLMService } from "../../../server/llm-service";
import { insertMessageTemplateSchema } from "../../../shared/schema";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MessageTemplate {
  name: string;
  category: string;
  content: string;
  variables: string[];
  status: "building" | "complete";
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "echo");

  // Chat endpoint for conversational message template building
  app.post("/api/agents/echo/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentTemplate } = req.body;
      
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Echo, a message template generation specialist. You help users create professional, engaging message templates for client communication.

**YOUR JOB:**
1. Ask clarifying questions about the message template they need
2. Understand the purpose, tone, and merge fields required
3. Build the template incrementally as you chat
4. Return a JSON template structure with each response

**MESSAGE TEMPLATE STRUCTURE:**
{
  "name": "Template Name",
  "category": "follow_up|status_update|request_info|greeting|custom",
  "content": "Message text with {{merge_fields}}",
  "variables": ["client_name", "firm_name", "due_date"],
  "status": "building|complete"
}

**MERGE FIELDS:**
Common merge fields to use:
- {{client_name}} - Client's full name
- {{client_first_name}} - Client's first name
- {{firm_name}} - Firm/organization name
- {{employee_name}} - Staff member's name
- {{due_date}} - Due date for tasks
- {{amount}} - Financial amount
- {{service_name}} - Service/product name
- {{status}} - Status update
- {{link}} - Document/portal link

**CATEGORIES:**
- follow_up: Following up on pending items
- status_update: Informing clients about progress
- request_info: Requesting information/documents
- greeting: Welcome/introduction messages
- custom: Other purposes

**TONE GUIDELINES:**
- Professional yet friendly
- Clear and concise
- Action-oriented when needed
- Personalized using merge fields

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---TEMPLATE_JSON---":
1. Your conversational response to the user
2. The current template JSON structure

Example:
Great! I've created a follow-up message for document requests. Would you like to adjust the tone or add more details?
---TEMPLATE_JSON---
{"name":"Document Request Follow-up","category":"follow_up","content":"Hi {{client_name}},\\n\\nWe're still waiting for the documents needed to complete your {{service_name}}. Could you please upload them at your earliest convenience?\\n\\nThank you,\\n{{firm_name}}","variables":["client_name","service_name","firm_name"],"status":"building"}

**IMPORTANT:**
- Always include merge fields in double curly braces
- Extract variables from merge fields automatically
- Be conversational and helpful
- Set status to "complete" only when user confirms`;

      let conversationContext = '';
      if (history && history.length > 0) {
        conversationContext = history
          .slice(-4)
          .map((msg: Message) => `${msg.role}: ${msg.content}`)
          .join('\n\n');
      }
      
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nuser: ${message}`
        : message;

      const fullResponse = await llmService.sendPrompt(fullPrompt, systemPrompt);

      let responseText = fullResponse;
      let templateUpdate: MessageTemplate | undefined = undefined;

      if (fullResponse.includes("---TEMPLATE_JSON---")) {
        const parts = fullResponse.split("---TEMPLATE_JSON---");
        responseText = parts[0].trim();
        
        try {
          const jsonPart = parts[1].trim();
          templateUpdate = JSON.parse(jsonPart);
        } catch (e) {
          console.error("Failed to parse template JSON:", e);
        }
      }

      res.json({ 
        response: responseText,
        templateUpdate: templateUpdate || currentTemplate
      });
      
    } catch (error) {
      console.error("Error in Echo chat:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save message template
  app.post("/api/agents/echo/save-template", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const templateScope = req.body.scope === "global" ? "global" : "organization";
      
      const templateData = {
        name: req.body.name,
        category: req.body.category || "custom",
        content: req.body.content,
        variables: req.body.variables || [],
        scope: templateScope,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id,
        isActive: true,
        isDefault: false,
        usageCount: 0,
        metadata: req.body.metadata || {}
      };

      const validationResult = insertMessageTemplateSchema.safeParse(templateData);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid message template data",
          details: validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const template = await storage.createMessageTemplate({
        ...validationResult.data,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id
      });

      res.json({ 
        success: true,
        message: "Message template saved successfully",
        templateId: template.id
      });
      
    } catch (error) {
      console.error("Error saving message template:", error);
      res.status(500).json({ 
        error: "Failed to save message template",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};
