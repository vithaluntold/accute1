import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { LynkAgent } from "./index";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "lynk");

  // Chat endpoint for conversational message processing
  app.post("/api/agents/lynk/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, messageContent, llmConfigId } = req.body;
      
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

      // Use LynkAgent class
      const agent = new LynkAgent(llmConfig);
      const result = await agent.execute({ message, history, messageContent });

      res.json({ 
        response: result.response,
        taskExtraction: result.taskExtraction
      });
      
    } catch (error) {
      console.error("Error in Lynk chat:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create task from extracted data
  app.post("/api/agents/lynk/create-task", requireAuth, async (req: AuthRequest, res: Response) => {
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
          source: "client-message",
          messageSubject: req.body.messageSubject,
          messageSender: req.body.messageSender,
          tags: req.body.tags || []
        }
      };

      const task = await storage.createClientPortalTask(taskData);

      res.json({ 
        success: true,
        message: "Task created successfully from client message",
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
