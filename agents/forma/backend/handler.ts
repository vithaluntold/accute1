import type { Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, type AuthRequest, decrypt } from "../../../server/auth";
import { storage } from "../../../server/storage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "checkbox" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
}

interface FormState {
  name: string;
  description?: string;
  fields: FormField[];
  status: "building" | "complete";
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const registerRoutes = (app: any) => {
  // Chat endpoint for conversational form building
  app.post("/api/agents/forma/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentForm } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Decrypt API key
      const apiKey = decrypt(llmConfig.apiKeyEncrypted);

      const client = new Anthropic({ apiKey: apiKey });

      const systemPrompt = `You are Forma, an AI form builder assistant. You help users create forms through conversation.

**YOUR JOB:**
1. Ask clarifying questions about the form they need
2. Understand what fields they want
3. Build the form incrementally as you chat
4. Return a JSON form structure with each response

**FORM STRUCTURE:**
{
  "name": "Form Name",
  "description": "Brief description",
  "fields": [
    {
      "id": "unique_id",
      "label": "Field Label",
      "type": "text|email|number|date|checkbox|select|textarea",
      "required": true|false,
      "placeholder": "Placeholder text",
      "options": ["Option 1", "Option 2"],  // Only for select fields
      "order": 0
    }
  ],
  "status": "building|complete"
}

**CONVERSATION FLOW:**
- When user says "create a client intake form", ask what fields they need
- When they mention fields, add them to the form
- Use appropriate field types (email for emails, number for numbers, etc.)
- Set status to "complete" only when user confirms form is done
- Status should be "building" while still working on it

**FIELD TYPE MAPPING:**
- Name, Title, Description → text
- Email → email
- Phone → text (with appropriate placeholder)
- Age, Quantity, Amount → number
- Birthday, Date → date
- Yes/No questions → checkbox
- Multiple choice → select (with options array)
- Long text → textarea

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---FORM_JSON---":
1. Your conversational response to the user
2. The current form JSON structure

Example:
Great! I've added an email field for you. What other information do you need to collect?
---FORM_JSON---
{"name":"Client Intake","description":"Collect client information","fields":[{"id":"abc123","label":"Email Address","type":"email","required":true,"order":0}],"status":"building"}

**IMPORTANT:**
- Always include the form JSON after your response
- Increment the order for each new field
- Generate unique IDs for fields
- Be conversational and helpful`;

      const conversationHistory = history
        .slice(-4)
        .map((msg: Message) => ({
          role: msg.role,
          content: msg.content
        }));

      const response = await client.messages.create({
        model: llmConfig.model || "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: "user", content: message }
        ]
      });

      const fullResponse = response.content[0].type === "text" 
        ? response.content[0].text 
        : "";

      // Parse the response to extract form JSON
      let responseText = fullResponse;
      let formUpdate: FormState | undefined = undefined;

      if (fullResponse.includes("---FORM_JSON---")) {
        const parts = fullResponse.split("---FORM_JSON---");
        responseText = parts[0].trim();
        
        try {
          const jsonPart = parts[1].trim();
          formUpdate = JSON.parse(jsonPart);
        } catch (e) {
          console.error("Failed to parse form JSON:", e);
        }
      }

      res.json({ 
        response: responseText,
        formUpdate: formUpdate || currentForm
      });
      
    } catch (error) {
      console.error("Error in Forma chat:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save form endpoint
  app.post("/api/agents/forma/save-form", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const formData = req.body;
      
      // TODO: Save to database
      // For now, just return success
      res.json({ 
        success: true,
        message: "Form saved successfully",
        formId: `form-${Date.now()}`
      });
      
    } catch (error) {
      console.error("Error saving form:", error);
      res.status(500).json({ 
        error: "Failed to save form",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};
