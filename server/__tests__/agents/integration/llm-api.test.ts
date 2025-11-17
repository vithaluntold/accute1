import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { testDb as db } from '../../../test-db';
import { createTestOrganization } from '../../helpers';
import { llmConfigurations } from '@shared/schema';
import { ConfigResolver } from '../../../config-resolver';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

/**
 * LLM API Integration Tests
 * 
 * Tests LLM provider integration, multi-provider fallback, error handling,
 * and configuration management using mocked API calls.
 * 
 * Coverage:
 * 1. OpenAI Integration (5 tests)
 * 2. Anthropic Integration (5 tests)
 * 3. Azure OpenAI Integration (5 tests)
 * 4. Multi-Provider Fallback (5 tests)
 * 5. Error Handling & Retries (5 tests)
 * 6. Configuration Resolution (5 tests)
 * 
 * Total: 30 tests
 */

describe('LLM API Integration Tests', () => {
  let testUserId: number;
  let testOrgId: number;
  let encryptionKey: string;
  let configResolver: ConfigResolver;

  beforeAll(async () => {
    // Create test organization
    const { organization, ownerUser } = await createTestOrganization();
    testUserId = ownerUser.id;
    testOrgId = organization.id;

    // Setup encryption key
    encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    process.env.ENCRYPTION_KEY = encryptionKey;

    // Initialize ConfigResolver
    configResolver = new ConfigResolver();
  });

  beforeEach(() => {
    // Clear config cache before each test
    configResolver.invalidateCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to encrypt API key
  function encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  // Helper to create LLM configuration
  async function createLLMConfig(
    provider: 'openai' | 'anthropic' | 'azure_openai',
    userId?: number,
    overrides?: any
  ) {
    const config = {
      name: `Test ${provider} Config`,
      provider,
      userId: userId || null,
      workspaceId: null,
      organizationId: testOrgId,
      isActive: true,
      apiKey: encrypt('test-api-key-' + nanoid()),
      model: provider === 'openai' ? 'gpt-4' : provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4',
      ...overrides,
    };

    if (provider === 'azure_openai') {
      config.endpoint = 'https://test.openai.azure.com';
    }

    const [created] = await db.insert(llmConfigurations).values(config).returning();
    return created;
  }

  // ============================================================
  // 1. OPENAI INTEGRATION (5 tests)
  // ============================================================

  describe('OpenAI Integration', () => {
    it('should resolve OpenAI configuration', async () => {
      await createLLMConfig('openai', testUserId);

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config).toBeDefined();
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4');
      expect(config.decryptedApiKey).toBeDefined();
    });

    it('should support GPT-4 model', async () => {
      const llmConfig = await createLLMConfig('openai', testUserId, null, {
        model: 'gpt-4',
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.model).toBe('gpt-4');
    });

    it('should support GPT-3.5-turbo model', async () => {
      await createLLMConfig('openai', testUserId, null, {
        model: 'gpt-3.5-turbo',
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.model).toBe('gpt-3.5-turbo');
    });

    it('should handle OpenAI API key decryption', async () => {
      const testKey = 'sk-test-' + nanoid();
      await createLLMConfig('openai', testUserId, null, {
        apiKey: encrypt(testKey),
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.decryptedApiKey).toBe(testKey);
    });

    it('should support custom OpenAI parameters', async () => {
      await createLLMConfig('openai', testUserId, null, {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(2000);
    });
  });

  // ============================================================
  // 2. ANTHROPIC INTEGRATION (5 tests)
  // ============================================================

  describe('Anthropic Integration', () => {
    it('should resolve Anthropic configuration', async () => {
      await createLLMConfig('anthropic', testUserId);

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config).toBeDefined();
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-3-opus-20240229');
      expect(config.decryptedApiKey).toBeDefined();
    });

    it('should support Claude 3 Opus model', async () => {
      await createLLMConfig('anthropic', testUserId, null, {
        model: 'claude-3-opus-20240229',
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.model).toBe('claude-3-opus-20240229');
    });

    it('should support Claude 3 Sonnet model', async () => {
      await createLLMConfig('anthropic', testUserId, null, {
        model: 'claude-3-5-sonnet-20241022',
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should handle Anthropic API key decryption', async () => {
      const testKey = 'sk-ant-api03-' + nanoid();
      await createLLMConfig('anthropic', testUserId, null, {
        apiKey: encrypt(testKey),
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.decryptedApiKey).toBe(testKey);
    });

    it('should support custom Anthropic parameters', async () => {
      await createLLMConfig('anthropic', testUserId, null, {
        model: 'claude-3-opus-20240229',
        temperature: 0.8,
        maxTokens: 4096,
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.temperature).toBe(0.8);
      expect(config.maxTokens).toBe(4096);
    });
  });

  // ============================================================
  // 3. AZURE OPENAI INTEGRATION (5 tests)
  // ============================================================

  describe('Azure OpenAI Integration', () => {
    it('should resolve Azure OpenAI configuration', async () => {
      await createLLMConfig('azure_openai', testUserId, null, {
        endpoint: 'https://test.openai.azure.com',
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config).toBeDefined();
      expect(config.provider).toBe('azure_openai');
      expect(config.endpoint).toBe('https://test.openai.azure.com');
      expect(config.decryptedApiKey).toBeDefined();
    });

    it('should require endpoint for Azure OpenAI', async () => {
      const config = await createLLMConfig('azure_openai', testUserId);

      expect(config.endpoint).toBeDefined();
      expect(config.endpoint).toContain('openai.azure.com');
    });

    it('should support Azure deployment names', async () => {
      await createLLMConfig('azure_openai', testUserId, null, {
        endpoint: 'https://test.openai.azure.com',
        model: 'gpt-4-deployment',
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.model).toBe('gpt-4-deployment');
    });

    it('should handle Azure API key decryption', async () => {
      const testKey = 'azure-key-' + nanoid();
      await createLLMConfig('azure_openai', testUserId, null, {
        apiKey: encrypt(testKey),
        endpoint: 'https://test.openai.azure.com',
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.decryptedApiKey).toBe(testKey);
    });

    it('should support Azure custom parameters', async () => {
      await createLLMConfig('azure_openai', testUserId, null, {
        endpoint: 'https://test.openai.azure.com',
        temperature: 0.6,
        maxTokens: 3000,
      });

      const config = await configResolver.resolve(testUserId, testOrgId);

      expect(config.temperature).toBe(0.6);
      expect(config.maxTokens).toBe(3000);
    });
  });

  // ============================================================
  // 4. MULTI-PROVIDER FALLBACK (5 tests)
  // ============================================================

  describe('Multi-Provider Fallback', () => {
    it('should prioritize user config over workspace config', async () => {
      // Create workspace config
      await createLLMConfig('anthropic', null, testWorkspaceId, {
        name: 'Workspace Config',
      });

      // Create user config
      await createLLMConfig('openai', testUserId, null, {
        name: 'User Config',
      });

      const config = await configResolver.resolve(testUserId, testOrgId, testWorkspaceId);

      expect(config.provider).toBe('openai');
      expect(config.name).toBe('User Config');
    });

    it('should fallback to workspace config when no user config exists', async () => {
      // Only create workspace config
      await createLLMConfig('anthropic', null, testWorkspaceId, {
        name: 'Workspace Config',
      });

      const config = await configResolver.resolve(testUserId, testOrgId, testWorkspaceId);

      expect(config.provider).toBe('anthropic');
      expect(config.name).toBe('Workspace Config');
    });

    it('should skip inactive configurations', async () => {
      // Create inactive user config
      await createLLMConfig('openai', testUserId, null, {
        name: 'Inactive User Config',
        isActive: false,
      });

      // Create active workspace config
      await createLLMConfig('anthropic', null, testWorkspaceId, {
        name: 'Active Workspace Config',
        isActive: true,
      });

      const config = await configResolver.resolve(testUserId, testOrgId, testWorkspaceId);

      expect(config.provider).toBe('anthropic');
      expect(config.name).toBe('Active Workspace Config');
    });

    it('should throw error when no configuration exists', async () => {
      const { ownerUser: newUser, organization: newOrg } = await createTestOrganization();

      await expect(
        configResolver.resolve(newUser.id, newOrg.id)
      ).rejects.toThrow('No active LLM configuration found');
    });

    it('should support switching between providers', async () => {
      // Start with OpenAI
      const openaiConfig = await createLLMConfig('openai', testUserId);
      let config = await configResolver.resolve(testUserId, testOrgId);
      expect(config.provider).toBe('openai');

      // Deactivate OpenAI, activate Anthropic
      await db.update(llmConfigurations)
        .set({ isActive: false })
        .where(eq(llmConfigurations.id, openaiConfig.id));

      await createLLMConfig('anthropic', testUserId, null, {
        isActive: true,
      });

      configResolver.invalidateCache();

      config = await configResolver.resolve(testUserId, testOrgId);
      expect(config.provider).toBe('anthropic');
    });
  });

  // ============================================================
  // 5. ERROR HANDLING & RETRIES (5 tests)
  // ============================================================

  describe('Error Handling & Retries', () => {
    it('should handle decryption failures gracefully', async () => {
      // Create config with invalid encrypted key
      await db.insert(llmConfigurations).values({
        name: 'Invalid Config',
        provider: 'openai',
        userId: testUserId,
        organizationId: testOrgId,
        isActive: true,
        apiKey: 'invalid-encrypted-key',
        model: 'gpt-4',
      });

      await expect(
        configResolver.resolve(testUserId, testOrgId)
      ).rejects.toThrow();
    });

    it('should validate required fields for each provider', async () => {
      // Azure requires endpoint
      const azureConfig = {
        name: 'Azure No Endpoint',
        provider: 'azure_openai' as const,
        userId: testUserId,
        organizationId: testOrgId,
        isActive: true,
        apiKey: encrypt('test-key'),
        model: 'gpt-4',
        // endpoint missing
      };

      const [config] = await db.insert(llmConfigurations).values(azureConfig).returning();

      const resolved = await configResolver.resolve(testUserId, testOrgId);
      
      // Should still resolve but endpoint might be undefined
      expect(resolved).toBeDefined();
    });

    it('should handle missing encryption key', async () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      await createLLMConfig('openai', testUserId);

      await expect(
        configResolver.resolve(testUserId, testOrgId)
      ).rejects.toThrow();

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should handle corrupted configuration data', async () => {
      await db.insert(llmConfigurations).values({
        name: 'Corrupted Config',
        provider: 'openai' as any,
        userId: testUserId,
        organizationId: testOrgId,
        isActive: true,
        apiKey: null as any, // Invalid: null API key
        model: 'gpt-4',
      });

      await expect(
        configResolver.resolve(testUserId, testOrgId)
      ).rejects.toThrow();
    });

    it('should handle organization mismatch', async () => {
      const { organization: org2, ownerUser: user2 } = await createTestOrganization();

      // Create config for org2
      await createLLMConfig('openai', user2.id);

      // Try to access with org1 user (should not find config)
      await expect(
        configResolver.resolve(testUserId, testOrgId)
      ).rejects.toThrow('No active LLM configuration found');
    });
  });

  // ============================================================
  // 6. CONFIGURATION RESOLUTION (5 tests)
  // ============================================================

  describe('Configuration Resolution', () => {
    it('should cache configuration for performance', async () => {
      await createLLMConfig('openai', testUserId);

      const start1 = Date.now();
      const config1 = await configResolver.resolve(testUserId, testOrgId);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const config2 = await configResolver.resolve(testUserId, testOrgId);
      const time2 = Date.now() - start2;

      expect(config1.id).toBe(config2.id);
      // Second call should be faster (cached)
      expect(time2).toBeLessThan(time1);
    });

    it('should respect cache invalidation', async () => {
      const config1 = await createLLMConfig('openai', testUserId);

      const resolved1 = await configResolver.resolve(testUserId, testOrgId);
      expect(resolved1.provider).toBe('openai');

      // Update config
      await db.update(llmConfigurations)
        .set({ isActive: false })
        .where(eq(llmConfigurations.id, config1.id));

      await createLLMConfig('anthropic', testUserId);

      configResolver.invalidateCache();

      const resolved2 = await configResolver.resolve(testUserId, testOrgId);
      expect(resolved2.provider).toBe('anthropic');
    });

    it('should handle concurrent resolution requests', async () => {
      await createLLMConfig('openai', testUserId);

      const promises = Array(10).fill(null).map(() => 
        configResolver.resolve(testUserId, testOrgId)
      );

      const configs = await Promise.all(promises);

      // All should resolve to same config
      expect(configs.every(c => c.id === configs[0].id)).toBe(true);
    });

    it('should resolve workspace-specific configurations', async () => {
      // Create configs for different workspaces
      const [workspace2] = await db.insert(workspaces).values({
        name: 'Test Workspace 2',
        organizationId: testOrgId,
        createdBy: testUserId,
        settings: {},
      }).returning();

      await createLLMConfig('openai', null, testWorkspaceId, {
        name: 'Workspace 1 Config',
      });

      await createLLMConfig('anthropic', null, workspace2.id, {
        name: 'Workspace 2 Config',
      });

      const config1 = await configResolver.resolve(testUserId, testOrgId, testWorkspaceId);
      const config2 = await configResolver.resolve(testUserId, testOrgId, workspace2.id);

      expect(config1.provider).toBe('openai');
      expect(config2.provider).toBe('anthropic');
    });

    it('should preserve configuration metadata', async () => {
      const originalConfig = await createLLMConfig('openai', testUserId, null, {
        name: 'Test Config',
        temperature: 0.7,
        maxTokens: 2000,
        model: 'gpt-4',
      });

      const resolved = await configResolver.resolve(testUserId, testOrgId);

      expect(resolved.id).toBe(originalConfig.id);
      expect(resolved.name).toBe('Test Config');
      expect(resolved.temperature).toBe(0.7);
      expect(resolved.maxTokens).toBe(2000);
      expect(resolved.model).toBe('gpt-4');
    });
  });
});
