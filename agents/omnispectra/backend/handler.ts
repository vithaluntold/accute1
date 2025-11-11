import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { OmniSpectraAgent } from "./index";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

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

      // Gather organization data for assignment tracking
      const [assignments, workflows, users, clients] = await Promise.all([
        storage.getWorkflowAssignmentsByOrganization(req.user!.organizationId!),
        storage.getWorkflowsByOrganization(req.user!.organizationId!),
        storage.getUsersByOrganization(req.user!.organizationId!),
        storage.getClientsByOrganization(req.user!.organizationId!)
      ]);

      // Build organization data context
      const organizationData = {
        assignments: assignments.map(a => ({
          id: a.id,
          workflowId: a.workflowId,
          clientId: a.clientId,
          assignedToId: a.assignedToId,
          status: a.status,
          currentStage: a.currentStage,
          dueDate: a.dueDate,
          completedAt: a.completedAt,
          createdAt: a.createdAt
        })),
        workflows: workflows.map(w => ({ id: w.id, name: w.name, status: w.status })),
        users: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role })),
        clients: clients.map(c => ({ id: c.id, name: c.name, status: c.status, type: c.type })),
      };

      // Use OmniSpectraAgent class with organization data
      const agent = new OmniSpectraAgent(llmConfig);
      const result = await agent.execute({ 
        message, 
        history, 
        context: { ...(context ?? {}), organizationData } 
      });

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
  
  app.post("/api/agents/omnispectra/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
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
          console.warn(`[OmniSpectra] Scanned PDF upload without LLM config - OCR unavailable for org ${req.user!.organizationId}`);
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

export default { registerRoutes };
