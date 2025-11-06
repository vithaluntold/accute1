/**
 * FormaLLMService - Specialized LLM service with function calling support
 * This service is exclusively for Forma agent to enable dynamic tool usage
 * without affecting other agents using the base LLMService
 */

import OpenAI from 'openai';
import type { LlmConfiguration } from '../../shared/schema';
import { LLMService, decrypt } from '../../server/llm-service';
import { executeFormaTool, getFormaToolsForLLM } from './tools';

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * FormaLLMService extends base LLMService with function calling capabilities
 */
export class FormaLLMService {
  private config: LlmConfiguration;
  private apiKey: string;
  private baseLLMService: LLMService;
  private readonly MAX_TOOL_ITERATIONS = 5;
  private readonly TIMEOUT_MS = 90000; // 90 seconds (longer for tool calls)
  
  constructor(config: LlmConfiguration) {
    // Use base LLMService which validates everything
    this.baseLLMService = new LLMService(config);
    this.config = config;
    this.apiKey = decrypt(config.apiKeyEncrypted);
  }
  
  /**
   * Send prompt with function calling support
   */
  async sendPromptWithTools(
    prompt: string,
    systemPrompt: string,
    tools?: any[]
  ): Promise<string> {
    // If no tools provided, use base service
    if (!tools || tools.length === 0) {
      return this.baseLLMService.sendPrompt(prompt, systemPrompt);
    }
    
    // Route to provider-specific implementation
    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.sendToOpenAIWithTools(prompt, systemPrompt, tools);
        case 'azure':
          return await this.sendToAzureWithTools(prompt, systemPrompt, tools);
        case 'anthropic':
          return await this.sendToAnthropicWithTools(prompt, systemPrompt, tools);
        default:
          throw new Error(`Unsupported provider for function calling: ${this.config.provider}`);
      }
    } catch (error) {
      console.error('Function calling failed, falling back to base service:', error);
      // Graceful fallback to base service
      return this.baseLLMService.sendPrompt(prompt, systemPrompt);
    }
  }
  
  /**
   * OpenAI function calling implementation
   */
  private async sendToOpenAIWithTools(
    prompt: string,
    systemPrompt: string,
    tools: any[]
  ): Promise<string> {
    const openai = new OpenAI({ apiKey: this.apiKey });
    
    // Build initial messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    let iterations = 0;
    
    // Tool calling loop
    while (iterations < this.MAX_TOOL_ITERATIONS) {
      iterations++;
      
      const completion = await openai.chat.completions.create({
        model: this.config.model,
        messages,
        tools,
        tool_choice: 'auto'
      });
      
      const responseMessage = completion.choices[0]?.message;
      
      if (!responseMessage) {
        throw new Error('No response from OpenAI');
      }
      
      // Add assistant's response to messages
      messages.push(responseMessage);
      
      // Check if the model wants to call functions
      const toolCalls = responseMessage.tool_calls;
      
      if (!toolCalls || toolCalls.length === 0) {
        // No more tool calls - return final content
        return responseMessage.content || '';
      }
      
      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`[Forma] Calling tool: ${functionName} with args:`, functionArgs);
        
        try {
          const toolResult = executeFormaTool(functionName, functionArgs);
          
          // Add tool response to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        } catch (error) {
          console.error(`Tool execution failed for ${functionName}:`, error);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool execution failed: ${error}` })
          });
        }
      }
      
      // Continue loop to get next response with tool results
    }
    
    // Max iterations reached
    console.warn(`[Forma] Max tool iterations (${this.MAX_TOOL_ITERATIONS}) reached`);
    return messages[messages.length - 1]?.content?.toString() || 'Tool execution limit reached';
  }
  
  /**
   * Azure OpenAI function calling (same as OpenAI API)
   */
  private async sendToAzureWithTools(
    prompt: string,
    systemPrompt: string,
    tools: any[]
  ): Promise<string> {
    if (!this.config.azureEndpoint) {
      throw new Error('Azure endpoint is required for Azure OpenAI');
    }
    
    // Azure uses OpenAI SDK with different endpoint
    // Format: https://{resource}.openai.azure.com/openai/deployments/{deployment-name}
    const baseURL = `${this.config.azureEndpoint}/openai/deployments/${this.config.model}`;
    const apiVersion = this.config.modelVersion || '2024-02-15-preview';
    
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': this.apiKey },
    });
    
    // Build initial messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    let iterations = 0;
    
    // Tool calling loop (same as OpenAI)
    while (iterations < this.MAX_TOOL_ITERATIONS) {
      iterations++;
      
      const completion = await openai.chat.completions.create({
        model: this.config.model,
        messages,
        tools,
        tool_choice: 'auto'
      });
      
      const responseMessage = completion.choices[0]?.message;
      
      if (!responseMessage) {
        throw new Error('No response from Azure OpenAI');
      }
      
      messages.push(responseMessage);
      
      const toolCalls = responseMessage.tool_calls;
      
      if (!toolCalls || toolCalls.length === 0) {
        return responseMessage.content || '';
      }
      
      // Execute tool calls
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`[Forma] Calling tool: ${functionName} with args:`, functionArgs);
        
        try {
          const toolResult = executeFormaTool(functionName, functionArgs);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        } catch (error) {
          console.error(`Tool execution failed for ${functionName}:`, error);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool execution failed: ${error}` })
          });
        }
      }
    }
    
    console.warn(`[Forma] Max tool iterations (${this.MAX_TOOL_ITERATIONS}) reached`);
    return messages[messages.length - 1]?.content?.toString() || 'Tool execution limit reached';
  }
  
  /**
   * Anthropic function calling implementation
   */
  private async sendToAnthropicWithTools(
    prompt: string,
    systemPrompt: string,
    tools: any[]
  ): Promise<string> {
    // Anthropic has different tool calling format
    // For now, fall back to base service
    // Can be implemented later if needed
    console.warn('[Forma] Anthropic function calling not yet implemented, falling back to base service');
    return this.baseLLMService.sendPrompt(prompt, systemPrompt);
  }
  
  /**
   * Streaming with function calling
   * Note: This is complex - for now, falls back to non-streaming
   */
  async sendPromptStreamWithTools(
    prompt: string,
    systemPrompt: string,
    tools: any[],
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // Function calling with streaming is complex
    // For now, use non-streaming and send result as single chunk
    const result = await this.sendPromptWithTools(prompt, systemPrompt, tools);
    onChunk(result);
    return result;
  }
  
  /**
   * Fallback to base service for non-tool calls
   */
  async sendPrompt(prompt: string, systemPrompt?: string): Promise<string> {
    return this.baseLLMService.sendPrompt(prompt, systemPrompt);
  }
  
  async sendPromptStream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    return this.baseLLMService.sendPromptStream(prompt, systemPrompt, onChunk);
  }
}
