import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { insertMessageTemplateSchema } from "../../../shared/schema";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { EchoAgent } from "./index";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "echo");

  // Chat endpoint for conversational message template building
  app.post("/api/agents/echo/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentTemplate, llmConfigId } = req.body;
      
      // Get LLM configuration (user-selected or default)
      let llmConfig;
      if (llmConfigId) {
        llmConfig = await storage.getLlmConfiguration(llmConfigId);
        if (!llmConfig || llmConfig.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ error: "LLM configuration not found" });
        }
      } else {
        llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      }
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Use EchoAgent class
      const agent = new EchoAgent(llmConfig);
      const result = await agent.execute({ message, history, currentTemplate });

      res.json({ 
        response: result.response,
        templateUpdate: result.templateUpdate
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
