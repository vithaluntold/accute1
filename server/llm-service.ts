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
 */
export class LLMService {
  private config: LlmConfiguration;
  private apiKey: string;
  
  constructor(config: LlmConfiguration) {
    this.config = config;
    this.apiKey = decrypt(config.apiKeyEncrypted);
  }
  
  /**
   * Send a prompt to the configured LLM and get a response
   */
  async sendPrompt(prompt: string, systemPrompt?: string): Promise<string> {
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
}
