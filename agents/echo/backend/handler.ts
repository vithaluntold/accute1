import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { withLLMConfig, getLLMConfig } from "../../../server/middleware/agent-llm-middleware";
import { insertMessageTemplateSchema } from "../../../shared/schema";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { EchoAgent } from "./index";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "echo");

  // Chat endpoint for conversational message template building
  app.post("/api/agents/echo/chat", requireAuth, 
    withLLMConfig(async (req, res, llmConfig) => {
      try {
        const { message, history, currentTemplate } = req.body;

        // Use EchoAgent class with LLM config from middleware
        const agent = new EchoAgent(llmConfig);
      const result = await agent.execute({ message, history, currentTemplate });

      res.json({ 
        response: result.response,
        templateUpdate: result.templateUpdate
      });
      
      } catch (error) {
        console.error("Error in Echo chat:", error);
        res.status(500).json({ 
          error: "Failed to process message",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    })
  );

  // Save message template
  app.post("/api/agents/echo/save-template", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const templateScope = req.body.scope === "global" ? "global" : "organization";
      
      const templateData = {
        name: req.body.name,
        category: req.body.category || "custom",
        content: req.body.content,
        variables: req.body.variables || [],
        scope: templateScope,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id,
        isActive: true,
        isDefault: false,
        usageCount: 0,
        metadata: req.body.metadata || {}
      };

      const validationResult = insertMessageTemplateSchema.safeParse(templateData);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid message template data",
          details: validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const template = await storage.createMessageTemplate({
        ...validationResult.data,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id
      });

      res.json({ 
        success: true,
        message: "Message template saved successfully",
        templateId: template.id
      });
      
    } catch (error) {
      console.error("Error saving message template:", error);
      res.status(500).json({ 
        error: "Failed to save message template",
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
  
  app.post("/api/agents/echo/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
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
        const llmConfig = await getLLMConfig({
          organizationId: req.user!.organizationId!,
          userId: req.user!.id
        }).catch(() => null);
        
        const parsed = await FileParserService.parseFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          llmConfig || undefined
        );

        // Warn if scanned PDF detected without LLM config
        if (parsed.isScannedPdf && !llmConfig) {
          console.warn(`[Echo] Scanned PDF upload without LLM config - OCR unavailable for org ${req.user!.organizationId}`);
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
