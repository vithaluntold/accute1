import type { Request, Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { withLLMConfig, getLLMConfig } from "../../../server/middleware/agent-llm-middleware";
import { LLMService } from "../../../server/llm-service";
import { FileParserService } from "../../../server/file-parser-service";
import multer from "multer";
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
  app.post("/api/agents/cadence/chat", requireAuth, 
    withLLMConfig(async (req, res, llmConfig) => {
      try {
        const { message, history, currentWorkflow } = req.body;

        // Initialize LLM service with LLM config from middleware
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
      const systemPrompt = `You are Cadence, an intelligent workflow building assistant. Your job is to help users create workflows through natural conversation with COMPLETE hierarchical detail.

**YOUR PRIMARY OBJECTIVE:**
ALWAYS create workflows with the FULL 6-level hierarchy:
1. Workflow → 2. Stages → 3. Steps → 4. Tasks → 5. Subtasks → 6. Checklists

**CRITICAL REQUIREMENTS:**
- EVERY Step MUST contain Tasks (minimum 2-5 tasks per step)
- EVERY Task MUST contain Subtasks (minimum 2-4 subtasks per task)
- EVERY Task MUST contain Checklists (minimum 2-4 checklist items per task)
- DO NOT create empty or incomplete levels - populate ALL hierarchy levels

**When a user describes a workflow:**
1. Ask clarifying questions if needed to understand the full scope
2. Break down their description into the COMPLETE hierarchy
3. For EACH step, identify specific tasks, subtasks, and checklists
4. Be comprehensive - include ALL detailed actions, not just high-level stages
5. Be conversational and friendly

**RESPONSE FORMAT:**
After your conversational response, include a JSON block with the workflow update:
\`\`\`json
{
  "workflowUpdate": {
    "name": "Workflow Name",
    "description": "Brief description",
    "stages": [
      {
        "id": "stage_1",
        "name": "Stage Name",
        "order": 1,
        "steps": [
          {
            "id": "step_1",
            "name": "Step Name",
            "description": "Detailed description",
            "order": 1,
            "status": "added",
            "tasks": [
              {
                "id": "task_1",
                "name": "Specific Task Name",
                "description": "What needs to be done",
                "order": 1,
                "type": "manual",
                "status": "pending",
                "priority": "medium",
                "subtasks": [
                  {
                    "id": "subtask_1",
                    "name": "Detailed Subtask Action",
                    "order": 1,
                    "status": "pending"
                  },
                  {
                    "id": "subtask_2",
                    "name": "Another Subtask Action",
                    "order": 2,
                    "status": "pending"
                  }
                ],
                "checklists": [
                  {
                    "id": "checklist_1",
                    "item": "Verify specific requirement",
                    "order": 1,
                    "isChecked": false
                  },
                  {
                    "id": "checklist_2",
                    "item": "Confirm completion criteria",
                    "order": 2,
                    "isChecked": false
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "status": "building"
  }
}
\`\`\`

Current workflow state: ${currentWorkflow ? JSON.stringify(currentWorkflow) : "No workflow started yet"}

**DETAILED GUIDELINES:**
- **Stages**: Major phases (e.g., "Client Onboarding", "Execution", "Delivery")
- **Steps**: Key activities within each stage (e.g., "Gather Documents", "Prepare Engagement Letter")
- **Tasks**: Specific actions for each step (e.g., "Request Tax Returns", "Draft Letter")
- **Subtasks**: Granular sub-actions (e.g., "Email client request", "Set 7-day deadline")
- **Checklists**: Verification points (e.g., "✓ All forms received", "✓ Data validated")

**HIERARCHY DEPTH REQUIREMENTS:**
- Minimum: 2-3 stages, 3-5 steps per stage, 3-5 tasks per step, 2-4 subtasks per task, 2-4 checklists per task
- Mark status as "building" until user confirms completion
- Generate unique sequential IDs (stage_1, step_1_1, task_1_1_1, etc.)
- Use descriptive names that clearly indicate the action

**EXAMPLES OF COMPREHENSIVE WORKFLOWS:**
- "Tax Preparation": Include stages for intake, review, preparation, submission, each with detailed tasks/subtasks/checklists
- "Audit Process": Break down engagement, planning, fieldwork, reporting with full task decomposition
- "Payroll Processing": Detail every verification step, calculation task, and compliance checklist`;

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
    })
  );

  // Endpoint to save the completed workflow
  app.post("/api/agents/cadence/save-workflow", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { workflow, scope } = req.body;
      const userId = req.userId;
      const organizationId = req.user?.organizationId;

      if (!workflow || !workflow.name) {
        return res.status(400).json({ error: "Invalid workflow data" });
      }

      // Validate scope parameter
      const templateScope = scope === "global" ? "global" : "organization";

      // Save to database via storage layer
      const { storage } = await import("../../../server/storage");
      
      // First, create the workflow
      const savedWorkflow = await storage.createWorkflow({
        name: workflow.name,
        description: workflow.description || "",
        category: "custom",
        triggers: [],
        status: "draft",
        scope: templateScope,
        organizationId: templateScope === "organization" ? organizationId! : null,
        createdBy: userId!,
      });

      // Then create stages, steps, tasks, subtasks, and checklists hierarchically
      for (const stageData of workflow.stages || []) {
        const savedStage = await storage.createWorkflowStage({
          workflowId: savedWorkflow.id,
          name: stageData.name,
          description: stageData.description || "",
          order: stageData.order || 0,
        });

        for (const stepData of stageData.steps || []) {
          const savedStep = await storage.createWorkflowStep({
            stageId: savedStage.id,
            name: stepData.name,
            description: stepData.description || "",
            order: stepData.order || 0,
          });

          for (const taskData of stepData.tasks || []) {
            const savedTask = await storage.createWorkflowTask({
              stepId: savedStep.id,
              name: taskData.name,
              description: taskData.description || "",
              order: taskData.order || 0,
              type: taskData.type || "manual",
              status: taskData.status || "pending",
              priority: taskData.priority || "medium",
            });

            // Create subtasks
            for (const subtaskData of taskData.subtasks || []) {
              await storage.createTaskSubtask({
                taskId: savedTask.id,
                name: subtaskData.name,
                order: subtaskData.order || 0,
                status: subtaskData.status || "pending",
              });
            }

            // Create checklists
            for (const checklistData of taskData.checklists || []) {
              await storage.createTaskChecklist({
                taskId: savedTask.id,
                item: checklistData.item,
                order: checklistData.order || 0,
                isChecked: checklistData.isChecked || false,
              });
            }
          }
        }
      }

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

      // Get LLM configuration using middleware helper
      const llmConfig = await getLLMConfig({
        organizationId: req.user!.organizationId!,
        userId: req.user!.id
      });

      // Parse document using centralized FileParserService
      // This supports scanned PDFs via multimodal AI (OCR), unlike manual parsing
      const parsed = await FileParserService.parseFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        llmConfig
      );

      // Warn if scanned PDF detected
      if (parsed.isScannedPdf) {
        console.log(`[Cadence] Scanned PDF processed via OCR for org ${req.user!.organizationId}`);
      }

      const documentText = parsed.text;

      // Use AI to extract workflow structure
      const llmService = new LLMService(llmConfig);

      const systemPrompt = `You are Cadence, an AI workflow builder. You analyze documents containing workflow specifications and convert them into structured workflows with FULL hierarchy.

**YOUR TASK:**
1. Read the provided workflow document
2. Extract the COMPLETE hierarchical structure: Workflow > Stages > Steps > Tasks > Subtasks > Checklists
3. Identify all levels: stages, steps, tasks, subtasks, and checklist items
4. Return a complete workflow structure

**WORKFLOW STRUCTURE:**
{
  "name": "Workflow Name (derived from document)",
  "description": "Brief description",
  "stages": [
    {
      "id": "stage_1",
      "name": "Stage Name",
      "order": 0,
      "steps": [
        {
          "id": "step_1",
          "name": "Step Name",
          "description": "Step description",
          "order": 0,
          "status": "pending",
          "tasks": [
            {
              "id": "task_1",
              "name": "Task Name",
              "description": "Task description",
              "order": 0,
              "type": "manual",
              "status": "pending",
              "priority": "medium",
              "subtasks": [
                {
                  "id": "subtask_1",
                  "name": "Subtask Name",
                  "order": 0,
                  "status": "pending"
                }
              ],
              "checklists": [
                {
                  "id": "checklist_1",
                  "item": "Checklist item text",
                  "order": 0,
                  "isChecked": false
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "status": "complete"
}

**STRUCTURE EXTRACTION RULES:**
- **Workflow**: The top-level process name (document title)
- **Stages**: Major phases or numbered sections (e.g., "1. Engagement and Client Onboarding")
- **Steps**: High-level activities within each stage (can be derived from headings like "1.1 Engagement Letter")
- **Tasks**: Bulleted items under "Tasks:" heading
- **Subtasks**: Bulleted items under "Subtasks:" heading
- **Checklists**: Bullet points under "Checklists:" or "Checklist:" heading (use bullet symbol • as indicator)

**EXTRACTION PATTERNS:**
1. Numbered sections (e.g., "1. Section Name") → Stages
2. Sub-numbered items (e.g., "1.1 Activity") → Steps
3. Items under "Tasks:" → Tasks within the current step
4. Items under "Subtasks:" → Subtasks within the current task
5. Items under "Checklists:" or lines starting with "•" → Checklist items

**IMPORTANT:**
- Extract ALL levels from the document: stages, steps, tasks, subtasks, checklists
- Maintain the hierarchical order exactly as in the document
- Use descriptive names taken directly from the document
- Generate unique, sequential IDs (stage_1, step_1, task_1, etc.)
- If a section has tasks but no explicit steps, create a default step named after the section
- Set all statuses to "pending"
- Set priority to "medium" for all tasks
- Set type to "manual" for all tasks
- Set status to "complete" when extraction is done

**RESPONSE FORMAT:**
Respond with TWO parts separated by "---WORKFLOW_JSON---":
1. A brief summary of what you found (include counts of stages, steps, tasks, subtasks, checklists)
2. The complete workflow JSON

Example:
I extracted a complete workflow with 7 stages, 15 steps, 42 tasks, 28 subtasks, and 35 checklist items. Here's your structured workflow.
---WORKFLOW_JSON---
{"name":"Statutory Audit End-to-End Workflow","description":"Complete workflow...","stages":[...],"status":"complete"}`;

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
