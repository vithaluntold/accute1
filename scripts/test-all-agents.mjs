#!/usr/bin/env node
/**
 * Comprehensive Agent Testing Script
 * Tests all 9 AI agents to verify they load and respond correctly
 */

import WebSocket from 'ws';
import { setTimeout } from 'timers/promises';

const AGENTS = [
  { name: 'Cadence', id: 'cadence', description: 'Workflow automation expert' },
  { name: 'Echo', id: 'echo', description: 'Communication specialist' },
  { name: 'Forma', id: 'forma', description: 'Document processing expert' },
  { name: 'Luca', id: 'luca', description: 'Accounting & finance expert' },
  { name: 'OmniSpectra', id: 'omnispectra', description: 'Multi-domain AI assistant' },
  { name: 'Parity', id: 'parity', description: 'Compliance & audit specialist' },
  { name: 'Radar', id: 'radar', description: 'Anomaly detection expert' },
  { name: 'Relay', id: 'relay', description: 'Task coordination specialist' },
  { name: 'Scribe', id: 'scribe', description: 'Documentation generator' },
];

const TEST_PROMPT = "Hello, please introduce yourself briefly.";
const TIMEOUT_MS = 30000; // 30 seconds per agent
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:5000';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testAgent(agent) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let responseReceived = false;
    let fullResponse = '';
    
    log(`\n${'='.repeat(80)}`, 'cyan');
    log(`Testing: ${agent.name} (${agent.id})`, 'blue');
    log(`Description: ${agent.description}`, 'gray');
    log('='.repeat(80), 'cyan');

    const ws = new WebSocket(`${SERVER_URL}/ws/ai-stream`);
    
    const timeoutId = setTimeout(() => {
      if (!responseReceived) {
        ws.close();
        reject(new Error(`Timeout after ${TIMEOUT_MS}ms`));
      }
    }, TIMEOUT_MS);

    ws.on('open', () => {
      log('✓ WebSocket connected', 'gray');
      
      // Send test message
      const payload = {
        type: 'execute_agent',
        agentName: agent.id,
        input: TEST_PROMPT,
      };
      
      log(`→ Sending: "${TEST_PROMPT}"`, 'gray');
      ws.send(JSON.stringify(payload));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'stream_start') {
          log('✓ Stream started', 'gray');
          responseReceived = true;
        } else if (message.type === 'stream_chunk') {
          const chunk = message.chunk || message.content || '';
          fullResponse += chunk;
          process.stdout.write('.');
        } else if (message.type === 'stream_end') {
          clearTimeout(timeoutId);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          
          console.log(); // New line after dots
          log('✓ Stream ended', 'gray');
          log(`\n← Response (${fullResponse.length} chars, ${duration}s):`, 'gray');
          log(fullResponse.substring(0, 200) + (fullResponse.length > 200 ? '...' : ''), 'gray');
          
          ws.close();
          resolve({
            agent: agent.name,
            status: 'PASSED',
            duration: parseFloat(duration),
            responseLength: fullResponse.length,
            response: fullResponse,
          });
        } else if (message.type === 'error') {
          clearTimeout(timeoutId);
          ws.close();
          reject(new Error(message.error || message.message || 'Unknown error'));
        }
      } catch (error) {
        clearTimeout(timeoutId);
        ws.close();
        reject(error);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    ws.on('close', () => {
      clearTimeout(timeoutId);
      if (!responseReceived) {
        reject(new Error('WebSocket closed without receiving response'));
      }
    });
  });
}

async function runTests() {
  log('\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║              ACCUTE AI AGENTS - COMPREHENSIVE TEST SUITE             ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝\n', 'cyan');
  
  log(`Server: ${SERVER_URL}`, 'gray');
  log(`Testing ${AGENTS.length} agents...`, 'gray');
  log(`Timeout: ${TIMEOUT_MS}ms per agent\n`, 'gray');

  const results = [];
  let passed = 0;
  let failed = 0;

  // Wait for server to be ready
  log('Waiting 2 seconds for server to be fully ready...', 'yellow');
  await setTimeout(2000);

  for (const agent of AGENTS) {
    try {
      const result = await testAgent(agent);
      results.push(result);
      log(`\n✅ PASSED: ${agent.name}`, 'green');
      passed++;
    } catch (error) {
      results.push({
        agent: agent.name,
        status: 'FAILED',
        error: error.message,
      });
      log(`\n❌ FAILED: ${agent.name}`, 'red');
      log(`   Error: ${error.message}`, 'red');
      failed++;
    }

    // Small delay between tests
    await setTimeout(500);
  }

  // Print summary
  log('\n\n╔══════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                          TEST RESULTS SUMMARY                         ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════════════╝\n', 'cyan');

  results.forEach((result) => {
    const status = result.status === 'PASSED' 
      ? `${colors.green}✅ PASSED${colors.reset}` 
      : `${colors.red}❌ FAILED${colors.reset}`;
    
    console.log(`${status} - ${result.agent}`);
    
    if (result.status === 'PASSED') {
      console.log(`        Duration: ${result.duration}s | Response: ${result.responseLength} chars`);
    } else {
      console.log(`        Error: ${result.error}`);
    }
  });

  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`Total: ${AGENTS.length} | Passed: ${colors.green}${passed}${colors.reset} | Failed: ${colors.red}${failed}${colors.reset}`, 'cyan');
  log('='.repeat(80), 'cyan');

  if (failed === 0) {
    log('\n🎉 ALL AGENTS WORKING PERFECTLY!', 'green');
    process.exit(0);
  } else {
    log(`\n⚠️  ${failed} agent(s) failed. Please check the errors above.`, 'red');
    process.exit(1);
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  log('\n\n⚠️  Tests interrupted by user', 'yellow');
  process.exit(130);
});

// Run tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
