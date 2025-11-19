import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from './auth';
import { SSEStream, streamRegistry, createStreamId } from './sse-agent-stream';
import { storage } from './storage';
import { getLLMConfig } from './middleware/agent-llm-middleware';
import { createStaticAgentInstance } from './agent-static-factory';
import { agentSupportsStreaming } from './agent-loader';

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
      session = await storage.getAgentSession(user.organizationId || undefined, sessionId);
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Strict ownership check: session must belong to current user
    if (session.userId !== user.id) {
      console.warn(`[SSE Stream] User ${user.id} attempted to access session ${sessionId} owned by ${session.userId}`);
      return res.status(403).json({ error: 'Unauthorized: session does not belong to current user' });
    }
    
    // Strict organization check: session organization must match user organization
    if (user.organizationId && session.organizationId !== user.organizationId) {
      console.warn(`[SSE Stream] Org mismatch: user org ${user.organizationId} vs session org ${session.organizationId}`);
      return res.status(403).json({ error: 'Unauthorized: organization mismatch' });
    }
    
    // Validate agent exists in Agent Foundry
    const { getAgentBySlug } = await import('./agents-static.js');
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
      await storage.createAgentSessionMessage({
        sessionId,
        sender: 'user',
        content: message,
        timestamp: new Date(),
      });
    }
    
    // Create stream metadata for authorization
    streamRegistry.createMetadata({
      streamId,
      userId: user.id,
      organizationId: user.organizationId || undefined,
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
      llmConfigId,
      contextType,
      contextId,
      contextData,
      userId: user.id,
      organizationId: user.organizationId || undefined,
    }).catch(error => {
      console.error(`[SSE Stream] Error processing stream ${streamId}:`, error);
      const stream = streamRegistry.get(streamId);
      if (stream && !stream.closed) {
        stream.error(error.message || 'Stream processing failed');
        stream.close();
      }
    });
    
  } catch (error: any) {
    console.error('[SSE Stream] Error initializing stream:', error);
    res.status(400).json({ error: error.message || 'Failed to initialize stream' });
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
  if (!streamRegistry.verifyOwnership(streamId, user.id, user.organizationId || undefined)) {
    console.warn(`[SSE Stream] Authorization failed for stream ${streamId} by user ${user.id}`);
    return res.status(403).json({ error: 'Stream not found or unauthorized' });
  }
  
  // Create SSE stream
  const sseStream = new SSEStream(res, streamId);
  
  // Register stream with authorization
  const registered = streamRegistry.register(streamId, sseStream, user.id, user.organizationId || undefined);
  
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
  if (!streamRegistry.verifyOwnership(streamId, user.id, user.organizationId || undefined)) {
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
    llmConfigId?: string;
    contextType?: string;
    contextId?: string;
    contextData?: any;
    userId: string;
    organizationId?: string;
  }
): Promise<void> {
  const { agentSlug, message, sessionId, llmConfigId, contextType, contextId, contextData, userId, organizationId } = params;
  
  try {
    // CRITICAL: Wait for client to establish SSE connection before executing agent
    // This prevents resource-intensive agent execution when client never connects
    let stream: SSEStream | undefined;
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
    
    // Get LLM config
    const llmConfig = llmConfigId
      ? await getLLMConfig(llmConfigId, organizationId)
      : await storage.getDefaultLLMConfigForOrganization(organizationId);
    
    if (!llmConfig) {
      throw new Error('No LLM configuration found');
    }
    
    // Create agent instance
    const agent = await createStaticAgentInstance(agentSlug);
    if (!agent) {
      throw new Error(`Agent ${agentSlug} not found`);
    }
    
    // Check if agent supports streaming
    const supportsStreaming = agentSupportsStreaming(agentSlug);
    
    stream.start({ agentSlug, supportsStreaming });
    
    let fullResponse = '';
    
    if (supportsStreaming && typeof agent.executeStreaming === 'function') {
      // Streaming execution
      console.log(`[SSE Stream] Executing streaming agent ${agentSlug}`);
      
      await agent.executeStreaming(
        message,
        {
          userId,
          organizationId,
          sessionId,
          llmConfig,
          contextType,
          contextId,
          contextData,
        },
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
      
      fullResponse = response;
      
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
        await storage.createAgentSessionMessage({
          sessionId,
          sender: 'agent',
          content: fullResponse,
          timestamp: new Date(),
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
    if (stream && !stream.closed) {
      stream.error(error.message || 'Agent execution failed');
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
