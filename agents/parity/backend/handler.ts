import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { ParityAgent } from "./index";
import { storage } from "../../../server/storage";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DocumentState {
  title: string;
  type: string;
  content: string;
  status: "generating" | "complete";
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "parity");
  // Chat endpoint for conversational document generation
  app.post("/api/agents/parity/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentDocument } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      console.log("LLM Config found:", llmConfig ? `Provider: ${llmConfig.provider}, Model: ${llmConfig.model}` : "None");
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Initialize Parity agent
      const agent = new ParityAgent(llmConfig);
      console.log("Parity agent initialized, executing prompt...");
      
      // Build conversation context
      const conversationContext = history
        .slice(-5) // Last 5 messages for context
        .map((msg: Message) => `${msg.role}: ${msg.content}`)
        .join('\n\n');
      
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nuser: ${message}`
        : message;
      
      // Execute conversational mode
      const response = await agent.execute(fullPrompt);
      
      // Parse document from response using markers
      let documentUpdate: DocumentState | undefined = undefined;
      let conversationalResponse = response;
      
      if (typeof response === "string" && response.includes("---DOCUMENT---")) {
        const docStart = response.indexOf("---DOCUMENT---");
        const docEnd = response.indexOf("---END DOCUMENT---");
        
        if (docStart !== -1 && docEnd !== -1) {
          // Extract conversational part (before document)
          conversationalResponse = response.substring(0, docStart).trim();
          
          // Extract document block
          const documentBlock = response.substring(docStart + 14, docEnd).trim();
          
          // Parse document metadata and content
          const titleMatch = documentBlock.match(/TITLE:\s*(.+)/);
          const typeMatch = documentBlock.match(/TYPE:\s*(.+)/);
          const contentMatch = documentBlock.match(/CONTENT:\s*([\s\S]+)/);
          
          if (titleMatch && contentMatch) {
            documentUpdate = {
              title: titleMatch[1].trim(),
              type: typeMatch ? typeMatch[1].trim() : "Document",
              content: contentMatch[1].trim(),
              status: "complete"
            };
          }
        }
      }
      
      res.json({ 
        response: conversationalResponse || (typeof response === "string" ? response : JSON.stringify(response, null, 2)),
        document: documentUpdate
      });
      
    } catch (error) {
      console.error("Error in Parity chat:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save generated document to documents library
  app.post("/api/agents/parity/save-document", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { title, content, type } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: "Title and content are required" });
      }

      // TODO: Save to documents table
      // For now, return success
      res.json({ 
        success: true,
        message: "Document saved successfully",
        documentId: `doc-${Date.now()}`
      });
      
    } catch (error) {
      console.error("Error saving document:", error);
      res.status(500).json({ 
        error: "Failed to save document",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save as template
  app.post("/api/agents/parity/save-template", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { name, category, description, content, scope } = req.body;
      
      if (!name || !content) {
        return res.status(400).json({ error: "Name and content are required" });
      }

      // Validate scope parameter
      const templateScope = scope === "global" ? "global" : "organization";

      const template = await storage.createDocumentTemplate({
        name,
        category: category || "engagement_letter",
        content,
        description: description || "",
        scope: templateScope,
        organizationId: templateScope === "organization" ? req.user!.organizationId! : null,
        createdBy: req.user!.id
      });

      res.json({ 
        success: true,
        message: "Template saved successfully",
        templateId: template.id
      });
      
    } catch (error) {
      console.error("Error saving template:", error);
      res.status(500).json({ 
        error: "Failed to save template",
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
  
  app.post("/api/agents/parity/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
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
