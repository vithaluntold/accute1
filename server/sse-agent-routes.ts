import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from './auth';
import { SSEStream, streamRegistry, createStreamId } from './sse-agent-stream';
import { storage } from './storage';
import { sessionService } from './agent-session-service';
import { getLLMConfig } from './middleware/agent-llm-middleware';
import { createStaticAgentInstance } from './agent-static-factory';
import { agentSupportsStreaming } from './agent-loader';
import { getAgentBySlug } from '@shared/agent-registry';

const router = Router();

/**
 * Schema for stream initialization request
 */
const streamInitSchema = z.object({
  agentSlug: z.string(),
  message: z.string(),
  sessionId: z.string(), // Required for security and audit trail
  llmConfigId: z.string().optional(),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
  contextData: z.any().optional(),
});

/**
 * POST /api/ai-agent/stream
 * Initialize a new SSE stream for agent response
 */
router.post('/stream', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = streamInitSchema.parse(req.body);
    const { agentSlug, message, sessionId, llmConfigId, contextType, contextId, contextData } = data;
    
    const user = req.user!;
    
    // Create unique stream ID
    const streamId = createStreamId();
    
    console.log(`[SSE Stream] Initializing stream ${streamId} for agent ${agentSlug} (user: ${user.id})`);
    
    // Validate session belongs to user AND organization
    // LUCA SPECIAL CASE: Luca uses luca_chat_sessions table instead of agent_sessions
    let session: any;
    if (agentSlug === 'luca') {
      session = await storage.getLucaChatSession(sessionId);
    } else {
      // Use sessionService.getSessionBySessionId with workspace context
      const workspaceId = user.effectiveOrganizationId || user.organizationId;
      console.log(`[SSE Stream] Looking up session: ${sessionId} for user: ${user.id} in workspace: ${workspaceId}`);
      session = await sessionService.getSessionBySessionId(sessionId, user.id, workspaceId);
      console.log(`[SSE Stream] Session lookup result:`, session ? 'FOUND' : 'NOT_FOUND');
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Strict ownership check: session must belong to current user
    if (session.userId !== user.id) {
      console.warn(`[SSE Stream] User ${user.id} attempted to access session ${sessionId} owned by ${session.userId}`);
      return res.status(403).json({ error: 'Unauthorized: session does not belong to current user' });
    }
    
    // Strict organization check: session organization must match workspace context
    if (user.effectiveOrganizationId && session.organizationId !== user.effectiveOrganizationId) {
      console.warn(`[SSE Stream] Org mismatch: workspace context ${user.effectiveOrganizationId} vs session org ${session.organizationId}`);
      return res.status(403).json({ error: 'Unauthorized: organization mismatch' });
    }
    
    // Validate agent exists in Agent Registry
    const agentMetadata = getAgentBySlug(agentSlug);
    if (!agentMetadata) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Save message to session immediately
    // LUCA SPECIAL CASE: Luca uses luca_chat_messages table
    if (agentSlug === 'luca') {
      await storage.createLucaChatMessage({
        sessionId,
        role: 'user',
        content: message,
        metadata: {},
      });
    } else {
      await storage.createAgentMessage({
        sessionId: session.id,
        role: 'user',
        content: message,
        metadata: {},
      });
    }
    
    // Create stream metadata for authorization
    streamRegistry.createMetadata({
      streamId,
      userId: user.id,
      organizationId: user.effectiveOrganizationId, // Use workspace context
      sessionId,
      agentSlug,
      createdAt: new Date(),
    });
    
    // Return stream ID immediately so client can start listening
    res.json({
      streamId,
      status: 'initialized',
      sessionId,
    });
    
    // Start processing in background (don't await)
    processAgentStream(streamId, {
      agentSlug,
      message,
      sessionId,
      sessionDbId: session.id, // Pass the database UUID for session
      llmConfigId,
      contextType,
      contextId,
      contextData,
      userId: user.id,
      organizationId: user.effectiveOrganizationId || user.organizationId, // Use proper fallback
      user: user, // Pass the full user object for workspace context
    }).catch(error => {
      console.error(`[SSE Stream] Error processing stream ${streamId}:`, error);
      const stream = streamRegistry.get(streamId);
      if (stream && !stream.closed) {
        // Provide user-friendly error message
        let userError: string;
        let debugInfo: string = error.message || 'Unknown error';
        
        if (error.message?.includes('LLM') || error.message?.includes('configuration')) {
          userError = 'AI configuration error. Please contact your administrator.';
        } else if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
          userError = 'Request timed out. The AI service may be busy. Please try again.';
        } else if (error.message?.includes('not found') && error.message?.includes('Agent')) {
          userError = `The ${agentSlug} agent is temporarily unavailable. Please try again.`;
        } else {
          userError = 'An unexpected error occurred while processing your request. Please try again.';
        }
        
        stream.error(JSON.stringify({
          message: userError,
          debugInfo,
          agentSlug,
          timestamp: new Date().toISOString()
        }));
        stream.close();
      }
    });
    
  } catch (error: any) {
    console.error('[SSE Stream] Error initializing stream:', error);
    
    // Provide specific error messages based on error type
    let userError: string;
    let statusCode: number = 400;
    
    if (error.name === 'ZodError') {
      // Handle validation errors
      const firstError = error.errors[0];
      if (firstError?.path.includes('agentSlug')) {
        userError = 'Please select an AI agent before sending a message.';
      } else if (firstError?.path.includes('message')) {
        userError = 'Please enter your question or request.';
      } else if (firstError?.path.includes('sessionId')) {
        userError = 'Session information is missing. Please refresh the page and try again.';
      } else {
        userError = 'Request format is invalid. Please check your input and try again.';
      }
    } else if (error.message?.includes('session') && error.message?.includes('not found')) {
      userError = 'Session not found. Please refresh the page and start a new conversation.';
      statusCode = 404;
    } else if (error.message?.includes('Agent not found')) {
      userError = 'The selected AI agent is not available. Please try a different agent.';
      statusCode = 404;
    } else if (error.message?.includes('Unauthorized') || error.message?.includes('permission')) {
      userError = 'You do not have permission to access this session. Please refresh and try again.';
      statusCode = 403;
    } else if (error.message?.includes('organization')) {
      userError = 'Organization access error. Please contact your administrator.';
      statusCode = 403;
    } else if (error.message?.includes('LLM') || error.message?.includes('configuration')) {
      userError = 'AI configuration issue. Please contact your administrator or try again later.';
      statusCode = 500;
    } else if (error.message?.includes('rate limit')) {
      userError = 'Too many requests. Please wait a moment before trying again.';
      statusCode = 429;
    } else {
      userError = 'Unable to start AI conversation. Please try again or contact support if the problem persists.';
      statusCode = 500;
    }
    
    res.status(statusCode).json({ 
      error: userError,
      debugInfo: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ai-agent/stream/:streamId
 * Establish SSE connection for streaming agent responses
 * SECURITY: Verifies stream ownership before allowing connection
 */
router.get('/stream/:streamId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { streamId } = req.params;
  const user = req.user!;
  
  console.log(`[SSE Stream] Client connecting to stream ${streamId} (user: ${user.id})`);
  
  // Verify stream ownership
  if (!streamRegistry.verifyOwnership(streamId, user.id, user.effectiveOrganizationId)) {
    console.warn(`[SSE Stream] Authorization failed for stream ${streamId} by user ${user.id}`);
    return res.status(403).json({ error: 'Stream not found or unauthorized' });
  }
  
  // Create SSE stream
  const sseStream = new SSEStream(res, streamId);
  
  // Register stream with authorization
  const registered = streamRegistry.register(streamId, sseStream, user.id, user.effectiveOrganizationId);
  
  if (!registered) {
    console.error(`[SSE Stream] Failed to register stream ${streamId}`);
    return res.status(403).json({ error: 'Failed to register stream' });
  }
  
  // Send initial connected event
  sseStream.sendEvent({
    type: 'connected',
    userId: user.id,
    metadata: { streamId },
  });
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`[SSE Stream] Client disconnected from stream ${streamId}`);
    streamRegistry.cleanup(streamId);
  });
  
  req.on('error', (error) => {
    console.error(`[SSE Stream] Client error on stream ${streamId}:`, error);
    streamRegistry.cleanup(streamId);
  });
});

/**
 * POST /api/ai-agent/stream/:streamId/cancel
 * Cancel an ongoing stream
 * SECURITY: Verifies stream ownership before cancellation
 */
router.post('/stream/:streamId/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
  const { streamId } = req.params;
  const user = req.user!;
  
  console.log(`[SSE Stream] Cancelling stream ${streamId} (user: ${user.id})`);
  
  // Verify stream ownership
  if (!streamRegistry.verifyOwnership(streamId, user.id, user.effectiveOrganizationId)) {
    console.warn(`[SSE Stream] Authorization failed: user ${user.id} attempted to cancel stream ${streamId}`);
    return res.status(403).json({ error: 'Stream not found or unauthorized' });
  }
  
  const stream = streamRegistry.get(streamId);
  if (stream) {
    stream.error('Stream cancelled by user');
    streamRegistry.cleanup(streamId);
    res.json({ status: 'cancelled' });
  } else {
    // Stream metadata exists but no active connection (not yet connected or already finished)
    streamRegistry.cleanup(streamId);
    res.json({ status: 'cancelled' });
  }
});

/**
 * Process agent execution and stream results
 */
async function processAgentStream(
  streamId: string,
  params: {
    agentSlug: string;
    message: string;
    sessionId: string;
    sessionDbId: string; // Database UUID for session messages
    llmConfigId?: string;
    contextType?: string;
    contextId?: string;
    contextData?: any;
    userId: string;
    organizationId?: string;
    user?: any; // Add user object for workspace context
  }
): Promise<void> {
  const { agentSlug, message, sessionId, sessionDbId, llmConfigId, contextType, contextId, contextData, userId, organizationId, user } = params;
  
  // Declare stream at function scope so it's accessible in catch block
  let stream: SSEStream | undefined;
  
  try {
    // CRITICAL: Wait for client to establish SSE connection before executing agent
    // This prevents resource-intensive agent execution when client never connects
    let attempts = 0;
    const maxAttempts = 100; // Wait up to 10 seconds
    
    console.log(`[SSE Stream] Waiting for client connection to stream ${streamId}...`);
    
    while (!stream && attempts < maxAttempts) {
      stream = streamRegistry.get(streamId);
      if (!stream) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
    
    if (!stream) {
      console.error(`[SSE Stream] TIMEOUT: Client never connected to stream ${streamId} after ${maxAttempts * 100}ms`);
      
      // Check if metadata still exists
      const metadata = streamRegistry.getMetadata(streamId);
      if (metadata) {
        console.error(`[SSE Stream] Cleaning up orphaned stream metadata for ${streamId}`);
        streamRegistry.cleanup(streamId);
      }
      
      // Agent execution cancelled - client never connected
      // This prevents resource waste on abandoned requests
      return;
    }
    
    console.log(`[SSE Stream] Client connected, starting agent execution for stream ${streamId}`);
    
    // Get LLM config with workspace context
    // PROPER FIX: Use user's current organization as workspace context
    const effectiveWorkspaceId = user.effectiveOrganizationId || user.organizationId;
    
    console.log(`[processAgentStream] Calling getLLMConfig with:`, {
      configId: llmConfigId,
      workspaceId: effectiveWorkspaceId,
      userId,
      agentSlug,
      userOrgId: user.organizationId,
      userEffectiveOrgId: user.effectiveOrganizationId
    });
    
    const llmConfig = llmConfigId
      ? await getLLMConfig({ 
          configId: llmConfigId, 
          workspaceId: effectiveWorkspaceId,
          userId 
        })
      : await storage.getDefaultLLMConfigForOrganization(effectiveWorkspaceId);
    
    if (!llmConfig) {
      // Debug: Check if ANY configs exist for this org
      const allConfigs = await storage.getLlmConfigurationsByOrganization(effectiveWorkspaceId);
      console.error(`[SSE Stream] No default LLM config found for org ${effectiveWorkspaceId}`);
      console.error(`[SSE Stream] Total configs in org: ${allConfigs.length}`);
      if (allConfigs.length > 0) {
        console.error(`[SSE Stream] Available configs:`, allConfigs.map(c => ({
          id: c.id,
          name: c.name,
          isDefault: c.isDefault,
          isActive: c.isActive,
          provider: c.provider
        })));
      }
      throw new Error(`No LLM configuration found for organization ${effectiveWorkspaceId}. Please configure an LLM provider in Organization Settings.`);
    }
    
    // Create agent instance WITH LLM configuration
    const agent = createStaticAgentInstance(agentSlug, llmConfig);
    if (!agent) {
      throw new Error(`Agent ${agentSlug} not found`);
    }
    
    // Check if agent supports streaming
    const supportsStreaming = agentSupportsStreaming(agentSlug);
    
    stream.start({ agentSlug, supportsStreaming });
    
    let fullResponse = '';
    
    // Check for executeStream method (actual implementation name used by all agents)
    if (supportsStreaming && typeof agent.executeStream === 'function') {
      // Streaming execution
      console.log(`[SSE Stream] Executing streaming agent ${agentSlug}`);
      
      await agent.executeStream(
        message,
        (chunk: string) => {
          if (!stream || stream.closed) {
            console.log(`[SSE Stream] Stream ${streamId} closed, stopping chunks`);
            return;
          }
          fullResponse += chunk;
          stream.chunk(chunk);
        }
      );
    } else {
      // Non-streaming execution
      console.log(`[SSE Stream] Executing non-streaming agent ${agentSlug}`);
      
      const response = await agent.execute(message, {
        userId,
        organizationId,
        sessionId,
        llmConfig,
        contextType,
        contextId,
        contextData,
      });
      
      // Ensure response is a string
      if (typeof response === 'string') {
        fullResponse = response;
      } else if (response && typeof response === 'object') {
        // Handle objects with 'response' field
        if ('response' in response && typeof response.response === 'string') {
          fullResponse = response.response;
        } else {
          // Fallback: stringify the entire object
          fullResponse = JSON.stringify(response, null, 2);
        }
      } else {
        fullResponse = String(response || '');
      }
      
      // Send as single chunk
      if (!stream.closed) {
        stream.chunk(fullResponse);
      }
    }
    
    // Save agent response to session
    // LUCA SPECIAL CASE: Luca uses luca_chat_messages table
    if (fullResponse) {
      if (agentSlug === 'luca') {
        await storage.createLucaChatMessage({
          sessionId,
          role: 'assistant',
          content: fullResponse,
          metadata: {},
        });
      } else {
        await storage.createAgentMessage({
          sessionId: sessionDbId,
          role: 'assistant',
          content: fullResponse,
          metadata: {},
        });
      }
    }
    
    // Send completion
    if (!stream.closed) {
      stream.end({ messageLength: fullResponse.length });
      stream.close();
    }
    
    console.log(`[SSE Stream] Completed stream ${streamId}, response length: ${fullResponse.length}`);
    
  } catch (error: any) {
    console.error(`[SSE Stream] Error in stream ${streamId}:`, error);
    
    // Determine user-friendly error message
    let userError: string;
    let debugInfo: string = error.message || 'Unknown error';
    
    if (error.message?.includes('No LLM configuration found')) {
      userError = 'AI configuration not found. Please set up an AI model in Settings or contact your administrator.';
    } else if (error.message?.includes('Failed to decrypt LLM credentials')) {
      userError = 'AI configuration issue detected. Please contact your administrator or try selecting a different AI model.';
    } else if (error.message?.includes('not found') && error.message?.includes('Agent')) {
      userError = `The ${params.agentSlug} agent is temporarily unavailable. Please try again or contact support.`;
    } else if (error.message?.includes('timeout') || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      userError = 'The AI service is taking longer than expected. Please try again or break your request into smaller parts.';
    } else if (error.message?.includes('rate limit') || error.code === 'RATE_LIMITED') {
      userError = 'You are sending requests too quickly. Please wait a moment before trying again.';
    } else if (error.message?.includes('quota') || error.message?.includes('limit') || error.code === 'QUOTA_EXCEEDED') {
      userError = 'AI service limit reached. Please try again later or contact your administrator.';
    } else if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
      userError = 'Authentication error. Please refresh the page and try again.';
    } else if (error.message?.includes('context') || error.message?.includes('memory') || error.message?.includes('too long')) {
      userError = 'Your conversation has become too long. Please start a new session to continue.';
    } else if (error.message?.includes('network') || error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      userError = 'Network connectivity issue. Please check your internet connection and try again.';
    } else if (error.message?.includes('session')) {
      userError = 'Session error occurred. Your conversation may be lost. Please refresh and start a new session.';
    } else {
      userError = `Unable to process your request with ${params.agentSlug}. Please try again or contact support if the problem persists.`;
    }
    
    if (stream && !stream.closed) {
      stream.error(JSON.stringify({
        message: userError,
        debugInfo,
        agentSlug: params.agentSlug,
        timestamp: new Date().toISOString(),
        streamId
      }));
      stream.close();
    }
  } finally {
    // Cleanup stream after a short delay
    setTimeout(() => {
      streamRegistry.cleanup(streamId);
    }, 1000);
  }
}

/**
 * GET /api/ai-agent/stream/stats
 * Get stream statistics (admin only)
 */
router.get('/stats', requireAuth, (req: AuthRequest, res: Response) => {
  res.json(streamRegistry.getStats());
});

export function registerSSEAgentRoutes(app: any) {
  app.use('/api/ai-agent', router);
  console.log('✅ SSE Agent routes registered');
}
