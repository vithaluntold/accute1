import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { LlmConfiguration } from '@shared/schema';

// Encryption key from environment (REQUIRED - must be 32 bytes for AES-256)
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  throw new Error(
    'CRITICAL SECURITY ERROR: ENCRYPTION_KEY environment variable must be set and at least 32 characters long. ' +
    'Generate a secure key with: node -e "console.log(crypto.randomBytes(32).toString(\'base64\'))"'
  );
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
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
  const ivHex = encryptedData.slice(0, IV_LENGTH * 2);
  const authTagHex = encryptedData.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2);
  const encrypted = encryptedData.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.slice(0, 32)),
    Buffer.from(ivHex, 'hex')
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
    
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.config.azureEndpoint,
      defaultQuery: { 'api-version': '2024-02-15-preview' },
      defaultHeaders: { 'api-key': this.apiKey },
    });
    
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
