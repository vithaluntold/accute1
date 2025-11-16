import { decrypt } from './crypto';
import { db } from './db';
import { llmConfigurations } from '@shared/schema';
import { and, eq, or, isNull } from 'drizzle-orm';

export interface ResolvedConfig {
  id: number;
  provider: string;
  apiKey: string;
  endpoint?: string;
  deploymentName?: string;
  organizationId: number;
  userId: number | null;
  isDefault: boolean;
  validatedAt: Date | null;
  cacheKey: string;
}

interface ConfigCache {
  config: ResolvedConfig;
  expiresAt: Date;
}

class ConfigResolver {
  private cache: Map<string, ConfigCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private hits: number = 0;
  private misses: number = 0;
  
  /**
   * Resolve LLM configuration with caching and fallback logic
   */
  async resolve(
    userId: number,
    organizationId: number,
    llmConfigId?: number
  ): Promise<ResolvedConfig | null> {
    const cacheKey = this.getCacheKey(userId, organizationId, llmConfigId);
    const cached = this.getCached(cacheKey);
    
    if (cached) {
      this.hits++;
      console.log(`[ConfigResolver] Cache HIT: ${cacheKey} (hit rate: ${this.getHitRate()}%)`);
      return cached;
    }
    
    this.misses++;
    console.log(`[ConfigResolver] Cache MISS: ${cacheKey} (hit rate: ${this.getHitRate()}%)`);
    
    const config = await this.fetchConfig(userId, organizationId, llmConfigId);
    if (!config) {
      console.log(`[ConfigResolver] No config found for user ${userId}, org ${organizationId}`);
      return null;
    }
    
    let decryptedKey: string;
    try {
      decryptedKey = decrypt(config.apiKey);
    } catch (error) {
      console.error(`[ConfigResolver] Failed to decrypt API key for config ${config.id}:`, error);
      return null;
    }
    
    const resolved: ResolvedConfig = {
      id: config.id,
      provider: config.provider,
      apiKey: decryptedKey,
      endpoint: config.azureEndpoint || undefined,
      deploymentName: config.azureDeploymentName || undefined,
      organizationId: config.organizationId,
      userId: config.userId,
      isDefault: config.isDefault || false,
      validatedAt: config.validatedAt,
      cacheKey,
    };
    
    this.setCache(cacheKey, resolved);
    
    return resolved;
  }
  
  /**
   * Invalidate cache for a specific organization (event-driven)
   */
  invalidate(organizationId: number): void {
    let invalidatedCount = 0;
    
    for (const [key, _] of this.cache.entries()) {
      if (key.includes(`org:${organizationId}`)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    console.log(`[ConfigResolver] Invalidated ${invalidatedCount} cache entries for org ${organizationId}`);
  }
  
  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[ConfigResolver] Invalidated all ${size} cache entries`);
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
    userId: number,
    organizationId: number,
    llmConfigId?: number
  ): string {
    return `user:${userId}:org:${organizationId}:config:${llmConfigId || 'default'}`;
  }
  
  private getCached(key: string): ResolvedConfig | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.config;
  }
  
  private setCache(key: string, config: ResolvedConfig): void {
    this.cache.set(key, {
      config,
      expiresAt: new Date(Date.now() + this.CACHE_TTL),
    });
  }
  
  private async fetchConfig(
    userId: number,
    organizationId: number,
    llmConfigId?: number
  ): Promise<any | null> {
    if (llmConfigId) {
      const config = await db.query.llmConfigurations.findFirst({
        where: and(
          eq(llmConfigurations.id, llmConfigId),
          eq(llmConfigurations.organizationId, organizationId)
        ),
      });
      
      return config || null;
    }
    
    const configs = await db.query.llmConfigurations.findMany({
      where: and(
        eq(llmConfigurations.organizationId, organizationId),
        or(
          isNull(llmConfigurations.userId),
          eq(llmConfigurations.userId, userId)
        )
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
