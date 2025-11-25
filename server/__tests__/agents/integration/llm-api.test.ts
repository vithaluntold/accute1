import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { testDb as db } from '../../../test-db';
import { createTestOrganization } from '../../helpers';
import { llmConfigurations } from '@shared/schema';
import { ConfigResolver } from '../../../config-resolver';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

/**
 * LLM API Integration Tests
 * 
 * Tests LLM provider integration with CORRECT schema structure:
 * - Uses `apiKeyEncrypted` (not `apiKey`)
 * - Uses `azureEndpoint` (not `endpoint`)
 * - Supports `scope: 'user' | 'workspace'`
 * - Tests user-level AND workspace-level configurations
 * 
 * Coverage:
 * 1. OpenAI Integration (5 tests)
 * 2. Anthropic Integration (5 tests)
 * 3. Azure OpenAI Integration (5 tests)
 * 4. User vs Workspace Scope (5 tests)
 * 5. Multi-Provider Fallback (5 tests)
 * 6. Error Handling & Security (5 tests)
 * 
 * Total: 30 tests
 */

describe('LLM API Integration Tests', () => {
  let testUserId: string;
  let testOrgId: string;
  let encryptionKey: string;
  let configResolver: ConfigResolver;

  beforeAll(async () => {
    // Setup encryption key (must be exactly 32 bytes = 64 hex characters)
    if (!process.env.ENCRYPTION_KEY || Buffer.from(process.env.ENCRYPTION_KEY, 'hex').length !== 32) {
      encryptionKey = crypto.randomBytes(32).toString('hex');
      process.env.ENCRYPTION_KEY = encryptionKey;
    } else {
      encryptionKey = process.env.ENCRYPTION_KEY;
    }

    // Initialize ConfigResolver
    configResolver = new ConfigResolver();
  });

  beforeEach(async () => {
    // Create fresh test organization and user for EACH test
    // This is necessary because global test setup truncates tables before each test
    const { organization, ownerUser } = await createTestOrganization();
    testUserId = ownerUser.id;
    testOrgId = organization.id;

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

  // Helper to create USER-level LLM configuration
  async function createUserLLMConfig(
    provider: 'openai' | 'anthropic' | 'azure_openai',
    userId: string,
    overrides?: any
  ) {
    const config = {
      scope: 'user',
      userId: userId,
      organizationId: null,
      name: `User ${provider} Config`,
      provider,
      apiKeyEncrypted: encrypt('test-api-key-' + nanoid()),
      model: provider === 'openai' ? 'gpt-4' : provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4',
      isActive: true,
      isDefault: false,
      createdBy: userId,
      ...overrides,
    };

    if (provider === 'azure_openai') {
      config.azureEndpoint = 'https://test.openai.azure.com';
    }

    const [created] = await db.insert(llmConfigurations).values(config).returning();
    return created;
  }

  // Helper to create WORKSPACE-level LLM configuration
  async function createWorkspaceLLMConfig(
    provider: 'openai' | 'anthropic' | 'azure_openai',
    organizationId: string,
    createdBy: string,
    overrides?: any
  ) {
    const config = {
      scope: 'workspace',
      userId: null,
      organizationId: organizationId,
      name: `Workspace ${provider} Config`,
      provider,
      apiKeyEncrypted: encrypt('test-api-key-' + nanoid()),
      model: provider === 'openai' ? 'gpt-4' : provider === 'anthropic' ? 'claude-3-opus-20240229' : 'gpt-4',
      isActive: true,
      isDefault: false,
      createdBy: createdBy,
      ...overrides,
    };

    if (provider === 'azure_openai') {
      config.azureEndpoint = 'https://test.openai.azure.com';
    }

    const [created] = await db.insert(llmConfigurations).values(config).returning();
    return created;
  }

  // ============================================================
  // 1. OPENAI INTEGRATION (5 tests)
  // ============================================================

  describe('OpenAI Integration', () => {
    it('should resolve user-level OpenAI configuration', async () => {
      await createUserLLMConfig('openai', testUserId);

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config).toBeDefined();
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4');
      expect(config.apiKeyEncrypted).toBeDefined();
      // ConfigResolver returns encrypted key; verify decryption works via decrypt()
      const decryptedKey = decrypt(config.apiKeyEncrypted);
      expect(decryptedKey).toMatch(/^test-api-key-/);
    });

    it('should support GPT-4 model', async () => {
      await createUserLLMConfig('openai', testUserId, {
        model: 'gpt-4',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.model).toBe('gpt-4');
    });

    it('should support GPT-3.5-turbo model', async () => {
      await createUserLLMConfig('openai', testUserId, {
        model: 'gpt-3.5-turbo',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.model).toBe('gpt-3.5-turbo');
    });

    it('should handle OpenAI API key decryption', async () => {
      const testKey = 'sk-test-' + nanoid();
      const encryptedTestKey = encrypt(testKey);
      await createUserLLMConfig('openai', testUserId, {
        apiKeyEncrypted: encryptedTestKey,
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      // ConfigResolver returns encrypted key (LLMService handles decryption)
      expect(config.apiKeyEncrypted).toBe(encryptedTestKey);
      // Verify decryption works correctly
      expect(decrypt(config.apiKeyEncrypted)).toBe(testKey);
    });

    it('should support workspace-level OpenAI config', async () => {
      await createWorkspaceLLMConfig('openai', testOrgId, testUserId);

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.provider).toBe('openai');
      expect(config.scope).toBe('workspace');
      expect(config.organizationId).toBe(testOrgId);
    });
  });

  // ============================================================
  // 2. ANTHROPIC INTEGRATION (5 tests)
  // ============================================================

  describe('Anthropic Integration', () => {
    it('should resolve user-level Anthropic configuration', async () => {
      await createUserLLMConfig('anthropic', testUserId);

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config).toBeDefined();
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-3-opus-20240229');
      expect(config.apiKeyEncrypted).toBeDefined();
    });

    it('should support Claude 3 Opus model', async () => {
      await createUserLLMConfig('anthropic', testUserId, {
        model: 'claude-3-opus-20240229',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.model).toBe('claude-3-opus-20240229');
    });

    it('should support Claude 3.5 Sonnet model', async () => {
      await createUserLLMConfig('anthropic', testUserId, {
        model: 'claude-3-5-sonnet-20241022',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should handle Anthropic API key decryption', async () => {
      const testKey = 'sk-ant-api03-' + nanoid();
      await createUserLLMConfig('anthropic', testUserId, {
        apiKeyEncrypted: encrypt(testKey),
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.apiKeyEncrypted).toBe(testKey);
    });

    it('should support workspace-level Anthropic config', async () => {
      await createWorkspaceLLMConfig('anthropic', testOrgId, testUserId);

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.provider).toBe('anthropic');
      expect(config.scope).toBe('workspace');
    });
  });

  // ============================================================
  // 3. AZURE OPENAI INTEGRATION (5 tests)
  // ============================================================

  describe('Azure OpenAI Integration', () => {
    it('should resolve Azure OpenAI configuration with azureEndpoint', async () => {
      await createUserLLMConfig('azure_openai', testUserId, {
        azureEndpoint: 'https://test.openai.azure.com',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config).toBeDefined();
      expect(config.provider).toBe('azure_openai');
      expect(config.azureEndpoint).toBe('https://test.openai.azure.com');
      expect(config.apiKeyEncrypted).toBeDefined();
    });

    it('should require azureEndpoint for Azure OpenAI', async () => {
      const config = await createUserLLMConfig('azure_openai', testUserId);

      expect(config.azureEndpoint).toBeDefined();
      expect(config.azureEndpoint).toContain('openai.azure.com');
    });

    it('should support Azure deployment names', async () => {
      await createUserLLMConfig('azure_openai', testUserId, {
        azureEndpoint: 'https://test.openai.azure.com',
        model: 'gpt-4-deployment',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.model).toBe('gpt-4-deployment');
    });

    it('should handle Azure API key decryption', async () => {
      const testKey = 'azure-key-' + nanoid();
      await createUserLLMConfig('azure_openai', testUserId, {
        apiKeyEncrypted: encrypt(testKey),
        azureEndpoint: 'https://test.openai.azure.com',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.apiKeyEncrypted).toBe(testKey);
    });

    it('should support workspace-level Azure config', async () => {
      await createWorkspaceLLMConfig('azure_openai', testOrgId, testUserId, {
        azureEndpoint: 'https://workspace.openai.azure.com',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.provider).toBe('azure_openai');
      expect(config.scope).toBe('workspace');
      expect(config.azureEndpoint).toBe('https://workspace.openai.azure.com');
    });
  });

  // ============================================================
  // 4. USER VS WORKSPACE SCOPE (5 tests)
  // ============================================================

  describe('User vs Workspace Scope', () => {
    it('should prioritize user-level config over workspace-level config', async () => {
      // Create workspace config
      await createWorkspaceLLMConfig('anthropic', testOrgId, testUserId, {
        name: 'Workspace Config',
      });

      // Create user config
      await createUserLLMConfig('openai', testUserId, {
        name: 'User Config',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.provider).toBe('openai');
      expect(config.name).toBe('User Config');
      expect(config.scope).toBe('user');
    });

    it('should fallback to workspace config when no user config exists', async () => {
      // Only create workspace config
      await createWorkspaceLLMConfig('anthropic', testOrgId, testUserId, {
        name: 'Workspace Config',
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.provider).toBe('anthropic');
      expect(config.name).toBe('Workspace Config');
      expect(config.scope).toBe('workspace');
    });

    it('should verify user-level config has userId and null organizationId', async () => {
      const userConfig = await createUserLLMConfig('openai', testUserId);

      expect(userConfig.scope).toBe('user');
      expect(userConfig.userId).toBe(testUserId);
      expect(userConfig.organizationId).toBeNull();
    });

    it('should verify workspace-level config has organizationId and null userId', async () => {
      const workspaceConfig = await createWorkspaceLLMConfig('anthropic', testOrgId, testUserId);

      expect(workspaceConfig.scope).toBe('workspace');
      expect(workspaceConfig.organizationId).toBe(testOrgId);
      expect(workspaceConfig.userId).toBeNull();
    });

    it('should support isDefault flag for user and workspace configs', async () => {
      // Create default user config
      await createUserLLMConfig('openai', testUserId, {
        isDefault: true,
      });

      // Create default workspace config
      await createWorkspaceLLMConfig('anthropic', testOrgId, testUserId, {
        isDefault: true,
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      // User config should be prioritized
      expect(config.provider).toBe('openai');
      expect(config.isDefault).toBe(true);
    });
  });

  // ============================================================
  // 5. MULTI-PROVIDER FALLBACK (5 tests)
  // ============================================================

  describe('Multi-Provider Fallback', () => {
    it('should skip inactive configurations and use active ones', async () => {
      // Create inactive user config
      await createUserLLMConfig('openai', testUserId, {
        name: 'Inactive User Config',
        isActive: false,
      });

      // Create active workspace config
      await createWorkspaceLLMConfig('anthropic', testOrgId, testUserId, {
        name: 'Active Workspace Config',
        isActive: true,
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.provider).toBe('anthropic');
      expect(config.name).toBe('Active Workspace Config');
      expect(config.isActive).toBe(true);
    });

    it('should throw error when no configuration exists', async () => {
      const { ownerUser: newUser, organization: newOrg } = await createTestOrganization();

      await expect(
        configResolver.resolve({ organizationId: newOrg.id, userId: newUser.id })
      ).rejects.toThrow('No active LLM configuration found');
    });

    it('should support switching between providers', async () => {
      // Start with OpenAI
      const openaiConfig = await createUserLLMConfig('openai', testUserId);
      let config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
      expect(config.provider).toBe('openai');

      // Deactivate OpenAI, activate Anthropic
      await db.update(llmConfigurations)
        .set({ isActive: false })
        .where(eq(llmConfigurations.id, openaiConfig.id));

      await createUserLLMConfig('anthropic', testUserId, {
        isActive: true,
      });

      configResolver.invalidateCache();

      config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
      expect(config.provider).toBe('anthropic');
    });

    it('should handle multiple workspace configs and select active one', async () => {
      // Create multiple workspace configs
      await createWorkspaceLLMConfig('openai', testOrgId, testUserId, {
        isActive: false,
      });

      await createWorkspaceLLMConfig('anthropic', testOrgId, testUserId, {
        isActive: true,
      });

      const config = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });

      expect(config.provider).toBe('anthropic');
      expect(config.isActive).toBe(true);
    });

    it('should handle organization isolation (different orgs have different configs)', async () => {
      const { organization: org2, ownerUser: user2 } = await createTestOrganization();

      // Create config for org1
      await createWorkspaceLLMConfig('openai', testOrgId, testUserId);

      // Create config for org2
      await createWorkspaceLLMConfig('anthropic', org2.id, user2.id);

      const config1 = await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
      const config2 = await configResolver.resolve({ organizationId: org2.id, userId: user2.id });

      expect(config1.provider).toBe('openai');
      expect(config1.organizationId).toBe(testOrgId);

      expect(config2.provider).toBe('anthropic');
      expect(config2.organizationId).toBe(org2.id);
    });
  });

  // ============================================================
  // 6. ERROR HANDLING & SECURITY (5 tests)
  // ============================================================

  describe('Error Handling & Security', () => {
    it('should handle decryption failures gracefully', async () => {
      // Create config with invalid encrypted key
      await db.insert(llmConfigurations).values({
        scope: 'user',
        userId: testUserId,
        organizationId: null,
        name: 'Invalid Config',
        provider: 'openai',
        apiKeyEncrypted: 'invalid-encrypted-key',
        model: 'gpt-4',
        isActive: true,
        isDefault: false,
        createdBy: testUserId,
      });

      await expect(
        configResolver.resolve({ organizationId: testOrgId, userId: testUserId })
      ).rejects.toThrow();
    });

    it('should handle missing encryption key', async () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      await createUserLLMConfig('openai', testUserId);

      await expect(
        configResolver.resolve({ organizationId: testOrgId, userId: testUserId })
      ).rejects.toThrow();

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should prevent organization mismatch (user cannot access other org configs)', async () => {
      const { organization: org2, ownerUser: user2 } = await createTestOrganization();

      // Create config for org2
      await createWorkspaceLLMConfig('openai', org2.id, user2.id);

      // testUser (from org1) should not see org2's config
      await expect(
        configResolver.resolve({ organizationId: testOrgId, userId: testUserId })
      ).rejects.toThrow('No active LLM configuration found');
    });

    it('should validate provider field is correct', async () => {
      const config = await createUserLLMConfig('openai', testUserId);

      expect(config.provider).toBe('openai');
      expect(['openai', 'anthropic', 'azure_openai']).toContain(config.provider);
    });

    it('should handle corrupted configuration data', async () => {
      await db.insert(llmConfigurations).values({
        scope: 'user',
        userId: testUserId,
        organizationId: null,
        name: 'Corrupted Config',
        provider: 'openai',
        apiKeyEncrypted: null as any, // Invalid: null API key
        model: 'gpt-4',
        isActive: true,
        isDefault: false,
        createdBy: testUserId,
      });

      await expect(
        configResolver.resolve({ organizationId: testOrgId, userId: testUserId })
      ).rejects.toThrow();
    });
  });
});
