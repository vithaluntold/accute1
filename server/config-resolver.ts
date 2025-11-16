import { decrypt } from './crypto-utils';
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
}

class ConfigResolver {
  private cache: Map<string, ConfigCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private hits: number = 0;
  private misses: number = 0;
  
  /**
   * Resolve LLM configuration with caching and fallback logic
   * Throws error if no configuration found
   */
  async resolve(options: ResolveOptions): Promise<LlmConfiguration> {
    const { organizationId, userId, configId } = options;
    
    if (!organizationId) {
      throw new Error('Organization access required to use AI agents');
    }
    
    const cacheKey = this.getCacheKey(organizationId, userId, configId);
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      this.hits++;
      console.log(`[ConfigResolver] Cache HIT: ${cacheKey} (hit rate: ${this.getHitRate()}%)`);
      return cached;
    }
    
    this.misses++;
    console.log(`[ConfigResolver] Cache MISS: ${cacheKey} (hit rate: ${this.getHitRate()}%)`);
    
    const config = await this.fetchConfig(organizationId, userId, configId);
    if (!config) {
      console.log(`[ConfigResolver] No config found for user ${userId}, org ${organizationId}`);
      throw new Error('No active LLM configuration found. Please configure an AI provider in Workspace Settings or your User Settings.');
    }
    
    // Decrypt API key
    let decryptedKey: string;
    try {
      decryptedKey = decrypt(config.apiKeyEncrypted);
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
  
  private async fetchConfig(
    organizationId: string,
    userId?: string,
    llmConfigId?: string
  ): Promise<LlmConfiguration | null> {
    // If specific config ID requested, fetch it
    if (llmConfigId) {
      const config = await db.query.llmConfigurations.findFirst({
        where: and(
          eq(llmConfigurations.id, llmConfigId),
          eq(llmConfigurations.organizationId, organizationId),
          eq(llmConfigurations.isActive, true)
        ),
      });
      
      if (!config) {
        throw new Error('LLM configuration not found or is inactive');
      }
      
      return config;
    }
    
    // Fetch default workspace or user config
    const configs = await db.query.llmConfigurations.findMany({
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
    
    return configs[0] || null;
  }
}

export const configResolver = new ConfigResolver();
