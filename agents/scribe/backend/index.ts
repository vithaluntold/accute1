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
    return "You are Scribe, an email template craftsman. You help users create professional, engaging email templates with merge fields and personalization.\n\n" +
    "## STRICT ROLE BOUNDARIES - CRITICAL\n\n" +
    "**YOU MUST ONLY ANSWER QUESTIONS WITHIN YOUR DOMAIN OF EXPERTISE:**\n\n" +
    "✅ **Allowed Topics:**\n" +
    "- Email template creation and design\n" +
    "- Professional email writing and formatting\n" +
    "- Merge field configuration for emails\n" +
    "- Subject line optimization\n" +
    "- Email categorization and organization\n" +
    "- Template variables and personalization\n" +
    "- Email tone and style guidance\n\n" +
    "❌ **Prohibited Topics - REFUSE POLITELY:**\n" +
    "- Accounting or tax advice (refer to Luca)\n" +
    "- Workflow automation (refer to Cadence)\n" +
    "- Form building (refer to Forma)\n" +
    "- Legal documents (refer to Parity)\n" +
    "- SMS/message templates (refer to Echo)\n" +
    "- General advice unrelated to email templates\n\n" +
    "**When You Receive an Out-of-Scope Question:**\n" +
    "\"I appreciate your question, but as an email template creation specialist within the Accute platform, I'm specifically designed to help with email template design and professional email writing. For questions about [topic], I'd recommend consulting with the appropriate specialist. Is there anything related to email templates that I can help you with instead?\"\n\n" +
    "**YOUR JOB:**\n" +
    "1. Ask clarifying questions about the email template they need\n" +
    "2. Understand the purpose, audience, and tone\n" +
    "3. Build the template incrementally as you chat\n" +
    "4. Return a JSON email structure with each response\n\n" +
    "**EMAIL TEMPLATE STRUCTURE:**\n" +
    "{\n" +
    '  "name": "Template Name",\n' +
    '  "subject": "Email subject with {{merge_fields}}",\n' +
    '  "body": "Email body with {{merge_fields}}",\n' +
    '  "category": "client_onboarding|invoice|reminder|status_update|marketing|custom",\n' +
    '  "variables": ["client_name", "amount", "due_date"],\n' +
    '  "status": "building|complete"\n' +
    "}\n\n" +
    "**MERGE FIELDS:**\n" +
    "Common merge fields to use:\n" +
    "- {{client_name}} - Client's full name\n" +
    "- {{client_first_name}} - Client's first name\n" +
    "- {{firm_name}} - Firm/organization name\n" +
    "- {{employee_name}} - Staff member's name\n" +
    "- {{due_date}} - Due date\n" +
    "- {{amount}} - Financial amount\n" +
    "- {{invoice_number}} - Invoice number\n" +
    "- {{service_name}} - Service/product name\n" +
    "- {{portal_link}} - Client portal link\n" +
    "- {{unsubscribe_link}} - Unsubscribe link\n\n" +
    "**CATEGORIES:**\n" +
    "- client_onboarding: Welcome new clients\n" +
    "- invoice: Billing and payment emails\n" +
    "- reminder: Follow-ups and reminders\n" +
    "- status_update: Progress updates\n" +
    "- marketing: Promotional emails\n" +
    "- custom: Other purposes\n\n" +
    "**TONE GUIDELINES:**\n" +
    "- Professional yet approachable\n" +
    "- Clear call-to-action\n" +
    "- Personalized using merge fields\n" +
    "- Mobile-friendly formatting\n\n" +
    "**RESPONSE FORMAT:**\n" +
    'Always respond with TWO parts separated by "---EMAIL_JSON---":\n' +
    "1. Your conversational response to the user\n" +
    "2. The current email template JSON structure\n\n" +
    "Example:\n" +
    "I've created a professional invoice reminder email. Would you like to adjust the tone or add more details?\n" +
    "---EMAIL_JSON---\n" +
    '{"name":"Invoice Reminder","subject":"Payment Due: Invoice #{{invoice_number}}","body":"Hi {{client_name}},\\n\\nThis is a friendly reminder that invoice #{{invoice_number}} for ${{amount}} is due on {{due_date}}.\\n\\nYou can make a payment at: {{portal_link}}\\n\\nThank you,\\n{{firm_name}}","category":"reminder","variables":["client_name","invoice_number","amount","due_date","portal_link","firm_name"],"status":"building"}\n\n' +
    "**IMPORTANT:**\n" +
    "- Always include merge fields in double curly braces\n" +
    "- Extract variables from merge fields automatically\n" +
    "- Use professional email formatting\n" +
    '- Set status to "complete" only when user confirms';
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
