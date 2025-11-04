import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { RelayAgent } from "./index";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "relay");

  // Chat endpoint for conversational inbox processing
  app.post("/api/agents/relay/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, emailContent, llmConfigId } = req.body;
      
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

      // Use RelayAgent class
      const agent = new RelayAgent(llmConfig);
      const result = await agent.execute({ message, history, emailContent });

      res.json({ 
        response: result.response,
        taskExtraction: result.taskExtraction
      });
      
    } catch (error) {
      console.error("Error in Relay chat:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create task from extracted data
  app.post("/api/agents/relay/create-task", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const taskData = {
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || "medium",
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        status: "pending" as const,
        assigneeId: req.body.assigneeId || null,
        clientId: null,
        organizationId: req.user!.organizationId!,
        assignmentId: null,
        isCompleted: false,
        completedAt: null,
        createdBy: req.user!.id,
        metadata: {
          source: "email",
          emailSubject: req.body.emailSubject,
          emailSender: req.body.emailSender,
          tags: req.body.tags || []
        }
      };

      const task = await storage.createClientPortalTask(taskData);

      res.json({ 
        success: true,
        message: "Task created successfully from email",
        taskId: task.id
      });
      
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ 
        error: "Failed to create task",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};
