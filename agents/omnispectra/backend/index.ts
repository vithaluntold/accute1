/**
 * OmniSpectra AI Agent - Work Status Tracking and Team Availability
 * 
 * OmniSpectra helps users manage work status updates and team availability.
 * Provides insights into team status, availability, and coordination.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";

export interface OmniSpectraInput {
  message: string;
  history?: Array<{role: "user" | "assistant", content: string}>;
  context?: any;
}

export class OmniSpectraAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Execute OmniSpectra agent in conversational mode
   */
  async execute(input: OmniSpectraInput | string): Promise<{ response: string; suggestions?: string[] }> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const context = typeof input === 'string' ? undefined : input.context;
    
    const systemPrompt = this.buildSystemPrompt(context);
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const responseText = await this.llmService.sendPrompt(fullPrompt, systemPrompt);
      return {
        response: responseText,
        suggestions: [
          "Update my status to In Meeting",
          "Who's available on my team?",
          "Show me team status",
          "Set my status to Away for 1 hour"
        ]
      };
    } catch (error) {
      console.error('OmniSpectra agent execution failed:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.',
        suggestions: []
      };
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: OmniSpectraInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const context = typeof input === 'string' ? undefined : input.context;
    
    const systemPrompt = this.buildSystemPrompt(context);
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const response = await this.llmService.sendPromptStream(fullPrompt, systemPrompt, onChunk);
      return response;
    } catch (error) {
      console.error('OmniSpectra agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(context?: any): string {
    return `You are OmniSpectra, an AI assistant that helps users manage work status updates and team availability.

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
}

export { registerRoutes } from "./handler";
