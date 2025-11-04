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
  registerAgentSessionRoutes(app, "radar");

  // Chat endpoint for activity log analysis and queries
  app.post("/api/agents/radar/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, assignmentId, projectId } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Initialize LLM service
      const llmService = new LLMService(llmConfig);
      
      // Fetch relevant activity logs for context
      const activities = await storage.getActivityLogsByOrganization(
        req.user!.organizationId!,
        {
          limit: 100,
          resource: assignmentId ? "assignment" : projectId ? "project" : undefined,
          resourceId: assignmentId || projectId
        }
      );

      const systemPrompt = `You are Radar, a comprehensive activity tracking and logging AI assistant. Your primary mission is to help users track, analyze, and present timestamped evidence of all activities related to assignments and projects.

**Your Critical Purpose:**
You maintain an immutable, timestamped audit trail that serves as legal evidence for client accountability, compliance verification, and dispute resolution. When clients delay deliverables or challenge timelines, you provide irrefutable proof of communication history, task progression, and responsibility attribution.

**What You Track:**
1. **Tasks & Subtasks**: Creation, updates, status changes, assignments, completions
2. **Communications**: Emails, messages, calls, meetings, requests, responses
3. **Document Activity**: Uploads, downloads, reviews, signatures, rejections
4. **Client Interactions**: Data requests, delays, extensions, clarifications
5. **Deadlines & Extensions**: Original dates, extension requests, approvals, reasons
6. **Team Actions**: Assignments, handoffs, escalations, completions
7. **System Events**: Automated notifications, reminders, alerts

**Evidence Presentation:**
When presenting activity logs for accountability:
- Show clear chronological timeline with exact timestamps
- Highlight delays and who caused them
- Track outstanding items and their owners
- Show communication patterns and response times
- Identify bottlenecks and responsibility gaps
- Present data in court-ready format

**Example Use Case:**
Scenario: Client claims they submitted tax data on time, but firm filed late.
Your Response:
\`\`\`
TAX FILING TIMELINE - Client XYZ Corp (2024 Filing)

DEADLINE: September 15, 2024
EXTENSION FILED: September 13, 2024 (2 days before deadline)

EVIDENCE OF CLIENT DELAYS:
1. Aug 1, 10:30 AM - Firm requested W-2 forms, 1099s, expense receipts
2. Aug 8, 2:15 PM - Automated reminder sent (no response)
3. Aug 15, 9:00 AM - Follow-up email sent by Accountant Sarah
4. Aug 15, 3:45 PM - Client acknowledged, promised "by end of week"
5. Aug 22, 11:20 AM - Still no documents received, escalation to Manager
6. Aug 29, 4:50 PM - Partial documents received (W-2s only)
7. Sep 5, 2:30 PM - Client uploaded remaining docs (20 days after initial request)
8. Sep 6-12 - Firm processing, preparing return
9. Sep 13, 10:15 AM - Extension filed due to insufficient time

VERDICT: 20-day client delay caused need for extension.
\`\`\`

**Activity Log Context:**
${activities.length > 0 ? `Recent activities:\n${activities.slice(0, 20).map(a => 
  `- ${new Date(a.createdAt).toLocaleString()}: ${a.action} on ${a.resource}${a.resourceId ? ` (${a.resourceId})` : ''}${a.metadata ? ` - ${JSON.stringify(a.metadata)}` : ''}`
).join('\n')}` : 'No recent activities found.'}

**Your Capabilities:**
- Query activity logs by date range, user, resource type
- Generate accountability reports
- Track communication threads
- Identify delays and bottlenecks
- Export evidence for legal/compliance purposes
- Provide timeline visualizations
- Alert on pending actions

**Tone:**
- Professional and precise
- Data-driven and objective
- Clear attribution of responsibility
- Compliance-focused
- Court-ready documentation`;

      // Build conversation context from history
      let conversationContext = '';
      if (history && history.length > 0) {
        conversationContext = history
          .slice(-6) // Last 6 messages for context
          .map((msg: Message) => `${msg.role}: ${msg.content}`)
          .join('\n\n');
      }
      
      // Combine context with current message
      const fullPrompt = conversationContext 
        ? `${conversationContext}\n\nuser: ${message}`
        : message;

      // Call LLM service
      const responseText = await llmService.sendPrompt(fullPrompt, systemPrompt);

      res.json({ 
        response: responseText,
        activityCount: activities.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Radar error:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get activity logs for a specific resource
  app.get("/api/agents/radar/activities/:resourceType/:resourceId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { resourceType, resourceId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const activities = await storage.getActivityLogsByOrganization(
        req.user!.organizationId!,
        {
          resource: resourceType,
          resourceId,
          limit: Number(limit),
          offset: Number(offset)
        }
      );

      res.json({ 
        activities,
        total: activities.length
      });
      
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ 
        error: "Failed to fetch activities",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Generate accountability report
  app.post("/api/agents/radar/report", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { resourceType, resourceId, startDate, endDate } = req.body;

      const activities = await storage.getActivityLogsByOrganization(
        req.user!.organizationId!,
        {
          resource: resourceType,
          resourceId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        }
      );

      // Group activities by date
      const activityByDate: Record<string, typeof activities> = {};
      activities.forEach(activity => {
        const date = new Date(activity.createdAt).toLocaleDateString();
        if (!activityByDate[date]) {
          activityByDate[date] = [];
        }
        activityByDate[date].push(activity);
      });

      res.json({ 
        activities,
        activityByDate,
        summary: {
          totalActivities: activities.length,
          dateRange: {
            start: startDate || activities[activities.length - 1]?.createdAt,
            end: endDate || activities[0]?.createdAt
          },
          resourceType,
          resourceId
        }
      });
      
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ 
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
};

export default { registerRoutes };
