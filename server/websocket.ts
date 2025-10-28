import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { storage } from './storage';
import { ParityAgent } from '../agents/parity/backend/index';
import { CadenceAgent } from '../agents/cadence/backend/index';
import { FormaAgent } from '../agents/forma/backend/index';
import { KanbanAgent } from '../agents/kanban/backend/index';

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

    // Authenticate WebSocket connection using session cookie
    try {
      const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
      const sessionId = cookies['connect.sid'];

      if (!sessionId) {
        ws.close(4001, 'Authentication required');
        return;
      }

      // Verify session
      const session = await storage.getSession(sessionId);
      if (!session) {
        ws.close(4001, 'Invalid session');
        return;
      }
      if (session.expiresAt < new Date()) {
        ws.close(4001, 'Session expired');
        return;
      }

      // Get user details
      const user = await storage.getUser(session.userId);
      if (!user) {
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

    // Execute agent with streaming
    const normalizedAgentName = agentName.toLowerCase().replace(/\s+/g, '');
    let fullResponse = '';

    switch (normalizedAgentName) {
      case 'parity': {
        const agent = new ParityAgent(llmConfig);
        fullResponse = await agent.executeStream(input, (chunk: string) => {
          ws.send(JSON.stringify({ type: 'stream_chunk', chunk }));
        });
        break;
      }
      case 'cadence': {
        const agent = new CadenceAgent(llmConfig);
        // For structured agents, execute normally since they return JSON
        const result = await agent.execute({ type: 'workflow', data: input } as any);
        fullResponse = JSON.stringify(result, null, 2);
        ws.send(JSON.stringify({ type: 'stream_chunk', chunk: fullResponse }));
        break;
      }
      case 'forma': {
        const agent = new FormaAgent(llmConfig);
        // For structured agents, execute normally since they return JSON
        const result = await agent.execute({ data: input, targetFormat: 'json' } as any);
        fullResponse = JSON.stringify(result, null, 2);
        ws.send(JSON.stringify({ type: 'stream_chunk', chunk: fullResponse }));
        break;
      }
      case 'kanban':
      case 'kanbanview': {
        const agent = new KanbanAgent(llmConfig);
        // For structured agents, execute normally since they return JSON
        const result = await agent.execute({ type: 'workflow', data: input, organizationId: ws.organizationId! } as any);
        fullResponse = JSON.stringify(result, null, 2);
        ws.send(JSON.stringify({ type: 'stream_chunk', chunk: fullResponse }));
        break;
      }
      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }

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
