import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { LLMService } from "../../../server/llm-service";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";

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

      // Initialize LLM service
      const llmService = new LLMService(llmConfig);
      
      const systemPrompt = `You are OmniSpectra, an AI assistant that helps users manage work status updates and team availability.

**Your Capabilities:**
1. Help users update their work status (Available, In Meeting, Busy, Away, Out of Office)
2. Check the status of team members and managers
3. Provide status summaries for teams or departments
4. Remind users about status update best practices
5. Suggest status messages based on context

**Guidelines:**
- Be concise and professional
- Suggest specific, helpful status messages
- Remind users to update their status when going into meetings or leaving
- Provide team availability insights when asked
- Help coordinate meetings by checking team availability
- Provide actionable suggestions

**Context:**
${context ? `User context: ${JSON.stringify(context)}` : 'No additional context'}`;

      // Build conversation context from history
      let conversationContext = '';
      if (history && history.length > 0) {
        conversationContext = history
          .slice(-4) // Last 4 messages for context
          .map((msg: Message) => `${msg.role}: ${msg.content}`)
          .join('\n\n');
      }
      
      // Combine context with current message
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nuser: ${message}`
        : message;

      // Call LLM service
      const responseText = await llmService.sendPrompt(fullPrompt, systemPrompt);

      const response = {
        response: responseText,
        suggestions: [
          "Update my status to In Meeting",
          "Who's available on my team?",
          "Show me team status",
          "Set my status to Away for 1 hour"
        ],
        timestamp: new Date().toISOString(),
      };
      
      res.json(response);
    } catch (error) {
      console.error("OmniSpectra error:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};

export default { registerRoutes };
