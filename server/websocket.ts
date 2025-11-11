import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { storage } from './storage';
// Import static agent factory for reliable agent creation in both dev and production
import { createStaticAgentInstance } from './agent-static-factory';
import { agentRequiresToolExecution, agentSupportsStreaming } from './agent-loader';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  organizationId?: string;
  isAlive?: boolean;
}

interface StreamMessage {
  type: 'execute_agent' | 'ping';
  agentName?: string;
  input?: string;
  llmConfigId?: string;
  conversationId?: string;
  contextType?: string;
  contextId?: string;
  contextData?: any;
  lucaSessionId?: string;
}

// Lazy WebSocket initialization - only creates when first connection is made
let wssInstance: WebSocketServer | null = null;
let isInitializing = false;

/**
 * Initialize WebSocket server on-demand (called on first upgrade request)
 */
function initializeWebSocketServer(httpServer: Server): WebSocketServer {
  if (wssInstance) {
    return wssInstance;
  }
  
  if (isInitializing) {
    throw new Error('WebSocket server is already being initialized');
  }
  
  isInitializing = true;
  console.log('[WebSocket] Initializing WebSocket server on first connection...');
  
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/ai-stream'
  });

  // Heartbeat to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedWebSocket;
      if (client.isAlive === false) {
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000); // 30 seconds

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    console.log('[WebSocket] New connection attempt');

    // Authenticate WebSocket connection using session cookie
    try {
      const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
      console.log('[WebSocket] Cookies received:', Object.keys(cookies));
      const sessionToken = cookies['session_token'];

      if (!sessionToken) {
        console.log('[WebSocket] No session token found in cookies');
        ws.close(4001, 'Authentication required');
        return;
      }

      console.log('[WebSocket] Session token found:', sessionToken.substring(0, 20) + '...');

      // Verify session using token
      const session = await storage.getSession(sessionToken);
      if (!session) {
        console.log('[WebSocket] Session not found for token');
        ws.close(4001, 'Invalid session');
        return;
      }
      console.log('[WebSocket] Session found for user:', session.userId);
      
      if (session.expiresAt < new Date()) {
        console.log('[WebSocket] Session expired');
        ws.close(4001, 'Session expired');
        return;
      }

      // Get user details
      const user = await storage.getUser(session.userId);
      if (!user) {
        console.log('[WebSocket] User not found:', session.userId);
        ws.close(4001, 'User not found');
        return;
      }

      ws.userId = user.id;
      ws.organizationId = user.organizationId || undefined;

      console.log(`WebSocket connected: user=${user.id}, org=${user.organizationId}`);

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message: StreamMessage = JSON.parse(data.toString());

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (message.type === 'execute_agent') {
            await handleAgentExecution(ws, message);
          }
        } catch (error: any) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: error.message || 'Failed to process message'
          }));
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket disconnected: user=${ws.userId}`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({ type: 'connected', userId: ws.userId }));

    } catch (error: any) {
      console.error('WebSocket authentication error:', error);
      ws.close(4001, 'Authentication failed');
    }
  });

  // Store instance for reuse
  wssInstance = wss;
  isInitializing = false;
  console.log('[WebSocket] WebSocket server initialized and ready');
  
  return wss;
}

/**
 * Setup lazy WebSocket initialization on HTTP server
 * WebSocket will only be initialized when first upgrade request is received
 */
export function setupWebSocket(httpServer: Server): void {
  console.log('[WebSocket] Attaching lazy initialization handler to HTTP server');
  
  // Intercept upgrade requests to initialize WebSocket on-demand
  httpServer.on('upgrade', (request, socket, head) => {
    // Check if this is a WebSocket upgrade for our path
    if (request.url === '/ws/ai-stream') {
      console.log('[WebSocket] Upgrade request received for WebSocket connection');
      
      // Initialize WebSocket server on first upgrade request
      if (!wssInstance) {
        console.log('[WebSocket] First connection detected - initializing WebSocket server');
        const wss = initializeWebSocketServer(httpServer);
        
        // Handle this first upgrade request explicitly
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
      // Subsequent requests are handled automatically by the WebSocketServer
    }
  });
}

/**
 * Handle AI agent execution with streaming responses
 */
async function handleAgentExecution(
  ws: AuthenticatedWebSocket,
  message: StreamMessage
) {
  const { agentName, input, llmConfigId, conversationId, contextType, contextId, contextData, lucaSessionId } = message;
  const startTime = Date.now();

  try {
    if (!agentName || !input) {
      throw new Error('Agent name and input are required');
    }

    if (!ws.organizationId) {
      throw new Error('Organization access required');
    }

    // Get LLM configuration using centralized service
    const { getLLMConfigService } = await import('./llm-config-service');
    const llmConfigService = getLLMConfigService();
    const llmConfig = await llmConfigService.getConfig({ 
      organizationId: ws.organizationId,
      userId: ws.userId,
      configId: llmConfigId 
    });

    // Handle Luca agent specially with its dedicated chat system
    const normalizedAgentName = agentName.toLowerCase().replace(/\s+/g, '');
    const isLucaAgent = normalizedAgentName === 'luca';

    // Validate Luca session if provided
    if (isLucaAgent && lucaSessionId) {
      const lucaSession = await storage.getLucaChatSession(lucaSessionId);
      if (!lucaSession || lucaSession.userId !== ws.userId) {
        throw new Error('Luca chat session not found or access denied');
      }
    } else if (isLucaAgent && !lucaSessionId) {
      throw new Error('Luca session ID is required');
    }

    // For Luca, user messages are already saved by the frontend mutation
    // For other agents, we manage conversations in the standard way
    let conversation;
    if (!isLucaAgent) {
      if (conversationId) {
        conversation = await storage.getAiConversation(conversationId);
        if (!conversation || conversation.userId !== ws.userId) {
          throw new Error('Conversation not found');
        }
      } else if (contextType && contextId) {
        conversation = await storage.getAiConversationByContext(
          contextType,
          contextId,
          ws.userId!,
          agentName
        );
      }

      if (!conversation) {
        conversation = await storage.createAiConversation({
          agentName,
          organizationId: ws.organizationId,
          userId: ws.userId!,
          contextType: contextType || null,
          contextId: contextId || null,
          contextData: contextData || {}
        });
      }

      // Save user message
      await storage.createAiMessage({
        conversationId: conversation.id,
        role: "user",
        content: input,
        llmConfigId: llmConfig.id
      });
    }

    // Send start event
    ws.send(JSON.stringify({ 
      type: 'stream_start', 
      conversationId: isLucaAgent ? lucaSessionId : conversation?.id 
    }));

    // Execute agent dynamically using agent loader
    let fullResponse = '';

    console.log(`[WebSocket] Executing agent: ${normalizedAgentName}, input length: ${input.length}`);

    // Load agent using static factory (works reliably in both dev and production)
    const agent = createStaticAgentInstance(normalizedAgentName, llmConfig) as any;
    
    // Prepare input with context for agents
    const agentInput = {
      query: input,
      context: {
        organizationId: ws.organizationId,
        userId: ws.userId,
        conversationId: isLucaAgent ? lucaSessionId : conversation?.id,
      }
    };
    
    // Handle agent execution based on capabilities
    if (agentRequiresToolExecution(normalizedAgentName)) {
      // Agent with tool execution (e.g., Luca)
      console.log(`[WebSocket] Starting ${normalizedAgentName} with tool execution support...`);
      
      const executionContext = {
        organizationId: ws.organizationId!,
        userId: ws.userId!,
        req: { user: { organizationId: ws.organizationId, id: ws.userId } } as any
      };
      
      const toolResult = await agent.executeWithTools(agentInput, executionContext);
      
      if (toolResult.usedTool) {
        // Tool was executed - send instant response
        fullResponse = toolResult.response;
        ws.send(JSON.stringify({ type: 'stream_chunk', chunk: fullResponse }));
      } else {
        // No tool needed - use streaming mode
        fullResponse = await agent.executeStream(agentInput, (chunk: string) => {
          console.log('[WebSocket] Received chunk:', chunk.substring(0, 50));
          ws.send(JSON.stringify({ type: 'stream_chunk', chunk }));
        });
      }
    } else if (agentSupportsStreaming(normalizedAgentName)) {
      // All streaming-enabled agents (Parity, Cadence, Forma, Echo, Relay, Scribe, OmniSpectra, Radar)
      console.log(`[WebSocket] Starting ${normalizedAgentName} streaming...`);
      fullResponse = await agent.executeStream(agentInput, (chunk: string) => {
        console.log('[WebSocket] Received chunk:', chunk.substring(0, 50));
        ws.send(JSON.stringify({ type: 'stream_chunk', chunk }));
      });
    } else {
      // Legacy non-streaming agents (fallback)
      console.log(`[WebSocket] Starting ${normalizedAgentName} execution (non-streaming)...`);
      
      const result = await agent.execute(agentInput);
      fullResponse = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      ws.send(JSON.stringify({ type: 'stream_chunk', chunk: fullResponse }));
    }
    
    console.log(`[WebSocket] ${normalizedAgentName} agent completed. Response length: ${fullResponse.length}`);

    const executionTime = Date.now() - startTime;

    // Save assistant message
    let assistantMessageId: string;
    if (isLucaAgent && lucaSessionId) {
      // Save to Luca-specific chat messages table
      try {
        console.log('[Luca WebSocket] === SAVING ASSISTANT MESSAGE ===');
        console.log('[Luca WebSocket] Session ID:', lucaSessionId);
        console.log('[Luca WebSocket] Response length:', fullResponse.length);
        console.log('[Luca WebSocket] Full response preview:', fullResponse.substring(0, 200));
        
        const lucaMessage = await storage.createLucaChatMessage({
          sessionId: lucaSessionId,
          role: "assistant",
          content: fullResponse,
          metadata: { executionTimeMs: executionTime, llmConfigId: llmConfig.id }
        });
        assistantMessageId = lucaMessage.id;
        
        console.log('[Luca WebSocket] ✅ Assistant message saved! Message ID:', assistantMessageId);

        // Update session's lastMessageAt
        await storage.updateLucaChatSession(lucaSessionId, {
          lastMessageAt: new Date(),
        });
        console.log('[Luca WebSocket] ✅ Session timestamp updated');

        // Verify message was saved by fetching it back
        const messages = await storage.getLucaChatMessagesBySession(lucaSessionId);
        console.log('[Luca WebSocket] ✅ Message count in session:', messages.length);
        
        // Auto-generate title after first exchange (user + assistant messages)
        if (messages.length === 2) {
          console.log('[Luca WebSocket] 🎯 First exchange complete! Auto-generating title...');
          try {
            const session = await storage.getLucaChatSession(lucaSessionId);
            if (session && session.title === 'New Chat') {
              // Get first user and assistant messages
              const firstUserMsg = messages.find(m => m.role === 'user');
              const firstAssistantMsg = messages.find(m => m.role === 'assistant');
              
              if (firstUserMsg && firstAssistantMsg) {
                // Generate title using LLM
                const { LLMService } = await import('./llm-service');
                const titleLlmService = new LLMService(llmConfig);
                
                const titlePrompt = `Generate a short, descriptive title (3-6 words max) for this conversation. Return ONLY the title, nothing else.

User: ${firstUserMsg.content.substring(0, 500)}
Assistant: ${firstAssistantMsg.content.substring(0, 500)}

Title:`;

                const generatedTitle = await titleLlmService.generateCompletion(titlePrompt, {
                  maxTokens: 20,
                  temperature: 0.7,
                });

                // Clean up title
                const title = generatedTitle.trim()
                  .replace(/^["']|["']$/g, '')
                  .replace(/\n.*/g, '')
                  .substring(0, 100);

                // Update session with generated title
                await storage.updateLucaChatSession(lucaSessionId, { title });
                console.log('[Luca WebSocket] 🎯 ✅ Title auto-generated:', title);
              }
            }
          } catch (titleError: any) {
            console.error('[Luca WebSocket] ⚠️  Failed to auto-generate title:', titleError.message);
            // Don't throw - title generation is not critical
          }
        }
      } catch (error: any) {
        console.error('[Luca WebSocket] ❌ CRITICAL ERROR saving assistant message:', error);
        console.error('[Luca WebSocket] Error stack:', error.stack);
        throw error; // Re-throw to send error to client
      }
    } else if (conversation) {
      // Save to standard AI agent messages table
      const assistantMessage = await storage.createAiMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: fullResponse,
        llmConfigId: llmConfig.id,
        executionTimeMs: executionTime
      });
      assistantMessageId = assistantMessage.id;
    } else {
      throw new Error('No conversation or Luca session found');
    }

    // Send completion event
    ws.send(JSON.stringify({ 
      type: 'stream_end', 
      conversationId: isLucaAgent ? lucaSessionId : conversation?.id,
      messageId: assistantMessageId,
      executionTime 
    }));

  } catch (error: any) {
    console.error('Agent execution error:', error);
    ws.send(JSON.stringify({ 
      type: 'error', 
      error: error.message || 'Failed to execute agent'
    }));
  }
}
