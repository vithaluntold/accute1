import { db } from './db';
import { llmConfigurations, type LlmConfiguration } from '@shared/schema';
import { and, eq, or, isNull } from 'drizzle-orm';

interface ConfigCache {
  config: LlmConfiguration;
  expiresAt: Date;
}

interface ResolveOptions {
  organizationId?: string;
  userId?: string;
  configId?: string;
  workspaceId?: string; // Current workspace context
}

class ConfigResolver {
  private cache: Map<string, ConfigCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private hits: number = 0;
  private misses: number = 0;
  
  /**
   * Resolve LLM configuration with caching and workspace→organization fallback
   * Throws error if no configuration found
   */
  async resolve(options: ResolveOptions): Promise<LlmConfiguration> {
    const { organizationId, userId, configId, workspaceId } = options;
    
    // DEBUG: Log incoming parameters
    console.log(`[ConfigResolver] resolve() called with:`, {
      organizationId,
      userId,
      configId,
      workspaceId
    });
    
    // Use workspace context if available, fallback to organizationId
    const effectiveOrgId = workspaceId || organizationId;
    
    console.log(`[ConfigResolver] effectiveOrgId:`, effectiveOrgId);
    
    if (!effectiveOrgId) {
      throw new Error('Workspace or organization access required to use AI agents');
    }
    
    const cacheKey = this.getCacheKey(effectiveOrgId, userId, configId);
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      this.hits++;
      console.log(`[ConfigResolver] Cache HIT: ${cacheKey} (hit rate: ${this.getHitRate()}%)`);
      return cached;
    }
    
    this.misses++;
    console.log(`[ConfigResolver] Cache MISS: ${cacheKey} (hit rate: ${this.getHitRate()}%)`);
    
    const config = await this.fetchConfigWithFallback(effectiveOrgId, organizationId, userId, configId);
    if (!config) {
      console.log(`[ConfigResolver] No config found for workspace ${workspaceId}, org ${organizationId}, user ${userId}`);
      throw new Error('No active LLM configuration found. Please configure an AI provider in Workspace Settings or your User Settings.');
    }
    
    // IMPORTANT: Do NOT decrypt API key here!
    // LLMService constructor handles decryption (single responsibility principle)
    // Previously this was decrypting, causing double-decryption failures when LLMService also decrypted
    
    // Just validate that the encrypted key exists
    if (!config.apiKeyEncrypted || typeof config.apiKeyEncrypted !== 'string') {
      console.error(`[ConfigResolver] Config ${config.id} has no encrypted API key`);
      throw new Error(`LLM configuration ${config.id} has no encrypted API key. Please reconfigure this AI provider.`);
    }
    
    if (config.apiKeyEncrypted.trim().length === 0) {
      console.error(`[ConfigResolver] Config ${config.id} has empty API key`);
      throw new Error(`LLM configuration ${config.id} has an empty API key. Please reconfigure this AI provider.`);
    }
    
    console.log(`[ConfigResolver] Returning config ${config.id} with encrypted API key (decryption deferred to LLMService)`);
    
    // Return config with ENCRYPTED key - LLMService will decrypt it
    this.setCache(cacheKey, config);
    
    return config;
  }
  
  /**
   * Invalidate cache (for middleware clearLLMConfigCache)
   */
  invalidateCache(options?: {
    organizationId?: string;
    userId?: string;
  }): void {
    if (!options) {
      // Invalidate all
      const size = this.cache.size;
      this.cache.clear();
      console.log(`[ConfigResolver] Invalidated all ${size} cache entries`);
      return;
    }
    
    let invalidatedCount = 0;
    const { organizationId, userId } = options;
    
    for (const [key, _] of this.cache.entries()) {
      let shouldInvalidate = false;
      
      if (organizationId && key.includes(`org:${organizationId}`)) {
        shouldInvalidate = true;
      }
      
      if (userId && key.includes(`user:${userId}`)) {
        shouldInvalidate = true;
      }
      
      if (shouldInvalidate) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    console.log(`[ConfigResolver] Invalidated ${invalidatedCount} cache entries for org ${organizationId}, user ${userId}`);
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
    entries: string[];
  } {
    return {
      size: this.cache.size,
      hitRate: this.getHitRate(),
      hits: this.hits,
      misses: this.misses,
      entries: Array.from(this.cache.keys()),
    };
  }
  
  private getHitRate(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return Math.round((this.hits / total) * 100);
  }
  
  private getCacheKey(
    organizationId: string,
    userId?: string,
    llmConfigId?: string
  ): string {
    return `user:${userId || 'none'}:org:${organizationId}:config:${llmConfigId || 'default'}`;
  }
  
  private getCached(key: string): LlmConfiguration | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    
    // Return a deep clone to prevent cache corruption if caller mutates
    return this.cloneConfig(cached.config);
  }
  
  private setCache(key: string, config: LlmConfiguration): void {
    // Store a deep clone to prevent mutations from affecting cache
    this.cache.set(key, {
      config: this.cloneConfig(config),
      expiresAt: new Date(Date.now() + this.CACHE_TTL),
    });
  }
  
  /**
   * Deep clone a config object to prevent cache corruption
   * Ensures callers cannot mutate cached data
   * Uses structuredClone to preserve Date instances and other special types
   */
  private cloneConfig(config: LlmConfiguration): LlmConfiguration {
    // structuredClone preserves Date objects, unlike JSON.parse(JSON.stringify(...))
    return structuredClone(config);
  }
  
  private async fetchConfigWithFallback(
    workspaceId: string,
    organizationId?: string,
    userId?: string,
    llmConfigId?: string
  ): Promise<LlmConfiguration | null> {
    // If specific config ID requested, fetch it directly
    if (llmConfigId) {
      const config = await db.query.llmConfigurations.findFirst({
        where: and(
          eq(llmConfigurations.id, llmConfigId),
          or(
            eq(llmConfigurations.organizationId, workspaceId),
            organizationId ? eq(llmConfigurations.organizationId, organizationId) : undefined,
            isNull(llmConfigurations.organizationId) // Allow system-wide configs
          ),
          eq(llmConfigurations.isActive, true)
        ),
      });
      
      if (!config) {
        console.log(`[ConfigResolver] Config ${llmConfigId} not found, trying fallback to any active config`);
      } else if (!this.isValidEncryptedApiKey(config.apiKeyEncrypted)) {
        console.error(`[ConfigResolver] Config ${config.id} has invalid encrypted API key, trying fallback to any active config`);
      } else {
        return config;
      }
    }
    
    // Fetch with workspace → organization fallback
    // 1. Try workspace-level configs first
    let configs = await this.fetchConfigsForOrganization(workspaceId, userId);
    
    // 2. If no workspace configs and we have a different organization, try organization-level
    if (configs.length === 0 && organizationId && organizationId !== workspaceId) {
      console.log(`[ConfigResolver] No workspace configs found, trying organization fallback`);
      configs = await this.fetchConfigsForOrganization(organizationId, userId);
    }
    
    // Filter out configs with invalid encrypted API keys and pick the first valid one
    const validConfigs = configs.filter(config => {
      if (!this.isValidEncryptedApiKey(config.apiKeyEncrypted)) {
        console.warn(`[ConfigResolver] Skipping config ${config.id} with invalid encrypted API key`);
        return false;
      }
      return true;
    });
    
    if (validConfigs.length > 0) {
      console.log(`[ConfigResolver] Using valid config: ${validConfigs[0].id}`);
      return validConfigs[0];
    }
    
    console.error(`[ConfigResolver] No valid LLM configs found for workspace ${workspaceId}`);
    return null;
  }
  
  private async fetchConfigsForOrganization(
    organizationId: string,
    userId?: string
  ): Promise<LlmConfiguration[]> {
    return await db.query.llmConfigurations.findMany({
      where: and(
        eq(llmConfigurations.organizationId, organizationId),
        eq(llmConfigurations.isActive, true),
        userId
          ? or(
              isNull(llmConfigurations.userId),
              eq(llmConfigurations.userId, userId)
            )
          : isNull(llmConfigurations.userId)
      ),
      orderBy: (llmConfigurations, { desc }) => [
        desc(llmConfigurations.isDefault),
        desc(llmConfigurations.userId),
      ],
    });
  }
  
  /**
   * Validate that an encrypted API key is properly formatted
   * 
   * IMPORTANT: The codebase has multiple encryption formats due to historical evolution:
   * 1. auth.ts encrypt() → AES-256-CBC → format: "iv:encrypted" (2 parts)
   * 2. crypto-utils.ts encrypt() → AES-256-GCM → format: "iv:encrypted:authTag" (3 parts)
   * 3. llm-service.ts encrypt() → AES-256-GCM → format: concatenated (no colons)
   * 
   * This validator accepts ALL formats for backward compatibility.
   * LLMService.decrypt() handles multi-format decryption.
   */
  private isValidEncryptedApiKey(encryptedApiKey: string | null | undefined): boolean {
    if (!encryptedApiKey || typeof encryptedApiKey !== 'string') {
      console.warn('[ConfigResolver] API key validation failed: empty or non-string');
      return false;
    }
    
    if (encryptedApiKey.trim().length === 0) {
      console.warn('[ConfigResolver] API key validation failed: empty string');
      return false;
    }
    
    const hexPattern = /^[0-9a-fA-F]+$/;
    const parts = encryptedApiKey.split(':');
    
    // Format 1: AES-256-CBC from auth.ts → "iv:encrypted" (2 parts)
    if (parts.length === 2) {
      const [iv, encrypted] = parts;
      if (hexPattern.test(iv) && iv.length === 32 && hexPattern.test(encrypted) && encrypted.length > 0) {
        console.log('[ConfigResolver] Valid encrypted key format: AES-256-CBC (2 parts)');
        return true;
      }
    }
    
    // Format 2: AES-256-GCM from crypto-utils.ts → "iv:encrypted:authTag" (3 parts)
    if (parts.length === 3) {
      const [iv, encrypted, authTag] = parts;
      if (
        hexPattern.test(iv) && iv.length === 32 &&
        hexPattern.test(encrypted) && encrypted.length > 0 &&
        hexPattern.test(authTag) && authTag.length === 32
      ) {
        console.log('[ConfigResolver] Valid encrypted key format: AES-256-GCM (3 parts)');
        return true;
      }
    }
    
    // Format 3: Concatenated AES-256-GCM from llm-service.ts → no colons
    // Format: iv(32 hex) + authTag(32 hex) + encrypted(variable)
    if (parts.length === 1 && hexPattern.test(encryptedApiKey) && encryptedApiKey.length >= 96) {
      console.log('[ConfigResolver] Valid encrypted key format: AES-256-GCM concatenated (no colons)');
      return true;
    }
    
    console.warn('[ConfigResolver] API key validation failed: unrecognized format', {
      partsCount: parts.length,
      totalLength: encryptedApiKey.length,
      previewStart: encryptedApiKey.substring(0, 20) + '...'
    });
    return false;
  }
}

// Export class for testing
export { ConfigResolver };

// Export singleton instance for production use
export const configResolver = new ConfigResolver();
