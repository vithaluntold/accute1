import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { withLLMConfig, getLLMConfig } from "../../../server/middleware/agent-llm-middleware";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { LynkAgent } from "./index";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "lynk");

  // Chat endpoint for conversational message processing
  app.post("/api/agents/lynk/chat", requireAuth, 
    withLLMConfig(async (req, res, llmConfig) => {
      try {
        const { message, history, messageContent } = req.body;

        // Use LynkAgent class with LLM config from middleware
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
    })
  );

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

  // File upload and parsing endpoint
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain'
      ];
      allowedMimes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
    }
  });
  
  app.post("/api/agents/lynk/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ 
          error: err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' 
            ? 'File too large. Maximum size is 10MB.' 
            : err.message || 'Invalid file upload'
        });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Get LLM config (optional - only needed for scanned PDF OCR)
        const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
        
        const parsed = await FileParserService.parseFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          llmConfig || undefined
        );

        // Warn if scanned PDF detected without LLM config
        if (parsed.isScannedPdf && !llmConfig) {
          console.warn(`[Lynk] Scanned PDF upload without LLM config - OCR unavailable for org ${req.user!.organizationId}`);
        }

        res.json({ 
          success: true,
          extractedText: parsed.text,
          filename: parsed.filename,
          metadata: parsed.metadata
        });
      } catch (error: any) {
        console.error("File parsing error:", error);
        res.status(500).json({ error: error.message || "Failed to parse file" });
      }
    });
  });
};
