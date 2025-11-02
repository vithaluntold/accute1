import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { LLMService } from "../../../server/llm-service";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TaskExtraction {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignee?: string;
  tags: string[];
  emailSubject: string;
  emailSender: string;
  status: "extracted" | "confirmed";
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

      const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Relay, an inbox intelligence specialist. You analyze emails and intelligently convert them into actionable tasks.

**YOUR JOB:**
1. Analyze email content
2. Extract actionable items and tasks
3. Determine priority, assignee, and due dates
4. Return structured task data

**TASK STRUCTURE:**
{
  "title": "Clear, concise task title",
  "description": "Detailed task description with context from email",
  "priority": "low|medium|high",
  "dueDate": "YYYY-MM-DD" (if mentioned or implied),
  "assignee": "person mentioned or inferred",
  "tags": ["tag1", "tag2"],
  "emailSubject": "Original email subject",
  "emailSender": "sender@email.com",
  "status": "extracted|confirmed"
}

**PRIORITY DETERMINATION:**
- High: Urgent deadlines, legal/compliance, payment issues, client complaints
- Medium: Regular requests, routine work, upcoming deadlines (>3 days)
- Low: FYI emails, long-term items, optional tasks

**DUE DATE INFERENCE:**
- "ASAP" or "urgent" → Tomorrow
- "by end of week" → Coming Friday
- "by end of month" → Last day of current month
- Specific dates mentioned → Use that date
- No deadline mentioned → Leave blank

**ASSIGNEE INFERENCE:**
- Look for names mentioned in email
- Check CC/To fields for team members
- Look for phrases like "can you", "@person"
- If unclear, suggest based on task type

**TAGS:**
Extract relevant tags from:
- Email category (invoice, compliance, tax, audit)
- Action type (review, approve, follow-up, document)
- Department (accounting, legal, hr)
- Client/project names

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---TASK_JSON---":
1. Your conversational response about the extracted task
2. The task JSON structure

Example:
I've identified a high-priority task from this client request. They need tax documents by Friday. Shall I create this task?
---TASK_JSON---
{"title":"Prepare Q4 2024 tax documents for ABC Corp","description":"Client ABC Corp requested Q4 2024 tax documents for their annual filing. Documents should include income statements, expense reports, and depreciation schedules.","priority":"high","dueDate":"2024-12-15","assignee":"John Smith","tags":["tax","client-abc-corp","q4","filing"],"emailSubject":"Q4 Tax Documents Needed","emailSender":"client@abccorp.com","status":"extracted"}

**IMPORTANT:**
- Be thorough in extracting context
- Infer priority intelligently
- Suggest realistic due dates
- Set status to "confirmed" only when user approves`;

      let conversationContext = '';
      if (history && history.length > 0) {
        conversationContext = history
          .slice(-4)
          .map((msg: Message) => `${msg.role}: ${msg.content}`)
          .join('\n\n');
      }
      
      const fullPrompt = emailContent 
        ? `Email to analyze:\n${emailContent}\n\n${conversationContext}\n\nuser: ${message}`
        : conversationContext 
          ? `${conversationContext}\n\nuser: ${message}`
          : message;

      const fullResponse = await llmService.sendPrompt(fullPrompt, systemPrompt);

      let responseText = fullResponse;
      let taskExtraction: TaskExtraction | undefined = undefined;

      if (fullResponse.includes("---TASK_JSON---")) {
        const parts = fullResponse.split("---TASK_JSON---");
        responseText = parts[0].trim();
        
        try {
          const jsonPart = parts[1].trim();
          taskExtraction = JSON.parse(jsonPart);
        } catch (e) {
          console.error("Failed to parse task JSON:", e);
        }
      }

      res.json({ 
        response: responseText,
        taskExtraction
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
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        status: "pending",
        assigneeId: req.body.assigneeId || null,
        createdBy: req.user!.id,
        organizationId: req.user!.organizationId!,
        metadata: {
          source: "email",
          emailSubject: req.body.emailSubject,
          emailSender: req.body.emailSender,
          tags: req.body.tags || []
        }
      };

      const task = await storage.createTask(taskData);

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
