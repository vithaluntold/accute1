/**
 * Centralized LLM Configuration Service
 * 
 * Single source of truth for LLM configuration management across all AI agents.
 * Handles fetching, caching, and validation of LLM configurations.
 */

import type { storage } from './storage';
import type { LlmConfiguration } from '@shared/schema';

type Storage = typeof storage;

export class LLMConfigService {
  private storage: Storage;
  
  // In-memory cache for default configs (prevents repeated DB queries)
  private defaultConfigCache = new Map<string, { config: LlmConfiguration; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  constructor(storage: Storage) {
    this.storage = storage;
  }
  
  /**
   * Get LLM configuration for an organization
   * 
   * @param organizationId Organization ID
   * @param configId Optional specific config ID (falls back to default if not provided)
   * @returns LLM configuration
   * @throws Error if no configuration found
   */
  async getConfig(organizationId: string, configId?: string): Promise<LlmConfiguration> {
    // If specific config requested, fetch it directly
    if (configId) {
      const config = await this.storage.getLlmConfiguration(configId);
      if (!config) {
        throw new Error(`LLM configuration not found: ${configId}`);
      }
      if (config.organizationId !== organizationId) {
        throw new Error(`LLM configuration does not belong to organization: ${configId}`);
      }
      if (!config.isActive) {
        throw new Error(`LLM configuration is inactive: ${configId}`);
      }
      return config;
    }
    
    // Otherwise, get default config (with caching)
    return this.getDefaultConfig(organizationId);
  }
  
  /**
   * Get default LLM configuration for an organization (with caching)
   * 
   * @param organizationId Organization ID
   * @returns Default LLM configuration
   * @throws Error if no default configuration found
   */
  async getDefaultConfig(organizationId: string): Promise<LlmConfiguration> {
    // Check cache first
    const cached = this.defaultConfigCache.get(organizationId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.config;
    }
    
    // Fetch from database
    const config = await this.storage.getDefaultLlmConfiguration(organizationId);
    if (!config) {
      throw new Error(
        'No default LLM configuration found. Please configure an LLM provider in Settings.'
      );
    }
    
    if (!config.isActive) {
      throw new Error('Default LLM configuration is inactive. Please activate it in Settings.');
    }
    
    // Cache it
    this.defaultConfigCache.set(organizationId, {
      config,
      timestamp: Date.now(),
    });
    
    return config;
  }
  
  /**
   * Get all LLM configurations for an organization
   * 
   * @param organizationId Organization ID
   * @returns Array of LLM configurations
   */
  async getAllConfigs(organizationId: string): Promise<LlmConfiguration[]> {
    return this.storage.getLlmConfigurationsByOrganization(organizationId);
  }
  
  /**
   * Clear cache for an organization (call after config updates)
   * 
   * @param organizationId Organization ID to clear cache for
   */
  clearCache(organizationId?: string): void {
    if (organizationId) {
      this.defaultConfigCache.delete(organizationId);
    } else {
      this.defaultConfigCache.clear();
    }
  }
  
  /**
   * Validate that an LLM config has all required fields for its provider
   * 
   * @param config LLM configuration to validate
   * @throws Error if configuration is invalid
   */
  validateConfig(config: LlmConfiguration): void {
    if (!config.provider) {
      throw new Error('LLM provider is required');
    }
    
    if (!config.model) {
      throw new Error('LLM model is required');
    }
    
    if (!config.apiKeyEncrypted) {
      throw new Error('API key is required');
    }
    
    // Provider-specific validation
    switch (config.provider) {
      case 'azure':
        if (!config.azureEndpoint) {
          throw new Error('Azure endpoint is required for Azure OpenAI');
        }
        if (!config.modelVersion) {
          throw new Error('Azure API version is required for Azure OpenAI');
        }
        break;
      
      case 'openai':
      case 'anthropic':
        // No additional fields required
        break;
      
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }
}

// Singleton instance (initialized in server startup)
let llmConfigServiceInstance: LLMConfigService | null = null;

/**
 * Initialize the LLM Config Service singleton
 * Must be called during server startup
 */
export function initializeLLMConfigService(storage: Storage): void {
  llmConfigServiceInstance = new LLMConfigService(storage);
  console.log('✅ LLM Configuration Service initialized');
}

/**
 * Get the LLM Config Service singleton instance
 * @throws Error if not initialized
 */
export function getLLMConfigService(): LLMConfigService {
  if (!llmConfigServiceInstance) {
    throw new Error('LLM Configuration Service not initialized. Call initializeLLMConfigService() first.');
  }
  return llmConfigServiceInstance;
}
