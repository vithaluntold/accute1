import { safeDecrypt } from './encryption-service';
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
    
    // Decrypt API key
    let decryptedKey: string;
    try {
      // Validate that we have an encrypted API key
      if (!config.apiKeyEncrypted || typeof config.apiKeyEncrypted !== 'string') {
        throw new Error(`LLM configuration ${config.id} has no encrypted API key. Please reconfigure this AI provider.`);
      }
      
      decryptedKey = safeDecrypt(config.apiKeyEncrypted);
      
      // Validate the decrypted key is not empty
      if (!decryptedKey || decryptedKey.trim().length === 0) {
        throw new Error(`LLM configuration ${config.id} has an empty API key after decryption.`);
      }
    } catch (error) {
      console.error(`[ConfigResolver] Failed to decrypt API key for config ${config.id}:`, error);
      throw new Error('Failed to decrypt LLM credentials. Please contact your administrator.');
    }
    
    // Return decrypted configuration
    const resolved: LlmConfiguration = {
      ...config,
      apiKeyEncrypted: decryptedKey, // Return decrypted key in the same field
    };
    
    this.setCache(cacheKey, resolved);
    
    return resolved;
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
    
    return cached.config;
  }
  
  private setCache(key: string, config: LlmConfiguration): void {
    this.cache.set(key, {
      config,
      expiresAt: new Date(Date.now() + this.CACHE_TTL),
    });
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
   */
  private isValidEncryptedApiKey(encryptedApiKey: string | null | undefined): boolean {
    if (!encryptedApiKey || typeof encryptedApiKey !== 'string') {
      return false;
    }
    
    // Check if it has the expected format: iv:encrypted:authTag
    const parts = encryptedApiKey.split(':');
    if (parts.length !== 3) {
      return false;
    }
    
    // Check if all parts are hex strings with reasonable lengths
    const [iv, encrypted, authTag] = parts;
    const hexPattern = /^[0-9a-fA-F]+$/;
    
    // IV should be 32 hex chars (16 bytes), authTag should be 32 hex chars (16 bytes)
    // Encrypted part should be at least some reasonable length
    return (
      hexPattern.test(iv) && iv.length === 32 &&
      hexPattern.test(encrypted) && encrypted.length > 0 &&
      hexPattern.test(authTag) && authTag.length === 32
    );
  }
}

// Export class for testing
export { ConfigResolver };

// Export singleton instance for production use
export const configResolver = new ConfigResolver();
