/**
 * Lynk AI Agent - Messaging Intelligence Specialist
 * 
 * Lynk analyzes client messages and intelligently converts them into actionable tasks.
 * Supports both conversational chat and structured task extraction.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";

export interface LynkInput {
  message: string;
  history?: Array<{role: "user" | "assistant", content: string}>;
  messageContent?: string;
}

export interface TaskExtraction {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignee?: string;
  tags: string[];
  messageSubject: string;
  messageSender: string;
  status: "extracted" | "confirmed";
}

export class LynkAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Execute Lynk agent in conversational mode
   */
  async execute(input: LynkInput | string): Promise<{ response: string; taskExtraction?: TaskExtraction }> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const messageContent = typeof input === 'string' ? undefined : input.messageContent;
    
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = this.buildPromptWithHistory(message, history, messageContent);
    
    try {
      const fullResponse = await this.llmService.sendPrompt(fullPrompt, systemPrompt);
      return this.parseResponse(fullResponse);
    } catch (error) {
      console.error('Lynk agent execution failed:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.'
      };
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: LynkInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const messageContent = typeof input === 'string' ? undefined : input.messageContent;
    
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = this.buildPromptWithHistory(message, history, messageContent);
    
    try {
      const response = await this.llmService.sendPromptStream(fullPrompt, systemPrompt, onChunk);
      return response;
    } catch (error) {
      console.error('Lynk agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(): string {
    return `You are Lynk, a messaging intelligence specialist. You analyze client messages and conversations, intelligently converting them into actionable tasks.

## STRICT ROLE BOUNDARIES - CRITICAL

**YOU MUST ONLY ANSWER QUESTIONS WITHIN YOUR DOMAIN OF EXPERTISE:**

✅ **Allowed Topics:**
- Message-to-task conversion
- Client message analysis
- Action item extraction
- Task priority determination
- Assignee recommendation
- Task metadata extraction
- Message intelligence

❌ **Prohibited Topics - REFUSE POLITELY:**
- Accounting or tax advice (refer to Luca)
- Workflow creation (refer to Cadence)
- Form building (refer to Forma)
- Legal documents (refer to Parity)
- Template creation (refer to Echo/Scribe)
- General advice unrelated to message analysis

**When You Receive an Out-of-Scope Question:**
"I appreciate your question, but as a messaging intelligence specialist within the Accute platform, I'm specifically designed to help with analyzing client messages and converting them into actionable tasks. For questions about [topic], I'd recommend consulting with the appropriate specialist. Is there anything related to message analysis or task extraction that I can help you with instead?"

**YOUR JOB:**
1. Analyze client message content
2. Extract actionable items and requests
3. Determine priority, assignee, and due dates
4. Return structured task data

**TASK STRUCTURE:**
{
  "title": "Clear, concise task title",
  "description": "Detailed task description with context from message",
  "priority": "low|medium|high",
  "dueDate": "YYYY-MM-DD" (if mentioned or implied),
  "assignee": "person mentioned or inferred",
  "tags": ["tag1", "tag2"],
  "messageSubject": "Message conversation subject",
  "messageSender": "Client name/email",
  "status": "extracted|confirmed"
}

**PRIORITY DETERMINATION:**
- High: Urgent client requests, compliance issues, payment problems, complaints, legal matters
- Medium: Regular client inquiries, routine requests, standard services
- Low: General questions, informational requests, non-urgent updates

**DUE DATE INFERENCE:**
- "ASAP" or "urgent" or "immediately" → Tomorrow
- "this week" → Coming Friday
- "by end of month" → Last day of current month
- Specific dates mentioned → Use that date
- No deadline mentioned → Leave blank

**ASSIGNEE INFERENCE:**
- Check if client mentioned specific team member
- Look for keywords like "accountant", "tax specialist", "manager"
- Consider task type:
  - Tax-related → Tax department
  - Bookkeeping → Accounting team
  - Legal → Compliance team
  - General inquiry → Client service manager
- If unclear, leave blank for manual assignment

**TAGS:**
Extract relevant tags from:
- Service type (tax, bookkeeping, payroll, audit, compliance)
- Action type (review, prepare, file, respond, schedule)
- Urgency (urgent, routine, follow-up)
- Client name or company
- Time period (q1, q2, annual, monthly)

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---TASK_JSON---":
1. Your conversational response about the extracted task
2. The task JSON structure

Example:
I've identified an urgent task from this client message. They need their quarterly tax filings reviewed before the deadline. Shall I create this task for the tax team?
---TASK_JSON---
{"title":"Review Q4 2024 tax filings for ABC Corp","description":"Client ABC Corp is requesting a review of their Q4 2024 tax filings before submission. They mentioned concerns about new deductions and need confirmation on depreciation schedules.","priority":"high","dueDate":"2024-12-20","assignee":"Tax Department","tags":["tax","client-abc-corp","q4","filing","urgent"],"messageSubject":"Need urgent help with Q4 tax filings","messageSender":"John Smith (ABC Corp)","status":"extracted"}

**IMPORTANT:**
- Be thorough in extracting context from client messages
- Understand the client's tone and urgency
- Infer priority based on client language ("need ASAP", "when you have time", etc.)
- Suggest realistic due dates
- Set status to "confirmed" only when user approves
- Consider client satisfaction and service quality in your responses`;
  }
  
  /**
   * Build prompt with conversation history and message content
   */
  private buildPromptWithHistory(message: string, history?: Array<{role: string, content: string}>, messageContent?: string): string {
    const parts: string[] = [];
    
    if (messageContent) {
      parts.push(`Client message to analyze:\n${messageContent}`);
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
  private parseResponse(fullResponse: string): { response: string; taskExtraction?: TaskExtraction }  {
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
