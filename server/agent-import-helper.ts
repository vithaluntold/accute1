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
  console.log(`[AGENT LOADER] Attempting to load agent: ${agentName}`);
  console.log(`[AGENT LOADER] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[AGENT LOADER] CWD: ${process.cwd()}`);
  
  // Try production path first (compiled JS)
  const prodPath = path.join(process.cwd(), 'dist', 'agents', agentName, 'backend', 'index.js');
  const prodUrl = pathToFileURL(prodPath).href;
  
  try {
    console.log(`[AGENT LOADER] Trying production path: ${prodPath}`);
    const module = await import(prodUrl);
    console.log(`[AGENT LOADER] ✅ Successfully loaded from production path`);
    return module;
  } catch (prodError) {
    console.log(`[AGENT LOADER] Production path failed, trying development path...`);
    
    // Fallback to development path (TypeScript)
    const devPath = path.join(process.cwd(), 'agents', agentName, 'backend', 'index.ts');
    const devUrl = pathToFileURL(devPath).href;
    
    try {
      console.log(`[AGENT LOADER] Trying development path: ${devPath}`);
      const module = await import(devUrl);
      console.log(`[AGENT LOADER] ✅ Successfully loaded from development path`);
      return module;
    } catch (devError) {
      console.error(`[AGENT LOADER] ❌ Failed to load agent ${agentName} from both paths`);
      console.error(`Production error:`, prodError);
      console.error(`Development error:`, devError);
      throw new Error(`Agent ${agentName} backend module not found. Tried:\n  - ${prodPath}\n  - ${devPath}`);
    }
  }
}
