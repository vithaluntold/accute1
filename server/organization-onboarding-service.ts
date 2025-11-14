/**
 * Organization Onboarding Service
 * 
 * Centralizes all post-creation setup for new organizations, ensuring
 * every organization gets required resources (default LLM configs, etc.)
 */

import type { storage } from './storage';
import { encrypt } from './llm-service';

type Storage = typeof storage;

export class OrganizationOnboardingService {
  private storage: Storage;
  
  constructor(storage: Storage) {
    this.storage = storage;
  }
  
  /**
   * Ensure an organization has a default LLM configuration.
   * Creates one if missing, leaves existing configs untouched.
   * 
   * @param organizationId Organization ID
   * @param createdById User ID of the creator (for audit trail)
   * @returns Created or existing LLM configuration
   */
  async ensureDefaultLlmConfig(
    organizationId: string,
    createdById: string
  ): Promise<any> {
    // Check if organization already has a default LLM config
    const existingDefault = await this.storage.getDefaultLlmConfiguration(organizationId);
    
    if (existingDefault) {
      console.log(`✓ Organization ${organizationId} already has default LLM config`);
      return existingDefault;
    }
    
    console.log(`📝 Creating default LLM configuration for organization ${organizationId}...`);
    
    // Determine provider and credentials from environment (trim all values)
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
    const azureEndpointRaw = process.env.AZURE_OPENAI_ENDPOINT?.trim();
    const azureDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
    const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
    
    // Validate and normalize Azure endpoint (if present)
    let azureEndpoint: string | undefined;
    if (azureEndpointRaw && azureEndpointRaw.length > 0) {
      // Validate HTTPS scheme and normalize trailing slashes
      if (!azureEndpointRaw.startsWith('https://')) {
        console.error(`❌ Invalid AZURE_OPENAI_ENDPOINT: must start with https:// (got: ${azureEndpointRaw})`);
      } else {
        // Remove trailing slashes for consistency
        azureEndpoint = azureEndpointRaw.replace(/\/+$/, '');
      }
    }
    
    let provider: 'azure' | 'openai' | 'anthropic';
    let apiKey: string;
    let configured = false;
    let azureEndpointValue: string | null = null;
    let azureDeploymentNameValue: string | null = null;
    let modelVersion: string | null = null;
    
    // Priority: OpenAI > Anthropic > Azure (requires full config) > Placeholder
    if (openaiApiKey && openaiApiKey.length > 0) {
      provider = 'openai';
      apiKey = openaiApiKey;
      configured = true;
    } else if (anthropicApiKey && anthropicApiKey.length > 0) {
      provider = 'anthropic';
      apiKey = anthropicApiKey;
      configured = true;
    } else if (azureApiKey || azureEndpoint || azureDeploymentName) {
      // CRITICAL: Azure requires ALL THREE components (trimmed, non-empty, valid)
      // Validate all required Azure components
      const hasApiKey = !!azureApiKey && azureApiKey.length > 0;
      const hasEndpoint = !!azureEndpoint && azureEndpoint.length > 0;
      const hasDeploymentName = !!azureDeploymentName && azureDeploymentName.length > 0;
      
      if (hasApiKey && hasEndpoint && hasDeploymentName) {
        // Complete Azure configuration - all values already trimmed and validated
        provider = 'azure';
        apiKey = azureApiKey;
        azureEndpointValue = azureEndpoint; // Already normalized (trailing slash removed)
        azureDeploymentNameValue = azureDeploymentName;
        modelVersion = '2024-12-01-preview';
        configured = true;
      } else {
        // CRITICAL: Partial Azure configuration detected
        console.error(`❌ CRITICAL: INCOMPLETE Azure OpenAI configuration for organization ${organizationId}`);
        console.error(`   - AZURE_OPENAI_API_KEY: ${hasApiKey ? '✓ Present' : '✗ Missing or empty'}`);
        console.error(`   - AZURE_OPENAI_ENDPOINT: ${hasEndpoint ? '✓ Present' : '✗ Missing or empty'}`);
        console.error(`   - AZURE_OPENAI_DEPLOYMENT_NAME: ${hasDeploymentName ? '✓ Present' : '✗ Missing or empty'}`);
        console.error(`   ⚠️  All three values are REQUIRED for Azure OpenAI.`);
        console.error(`   ⚠️  Creating INACTIVE Azure config with placeholders - organization AI will NOT work.`);
        console.error(`   ⚠️  FIX: Set all Azure environment variables OR remove them to use OpenAI/Anthropic.`);
        
        // Create INACTIVE Azure config with placeholders for missing fields
        // This preserves any valid credentials while surfacing the misconfiguration
        provider = 'azure';
        apiKey = azureApiKey || 'PLACEHOLDER_AZURE_API_KEY';
        azureEndpointValue = azureEndpoint || 'https://PLACEHOLDER.openai.azure.com';
        azureDeploymentNameValue = azureDeploymentName || 'PLACEHOLDER_DEPLOYMENT';
        modelVersion = '2024-12-01-preview';
        configured = false; // Mark as not fully configured (will be inactive)
      }
    } else {
      // No API keys available - use placeholder
      provider = 'openai'; // Default to OpenAI for UI consistency
      apiKey = 'PLACEHOLDER_API_KEY_PLEASE_UPDATE';
      configured = false;
      console.warn(`⚠️  No LLM provider credentials found in environment for organization ${organizationId}`);
      console.warn(`   Creating placeholder config - admin must update credentials via Settings`);
    }
    
    // Encrypt the API key (even if placeholder)
    const encryptedKey = encrypt(apiKey);
    
    // Determine model based on provider
    // Note: For Azure, the 'model' field serves as the deployment name in the API URL
    let model: string;
    switch (provider) {
      case 'azure':
        // CRITICAL: Use the trimmed, validated deployment name stored earlier
        // This prevents whitespace from breaking Azure API URLs
        model = azureDeploymentNameValue!;
        break;
      case 'openai':
        model = 'gpt-4o';
        break;
      case 'anthropic':
        model = 'claude-3-5-sonnet-20241022';
        break;
    }
    
    // Create default workspace-level LLM configuration
    const config = await this.storage.createLlmConfiguration({
      name: `Default ${provider === 'azure' ? 'Azure OpenAI' : provider === 'openai' ? 'OpenAI' : 'Anthropic'}`,
      provider,
      model, // For Azure, this is the deployment name used in the URL
      modelVersion,
      apiKeyEncrypted: encryptedKey,
      azureEndpoint: azureEndpointValue,
      isDefault: true,
      isActive: true,
      scope: 'workspace',
      organizationId,
      userId: null,
      createdBy: createdById,
    });
    
    if (configured) {
      console.log(`✅ Created default ${provider} LLM config for organization ${organizationId}`);
    } else {
      console.log(`⚠️  Created placeholder LLM config for organization ${organizationId} - requires API key update`);
    }
    
    return config;
  }
  
  /**
   * Complete onboarding setup for a new organization.
   * Called after organization creation to provision all required resources.
   * 
   * @param organizationId Organization ID
   * @param createdById User ID of the creator
   */
  async onboardOrganization(
    organizationId: string,
    createdById: string
  ): Promise<void> {
    console.log(`🚀 Onboarding organization ${organizationId}...`);
    
    // Ensure default LLM configuration
    await this.ensureDefaultLlmConfig(organizationId, createdById);
    
    // Future: Add other onboarding tasks here
    // - Default folder structure
    // - Default templates
    // - Feature flags
    // - Default roles (if not system-wide)
    
    console.log(`✅ Organization ${organizationId} onboarding complete`);
  }
}

// Singleton instance (initialized with storage)
let onboardingServiceInstance: OrganizationOnboardingService | null = null;

/**
 * Initialize the Organization Onboarding Service singleton
 */
export function initializeOnboardingService(storage: Storage): void {
  onboardingServiceInstance = new OrganizationOnboardingService(storage);
}

/**
 * Get the Organization Onboarding Service singleton instance
 */
export function getOnboardingService(): OrganizationOnboardingService {
  if (!onboardingServiceInstance) {
    throw new Error('Organization Onboarding Service not initialized');
  }
  return onboardingServiceInstance;
}
