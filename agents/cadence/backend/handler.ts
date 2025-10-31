import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth, type AuthRequest, decrypt } from "../../../server/auth";
import { storage } from "../../../server/storage";

interface WorkflowState {
  name: string;
  description?: string;
  stages: Stage[];
  status: "building" | "complete";
}

interface Stage {
  id: string;
  name: string;
  order: number;
  steps: Step[];
}

interface Step {
  id: string;
  name: string;
  description?: string;
  order: number;
  status: "pending" | "added" | "complete";
}

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const registerRoutes = (app: any) => {
  // Chat endpoint for conversational workflow building
  app.post("/api/agents/cadence/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentWorkflow } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.json({
          response: "Hi! I'm Cadence. To start building workflows, I need an API key to be configured in your LLM settings. Once that's set up, I can help you create custom workflows conversationally!",
        });
      }

      // Decrypt API key
      const apiKey = decrypt(llmConfig.apiKeyEncrypted);

      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: apiKey,
      });

      // Build conversation history for Claude
      const messages: Anthropic.MessageParam[] = [];
      
      // Add history (excluding the initial system message)
      if (history && history.length > 0) {
        history.slice(1).forEach((msg: any) => {
          if (msg.role === "user" || msg.role === "assistant") {
            messages.push({
              role: msg.role as "user" | "assistant",
              content: msg.content
            });
          }
        });
      }

      // Add current message
      messages.push({
        role: "user",
        content: message
      });

      // System prompt for workflow building
      const systemPrompt = `You are Cadence, an intelligent workflow building assistant. Your job is to help users create workflows through natural conversation.

When a user describes a workflow they want to build:
1. Ask clarifying questions if needed
2. Suggest stages and steps based on their description
3. Guide them through building a complete workflow structure
4. Be conversational and friendly

When building a workflow, you should respond with both:
- A natural language response to the user
- A JSON object representing the workflow state updates

IMPORTANT: After your conversational response, include a JSON block with the workflow update in this exact format:
\`\`\`json
{
  "workflowUpdate": {
    "name": "Workflow Name",
    "description": "Brief description",
    "stages": [
      {
        "id": "unique-id",
        "name": "Stage Name",
        "order": 1,
        "steps": [
          {
            "id": "unique-id",
            "name": "Step Name",
            "description": "Optional description",
            "order": 1,
            "status": "added"
          }
        ]
      }
    ],
    "status": "building" or "complete"
  }
}
\`\`\`

Current workflow state: ${currentWorkflow ? JSON.stringify(currentWorkflow) : "No workflow started yet"}

Guidelines:
- Start with high-level stages, then break them down into steps
- Mark new items as "added" status, existing items as "complete"
- Set status to "complete" only when the user confirms the workflow is done
- Be specific with step names and descriptions
- Consider typical workflow patterns for common processes
- Ask if they want to add more stages or steps before marking complete`;

      // Call Claude
      const completion = await anthropic.messages.create({
        model: llmConfig.model || "claude-3-5-sonnet-20241022",
        max_tokens: llmConfig.maxTokens || 4000, // Note: Anthropic SDK accepts max_tokens (not max_output_tokens)
        temperature: llmConfig.temperature || 0.7,
        system: systemPrompt,
        messages: messages
      });

      const responseText = completion.content[0].type === "text" 
        ? completion.content[0].text 
        : "I'm sorry, I couldn't generate a response.";

      // Extract workflow update from response
      let workflowUpdate = null;
      let cleanResponse = responseText;
      
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          workflowUpdate = jsonData.workflowUpdate;
          cleanResponse = responseText.replace(/```json\n[\s\S]*?\n```/, '').trim();
        } catch (e) {
          console.error("Failed to parse workflow update JSON:", e);
        }
      }

      res.json({
        response: cleanResponse,
        workflowUpdate: workflowUpdate,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Cadence agent error:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error.message 
      });
    }
  });

  // Endpoint to save the completed workflow
  app.post("/api/agents/cadence/save-workflow", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { workflow } = req.body;
      const userId = req.userId;
      const organizationId = req.user?.organizationId;

      if (!workflow || !workflow.name) {
        return res.status(400).json({ error: "Invalid workflow data" });
      }

      // Convert Cadence workflow format to system workflow format
      const stages = workflow.stages.map((stage: Stage) => ({
        id: stage.id,
        name: stage.name,
        order: stage.order,
        description: "",
        steps: stage.steps.map((step: Step) => ({
          id: step.id,
          name: step.name,
          description: step.description || "",
          order: step.order,
          type: "manual" as const,
          requiresApproval: false,
          approvers: []
        }))
      }));

      // Save to database via storage layer
      const { storage } = await import("../../../server/storage");
      const savedWorkflow = await storage.createWorkflow({
        name: workflow.name,
        description: workflow.description || "",
        category: "custom",
        stages: stages,
        triggers: [],
        status: "draft",
        isTemplate: false,
        organizationId: organizationId!,
        createdBy: userId!,
      });

      res.json({
        success: true,
        workflowId: savedWorkflow.id,
        message: "Workflow saved successfully!"
      });
    } catch (error: any) {
      console.error("Save workflow error:", error);
      res.status(500).json({ error: "Failed to save workflow" });
    }
  });
};

export default { registerRoutes };
