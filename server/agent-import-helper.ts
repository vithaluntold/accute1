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
  // Check multiple production indicators to ensure proper detection
  const isProduction = process.env.NODE_ENV === 'production' || 
                       !process.env.NODE_ENV?.includes('development') &&
                       (process.execPath.includes('dist') || process.argv[1]?.includes('dist'));
  
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
    console.error(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.error(`Process argv[1]: ${process.argv[1]}`);
    throw new Error(`Agent ${agentName} backend module not found or failed to load`);
  }
}
