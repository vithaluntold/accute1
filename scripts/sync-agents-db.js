#!/usr/bin/env node

/**
 * Debug script to force sync all agents to database
 * Usage: node scripts/sync-agents-db.js
 */

const { AgentRegistry } = require('../server/agent-registry.js');

async function syncAllAgents() {
  console.log('🔄 Starting agent database sync...');
  
  try {
    const registry = AgentRegistry.getInstance();
    
    // Initialize the registry (loads and syncs all agents)
    await registry.init();
    
    console.log('✅ Agent database sync completed!');
    
    // List all agents from registry
    const agents = registry.getAllAgents();
    console.log(`\n📦 Registry contains ${Object.keys(agents).length} agents:`);
    Object.keys(agents).forEach(slug => {
      console.log(`  - ${slug}: ${agents[slug].name}`);
    });
    
    console.log('\n🔍 To verify database sync, check Railway logs or run:');
    console.log('   SELECT slug, name, "isPublished" FROM ai_agents;');
    
  } catch (error) {
    console.error('❌ Failed to sync agents:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

syncAllAgents();