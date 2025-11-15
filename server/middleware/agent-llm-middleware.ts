/**
 * Agent LLM Configuration Middleware
 * 
 * Centralized middleware for retrieving and managing LLM configurations
 * for AI agents. Provides automatic caching, workspace→user fallback,
 * and consistent error handling across all agents.
 * 
 * Usage:
 * ```typescript
 * import { withLLMConfig } from '../../server/middleware/agent-llm-middleware';
 * 
 * app.post("/api/agents/myagent/query", requireAuth, 
 *   withLLMConfig(async (req, res, llmConfig) => {
 *     // llmConfig is automatically provided with caching + fallback
 *     const agent = new MyAgent(llmConfig);
 *     const response = await agent.execute(req.body);
 *     res.json(response);
 *   })
 * );
 * ```
 */

import type { Response } from 'express';
import type { AuthRequest } from '../auth';
import type { LlmConfiguration } from '@shared/schema';
import { getLLMConfigService } from '../llm-config-service';

/**
 * Handler function that receives LLM configuration
 */
export type LLMConfigHandler = (
  req: AuthRequest,
  res: Response,
  llmConfig: LlmConfiguration
) => Promise<void> | void;

/**
 * Middleware that retrieves LLM configuration and passes it to the handler
 * 
 * Features:
 * - Automatic caching (5-minute TTL)
 * - Workspace→User config fallback
 * - Consistent error messages
 * - Works with optional llmConfigId in request body
 * 
 * @param handler - Express handler that receives (req, res, llmConfig)
 * @returns Express middleware function
 */
export function withLLMConfig(handler: LLMConfigHandler) {
  return async (req: AuthRequest, res: Response, next: any) => {
    try {
      // Extract optional llmConfigId from request body
      const { llmConfigId } = req.body || {};
      
      if (!req.user?.organizationId) {
        return res.status(403).json({ 
          error: "Organization access required to use AI agents" 
        });
      }
      
      // Get LLM configuration using centralized service
      // Priority: specific config → workspace default → user default
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getConfig({
        organizationId: req.user.organizationId,
        userId: req.userId,
        configId: llmConfigId
      });
      
      // Pass config to handler
      await handler(req, res, llmConfig);
    } catch (error: any) {
      // If headers already sent (partial response), just log and bail
      if (res.headersSent) {
        console.error('[withLLMConfig] Error after headers sent:', error);
        return;
      }
      
      // Handle known LLM configuration errors with user-friendly messages
      if (error.message?.includes('No active LLM configuration')) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure an AI provider in Workspace Settings or your User Settings." 
        });
      }
      
      if (error.message?.includes('LLM configuration not found')) {
        return res.status(404).json({ 
          error: "The specified LLM configuration was not found or you don't have access to it." 
        });
      }
      
      if (error.message?.includes('does not belong to')) {
        return res.status(403).json({ 
          error: "Access denied to the specified LLM configuration." 
        });
      }
      
      if (error.message?.includes('is inactive')) {
        return res.status(400).json({ 
          error: "The specified LLM configuration is inactive. Please activate it or select a different one." 
        });
      }
      
      // CRITICAL FIX: Handle decryption and API errors with detailed logging
      // Log structured error information for debugging
      console.error('[withLLMConfig] Unexpected error:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        provider: error?.provider,
        model: error?.model
      });
      console.error('[withLLMConfig] Error stack:', error?.stack);
      
      // For API/decryption errors, return user-friendly JSON
      // Check for common error patterns
      if (error?.message?.includes('decrypt') || error?.message?.includes('ENCRYPTION_KEY')) {
        return res.status(500).json({
          error: "Failed to decrypt LLM credentials. Please contact your administrator.",
          details: "Encryption key configuration issue"
        });
      }
      
      if (error?.message?.includes('API key') || error?.status === 401 || error?.status === 403) {
        return res.status(500).json({
          error: "Invalid API key configuration. Please update your LLM settings.",
          details: error?.message,
          hint: "Check your API key in Workspace Settings"
        });
      }
      
      // For other errors, delegate to Express global error handler via next()
      // This ensures consistent error handling and logging across the app
      next(error);
    }
  };
}

/**
 * Get LLM configuration directly (for non-Express contexts like WebSocket)
 * 
 * @param options Configuration options
 * @returns LLM configuration
 * @throws Error if no configuration found
 */
export async function getLLMConfig(options: {
  organizationId?: string;
  userId?: string;
  configId?: string;
}): Promise<LlmConfiguration> {
  const llmConfigService = getLLMConfigService();
  return llmConfigService.getConfig(options);
}

/**
 * Clear LLM configuration cache (call after CRUD operations)
 * 
 * @param options Cache invalidation options
 */
export function clearLLMConfigCache(options?: { 
  organizationId?: string; 
  userId?: string;
}): void {
  const llmConfigService = getLLMConfigService();
  llmConfigService.clearCache(options);
}
