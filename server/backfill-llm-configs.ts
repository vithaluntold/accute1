/**
 * Backfill Script: Create Default LLM Configurations
 * 
 * Creates default LLM configurations for existing organizations
 * that don't have them, ensuring AI agents work for all users.
 * 
 * Usage: tsx server/backfill-llm-configs.ts
 */

import { storage } from "./storage";
import { initializeOnboardingService, getOnboardingService } from "./organization-onboarding-service";

async function backfillLlmConfigs() {
  try {
    console.log("🔧 Starting LLM configuration backfill...\n");
    
    // Initialize the onboarding service
    initializeOnboardingService(storage);
    const onboardingService = getOnboardingService();
    
    // Get all organizations
    const organizations = await storage.getAllOrganizations();
    console.log(`📊 Found ${organizations.length} organizations\n`);
    
    let processed = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const org of organizations) {
      processed++;
      console.log(`[${processed}/${organizations.length}] Processing: ${org.name} (${org.id})`);
      
      try {
        // Check if organization already has a default LLM config
        const existingDefault = await storage.getDefaultLlmConfiguration(org.id);
        
        if (existingDefault) {
          console.log(`  ✓ Already has default LLM config (${existingDefault.provider})`);
          skipped++;
          continue;
        }
        
        // Get an admin user from this organization to use as createdBy
        const users = await storage.getAllUsers();
        const orgAdmin = users.find(u => 
          u.organizationId === org.id && 
          u.isActive
        );
        
        if (!orgAdmin) {
          console.log(`  ⚠️  No active users found - skipping`);
          skipped++;
          continue;
        }
        
        // Create default LLM config using onboarding service
        await onboardingService.ensureDefaultLlmConfig(org.id, orgAdmin.id);
        created++;
        
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        errors++;
      }
      
      console.log(''); // Blank line for readability
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary');
    console.log('='.repeat(60));
    console.log(`Total organizations:     ${organizations.length}`);
    console.log(`Configs created:         ${created}`);
    console.log(`Already configured:      ${skipped}`);
    console.log(`Errors:                  ${errors}`);
    console.log('='.repeat(60));
    
    if (created > 0) {
      console.log('\n✅ Backfill complete! AI agents are now available for all organizations.');
      if (process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
        console.log('   Configurations use environment API keys and are ready to use.');
      } else {
        console.log('\n⚠️  WARNING: No API keys found in environment!');
        console.log('   Placeholder configs were created - admins must update credentials.');
        console.log('   Set AZURE_OPENAI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.');
      }
    } else {
      console.log('\n✓ All organizations already have LLM configurations.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the backfill
backfillLlmConfigs();
