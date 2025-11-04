/**
 * Relay AI Agent - Inbox Intelligence Specialist
 * 
 * Relay analyzes emails and intelligently converts them into actionable tasks.
 * Supports both conversational chat and structured task extraction.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";

export interface RelayInput {
  message: string;
  history?: Array<{role: "user" | "assistant", content: string}>;
  emailContent?: string;
}

export interface TaskExtraction {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignee?: string;
  tags: string[];
  emailSubject: string;
  emailSender: string;
  status: "extracted" | "confirmed";
}

export class RelayAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Execute Relay agent in conversational mode
   */
  async execute(input: RelayInput | string): Promise<{ response: string; taskExtraction?: TaskExtraction }> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const emailContent = typeof input === 'string' ? undefined : input.emailContent;
    
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = this.buildPromptWithHistory(message, history, emailContent);
    
    try {
      const fullResponse = await this.llmService.sendPrompt(fullPrompt, systemPrompt);
      return this.parseResponse(fullResponse);
    } catch (error) {
      console.error('Relay agent execution failed:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.'
      };
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: RelayInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const emailContent = typeof input === 'string' ? undefined : input.emailContent;
    
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = this.buildPromptWithHistory(message, history, emailContent);
    
    try {
      const response = await this.llmService.sendPromptStream(fullPrompt, systemPrompt, onChunk);
      return response;
    } catch (error) {
      console.error('Relay agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(): string {
    return `You are Relay, an inbox intelligence specialist. You analyze emails and intelligently convert them into actionable tasks.

**YOUR JOB:**
1. Analyze email content
2. Extract actionable items and tasks
3. Determine priority, assignee, and due dates
4. Return structured task data

**TASK STRUCTURE:**
{
  "title": "Clear, concise task title",
  "description": "Detailed task description with context from email",
  "priority": "low|medium|high",
  "dueDate": "YYYY-MM-DD" (if mentioned or implied),
  "assignee": "person mentioned or inferred",
  "tags": ["tag1", "tag2"],
  "emailSubject": "Original email subject",
  "emailSender": "sender@email.com",
  "status": "extracted|confirmed"
}

**PRIORITY DETERMINATION:**
- High: Urgent deadlines, legal/compliance, payment issues, client complaints
- Medium: Regular requests, routine work, upcoming deadlines (>3 days)
- Low: FYI emails, long-term items, optional tasks

**DUE DATE INFERENCE:**
- "ASAP" or "urgent" → Tomorrow
- "by end of week" → Coming Friday
- "by end of month" → Last day of current month
- Specific dates mentioned → Use that date
- No deadline mentioned → Leave blank

**ASSIGNEE INFERENCE:**
- Look for names mentioned in email
- Check CC/To fields for team members
- Look for phrases like "can you", "@person"
- If unclear, suggest based on task type

**TAGS:**
Extract relevant tags from:
- Email category (invoice, compliance, tax, audit)
- Action type (review, approve, follow-up, document)
- Department (accounting, legal, hr)
- Client/project names

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---TASK_JSON---":
1. Your conversational response about the extracted task
2. The task JSON structure

Example:
I've identified a high-priority task from this client request. They need tax documents by Friday. Shall I create this task?
---TASK_JSON---
{"title":"Prepare Q4 2024 tax documents for ABC Corp","description":"Client ABC Corp requested Q4 2024 tax documents for their annual filing. Documents should include income statements, expense reports, and depreciation schedules.","priority":"high","dueDate":"2024-12-15","assignee":"John Smith","tags":["tax","client-abc-corp","q4","filing"],"emailSubject":"Q4 Tax Documents Needed","emailSender":"client@abccorp.com","status":"extracted"}

**IMPORTANT:**
- Be thorough in extracting context
- Infer priority intelligently
- Suggest realistic due dates
- Set status to "confirmed" only when user approves`;
  }
  
  /**
   * Build prompt with conversation history and email content
   */
  private buildPromptWithHistory(message: string, history?: Array<{role: string, content: string}>, emailContent?: string): string {
    const parts: string[] = [];
    
    if (emailContent) {
      parts.push(`Email to analyze:\n${emailContent}`);
    }
    
    if (history && history.length > 0) {
      const conversationContext = history
        .slice(-4)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');
      parts.push(conversationContext);
    }
    
    parts.push(`user: ${message}`);
    
    return parts.join('\n\n');
  }
  
  /**
   * Parse LLM response to extract task JSON
   */
  private parseResponse(fullResponse: string): { response: string; taskExtraction?: TaskExtraction } {
    let responseText = fullResponse;
    let taskExtraction: TaskExtraction | undefined = undefined;

    if (fullResponse.includes("---TASK_JSON---")) {
      const parts = fullResponse.split("---TASK_JSON---");
      responseText = parts[0].trim();
      
      try {
        const jsonPart = parts[1].trim();
        taskExtraction = JSON.parse(jsonPart);
      } catch (e) {
        console.error("Failed to parse task JSON:", e);
      }
    }

    return {
      response: responseText,
      taskExtraction
    };
  }
}

export { registerRoutes } from "./handler";
