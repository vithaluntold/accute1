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
  
  // In-memory cache for workspace default configs (prevents repeated DB queries)
  private defaultConfigCache = new Map<string, { config: LlmConfiguration; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  constructor(storage: Storage) {
    this.storage = storage;
  }
  
  /**
   * Get LLM configuration with dual-scope support (workspace-level and user-level)
   * 
   * Priority order:
   * 1. If configId specified, fetch that specific config
   * 2. Workspace-level default config (if organizationId provided)
   * 3. User-level default config (if userId provided)
   * 
   * @param options Configuration options
   * @param options.organizationId Organization ID (for workspace-level configs)
   * @param options.userId User ID (for user-level configs fallback)
   * @param options.configId Optional specific config ID
   * @returns LLM configuration
   * @throws Error if no configuration found
   */
  async getConfig(options: { 
    organizationId?: string; 
    userId?: string; 
    configId?: string;
  }): Promise<LlmConfiguration> {
    const { organizationId, userId, configId } = options;
    
    // If specific config requested, fetch it directly
    if (configId) {
      const config = await this.storage.getLlmConfiguration(configId);
      if (!config) {
        throw new Error(`LLM configuration not found: ${configId}`);
      }
      
      // Validate ownership based on scope
      if (config.scope === 'workspace' && config.organizationId !== organizationId) {
        throw new Error(`LLM configuration does not belong to organization: ${configId}`);
      }
      if (config.scope === 'user' && config.userId !== userId) {
        throw new Error(`LLM configuration does not belong to user: ${configId}`);
      }
      
      if (!config.isActive) {
        throw new Error(`LLM configuration is inactive: ${configId}`);
      }
      return config;
    }
    
    // Priority 1: Workspace-level default config (with caching)
    if (organizationId) {
      try {
        const workspaceConfig = await this.getDefaultWorkspaceConfig(organizationId);
        return workspaceConfig;
      } catch (error) {
        // Workspace config not found or inactive, try user-level fallback
      }
    }
    
    // Priority 2: User-level default config (no caching to avoid staleness)
    if (userId) {
      const userConfigs = await this.storage.getLlmConfigurationsByUser(userId);
      const userDefaultConfig = userConfigs.find(c => c.isDefault && c.isActive);
      if (userDefaultConfig) {
        return userDefaultConfig;
      }
    }
    
    // No config found in either scope
    throw new Error(
      'No active LLM configuration found. Please configure an LLM provider in Settings (user-level) or Workspace Settings (workspace-level).'
    );
  }
  
  /**
   * Helper method for backward compatibility with existing callers
   * Fetches workspace-level config only
   * 
   * @param organizationId Organization ID
   * @param configId Optional specific config ID
   * @returns LLM configuration
   */
  async getWorkspaceConfig(organizationId: string, configId?: string): Promise<LlmConfiguration> {
    return this.getConfig({ organizationId, configId });
  }
  
  /**
   * Get default workspace-level LLM configuration for an organization (with caching)
   * Internal method - use getConfig() instead for dual-scope support
   * 
   * @param organizationId Organization ID
   * @returns Default workspace-level LLM configuration
   * @throws Error if no default configuration found
   */
  private async getDefaultWorkspaceConfig(organizationId: string): Promise<LlmConfiguration> {
    // Check cache first
    const cached = this.defaultConfigCache.get(organizationId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.config;
    }
    
    // Fetch from database
    const config = await this.storage.getDefaultLlmConfiguration(organizationId);
    if (!config) {
      throw new Error(
        'No default workspace LLM configuration found. Please configure an LLM provider in Workspace Settings.'
      );
    }
    
    if (!config.isActive) {
      throw new Error('Default workspace LLM configuration is inactive. Please activate it in Workspace Settings.');
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
   * Clear cache for configurations (call after config updates)
   * 
   * @param options Cache invalidation options
   * @param options.organizationId Organization ID to clear workspace config cache
   * @param options.userId User ID to clear user config cache (user configs not cached currently)
   */
  clearCache(options?: { organizationId?: string; userId?: string }): void {
    if (!options) {
      // Clear all caches
      this.defaultConfigCache.clear();
      return;
    }
    
    const { organizationId, userId } = options;
    
    // Clear workspace cache
    if (organizationId) {
      this.defaultConfigCache.delete(organizationId);
    }
    
    // User configs are not cached currently, so userId parameter is reserved for future use
    // If we add per-user caching in the future, invalidation would happen here
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
