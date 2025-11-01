import type { Request, Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { LLMService } from "../../../server/llm-service";
import multer from "multer";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";

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
  // Register session management routes
  registerAgentSessionRoutes(app, "cadence");
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

      // Initialize LLM service
      const llmService = new LLMService(llmConfig);

      // Build conversation context from history
      let conversationContext = '';
      if (history && history.length > 0) {
        conversationContext = history
          .slice(1) // Skip system message
          .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join('\n\n');
      }
      
      // Combine context with current message
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nuser: ${message}`
        : message;

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

      // Call LLM service
      const responseText = await llmService.sendPrompt(fullPrompt, systemPrompt);

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

      // Save to database via storage layer as a template
      const { storage } = await import("../../../server/storage");
      const savedWorkflow = await storage.createWorkflow({
        name: workflow.name,
        description: workflow.description || "",
        category: "custom",
        stages: stages,
        triggers: [],
        status: "published",
        isTemplate: true, // Save as template for reuse
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

  // Document upload and parsing endpoint with security limits
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/plain'
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, and TXT files are allowed.'));
      }
    }
  });
  
  app.post("/api/agents/cadence/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ error: err.message || 'Invalid file upload' });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Additional file size check
        if (req.file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
        }

      // Get LLM configuration
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Parse document based on file type
      let documentText = "";
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      if (fileExtension === "pdf") {
        const pdfData = await (pdfParse as any)(req.file.buffer);
        documentText = pdfData.text;
      } else if (fileExtension === "docx") {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        documentText = result.value;
      } else if (fileExtension === "txt") {
        documentText = req.file.buffer.toString('utf-8');
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        let allText = "";
        
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(sheet);
          allText += `\n--- Sheet: ${sheetName} ---\n${csvData}\n`;
        });
        
        documentText = allText;
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload PDF, DOCX, XLSX, or TXT files." });
      }

      // Use AI to extract workflow structure
      const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Cadence, an AI workflow builder. You analyze documents containing workflow specifications and convert them into structured workflows.

**YOUR TASK:**
1. Read the provided workflow document
2. Extract the hierarchical structure: Workflow > Stages > Steps > Tasks
3. Identify all stages, steps, and tasks
4. Return a complete workflow structure

**WORKFLOW STRUCTURE:**
{
  "name": "Workflow Name (derived from document)",
  "description": "Brief description",
  "stages": [
    {
      "id": "unique_id",
      "name": "Stage Name",
      "order": 0,
      "steps": [
        {
          "id": "unique_id",
          "name": "Step Name",
          "description": "Step description",
          "order": 0,
          "status": "pending"
        }
      ]
    }
  ],
  "status": "complete"
}

**STRUCTURE EXTRACTION RULES:**
- **Workflow**: The top-level process name
- **Stages**: Major phases or sections (e.g., "Onboarding", "Review", "Approval")
- **Steps**: Individual tasks or actions within each stage
- **Tasks/Subtasks**: Can be included as steps with detailed descriptions

**HIERARCHY EXAMPLES:**
1. Section headers → Stages
2. Numbered/bulleted items → Steps
3. Sub-items → Include in step descriptions
4. Checklists → Convert to individual steps

**IMPORTANT:**
- Extract ALL stages, steps, and tasks from the document
- Maintain the hierarchical order
- Use descriptive names
- Set status to "complete" when done
- Generate unique IDs for each stage and step

**RESPONSE FORMAT:**
Respond with TWO parts separated by "---WORKFLOW_JSON---":
1. A brief summary of what you found
2. The complete workflow JSON

Example:
I found a 3-stage client onboarding workflow with 12 total steps. Here's your structured workflow.
---WORKFLOW_JSON---
{"name":"Client Onboarding","description":"Complete client onboarding process","stages":[...],"status":"complete"}`;

      const userPrompt = `Please analyze this document and create a workflow from it:

---DOCUMENT START---
${documentText}
---DOCUMENT END---

Extract the workflow structure (Workflow > Stages > Steps > Tasks) and return the complete workflow.`;

      const fullResponse = await llmService.sendPrompt(userPrompt, systemPrompt);

      // Parse the response
      let responseText = fullResponse;
      let workflowUpdate: WorkflowState | undefined = undefined;

      if (fullResponse.includes("---WORKFLOW_JSON---")) {
        const parts = fullResponse.split("---WORKFLOW_JSON---");
        responseText = parts[0].trim();
        
        try {
          const jsonPart = parts[1].trim();
          workflowUpdate = JSON.parse(jsonPart);
        } catch (e) {
          console.error("Failed to parse workflow JSON:", e);
          return res.status(500).json({ error: "Failed to parse AI response" });
        }
      }

      if (!workflowUpdate) {
        return res.status(500).json({ error: "AI did not return a valid workflow structure" });
      }

      res.json({ 
        response: responseText,
        workflowUpdate
      });
      
      } catch (error) {
        console.error("Error processing document:", error);
        res.status(500).json({ 
          error: "Failed to process document",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });
  });
};

export default { registerRoutes };
