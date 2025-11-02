import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { LLMService } from "../../../server/llm-service";
import { insertEmailTemplateSchema } from "../../../shared/schema";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  status: "building" | "complete";
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "scribe");

  // Chat endpoint for conversational email template building
  app.post("/api/agents/scribe/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentTemplate } = req.body;
      
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Scribe, an email template craftsman. You help users create professional, engaging email templates with merge fields and personalization.

**YOUR JOB:**
1. Ask clarifying questions about the email template they need
2. Understand the purpose, audience, and tone
3. Build the template incrementally as you chat
4. Return a JSON email structure with each response

**EMAIL TEMPLATE STRUCTURE:**
{
  "name": "Template Name",
  "subject": "Email subject with {{merge_fields}}",
  "body": "Email body with {{merge_fields}}",
  "category": "client_onboarding|invoice|reminder|status_update|marketing|custom",
  "variables": ["client_name", "amount", "due_date"],
  "status": "building|complete"
}

**MERGE FIELDS:**
Common merge fields to use:
- {{client_name}} - Client's full name
- {{client_first_name}} - Client's first name
- {{firm_name}} - Firm/organization name
- {{employee_name}} - Staff member's name
- {{due_date}} - Due date
- {{amount}} - Financial amount
- {{invoice_number}} - Invoice number
- {{service_name}} - Service/product name
- {{portal_link}} - Client portal link
- {{unsubscribe_link}} - Unsubscribe link

**CATEGORIES:**
- client_onboarding: Welcome new clients
- invoice: Billing and payment emails
- reminder: Follow-ups and reminders
- status_update: Progress updates
- marketing: Promotional emails
- custom: Other purposes

**TONE GUIDELINES:**
- Professional yet approachable
- Clear call-to-action
- Personalized using merge fields
- Mobile-friendly formatting

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---EMAIL_JSON---":
1. Your conversational response to the user
2. The current email template JSON structure

Example:
I've created a professional invoice reminder email. Would you like to adjust the tone or add more details?
---EMAIL_JSON---
{"name":"Invoice Reminder","subject":"Payment Due: Invoice #{{invoice_number}}","body":"Hi {{client_name}},\\n\\nThis is a friendly reminder that invoice #{{invoice_number}} for ${{amount}} is due on {{due_date}}.\\n\\nYou can make a payment at: {{portal_link}}\\n\\nThank you,\\n{{firm_name}}","category":"reminder","variables":["client_name","invoice_number","amount","due_date","portal_link","firm_name"],"status":"building"}

**IMPORTANT:**
- Always include merge fields in double curly braces
- Extract variables from merge fields automatically
- Use professional email formatting
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
      let templateUpdate: EmailTemplate | undefined = undefined;

      if (fullResponse.includes("---EMAIL_JSON---")) {
        const parts = fullResponse.split("---EMAIL_JSON---");
        responseText = parts[0].trim();
        
        try {
          const jsonPart = parts[1].trim();
          templateUpdate = JSON.parse(jsonPart);
        } catch (e) {
          console.error("Failed to parse email JSON:", e);
        }
      }

      res.json({ 
        response: responseText,
        templateUpdate: templateUpdate || currentTemplate
      });
      
    } catch (error) {
      console.error("Error in Scribe chat:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save email template
  app.post("/api/agents/scribe/save-template", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const templateScope = req.body.scope === "global" ? "global" : "organization";
      
      const templateData = {
        name: req.body.name,
        subject: req.body.subject,
        body: req.body.body,
        category: req.body.category || "custom",
        variables: req.body.variables || [],
        scope: templateScope,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id,
        isActive: true,
        usageCount: 0,
        metadata: req.body.metadata || {}
      };

      const validationResult = insertEmailTemplateSchema.safeParse(templateData);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid email template data",
          details: validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const template = await storage.createEmailTemplate({
        ...validationResult.data,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id
      });

      res.json({ 
        success: true,
        message: "Email template saved successfully",
        templateId: template.id
      });
      
    } catch (error) {
      console.error("Error saving email template:", error);
      res.status(500).json({ 
        error: "Failed to save email template",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};
