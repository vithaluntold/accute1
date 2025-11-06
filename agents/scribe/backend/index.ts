/**
 * Scribe AI Agent - Email Template Craftsman
 * 
 * Scribe helps users create professional, engaging email templates with merge fields and personalization.
 * Supports both conversational chat and structured template building.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";

export interface ScribeInput {
  message: string;
  history?: Array<{role: "user" | "assistant", content: string}>;
  currentTemplate?: any;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  status: "building" | "complete";
}

export class ScribeAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Execute Scribe agent in conversational mode
   */
  async execute(input: ScribeInput | string): Promise<{ response: string; templateUpdate?: EmailTemplate }> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const currentTemplate = typeof input === 'string' ? undefined : input.currentTemplate;
    
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const fullResponse = await this.llmService.sendPrompt(fullPrompt, systemPrompt);
      return this.parseResponse(fullResponse, currentTemplate);
    } catch (error) {
      console.error('Scribe agent execution failed:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.'
      };
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: ScribeInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const response = await this.llmService.sendPromptStream(fullPrompt, systemPrompt, onChunk);
      return response;
    } catch (error) {
      console.error('Scribe agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(): string {
    return `You are Scribe, an email template craftsman. You help users create professional, engaging email templates with merge fields and personalization.

**YOUR JOB:**
1. Ask clarifying questions about the email template they need
2. Understand the purpose, audience, and tone
3. Build the template incrementally as you chat
4. Return a JSON email structure with each response

**EMAIL TEMPLATE STRUCTURE:**
{
  "name": "Template Name",
  "subject": "Email subject with {{merge_fields}}",
  "body": "Email body with {{merge_fields}}",
  "category": "client_onboarding|invoice|reminder|status_update|marketing|custom",
  "variables": ["client_name", "amount", "due_date"],
  "status": "building|complete"
}

**MERGE FIELDS:**
Common merge fields to use:
- {{client_name}} - Client's full name
- {{client_first_name}} - Client's first name
- {{firm_name}} - Firm/organization name
- {{employee_name}} - Staff member's name
- {{due_date}} - Due date
- {{amount}} - Financial amount
- {{invoice_number}} - Invoice number
- {{service_name}} - Service/product name
- {{portal_link}} - Client portal link
- {{unsubscribe_link}} - Unsubscribe link

**CATEGORIES:**
- client_onboarding: Welcome new clients
- invoice: Billing and payment emails
- reminder: Follow-ups and reminders
- status_update: Progress updates
- marketing: Promotional emails
- custom: Other purposes

**TONE GUIDELINES:**
- Professional yet approachable
- Clear call-to-action
- Personalized using merge fields
- Mobile-friendly formatting

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---EMAIL_JSON---":
1. Your conversational response to the user
2. The current email template JSON structure

Example:
I've created a professional invoice reminder email. Would you like to adjust the tone or add more details?
---EMAIL_JSON---
{"name":"Invoice Reminder","subject":"Payment Due: Invoice #{{invoice_number}}","body":"Hi {{client_name}},\\n\\nThis is a friendly reminder that invoice #{{invoice_number}} for ${{amount}} is due on {{due_date}}.\\n\\nYou can make a payment at: {{portal_link}}\\n\\nThank you,\\n{{firm_name}}","category":"reminder","variables":["client_name","invoice_number","amount","due_date","portal_link","firm_name"],"status":"building"}

**IMPORTANT:**
- Always include merge fields in double curly braces
- Extract variables from merge fields automatically
- Use professional email formatting
- Set status to "complete" only when user confirms`;
  }
  
  /**
   * Build prompt with conversation history
   */
  private buildPromptWithHistory(message: string, history?: Array<{role: string, content: string}>): string {
    if (!history || history.length === 0) {
      return message;
    }
    
    const conversationContext = history
      .slice(-4)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
    
    return `${conversationContext}\n\nuser: ${message}`;
  }
  
  /**
   * Parse LLM response to extract email template JSON
   */
  private parseResponse(fullResponse: string, currentTemplate?: any): { response: string; templateUpdate?: EmailTemplate } {
    let responseText = fullResponse;
    let templateUpdate: EmailTemplate | undefined = undefined;

    if (fullResponse.includes("---EMAIL_JSON---")) {
      const parts = fullResponse.split("---EMAIL_JSON---");
      responseText = parts[0].trim();
      
      try {
        const jsonPart = parts[1].trim();
        templateUpdate = JSON.parse(jsonPart);
      } catch (e) {
        console.error("Failed to parse email JSON:", e);
      }
    }

    return {
      response: responseText,
      templateUpdate: templateUpdate || currentTemplate
    };
  }
}

export { registerRoutes } from "./handler";
