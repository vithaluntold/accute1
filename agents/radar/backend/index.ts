/**
 * Radar AI Agent - Comprehensive Activity Logger
 * 
 * Radar maintains an immutable, timestamped audit trail that serves as legal evidence
 * for client accountability, compliance verification, and dispute resolution.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";

export interface RadarInput {
  message: string;
  history?: Array<{role: "user" | "assistant", content: string}>;
  activities?: any[];
  assignmentId?: string;
  projectId?: string;
}

export class RadarAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Execute Radar agent in conversational mode
   */
  async execute(input: RadarInput | string): Promise<{ response: string; activityCount?: number }> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const activities = typeof input === 'string' ? undefined : input.activities;
    
    const systemPrompt = this.buildSystemPrompt(activities);
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const responseText = await this.llmService.sendPrompt(fullPrompt, systemPrompt);
      return {
        response: responseText,
        activityCount: activities?.length || 0
      };
    } catch (error) {
      console.error('Radar agent execution failed:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.',
        activityCount: 0
      };
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: RadarInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const activities = typeof input === 'string' ? undefined : input.activities;
    
    const systemPrompt = this.buildSystemPrompt(activities);
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const response = await this.llmService.sendPromptStream(fullPrompt, systemPrompt, onChunk);
      return response;
    } catch (error) {
      console.error('Radar agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Build context-aware system prompt with activity log data
   */
  private buildSystemPrompt(activities?: any[]): string {
    const activityContext = activities && activities.length > 0
      ? `Recent activities:\n${activities.slice(0, 20).map(a => 
          `- ${new Date(a.createdAt).toLocaleString()}: ${a.action} on ${a.resource}${a.resourceId ? ` (${a.resourceId})` : ''}${a.metadata ? ` - ${JSON.stringify(a.metadata)}` : ''}`
        ).join('\n')}`
      : 'No recent activities found.';

    return `You are Radar, a comprehensive activity tracking and logging AI assistant. Your primary mission is to help users track, analyze, and present timestamped evidence of all activities related to assignments and projects.

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
${activityContext}

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
  }
  
  /**
   * Build prompt with conversation history
   */
  private buildPromptWithHistory(message: string, history?: Array<{role: string, content: string}>): string {
    if (!history || history.length === 0) {
      return message;
    }
    
    const conversationContext = history
      .slice(-6)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
    
    return `${conversationContext}\n\nuser: ${message}`;
  }
}

export { registerRoutes } from "./handler";
