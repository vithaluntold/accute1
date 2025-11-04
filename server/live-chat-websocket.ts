import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { storage } from './storage';
import { canAccessLiveChat } from '../shared/accessControl';
import type { LiveChatConversation, LiveChatMessage } from '../shared/schema';

interface LiveChatWebSocket extends WebSocket {
  userId?: string;
  organizationId?: string;
  conversationId?: string;
  isAgent?: boolean;
  isAlive?: boolean;
}

interface LiveChatClientMessage {
  type:
    | 'join_conversation'
    | 'leave_conversation'
    | 'send_message'
    | 'start_typing'
    | 'stop_typing'
    | 'mark_read'
    | 'update_agent_status'
    | 'ping';
  conversationId?: string;
  content?: string;
  agentStatus?: string;
  metadata?: any;
}

interface LiveChatBroadcastMessage {
  type:
    | 'new_message'
    | 'user_joined'
    | 'user_left'
    | 'typing_indicator'
    | 'conversation_assigned'
    | 'conversation_resolved'
    | 'agent_status_changed'
    | 'error';
  data?: any;
  error?: string;
}

/**
 * Setup WebSocket server for Live Chat Support
 */
export function setupLiveChatWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/live-chat',
    maxPayload: 5 * 1024 * 1024 // 5MB max payload for file attachments
  });

  // Track connections by conversation
  const conversationConnections = new Map<string, Set<LiveChatWebSocket>>();
  
  // Track agent connections for availability
  const agentConnections = new Map<string, LiveChatWebSocket>();

  // Heartbeat to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as LiveChatWebSocket;
      if (client.isAlive === false) {
        // Clean up connections
        if (client.conversationId) {
          const connections = conversationConnections.get(client.conversationId);
          if (connections) {
            connections.delete(client);
          }
        }
        if (client.isAgent && client.userId) {
          agentConnections.delete(client.userId);
        }
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000); // 30 seconds

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', async (ws: LiveChatWebSocket, req) => {
    ws.isAlive = true;
    console.log('[Live Chat WS] New connection attempt');

    // Authenticate WebSocket connection
    try {
      let userId: string | undefined;

      // Try cookie-based session authentication first (web clients)
      const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
      const sessionToken = cookies['session_token'];

      if (sessionToken) {
        const session = await storage.getSession(sessionToken);
        if (session && session.expiresAt >= new Date()) {
          userId = session.userId;
        }
      }

      // Fall back to JWT token in query parameter (mobile clients)
      if (!userId) {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        if (token) {
          const jwtSecret = process.env.JWT_SECRET;
          if (!jwtSecret) {
            console.error('[Live Chat WS] JWT_SECRET not configured');
            ws.close(4001, 'Server configuration error');
            return;
          }

          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, jwtSecret) as any;
            userId = decoded.userId;
          } catch (error) {
            console.log('[Live Chat WS] Invalid JWT token');
          }
        }
      }

      if (!userId) {
        console.log('[Live Chat WS] No valid authentication found');
        ws.close(4001, 'Authentication required');
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) {
        console.log('[Live Chat WS] User not found');
        ws.close(4001, 'User not found');
        return;
      }

      // Fetch subscription data if user has an organization
      let subscription = null;
      if (user.organizationId) {
        subscription = await storage.getPlatformSubscriptionByOrganization(user.organizationId);
      }

      // Check if user has access to live chat (Edge subscription or test user)
      const accessCheck = canAccessLiveChat({
        id: user.id,
        isActive: user.isActive,
        createdAt: user.createdAt,
        kycStatus: user.kycStatus,
        subscription: subscription ? { plan: subscription.plan, status: subscription.status } : null
      });

      // Agents (Admin/Super Admin) always have access
      const isAgent = user.role === 'superadmin' || user.role === 'admin';
      
      if (!accessCheck.allowed && !isAgent) {
        console.log(`[Live Chat WS] Access denied: ${accessCheck.reason}`);
        ws.close(4003, accessCheck.reason || 'Access denied');
        return;
      }

      ws.userId = user.id;
      ws.organizationId = user.organizationId || undefined;
      ws.isAgent = isAgent;

      console.log(`[Live Chat WS] Connected: user=${user.id}, agent=${isAgent}, org=${user.organizationId}`);

      // Track agent connection
      if (isAgent) {
        agentConnections.set(user.id, ws);
        // Update agent availability to online
        await updateAgentAvailability(user.id, 'online');
      }

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message: LiveChatClientMessage = JSON.parse(data.toString());

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          switch (message.type) {
            case 'join_conversation':
              await handleJoinConversation(ws, message, conversationConnections);
              break;
            case 'leave_conversation':
              await handleLeaveConversation(ws, conversationConnections);
              break;
            case 'send_message':
              await handleSendMessage(ws, message, conversationConnections);
              break;
            case 'start_typing':
              await handleTypingIndicator(ws, message, conversationConnections, true);
              break;
            case 'stop_typing':
              await handleTypingIndicator(ws, message, conversationConnections, false);
              break;
            case 'mark_read':
              await handleMarkRead(ws, message);
              break;
            case 'update_agent_status':
              await handleUpdateAgentStatus(ws, message, agentConnections);
              break;
          }
        } catch (error: any) {
          console.error('[Live Chat WS] Message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message || 'Failed to process message'
          }));
        }
      });

      ws.on('close', () => {
        if (ws.conversationId) {
          const connections = conversationConnections.get(ws.conversationId);
          if (connections) {
            connections.delete(ws);
            // Broadcast user left
            broadcastToConversation(
              ws.conversationId,
              {
                type: 'user_left',
                data: { userId: ws.userId }
              },
              conversationConnections
            );
          }
        }
        
        // Update agent status to offline
        if (ws.isAgent && ws.userId) {
          agentConnections.delete(ws.userId);
          updateAgentAvailability(ws.userId, 'offline').catch(console.error);
        }
        
        console.log(`[Live Chat WS] Disconnected: user=${ws.userId}`);
      });

      ws.on('error', (error) => {
        console.error('[Live Chat WS] WebSocket error:', error);
      });

    } catch (error: any) {
      console.error('[Live Chat WS] Connection error:', error);
      ws.close(4000, 'Connection failed');
    }
  });

  console.log('[Live Chat WS] Server initialized on path /ws/live-chat');
  return wss;
}

/**
 * Handle joining a conversation
 */
async function handleJoinConversation(
  ws: LiveChatWebSocket,
  message: LiveChatClientMessage,
  conversationConnections: Map<string, Set<LiveChatWebSocket>>
) {
  if (!message.conversationId || !ws.userId) return;

  try {
    // Verify user has access to this conversation
    const conversation = await storage.getLiveChatConversation(message.conversationId);
    if (!conversation) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Conversation not found'
      }));
      return;
    }

    // Check if user is part of this conversation
    const isParticipant = conversation.userId === ws.userId ||
                         conversation.assignedAgentId === ws.userId ||
                         ws.isAgent;

    if (!isParticipant) {
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Access denied to this conversation'
      }));
      return;
    }

    // Leave current conversation if any
    if (ws.conversationId) {
      const oldConnections = conversationConnections.get(ws.conversationId);
      if (oldConnections) {
        oldConnections.delete(ws);
      }
    }

    // Join new conversation
    ws.conversationId = message.conversationId;
    if (!conversationConnections.has(message.conversationId)) {
      conversationConnections.set(message.conversationId, new Set());
    }
    conversationConnections.get(message.conversationId)!.add(ws);

    console.log(`[Live Chat WS] User ${ws.userId} joined conversation ${message.conversationId}`);

    // Notify others in the conversation
    broadcastToConversation(
      message.conversationId,
      {
        type: 'user_joined',
        data: { userId: ws.userId, isAgent: ws.isAgent }
      },
      conversationConnections,
      ws
    );

    // Send confirmation
    ws.send(JSON.stringify({
      type: 'joined',
      data: { conversationId: message.conversationId }
    }));

  } catch (error: any) {
    console.error('[Live Chat WS] Join conversation error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to join conversation'
    }));
  }
}

/**
 * Handle leaving a conversation
 */
async function handleLeaveConversation(
  ws: LiveChatWebSocket,
  conversationConnections: Map<string, Set<LiveChatWebSocket>>
) {
  if (!ws.conversationId) return;

  const connections = conversationConnections.get(ws.conversationId);
  if (connections) {
    connections.delete(ws);
    broadcastToConversation(
      ws.conversationId,
      {
        type: 'user_left',
        data: { userId: ws.userId }
      },
      conversationConnections
    );
  }

  ws.conversationId = undefined;
  console.log(`[Live Chat WS] User ${ws.userId} left conversation`);
}

/**
 * Handle sending a message
 */
async function handleSendMessage(
  ws: LiveChatWebSocket,
  message: LiveChatClientMessage,
  conversationConnections: Map<string, Set<LiveChatWebSocket>>
) {
  if (!ws.conversationId || !ws.userId || !message.content) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Invalid message data'
    }));
    return;
  }

  try {
    // Save message to database
    const savedMessage = await storage.createLiveChatMessage({
      conversationId: ws.conversationId,
      content: message.content,
      senderType: ws.isAgent ? 'agent' : 'user',
      senderId: ws.userId,
      isInternal: false,
      attachments: message.metadata?.attachments || [],
      isRead: false
    });

    // Update conversation last message time
    await storage.updateLiveChatConversation(ws.conversationId, {
      lastMessageAt: new Date(),
      messageCount: (await storage.getLiveChatMessages(ws.conversationId)).length
    });

    console.log(`[Live Chat WS] Message sent in conversation ${ws.conversationId}`);

    // Broadcast to all participants in the conversation
    broadcastToConversation(
      ws.conversationId,
      {
        type: 'new_message',
        data: savedMessage
      },
      conversationConnections
    );

  } catch (error: any) {
    console.error('[Live Chat WS] Send message error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Failed to send message'
    }));
  }
}

/**
 * Handle typing indicators
 */
async function handleTypingIndicator(
  ws: LiveChatWebSocket,
  message: LiveChatClientMessage,
  conversationConnections: Map<string, Set<LiveChatWebSocket>>,
  isTyping: boolean
) {
  if (!ws.conversationId || !ws.userId) return;

  broadcastToConversation(
    ws.conversationId,
    {
      type: 'typing_indicator',
      data: {
        userId: ws.userId,
        isAgent: ws.isAgent,
        isTyping
      }
    },
    conversationConnections,
    ws // Exclude sender
  );
}

/**
 * Handle marking messages as read
 */
async function handleMarkRead(
  ws: LiveChatWebSocket,
  message: LiveChatClientMessage
) {
  if (!ws.conversationId || !ws.userId) return;

  try {
    await storage.markLiveChatMessagesAsRead(ws.conversationId, ws.userId);
    console.log(`[Live Chat WS] Messages marked as read for user ${ws.userId}`);
  } catch (error: any) {
    console.error('[Live Chat WS] Mark read error:', error);
  }
}

/**
 * Handle agent status updates
 */
async function handleUpdateAgentStatus(
  ws: LiveChatWebSocket,
  message: LiveChatClientMessage,
  agentConnections: Map<string, LiveChatWebSocket>
) {
  if (!ws.isAgent || !ws.userId || !message.agentStatus) return;

  try {
    await updateAgentAvailability(ws.userId, message.agentStatus);
    
    // Broadcast agent status change to all agents
    const statusMessage: LiveChatBroadcastMessage = {
      type: 'agent_status_changed',
      data: {
        agentId: ws.userId,
        status: message.agentStatus
      }
    };

    agentConnections.forEach((agentWs) => {
      if (agentWs.readyState === WebSocket.OPEN) {
        agentWs.send(JSON.stringify(statusMessage));
      }
    });

    console.log(`[Live Chat WS] Agent ${ws.userId} status updated to ${message.agentStatus}`);
  } catch (error: any) {
    console.error('[Live Chat WS] Update agent status error:', error);
  }
}

/**
 * Update agent availability in database
 */
async function updateAgentAvailability(userId: string, status: string) {
  try {
    const availability = await storage.getAgentAvailability(userId);
    
    if (availability) {
      await storage.updateAgentAvailability(userId, {
        status,
        lastOnlineAt: status === 'online' ? new Date() : availability.lastOnlineAt,
        lastActivityAt: new Date()
      });
    } else {
      await storage.createAgentAvailability({
        userId,
        status,
        statusMessage: null,
        maxConcurrentChats: 3,
        currentChatCount: 0,
        isAcceptingChats: status === 'online',
        lastOnlineAt: status === 'online' ? new Date() : null,
        lastActivityAt: new Date(),
        autoAwayMinutes: 10
      });
    }
  } catch (error) {
    console.error('[Live Chat WS] Failed to update agent availability:', error);
  }
}

/**
 * Broadcast message to all connections in a conversation
 */
function broadcastToConversation(
  conversationId: string,
  message: LiveChatBroadcastMessage,
  conversationConnections: Map<string, Set<LiveChatWebSocket>>,
  exclude?: LiveChatWebSocket
) {
  const connections = conversationConnections.get(conversationId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  connections.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}
