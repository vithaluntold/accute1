/**
 * Seed Default Azure OpenAI LLM Configuration
 * 
 * Creates a default LLM configuration for the Sterling organization
 * using Azure OpenAI. This ensures AI agents can work out of the box.
 * 
 * Usage: tsx server/seed-default-llm.ts
 */

import { storage } from "./storage";
import { encrypt } from "./llm-service";

async function seedDefaultLLM() {
  try {
    console.log("🔧 Seeding default Azure OpenAI LLM configuration...\n");

    // Get Sterling organization
    const organizations = await storage.getAllOrganizations();
    const sterling = organizations.find(org => org.slug === "sterling-accounting");
    
    if (!sterling) {
      throw new Error("Sterling organization not found. Please run initialization first.");
    }

    console.log(`✓ Found organization: ${sterling.name} (${sterling.id})`);

    // Check if default LLM config already exists
    const existingDefault = await storage.getDefaultLlmConfiguration(sterling.id);
    
    if (existingDefault) {
      console.log(`\n⚠️  Default LLM configuration already exists:`);
      console.log(`   Name: ${existingDefault.name}`);
      console.log(`   Provider: ${existingDefault.provider}`);
      console.log(`   Model: ${existingDefault.model}`);
      console.log(`\nSkipping seed. Delete existing config first if you want to recreate it.`);
      return;
    }

    // Get admin user for createdBy field
    const users = await storage.getAllUsers();
    const admin = users.find(u => u.email === "admin@sterling.com");
    
    if (!admin) {
      throw new Error("Admin user not found. Please run initialization first.");
    }

    // Check for environment variables
    const azureApiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    
    if (!azureApiKey) {
      console.log(`\n⚠️  Warning: No API key found in environment`);
      console.log(`   Please set one of these environment variables:`);
      console.log(`   - AZURE_OPENAI_API_KEY (for Azure OpenAI)`);
      console.log(`   - OPENAI_API_KEY (for OpenAI)`);
      console.log(`\n   Using placeholder for now. Update via UI after seeding.\n`);
    }

    const apiKeyToUse = azureApiKey || "your-api-key-here";
    const encryptedKey = encrypt(apiKeyToUse);

    // Determine provider based on available env vars
    const provider = azureEndpoint ? "azure" : "openai";
    const modelVersion = "2024-12-01-preview";

    console.log(`\n📝 Creating default LLM configuration:`);
    console.log(`   Provider: ${provider}`);
    console.log(`   Model: gpt-4o`);
    if (provider === "azure") {
      console.log(`   Endpoint: ${azureEndpoint || "Not configured"}`);
      console.log(`   API Version: ${modelVersion}`);
    }

    // Create default LLM configuration
    const config = await storage.createLlmConfiguration({
      name: "Default Azure OpenAI",
      provider: provider,
      model: "gpt-4o",
      modelVersion: modelVersion,
      apiKeyEncrypted: encryptedKey,
      azureEndpoint: azureEndpoint || null,
      azureDeploymentName: null,
      isDefault: true,
      isActive: true,
      organizationId: sterling.id,
      createdBy: admin.id
    });

    console.log(`\n✅ Default LLM configuration created successfully!`);
    console.log(`   Configuration ID: ${config.id}`);
    console.log(`   Organization: ${sterling.name}`);
    console.log(`   Is Default: ${config.isDefault}`);
    
    if (!azureApiKey) {
      console.log(`\n⚠️  IMPORTANT: Update API key in Settings > LLM Configuration`);
    }

    console.log(`\n✨ AI agents (Forma, Cadence, Parity, Echo, Relay, Scribe, Luca) can now use this configuration!`);

  } catch (error: any) {
    console.error("❌ Error seeding default LLM:", error.message);
    process.exit(1);
  }
}

// Run the seed
seedDefaultLLM();
