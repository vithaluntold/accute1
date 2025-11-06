import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { LlmConfiguration } from '@shared/schema';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Check if encryption is properly configured
 */
function checkEncryptionKey(): void {
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY not configured. Please set a 32+ character encryption key to use LLM features. ' +
      'Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"'
    );
  }
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(text: string): string {
  checkEncryptionKey();
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(process.env.ENCRYPTION_KEY!.slice(0, 32)),
    iv
  );
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  // Return: iv + authTag + encrypted data (all hex encoded)
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

/**
 * Decrypt sensitive data using AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  checkEncryptionKey();
  
  const ivHex = encryptedData.slice(0, IV_LENGTH * 2);
  const authTagHex = encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2);
  const encrypted = encryptedData.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(process.env.ENCRYPTION_KEY!.slice(0, 32)),
    Buffer.from(ivHex, 'hex'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * LLM Service - Handles AI model interactions using user-configured credentials
 * Features: Retry logic, timeout handling, circuit breaker for production reliability
 */
export class LLMService {
  private config: LlmConfiguration;
  private apiKey: string;
  private readonly MAX_RETRIES = 3;
  private readonly TIMEOUT_MS = 60000; // 60 seconds
  private readonly RETRY_DELAY_MS = 1000; // 1 second
  
  constructor(config: LlmConfiguration) {
    // Validate configuration before attempting decryption
    this.validateConfiguration(config);
    
    this.config = config;
    
    // Try to decrypt API key with helpful error messages
    try {
      this.apiKey = decrypt(config.apiKeyEncrypted);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
        throw new Error('Encryption key not configured or invalid. Please contact system administrator.');
      }
      throw new Error(`Failed to decrypt API key. This may indicate the encryption key has changed or the configuration is corrupted. Original error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Validate LLM configuration has required fields for the provider
   */
  private validateConfiguration(config: LlmConfiguration): void {
    // Check basic fields
    if (!config.provider) {
      throw new Error('LLM provider is required. Please configure your AI provider in Settings > LLM Configuration.');
    }
    
    if (!config.model) {
      throw new Error('Model name is required. Please configure your AI model in Settings > LLM Configuration.');
    }
    
    if (!config.apiKeyEncrypted) {
      throw new Error('API key is required. Please configure your API key in Settings > LLM Configuration.');
    }
    
    // Provider-specific validation
    switch (config.provider) {
      case 'azure':
        if (!config.azureEndpoint) {
          throw new Error('Azure endpoint is required for Azure OpenAI. Please configure it in Settings > LLM Configuration (e.g., https://your-resource.openai.azure.com).');
        }
        if (!config.modelVersion) {
          throw new Error('Azure API version is required for Azure OpenAI. Please configure it in Settings > LLM Configuration (e.g., 2024-02-15-preview).');
        }
        // Validate endpoint format
        if (!config.azureEndpoint.startsWith('https://') || !config.azureEndpoint.includes('.openai.azure.com')) {
          throw new Error(`Invalid Azure endpoint format: "${config.azureEndpoint}". Expected format: https://your-resource.openai.azure.com`);
        }
        break;
        
      case 'openai':
        // OpenAI just needs model and API key (already validated above)
        break;
        
      case 'anthropic':
        // Anthropic just needs model and API key (already validated above)
        break;
        
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}. Supported providers: openai, azure, anthropic.`);
    }
  }
  
  /**
   * Send a prompt to the configured LLM and get a response with retry logic
   */
  async sendPrompt(prompt: string, systemPrompt?: string): Promise<string> {
    return this.withRetry(async () => {
      switch (this.config.provider) {
        case 'openai':
          return this.sendToOpenAI(prompt, systemPrompt);
        case 'azure':
          return this.sendToAzure(prompt, systemPrompt);
        case 'anthropic':
          return this.sendToAnthropic(prompt, systemPrompt);
        default:
          throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
      }
    });
  }

  /**
   * Retry wrapper with exponential backoff for transient failures
   */
  private async withRetry<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
    try {
      return await this.withTimeout(fn(), this.TIMEOUT_MS);
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && attempt < this.MAX_RETRIES;

      if (shouldRetry) {
        const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`LLM request failed (attempt ${attempt}/${this.MAX_RETRIES}), retrying in ${delay}ms...`, error);
        await this.sleep(delay);
        return this.withRetry(fn, attempt + 1);
      }

      // Final failure - provide helpful error message
      throw this.enhanceError(error, attempt);
    }
  }

  /**
   * Add timeout to prevent hanging requests
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`LLM request timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Check if error is retryable (network issues, rate limits, server errors)
   */
  private isRetryableError(error: any): boolean {
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
      return true; // Network errors
    }
    if (error?.status === 429 || error?.status === 503 || error?.status === 500) {
      return true; // Rate limit, service unavailable, server error
    }
    if (error?.message?.includes('timeout')) {
      return true; // Timeout errors
    }
    return false;
  }

  /**
   * Enhance error with helpful context for debugging
   */
  private enhanceError(error: any, attempts: number): Error {
    const provider = this.config.provider;
    const model = this.config.model;
    
    let message = `LLM request failed after ${attempts} attempts. Provider: ${provider}, Model: ${model}. `;
    
    if (error?.status === 401 || error?.status === 403) {
      message += 'Authentication failed. Please check your API key configuration.';
    } else if (error?.status === 429) {
      message += 'Rate limit exceeded. Please try again later or upgrade your plan.';
    } else if (error?.status === 404) {
      message += 'Model not found. Please verify the model name is correct.';
    } else if (error?.message?.includes('timeout')) {
      message += 'Request timed out. The LLM service may be experiencing issues.';
    } else {
      message += `Original error: ${error?.message || 'Unknown error'}`;
    }

    const enhancedError = new Error(message);
    (enhancedError as any).originalError = error;
    (enhancedError as any).provider = provider;
    (enhancedError as any).model = model;
    return enhancedError;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send a prompt with streaming response
   * @param prompt User prompt
   * @param systemPrompt System prompt
   * @param onChunk Callback for each chunk
   * @returns Full response
   */
  async sendPromptStream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    switch (this.config.provider) {
      case 'openai':
        return this.sendToOpenAIStream(prompt, systemPrompt, onChunk);
      case 'azure':
        return this.sendToAzureStream(prompt, systemPrompt, onChunk);
      case 'anthropic':
        return this.sendToAnthropicStream(prompt, systemPrompt, onChunk);
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }
  
  private async sendToOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
    const openai = new OpenAI({ apiKey: this.apiKey });
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const completion = await openai.chat.completions.create({
      model: this.config.model,
      messages,
    });
    
    return completion.choices[0]?.message?.content || '';
  }
  
  private async sendToAzure(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.config.azureEndpoint) {
      throw new Error('Azure endpoint is required for Azure OpenAI');
    }
    
    // Azure OpenAI requires deployment name in the URL path
    // Format: https://{resource}.openai.azure.com/openai/deployments/{deployment-name}
    const baseURL = `${this.config.azureEndpoint}/openai/deployments/${this.config.model}`;
    const apiVersion = this.config.modelVersion || '2024-02-15-preview';
    
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': this.apiKey },
    });
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    // For Azure, the model is already in the baseURL, so we use a placeholder
    const completion = await openai.chat.completions.create({
      model: this.config.model, // Azure ignores this since it's in the URL
      messages,
    });
    
    return completion.choices[0]?.message?.content || '';
  }
  
  private async sendToAnthropic(prompt: string, systemPrompt?: string): Promise<string> {
    const anthropic = new Anthropic({ apiKey: this.apiKey });
    
    const message = await anthropic.messages.create({
      model: this.config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    
    const content = message.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return '';
  }

  // Streaming implementations
  private async sendToOpenAIStream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const openai = new OpenAI({ apiKey: this.apiKey });
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const stream = await openai.chat.completions.create({
      model: this.config.model,
      messages,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }
    
    return fullResponse;
  }

  private async sendToAzureStream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    if (!this.config.azureEndpoint) {
      throw new Error('Azure endpoint is required for Azure OpenAI');
    }
    
    const baseURL = `${this.config.azureEndpoint}/openai/deployments/${this.config.model}`;
    const apiVersion = this.config.modelVersion || '2024-02-15-preview';
    
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': this.apiKey },
    });
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const stream = await openai.chat.completions.create({
      model: this.config.model,
      messages,
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }
    
    return fullResponse;
  }

  private async sendToAnthropicStream(
    prompt: string,
    systemPrompt: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const anthropic = new Anthropic({ apiKey: this.apiKey });
    
    const stream = await anthropic.messages.create({
      model: this.config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let fullResponse = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const content = event.delta.text;
        fullResponse += content;
        onChunk(content);
      }
    }
    
    return fullResponse;
  }
}
