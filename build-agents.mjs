#!/usr/bin/env node

/**
 * Build script for transpiling agent backends to production-ready JavaScript
 * 
 * This script:
 * 1. Finds all agent backend TypeScript files
 * 2. Transpiles each one using esbuild
 * 3. Outputs to dist/agents/<agent-name>/backend/index.js
 * 
 * This allows production to dynamically import agent backends as JavaScript modules.
 */

import { build } from 'esbuild';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENTS_DIR = join(__dirname, 'agents');
const DIST_DIR = join(__dirname, 'dist');

async function buildAgents() {
  console.log('🤖 Building agent backends for production...\n');
  
  try {
    // Find all agent directories (skip templates and examples starting with _)
    const agentDirs = await readdir(AGENTS_DIR, { withFileTypes: true });
    const agents = agentDirs
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('_'))
      .map(dirent => dirent.name);
    
    console.log(`Found ${agents.length} agents:`, agents.join(', '));
    console.log('');
    
    let successCount = 0;
    let failCount = 0;
    
    // Build each agent backend
    for (const agentName of agents) {
      const backendEntry = join(AGENTS_DIR, agentName, 'backend', 'index.ts');
      const outDir = join(DIST_DIR, 'agents', agentName, 'backend');
      
      try {
        // Create output directory
        await mkdir(outDir, { recursive: true });
        
        // Transpile using esbuild
        await build({
          entryPoints: [backendEntry],
          bundle: false, // Don't bundle, just transpile
          platform: 'node',
          format: 'esm',
          target: 'node20',
          outfile: join(outDir, 'index.js'),
          sourcemap: true,
          packages: 'external', // Mark all node_modules as external
        });
        
        console.log(`✅ ${agentName}`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${agentName}: ${error.message}`);
        failCount++;
      }
    }
    
    console.log('');
    console.log(`📦 Agent build complete: ${successCount} succeeded, ${failCount} failed`);
    
    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildAgents();
