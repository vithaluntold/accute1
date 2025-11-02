import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { storage } from './storage';
import { RoundtableOrchestrator } from './roundtable-orchestrator';

interface RoundtableWebSocket extends WebSocket {
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  participantId?: string;
  isAlive?: boolean;
}

interface RoundtableMessage {
  type: 
    | 'join_session'
    | 'leave_session'
    | 'send_message'
    | 'send_private_message'
    | 'add_agent'
    | 'remove_agent'
    | 'present_deliverable'
    | 'stop_presentation'
    | 'start_typing'
    | 'stop_typing'
    | 'ping';
  sessionId?: string;
  content?: string;
  recipientParticipantId?: string;
  agentSlug?: string;
  participantId?: string;
  deliverableId?: string;
  channelType?: 'main' | 'private';
}

interface BroadcastMessage {
  type:
    | 'participant_joined'
    | 'participant_left'
    | 'new_message'
    | 'private_message'
    | 'agent_added'
    | 'agent_removed'
    | 'deliverable_created'
    | 'deliverable_presentation'
    | 'presentation_ended'
    | 'typing_indicator'
    | 'roster_update'
    | 'error';
  data?: any;
  error?: string;
}

/**
 * Setup WebSocket server for AI Roundtable collaboration
 */
export function setupRoundtableWebSocket(httpServer: Server): WebSocketServer {
  const orchestrator = new RoundtableOrchestrator(storage);
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/roundtable'
  });

  // Track active connections by session
  const sessionConnections = new Map<string, Set<RoundtableWebSocket>>();

  // Heartbeat to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as RoundtableWebSocket;
      if (client.isAlive === false) {
        if (client.sessionId) {
          removeFromSession(client.sessionId, client);
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

  wss.on('connection', async (ws: RoundtableWebSocket, req) => {
    ws.isAlive = true;
    console.log('[Roundtable WS] New connection attempt');

    // Authenticate WebSocket connection
    try {
      const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
      const sessionToken = cookies['session_token'];

      if (!sessionToken) {
        console.log('[Roundtable WS] No session token found');
        ws.close(4001, 'Authentication required');
        return;
      }

      const session = await storage.getSession(sessionToken);
      if (!session || session.expiresAt < new Date()) {
        console.log('[Roundtable WS] Invalid or expired session');
        ws.close(4001, 'Invalid session');
        return;
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        console.log('[Roundtable WS] User not found');
        ws.close(4001, 'User not found');
        return;
      }

      ws.userId = user.id;
      ws.organizationId = user.organizationId || undefined;

      console.log(`[Roundtable WS] Connected: user=${user.id}, org=${user.organizationId}`);

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message: RoundtableMessage = JSON.parse(data.toString());
          console.log('[Roundtable WS] Message received:', message.type);

          switch (message.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;

            case 'join_session':
              await handleJoinSession(ws, message, orchestrator, sessionConnections);
              break;

            case 'leave_session':
              await handleLeaveSession(ws, sessionConnections);
              break;

            case 'send_message':
              await handleSendMessage(ws, message, orchestrator, sessionConnections);
              break;

            case 'send_private_message':
              await handleSendPrivateMessage(ws, message, orchestrator, sessionConnections);
              break;

            case 'add_agent':
              await handleAddAgent(ws, message, orchestrator, sessionConnections);
              break;

            case 'remove_agent':
              await handleRemoveAgent(ws, message, orchestrator, sessionConnections);
              break;

            case 'present_deliverable':
              await handlePresentDeliverable(ws, message, orchestrator, sessionConnections);
              break;

            case 'stop_presentation':
              await handleStopPresentation(ws, message, orchestrator, sessionConnections);
              break;

            case 'start_typing':
            case 'stop_typing':
              await handleTypingIndicator(ws, message, sessionConnections);
              break;

            default:
              console.log('[Roundtable WS] Unknown message type:', message.type);
          }
        } catch (error: any) {
          console.error('[Roundtable WS] Message error:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: error.message || 'Failed to process message'
          }));
        }
      });

      ws.on('close', () => {
        if (ws.sessionId) {
          removeFromSession(ws.sessionId, ws);
        }
        console.log(`[Roundtable WS] Disconnected: user=${ws.userId}`);
      });

      ws.on('error', (error) => {
        console.error('[Roundtable WS] Error:', error);
      });

      ws.send(JSON.stringify({ type: 'connected', userId: ws.userId }));

    } catch (error: any) {
      console.error('[Roundtable WS] Authentication error:', error);
      ws.close(4001, 'Authentication failed');
    }
  });

  // Helper function to remove client from session
  function removeFromSession(sessionId: string, ws: RoundtableWebSocket) {
    const connections = sessionConnections.get(sessionId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        sessionConnections.delete(sessionId);
      }
    }
  }

  return wss;
}

/**
 * Handle user joining a roundtable session
 */
async function handleJoinSession(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  orchestrator: RoundtableOrchestrator,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  const { sessionId } = message;
  if (!sessionId || !ws.userId) {
    throw new Error('Session ID and user ID required');
  }

  // Verify session exists and user has access
  const session = await storage.getRoundtableSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.userId !== ws.userId && session.organizationId !== ws.organizationId) {
    throw new Error('Access denied');
  }

  ws.sessionId = sessionId;

  // Add to session connections
  if (!sessionConnections.has(sessionId)) {
    sessionConnections.set(sessionId, new Set());
  }
  sessionConnections.get(sessionId)!.add(ws);

  // Get session context
  const context = await orchestrator.getSessionContext(sessionId);

  // Send session state to joining user
  ws.send(JSON.stringify({
    type: 'session_joined',
    session,
    participants: context.participants,
    knowledgeBase: context.knowledgeBase,
    deliverables: context.deliverables,
  }));

  // Broadcast to other participants
  broadcastToSession(sessionId, sessionConnections, {
    type: 'participant_joined',
    data: { userId: ws.userId }
  }, ws);

  console.log(`[Roundtable WS] User ${ws.userId} joined session ${sessionId}`);
}

/**
 * Handle user leaving session
 */
async function handleLeaveSession(
  ws: RoundtableWebSocket,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  if (!ws.sessionId) return;

  const sessionId = ws.sessionId;

  // Remove from connections
  const connections = sessionConnections.get(sessionId);
  if (connections) {
    connections.delete(ws);
  }

  // Broadcast leave event
  broadcastToSession(sessionId, sessionConnections, {
    type: 'participant_left',
    data: { userId: ws.userId }
  });

  ws.sessionId = undefined;
  console.log(`[Roundtable WS] User ${ws.userId} left session ${sessionId}`);
}

/**
 * Handle sending message to main channel
 */
async function handleSendMessage(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  orchestrator: RoundtableOrchestrator,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  const { content } = message;
  if (!ws.sessionId || !ws.userId || !content) {
    throw new Error('Session ID, user ID, and content required');
  }

  // Get user name
  const user = await storage.getUser(ws.userId);
  if (!user) {
    throw new Error('User not found');
  }

  const userName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.username;

  // Create message in database
  const savedMessage = await orchestrator.createMessage(
    ws.sessionId,
    ws.userId,
    userName,
    'user',
    content,
    'main'
  );

  // Broadcast to all session participants
  broadcastToSession(ws.sessionId, sessionConnections, {
    type: 'new_message',
    data: savedMessage
  });
}

/**
 * Handle sending private message to specific participant
 */
async function handleSendPrivateMessage(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  orchestrator: RoundtableOrchestrator,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  const { content, recipientParticipantId } = message;
  if (!ws.sessionId || !ws.userId || !content || !recipientParticipantId) {
    throw new Error('All fields required for private message');
  }

  // Get user name
  const user = await storage.getUser(ws.userId);
  if (!user) {
    throw new Error('User not found');
  }

  const userName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.username;

  // Create private message
  const savedMessage = await orchestrator.createMessage(
    ws.sessionId,
    ws.userId,
    userName,
    'user',
    content,
    'private',
    recipientParticipantId
  );

  // Send to recipient only (find their connection)
  const connections = sessionConnections.get(ws.sessionId) || new Set();
  const recipient = await storage.getRoundtableParticipant(recipientParticipantId);
  
  if (recipient && recipient.participantType === 'user' && recipient.participantId) {
    for (const client of Array.from(connections)) {
      if (client.userId === recipient.participantId) {
        client.send(JSON.stringify({
          type: 'private_message',
          data: savedMessage
        }));
        break;
      }
    }
  }

  // Also send back to sender
  ws.send(JSON.stringify({
    type: 'private_message',
    data: savedMessage
  }));
}

/**
 * Handle adding agent to session
 */
async function handleAddAgent(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  orchestrator: RoundtableOrchestrator,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  const { agentSlug } = message;
  if (!ws.sessionId || !ws.userId || !agentSlug) {
    throw new Error('Session ID, user ID, and agent slug required');
  }

  const participant = await orchestrator.addAgentToSession(
    ws.sessionId,
    agentSlug,
    ws.userId
  );

  // Broadcast agent addition
  broadcastToSession(ws.sessionId, sessionConnections, {
    type: 'agent_added',
    data: participant
  });
}

/**
 * Handle removing agent from session
 */
async function handleRemoveAgent(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  orchestrator: RoundtableOrchestrator,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  const { participantId } = message;
  if (!ws.sessionId || !participantId) {
    throw new Error('Session ID and participant ID required');
  }

  await orchestrator.removeAgentFromSession(ws.sessionId, participantId);

  // Broadcast agent removal
  broadcastToSession(ws.sessionId, sessionConnections, {
    type: 'agent_removed',
    data: { participantId }
  });
}

/**
 * Handle presenting deliverable (screenshare)
 */
async function handlePresentDeliverable(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  orchestrator: RoundtableOrchestrator,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  const { deliverableId } = message;
  if (!ws.sessionId || !deliverableId) {
    throw new Error('Session ID and deliverable ID required');
  }

  await orchestrator.presentDeliverable(ws.sessionId, deliverableId);

  const deliverable = await storage.getRoundtableDeliverable(deliverableId);

  // Broadcast presentation start
  broadcastToSession(ws.sessionId, sessionConnections, {
    type: 'deliverable_presentation',
    data: deliverable
  });
}

/**
 * Handle stopping presentation
 */
async function handleStopPresentation(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  orchestrator: RoundtableOrchestrator,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  if (!ws.sessionId) {
    throw new Error('Session ID required');
  }

  await orchestrator.stopPresentation(ws.sessionId);

  // Broadcast presentation stop
  broadcastToSession(ws.sessionId, sessionConnections, {
    type: 'presentation_ended'
  });
}

/**
 * Handle typing indicators
 */
async function handleTypingIndicator(
  ws: RoundtableWebSocket,
  message: RoundtableMessage,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>
) {
  if (!ws.sessionId || !ws.userId) return;

  const isTyping = message.type === 'start_typing';
  const channelType = message.channelType || 'main';

  // Broadcast typing indicator
  broadcastToSession(ws.sessionId, sessionConnections, {
    type: 'typing_indicator',
    data: {
      userId: ws.userId,
      isTyping,
      channelType,
      recipientParticipantId: message.recipientParticipantId
    }
  }, ws);
}

/**
 * Broadcast message to all clients in a session
 */
function broadcastToSession(
  sessionId: string,
  sessionConnections: Map<string, Set<RoundtableWebSocket>>,
  message: BroadcastMessage,
  excludeWs?: RoundtableWebSocket
) {
  const connections = sessionConnections.get(sessionId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  for (const client of Array.from(connections)) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}
