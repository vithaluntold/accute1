/**
 * AI Agent System - LLM Configuration Unit Tests
 * Part of Six Sigma Testing Strategy (AI_AGENT_TESTING_PLAN.md)
 * 
 * Target: 30 unit tests
 * Coverage: Two-level config, encryption, fallback, multi-provider, caching
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { testDb as db } from '../../test-db';
import { configResolver } from '../../config-resolver';
import { encrypt, decrypt } from '../../crypto-utils';
import { llmConfigurations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { createUser, createTestOrganization } from '../helpers';

describe('AI Agent System - LLM Configuration', () => {
  let testOrgId: string;
  let testUserId: string;
  let testConfigId: string;

  beforeEach(async () => {
    // Create test organization and user
    const { organization, ownerUser } = await createTestOrganization();
    testOrgId = organization.id;
    testUserId = ownerUser.id;

    // Clear cache before each test
    configResolver.invalidateCache();
  });

  afterEach(async () => {
    // Cleanup LLM configurations
    await db.delete(llmConfigurations).where(
      eq(llmConfigurations.organizationId, testOrgId)
    );

    // Clear cache after each test
    configResolver.invalidateCache();
  });

  // ============================================================
  // 1. BASIC CONFIGURATION OPERATIONS (10 tests)
  // ============================================================

  describe('Basic Configuration Operations', () => {
    it('should create workspace-level LLM config with encryption', async () => {
      const apiKey = 'sk-test-workspace-key-12345';
      const encryptedKey = encrypt(apiKey);

      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Workspace OpenAI',
        provider: 'openai',
        apiKeyEncrypted: encryptedKey,
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      expect(config).toBeDefined();
      expect(config.scope).toBe('workspace');
      expect(config.organizationId).toBe(testOrgId);
      expect(config.userId).toBeNull();
      expect(config.provider).toBe('openai');
      expect(config.apiKeyEncrypted).not.toBe(apiKey); // Should be encrypted

      // Verify decryption works
      const decrypted = decrypt(config.apiKeyEncrypted);
      expect(decrypted).toBe(apiKey);
    });

    it('should create user-level LLM config with encryption', async () => {
      const apiKey = 'sk-test-user-key-67890';
      const encryptedKey = encrypt(apiKey);

      const [config] = await db.insert(llmConfigurations).values({
        scope: 'user',
        organizationId: testOrgId,
        userId: testUserId,
        name: 'Personal Claude',
        provider: 'anthropic',
        apiKeyEncrypted: encryptedKey,
        model: 'claude-3-5-sonnet-20241022',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      expect(config).toBeDefined();
      expect(config.scope).toBe('user');
      expect(config.userId).toBe(testUserId);
      expect(config.provider).toBe('anthropic');

      // Verify decryption
      const decrypted = decrypt(config.apiKeyEncrypted);
      expect(decrypted).toBe(apiKey);
    });

    it('should support OpenAI provider configuration', async () => {
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'OpenAI GPT-4',
        provider: 'openai',
        apiKeyEncrypted: encrypt('sk-openai-test'),
        model: 'gpt-4-turbo-preview',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4-turbo-preview');
      expect(config.azureEndpoint).toBeNull();
    });

    it('should support Anthropic provider configuration', async () => {
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Claude Opus',
        provider: 'anthropic',
        apiKeyEncrypted: encrypt('sk-ant-test'),
        model: 'claude-3-opus-20240229',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-3-opus-20240229');
    });

    it('should support Azure OpenAI provider configuration with endpoint', async () => {
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Azure GPT-4',
        provider: 'azure',
        apiKeyEncrypted: encrypt('azure-key-test'),
        azureEndpoint: 'https://myaccount.openai.azure.com',
        model: 'gpt-4',
        modelVersion: '2024-02-01',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      expect(config.provider).toBe('azure');
      expect(config.azureEndpoint).toBe('https://myaccount.openai.azure.com');
      expect(config.modelVersion).toBe('2024-02-01');
    });

    it('should allow multiple non-default configs per organization', async () => {
      const configs = await db.insert(llmConfigurations).values([
        {
          scope: 'workspace',
          organizationId: testOrgId,
          userId: null,
          name: 'Config 1',
          provider: 'openai',
          apiKeyEncrypted: encrypt('key1'),
          model: 'gpt-4',
          isActive: true,
          isDefault: true,
          createdBy: testUserId,
        },
        {
          scope: 'workspace',
          organizationId: testOrgId,
          userId: null,
          name: 'Config 2',
          provider: 'anthropic',
          apiKeyEncrypted: encrypt('key2'),
          model: 'claude-3-opus',
          isActive: true,
          isDefault: false, // Not default
          createdBy: testUserId,
        },
      ]).returning();

      expect(configs).toHaveLength(2);
      expect(configs.filter(c => c.isDefault)).toHaveLength(1);
    });

    it('should deactivate configs without deletion', async () => {
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Inactive Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      // Deactivate
      const [updated] = await db.update(llmConfigurations)
        .set({ isActive: false })
        .where(eq(llmConfigurations.id, config.id))
        .returning();

      expect(updated.isActive).toBe(false);

      // Config still exists in database
      const found = await db.query.llmConfigurations.findFirst({
        where: eq(llmConfigurations.id, config.id)
      });
      expect(found).toBeDefined();
    });

    it('should track creation metadata', async () => {
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Metadata Test',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      expect(config.createdBy).toBe(testUserId);
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
      expect(config.createdAt).toEqual(config.updatedAt);
    });

    it('should update timestamps on modification', async () => {
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Update Test',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      const originalUpdatedAt = config.updatedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update config
      const [updated] = await db.update(llmConfigurations)
        .set({ name: 'Updated Name', updatedAt: new Date() })
        .where(eq(llmConfigurations.id, config.id))
        .returning();

      expect(updated.name).toBe('Updated Name');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('should enforce organization isolation', async () => {
      // Create another organization
      const { organization: org2 } = await createTestOrganization();

      // Create config in org1
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Org 1 Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key1'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // Try to fetch from org2 (should not find org1's config)
      const org2Configs = await db.query.llmConfigurations.findMany({
        where: and(
          eq(llmConfigurations.organizationId, org2.id),
          eq(llmConfigurations.isActive, true)
        )
      });

      expect(org2Configs).toHaveLength(0);
    });
  });

  // ============================================================
  // 2. CONFIG RESOLVER - FALLBACK LOGIC (8 tests)
  // ============================================================

  describe('ConfigResolver - Fallback Logic', () => {
    it('should resolve workspace-level default config', async () => {
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Workspace Default',
        provider: 'openai',
        apiKeyEncrypted: encrypt('workspace-key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      const resolved = await configResolver.resolve({
        organizationId: testOrgId,
      });

      expect(resolved.id).toBe(config.id);
      expect(resolved.scope).toBe('workspace');
      expect(resolved.apiKeyEncrypted).toBe('workspace-key'); // Decrypted
    });

    it('should prefer user-level config over workspace config', async () => {
      // Create workspace config
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Workspace Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('workspace-key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // Create user config
      const [userConfig] = await db.insert(llmConfigurations).values({
        scope: 'user',
        organizationId: testOrgId,
        userId: testUserId,
        name: 'User Config',
        provider: 'anthropic',
        apiKeyEncrypted: encrypt('user-key'),
        model: 'claude-3-opus',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      const resolved = await configResolver.resolve({
        organizationId: testOrgId,
        userId: testUserId,
      });

      expect(resolved.id).toBe(userConfig.id);
      expect(resolved.scope).toBe('user');
      expect(resolved.apiKeyEncrypted).toBe('user-key'); // Decrypted
    });

    it('should fallback to workspace config when user has no config', async () => {
      // Create workspace config only
      const [workspaceConfig] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Workspace Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('workspace-key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      const resolved = await configResolver.resolve({
        organizationId: testOrgId,
        userId: testUserId, // User provided but has no personal config
      });

      expect(resolved.id).toBe(workspaceConfig.id);
      expect(resolved.scope).toBe('workspace');
    });

    it('should resolve specific config by ID', async () => {
      // Create two configs
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Default Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('default-key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      const [specificConfig] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Specific Config',
        provider: 'anthropic',
        apiKeyEncrypted: encrypt('specific-key'),
        model: 'claude-3-opus',
        isActive: true,
        isDefault: false,
        createdBy: testUserId,
      }).returning();

      const resolved = await configResolver.resolve({
        organizationId: testOrgId,
        configId: specificConfig.id,
      });

      expect(resolved.id).toBe(specificConfig.id);
      expect(resolved.name).toBe('Specific Config');
      expect(resolved.apiKeyEncrypted).toBe('specific-key');
    });

    it('should throw error when no config exists', async () => {
      await expect(
        configResolver.resolve({ organizationId: testOrgId })
      ).rejects.toThrow('No active LLM configuration found');
    });

    it('should throw error when organization not provided', async () => {
      await expect(
        configResolver.resolve({ userId: testUserId })
      ).rejects.toThrow('Organization access required');
    });

    it('should skip inactive configs in resolution', async () => {
      // Create inactive config
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Inactive Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('inactive-key'),
        model: 'gpt-4',
        isActive: false, // Inactive
        isDefault: true,
        createdBy: testUserId,
      });

      await expect(
        configResolver.resolve({ organizationId: testOrgId })
      ).rejects.toThrow('No active LLM configuration found');
    });

    it('should throw error when specific config ID not found', async () => {
      await expect(
        configResolver.resolve({
          organizationId: testOrgId,
          configId: 'non-existent-id',
        })
      ).rejects.toThrow('LLM configuration not found');
    });
  });

  // ============================================================
  // 3. CACHING & PERFORMANCE (7 tests)
  // ============================================================

  describe('ConfigResolver - Caching & Performance', () => {
    it('should cache resolved configs', async () => {
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Cached Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('cached-key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // First call - cache miss
      const stats1 = configResolver.getCacheStats();
      expect(stats1.size).toBe(0);

      await configResolver.resolve({ organizationId: testOrgId });

      // Second call - cache hit
      const stats2 = configResolver.getCacheStats();
      expect(stats2.size).toBe(1);

      await configResolver.resolve({ organizationId: testOrgId });

      const stats3 = configResolver.getCacheStats();
      expect(stats3.hits).toBeGreaterThan(0);
    });

    it('should use different cache keys for user vs workspace', async () => {
      // Create workspace config
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Workspace',
        provider: 'openai',
        apiKeyEncrypted: encrypt('workspace-key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // Create user config
      await db.insert(llmConfigurations).values({
        scope: 'user',
        organizationId: testOrgId,
        userId: testUserId,
        name: 'User',
        provider: 'anthropic',
        apiKeyEncrypted: encrypt('user-key'),
        model: 'claude-3-opus',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // Resolve both
      await configResolver.resolve({ organizationId: testOrgId });
      await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      const stats = configResolver.getCacheStats();
      expect(stats.size).toBe(2); // Two different cache entries
    });

    it('should invalidate cache for specific organization', async () => {
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      await configResolver.resolve({ organizationId: testOrgId });

      const statsBefore = configResolver.getCacheStats();
      expect(statsBefore.size).toBe(1);

      configResolver.invalidateCache({ organizationId: testOrgId });

      const statsAfter = configResolver.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    it('should invalidate cache for specific user', async () => {
      await db.insert(llmConfigurations).values({
        scope: 'user',
        organizationId: testOrgId,
        userId: testUserId,
        name: 'User Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      configResolver.invalidateCache({ userId: testUserId });

      const stats = configResolver.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should invalidate all cache entries', async () => {
      // Create multiple configs
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // Resolve multiple times
      await configResolver.resolve({ organizationId: testOrgId });
      await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      const statsBefore = configResolver.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      configResolver.invalidateCache(); // No params = invalidate all

      const statsAfter = configResolver.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    it('should provide cache statistics', async () => {
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // First call - miss
      await configResolver.resolve({ organizationId: testOrgId });

      // Second call - hit
      await configResolver.resolve({ organizationId: testOrgId });

      const stats = configResolver.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50); // 1 hit / 2 total
      expect(stats.entries).toHaveLength(1);
    });

    it('should calculate hit rate correctly', async () => {
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Config',
        provider: 'openai',
        apiKeyEncrypted: encrypt('key'),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // 1 miss, 3 hits
      await configResolver.resolve({ organizationId: testOrgId }); // Miss
      await configResolver.resolve({ organizationId: testOrgId }); // Hit
      await configResolver.resolve({ organizationId: testOrgId }); // Hit
      await configResolver.resolve({ organizationId: testOrgId }); // Hit

      const stats = configResolver.getCacheStats();
      expect(stats.hitRate).toBe(75); // 3 hits / 4 total = 75%
    });
  });

  // ============================================================
  // 4. ENCRYPTION & SECURITY (5 tests)
  // ============================================================

  describe('Encryption & Security', () => {
    it('should decrypt API keys correctly', async () => {
      const originalKey = 'sk-test-api-key-12345';
      const [config] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Decrypt Test',
        provider: 'openai',
        apiKeyEncrypted: encrypt(originalKey),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      const resolved = await configResolver.resolve({ organizationId: testOrgId });

      expect(resolved.apiKeyEncrypted).toBe(originalKey); // Returns decrypted
    });

    it('should throw error on decryption failure', async () => {
      // Create config with invalid encrypted data
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Bad Encryption',
        provider: 'openai',
        apiKeyEncrypted: 'invalid-encrypted-data', // Not properly encrypted
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      await expect(
        configResolver.resolve({ organizationId: testOrgId })
      ).rejects.toThrow('Failed to decrypt LLM credentials');
    });

    it('should not expose encrypted keys in database queries', async () => {
      const originalKey = 'sk-secret-key';
      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Security Test',
        provider: 'openai',
        apiKeyEncrypted: encrypt(originalKey),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      });

      // Direct DB query should show encrypted data
      const dbConfig = await db.query.llmConfigurations.findFirst({
        where: and(
          eq(llmConfigurations.organizationId, testOrgId),
          eq(llmConfigurations.isActive, true)
        )
      });

      expect(dbConfig?.apiKeyEncrypted).not.toBe(originalKey);
      expect(dbConfig?.apiKeyEncrypted).toBeTruthy();
    });

    it('should handle different encryption keys', async () => {
      const key1 = 'sk-key-one';
      const key2 = 'sk-key-two';

      const encrypted1 = encrypt(key1);
      const encrypted2 = encrypt(key2);

      expect(encrypted1).not.toBe(encrypted2);

      const decrypted1 = decrypt(encrypted1);
      const decrypted2 = decrypt(encrypted2);

      expect(decrypted1).toBe(key1);
      expect(decrypted2).toBe(key2);
    });

    it('should maintain encryption across database round-trip', async () => {
      const originalKey = 'sk-roundtrip-test';
      const [inserted] = await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: testOrgId,
        userId: null,
        name: 'Roundtrip Test',
        provider: 'openai',
        apiKeyEncrypted: encrypt(originalKey),
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: testUserId,
      }).returning();

      const fetched = await db.query.llmConfigurations.findFirst({
        where: eq(llmConfigurations.id, inserted.id)
      });

      expect(fetched).toBeDefined();
      expect(decrypt(fetched!.apiKeyEncrypted)).toBe(originalKey);
    });
  });
});
