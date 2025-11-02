import type { Request, Response } from "express";
import type { Express } from "express";

export const registerRoutes = (app: Express) => {
  app.post("/api/agents/work-status-bot/chat", async (req: Request, res: Response) => {
    try {
      const { message, history, context } = req.body;
      
      const systemPrompt = `You are the Work Status Bot, an AI assistant that helps users manage work status updates and team availability.

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

**Context:**
${context ? `User context: ${JSON.stringify(context)}` : 'No additional context'}

**Conversation History:**
${history && history.length > 0 ? history.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n') : 'No previous messages'}

User: ${message}

Respond naturally and helpfully as the Work Status Bot.`;

      const response = {
        response: `Work Status Bot: I can help you manage work status! Here are some things I can do:

1. **Update your status** - Just tell me what you're doing (e.g., "I'm in a meeting")
2. **Check team availability** - Ask "Who's available on my team?"
3. **Status summaries** - "Give me a status summary of the Tax Team"
4. **Set status reminders** - "Remind me to update my status"

What would you like to do?`,
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
      console.error("Work Status Bot error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });
};

export default { registerRoutes };
