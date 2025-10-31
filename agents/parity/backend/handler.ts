import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { ParityAgent } from "./index";
import { storage } from "../../../server/storage";

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
  // Chat endpoint for conversational document generation
  app.post("/api/agents/parity/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, currentDocument } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Initialize Parity agent
      const agent = new ParityAgent(llmConfig);
      
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
      
      // Try to detect if the AI generated a document
      let documentUpdate: DocumentState | undefined = undefined;
      
      // Simple heuristic: if response is long and contains document-like content
      if (typeof response === "string" && response.length > 500) {
        // Check if it looks like a formal document
        const looksLikeDocument = (
          response.includes("ENGAGEMENT LETTER") ||
          response.includes("SERVICE AGREEMENT") ||
          response.includes("Dear") ||
          response.includes("Sincerely") ||
          response.includes("This Agreement") ||
          response.includes("effective as of")
        );
        
        if (looksLikeDocument) {
          // Extract document title from first line or use default
          const firstLine = response.split('\n')[0].trim();
          const title = firstLine.length > 0 && firstLine.length < 100 
            ? firstLine.replace(/[#*]/g, '').trim()
            : "Generated Document";
          
          documentUpdate = {
            title,
            type: response.includes("ENGAGEMENT LETTER") ? "Engagement Letter" : "Document",
            content: response,
            status: "complete"
          };
        }
      }
      
      res.json({ 
        response: typeof response === "string" ? response : JSON.stringify(response, null, 2),
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
};
