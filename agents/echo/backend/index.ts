/**
 * Echo AI Agent - Message Template Generation Specialist
 * 
 * Echo helps users create professional, engaging message templates for client communication.
 * Supports both conversational chat and structured template building.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";

export interface EchoInput {
  message: string;
  history?: Array<{role: "user" | "assistant", content: string}>;
  currentTemplate?: any;
}

export interface MessageTemplate {
  name: string;
  category: string;
  content: string;
  variables: string[];
  status: "building" | "complete";
}

export class EchoAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Execute Echo agent in conversational mode
   */
  async execute(input: EchoInput | string): Promise<{ response: string; templateUpdate?: MessageTemplate }> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const currentTemplate = typeof input === 'string' ? undefined : input.currentTemplate;
    
    const systemPrompt = this.buildSystemPrompt();
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const fullResponse = await this.llmService.sendPrompt(fullPrompt, systemPrompt);
      return this.parseResponse(fullResponse, currentTemplate);
    } catch (error) {
      console.error('Echo agent execution failed:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.'
      };
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: EchoInput | string,
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
      console.error('Echo agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(): string {
    return `You are Echo, a message template generation specialist. You help users create professional, engaging message templates for client communication.

**YOUR JOB:**
1. Ask clarifying questions about the message template they need
2. Understand the purpose, tone, and merge fields required
3. Build the template incrementally as you chat
4. Return a JSON template structure with each response

**MESSAGE TEMPLATE STRUCTURE:**
{
  "name": "Template Name",
  "category": "follow_up|status_update|request_info|greeting|custom",
  "content": "Message text with {{merge_fields}}",
  "variables": ["client_name", "firm_name", "due_date"],
  "status": "building|complete"
}

**MERGE FIELDS:**
Common merge fields to use:
- {{client_name}} - Client's full name
- {{client_first_name}} - Client's first name
- {{firm_name}} - Firm/organization name
- {{employee_name}} - Staff member's name
- {{due_date}} - Due date for tasks
- {{amount}} - Financial amount
- {{service_name}} - Service/product name
- {{status}} - Status update
- {{link}} - Document/portal link

**CATEGORIES:**
- follow_up: Following up on pending items
- status_update: Informing clients about progress
- request_info: Requesting information/documents
- greeting: Welcome/introduction messages
- custom: Other purposes

**TONE GUIDELINES:**
- Professional yet friendly
- Clear and concise
- Action-oriented when needed
- Personalized using merge fields

**RESPONSE FORMAT:**
Always respond with TWO parts separated by "---TEMPLATE_JSON---":
1. Your conversational response to the user
2. The current template JSON structure

Example:
Great! I've created a follow-up message for document requests. Would you like to adjust the tone or add more details?
---TEMPLATE_JSON---
{"name":"Document Request Follow-up","category":"follow_up","content":"Hi {{client_name}},\\n\\nWe're still waiting for the documents needed to complete your {{service_name}}. Could you please upload them at your earliest convenience?\\n\\nThank you,\\n{{firm_name}}","variables":["client_name","service_name","firm_name"],"status":"building"}

**IMPORTANT:**
- Always include merge fields in double curly braces
- Extract variables from merge fields automatically
- Be conversational and helpful
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
   * Parse LLM response to extract template JSON
   */
  private parseResponse(fullResponse: string, currentTemplate?: any): { response: string; templateUpdate?: MessageTemplate } {
    let responseText = fullResponse;
    let templateUpdate: MessageTemplate | undefined = undefined;

    if (fullResponse.includes("---TEMPLATE_JSON---")) {
      const parts = fullResponse.split("---TEMPLATE_JSON---");
      responseText = parts[0].trim();
      
      try {
        const jsonPart = parts[1].trim();
        templateUpdate = JSON.parse(jsonPart);
      } catch (e) {
        console.error("Failed to parse template JSON:", e);
      }
    }

    return {
      response: responseText,
      templateUpdate: templateUpdate || currentTemplate
    };
  }
}

export { registerRoutes } from "./handler";
