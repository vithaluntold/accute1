#!/usr/bin/env node
/**
 * Quick Agent Verification Script
 * Checks if all agents are properly loaded in the system
 */

import fetch from 'isomorphic-fetch';

const EXPECTED_AGENTS = [
  'cadence',
  'echo',
  'forma',
  'luca',
  'omnispectra',
  'parity',
  'radar',
  'relay',
  'scribe',
];

async function verifyAgents() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        ACCUTE AI AGENTS - REGISTRATION VERIFICATION        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // Fetch the list of agents from the API
    const response = await fetch('http://localhost:5000/api/agents');
    
    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const agents = await response.json();
    console.log(`✓ Found ${agents.length} agents registered in the system\n`);

    // Check each expected agent
    const found = [];
    const missing = [];

    for (const expectedId of EXPECTED_AGENTS) {
      const agent = agents.find(a => a.id === expectedId);
      if (agent) {
        found.push(agent);
        console.log(`✅ ${agent.name.padEnd(20)} (${agent.id})`);
      } else {
        missing.push(expectedId);
        console.log(`❌ ${expectedId.padEnd(20)} - NOT FOUND`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Total: ${EXPECTED_AGENTS.length} | Found: ${found.length} | Missing: ${missing.length}`);
    console.log('='.repeat(70));

    if (missing.length === 0) {
      console.log('\n🎉 ALL AGENTS PROPERLY REGISTERED!\n');
      console.log('✅ To test the agents:');
      console.log('   1. Open the app in your browser');
      console.log('   2. Login with: admin@sterling.com / Admin123!');
      console.log('   3. Click on Luca (chat icon) in the bottom right');
      console.log('   4. Send a message to test');
      console.log('   5. Check other agents in the "AI Agents" section\n');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${missing.length} agent(s) not properly registered`);
      console.log(`Missing: ${missing.join(', ')}\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    console.error('Make sure the server is running on http://localhost:5000');
    process.exit(1);
  }
}

verifyAgents();
