import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { storage } from './storage';
// Import dynamic agent loader
import { createAgentInstance, agentRequiresToolExecution, agentSupportsStreaming } from './agent-loader';

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
}

/**
 * Setup WebSocket server for streaming AI agent responses
 */
export function setupWebSocket(httpServer: Server): WebSocketServer {
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

  return wss;
}

/**
 * Handle AI agent execution with streaming responses
 */
async function handleAgentExecution(
  ws: AuthenticatedWebSocket,
  message: StreamMessage
) {
  const { agentName, input, llmConfigId, conversationId, contextType, contextId, contextData } = message;
  const startTime = Date.now();

  try {
    if (!agentName || !input) {
      throw new Error('Agent name and input are required');
    }

    if (!ws.organizationId) {
      throw new Error('Organization access required');
    }

    // Get LLM configuration
    let llmConfig;
    if (llmConfigId) {
      llmConfig = await storage.getLlmConfiguration(llmConfigId);
      if (!llmConfig || llmConfig.organizationId !== ws.organizationId) {
        throw new Error('LLM configuration not found');
      }
    } else {
      llmConfig = await storage.getDefaultLlmConfiguration(ws.organizationId);
      if (!llmConfig) {
        throw new Error('No default LLM configuration found. Please configure an LLM provider first.');
      }
    }

    // Find or create conversation
    let conversation;
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

    // Send start event
    ws.send(JSON.stringify({ 
      type: 'stream_start', 
      conversationId: conversation.id 
    }));

    // Execute agent dynamically using agent loader
    const normalizedAgentName = agentName.toLowerCase().replace(/\s+/g, '');
    let fullResponse = '';

    console.log(`[WebSocket] Executing agent: ${normalizedAgentName}, input length: ${input.length}`);

    // Load agent dynamically
    const agent = await createAgentInstance(normalizedAgentName, llmConfig) as any;
    
    // Handle agent execution based on capabilities
    if (agentRequiresToolExecution(normalizedAgentName)) {
      // Agent with tool execution (e.g., Luca)
      console.log(`[WebSocket] Starting ${normalizedAgentName} with tool execution support...`);
      
      const executionContext = {
        organizationId: ws.organizationId!,
        userId: ws.userId!,
        req: { user: { organizationId: ws.organizationId, id: ws.userId } } as any
      };
      
      const toolResult = await agent.executeWithTools(input, executionContext);
      
      if (toolResult.usedTool) {
        // Tool was executed - send instant response
        fullResponse = toolResult.response;
        ws.send(JSON.stringify({ type: 'stream_chunk', chunk: fullResponse }));
      } else {
        // No tool needed - use streaming mode
        fullResponse = await agent.executeStream(input, (chunk: string) => {
          console.log('[WebSocket] Received chunk:', chunk.substring(0, 50));
          ws.send(JSON.stringify({ type: 'stream_chunk', chunk }));
        });
      }
    } else if (agentSupportsStreaming(normalizedAgentName) && normalizedAgentName === 'parity') {
      // Streaming agents (e.g., Parity)
      console.log(`[WebSocket] Starting ${normalizedAgentName} streaming...`);
      fullResponse = await agent.executeStream(input, (chunk: string) => {
        console.log('[WebSocket] Received chunk:', chunk.substring(0, 50));
        ws.send(JSON.stringify({ type: 'stream_chunk', chunk }));
      });
    } else {
      // Structured response agents (e.g., Cadence, Forma, Kanban)
      console.log(`[WebSocket] Starting ${normalizedAgentName} execution...`);
      
      // Prepare input based on agent type
      let agentInput: any;
      if (normalizedAgentName === 'cadence') {
        agentInput = { type: 'workflow', data: input };
      } else if (normalizedAgentName === 'forma') {
        agentInput = { data: input, targetFormat: 'json' };
      } else if (normalizedAgentName === 'kanban' || normalizedAgentName === 'kanbanview') {
        agentInput = { type: 'workflow', data: input, organizationId: ws.organizationId! };
      } else {
        agentInput = input;
      }
      
      const result = await agent.execute(agentInput);
      fullResponse = JSON.stringify(result, null, 2);
      ws.send(JSON.stringify({ type: 'stream_chunk', chunk: fullResponse }));
    }
    
    console.log(`[WebSocket] ${normalizedAgentName} agent completed. Response length: ${fullResponse.length}`);

    const executionTime = Date.now() - startTime;

    // Save assistant message
    const assistantMessage = await storage.createAiMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: fullResponse,
      llmConfigId: llmConfig.id,
      executionTimeMs: executionTime
    });

    // Send completion event
    ws.send(JSON.stringify({ 
      type: 'stream_end', 
      conversationId: conversation.id,
      messageId: assistantMessage.id,
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
