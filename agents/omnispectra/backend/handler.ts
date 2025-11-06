import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { OmniSpectraAgent } from "./index";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "omnispectra");

  app.post("/api/agents/omnispectra/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, context } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Use OmniSpectraAgent class
      const agent = new OmniSpectraAgent(llmConfig);
      const result = await agent.execute({ message, history, context });

      res.json({
        response: result.response,
        suggestions: result.suggestions,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("OmniSpectra error:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};

export default { registerRoutes };
