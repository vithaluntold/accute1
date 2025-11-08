import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { insertEmailTemplateSchema } from "../../../shared/schema";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { ScribeAgent } from "./index";
import { getLLMConfigService } from "../../../server/llm-config-service";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "scribe");

  // Chat endpoint for conversational email template building
  app.post("/api/agents/scribe/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentTemplate, llmConfigId } = req.body;
      
      // Get LLM configuration using centralized service
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getConfig(req.user!.organizationId!, llmConfigId);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Use ScribeAgent class
      const agent = new ScribeAgent(llmConfig);
      const result = await agent.execute({ message, history, currentTemplate });

      res.json({ 
        response: result.response,
        templateUpdate: result.templateUpdate
      });
      
    } catch (error) {
      console.error("Error in Scribe chat:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save email template
  app.post("/api/agents/scribe/save-template", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const templateScope = req.body.scope === "global" ? "global" : "organization";
      
      const templateData = {
        name: req.body.name,
        subject: req.body.subject,
        body: req.body.body,
        category: req.body.category || "custom",
        variables: req.body.variables || [],
        scope: templateScope,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id,
        isActive: true,
        usageCount: 0,
        metadata: req.body.metadata || {}
      };

      const validationResult = insertEmailTemplateSchema.safeParse(templateData);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid email template data",
          details: validationResult.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const template = await storage.createEmailTemplate({
        ...validationResult.data,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id
      });

      res.json({ 
        success: true,
        message: "Email template saved successfully",
        templateId: template.id
      });
      
    } catch (error) {
      console.error("Error saving email template:", error);
      res.status(500).json({ 
        error: "Failed to save email template",
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
  
  app.post("/api/agents/scribe/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
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

        const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
        
        const parsed = await FileParserService.parseFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          llmConfig || undefined
        );

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
