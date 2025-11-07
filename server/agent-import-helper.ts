/**
 * Agent Import Helper
 * 
 * Handles dynamic imports of agent backends in both development and production.
 * - Development: Uses .ts files directly (tsx transpiles on-the-fly)
 * - Production: Uses compiled .js files from dist/agents/
 */

import { pathToFileURL } from 'url';
import path from 'path';

/**
 * Dynamically import an agent backend module
 * @param agentName - Name of the agent (e.g., 'cadence', 'luca', 'forma')
 * @returns The imported module
 */
export async function importAgentBackend(agentName: string): Promise<any> {
  // CRITICAL DEBUG INFO
  console.error(`========== AGENT LOADER DEBUG: ${agentName} ==========`);
  console.error(`NODE_ENV: "${process.env.NODE_ENV}"`);
  console.error(`process.cwd(): "${process.cwd()}"`);
  console.error(`process.execPath: "${process.execPath}"`);
  console.error(`process.argv[0]: "${process.argv[0]}"`);
  console.error(`process.argv[1]: "${process.argv[1]}"`);
  console.error(`__dirname: "${__dirname}"`);
  
  // Check multiple production indicators to ensure proper detection
  const check1 = process.env.NODE_ENV === 'production';
  const check2 = !process.env.NODE_ENV?.includes('development');
  const check3 = process.execPath.includes('dist');
  const check4 = process.argv[1]?.includes('dist');
  
  console.error(`Check 1 (NODE_ENV === 'production'): ${check1}`);
  console.error(`Check 2 (!NODE_ENV.includes('development')): ${check2}`);
  console.error(`Check 3 (execPath.includes('dist')): ${check3}`);
  console.error(`Check 4 (argv[1].includes('dist')): ${check4}`);
  
  const isProduction = check1 || (check2 && (check3 || check4));
  console.error(`Final isProduction: ${isProduction}`);
  console.error(`======================================`);
  
  let modulePath: string;
  
  if (isProduction) {
    // Production: Load compiled JS from dist/agents/<name>/backend/index.js
    modulePath = path.join(process.cwd(), 'dist', 'agents', agentName, 'backend', 'index.js');
    console.log(`[AGENT LOADER] Production mode - Loading ${agentName} from: ${modulePath}`);
  } else {
    // Development: Load TS files from agents/<name>/backend/index.ts
    modulePath = path.join(process.cwd(), 'agents', agentName, 'backend', 'index.ts');
    console.log(`[AGENT LOADER] Development mode - Loading ${agentName} from: ${modulePath}`);
  }
  
  // Convert to file URL for ESM compatibility
  const moduleUrl = pathToFileURL(modulePath).href;
  
  try {
    return await import(moduleUrl);
  } catch (error) {
    console.error(`Failed to import agent ${agentName}:`, error);
    console.error(`Attempted path: ${modulePath}`);
    throw new Error(`Agent ${agentName} backend module not found or failed to load`);
  }
}
