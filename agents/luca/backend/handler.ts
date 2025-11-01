import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { LucaAgent } from "./index";
import { storage } from "../../../server/storage";

export const registerRoutes = (app: any) => {
  // Luca primarily operates through WebSocket for real-time chat
  // This handler provides optional HTTP endpoints for testing
  
  // Health check endpoint
  app.get("/api/agents/luca/status", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      res.json({ 
        status: "active",
        name: "Luca",
        description: "Accounting, Finance & Taxation Expert",
        capabilities: ["accounting", "taxation", "finance", "support-tickets", "conversational"]
      });
    } catch (error) {
      console.error("Error in Luca status:", error);
      res.status(500).json({ 
        error: "Failed to get status",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Optional: Direct execution endpoint (for testing without WebSocket)
  app.post("/api/agents/luca/query", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { query, llmConfigId } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
      
      // Get LLM configuration
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
          error: "No LLM configuration found. Please configure your AI provider in Settings." 
        });
      }

      // Initialize Luca agent
      const agent = new LucaAgent(llmConfig);
      
      // Execute query
      const response = await agent.execute({
        query,
        context: {
          organizationId: req.user!.organizationId!,
          userId: req.user!.id
        }
      });
      
      res.json({ response });
      
    } catch (error) {
      console.error("Error in Luca query:", error);
      res.status(500).json({ 
        error: "Failed to process query",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};
