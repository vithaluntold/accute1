import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { LucaAgent } from "./index";
import { storage } from "../../../server/storage";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

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
  
  app.post("/api/agents/luca/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
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
          console.warn(`[Luca] Scanned PDF upload without LLM config - OCR unavailable for org ${req.user!.organizationId}`);
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
