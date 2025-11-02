import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { storage } from './storage';

interface TeamChatWebSocket extends WebSocket {
  userId?: string;
  organizationId?: string;
  teamId?: string;
  isAlive?: boolean;
}

interface TeamChatMessage {
  type: 
    | 'join_team'
    | 'leave_team'
    | 'send_message'
    | 'start_typing'
    | 'stop_typing'
    | 'ping';
  teamId?: string;
  message?: string;
  metadata?: any;
}

interface BroadcastMessage {
  type:
    | 'new_message'
    | 'user_joined'
    | 'user_left'
    | 'typing_indicator'
    | 'error';
  data?: any;
  error?: string;
}

/**
 * Setup WebSocket server for Team Chat
 */
export function setupTeamChatWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/team-chat',
    maxPayload: 1024 * 1024 // 1MB max payload
  });

  // Track connections by team
  const teamConnections = new Map<string, Set<TeamChatWebSocket>>();

  // Heartbeat to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as TeamChatWebSocket;
      if (client.isAlive === false) {
        // Remove from team connections
        if (client.teamId) {
          const connections = teamConnections.get(client.teamId);
          if (connections) {
            connections.delete(client);
          }
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

  wss.on('connection', async (ws: TeamChatWebSocket, req) => {
    ws.isAlive = true;
    console.log('[Team Chat WS] New connection attempt');

    // Authenticate WebSocket connection
    try {
      const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
      const sessionToken = cookies['session_token'];

      if (!sessionToken) {
        console.log('[Team Chat WS] No session token found');
        ws.close(4001, 'Authentication required');
        return;
      }

      const session = await storage.getSession(sessionToken);
      if (!session) {
        console.log('[Team Chat WS] Session not found');
        ws.close(4001, 'Invalid session');
        return;
      }
      
      if (session.expiresAt < new Date()) {
        console.log('[Team Chat WS] Session expired');
        ws.close(4001, 'Session expired');
        return;
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        console.log('[Team Chat WS] User not found');
        ws.close(4001, 'User not found');
        return;
      }

      ws.userId = user.id;
      ws.organizationId = user.organizationId || undefined;

      console.log(`[Team Chat WS] Connected: user=${user.id}, org=${user.organizationId}`);

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message: TeamChatMessage = JSON.parse(data.toString());

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          switch (message.type) {
            case 'join_team':
              await handleJoinTeam(ws, message, teamConnections);
              break;
            case 'leave_team':
              await handleLeaveTeam(ws, teamConnections);
              break;
            case 'send_message':
              await handleSendMessage(ws, message, teamConnections);
              break;
            case 'start_typing':
              await handleTypingIndicator(ws, message, teamConnections, true);
              break;
            case 'stop_typing':
              await handleTypingIndicator(ws, message, teamConnections, false);
              break;
          }
        } catch (error: any) {
          console.error('[Team Chat WS] Message error:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: error.message || 'Failed to process message'
          }));
        }
      });

      ws.on('close', () => {
        if (ws.teamId) {
          const connections = teamConnections.get(ws.teamId);
          if (connections) {
            connections.delete(ws);
            // Broadcast user left
            broadcastToTeam(ws.teamId, teamConnections, {
              type: 'user_left',
              data: { userId: ws.userId }
            });
          }
        }
        console.log(`[Team Chat WS] Disconnected: user=${ws.userId}`);
      });

      ws.on('error', (error) => {
        console.error('[Team Chat WS] Error:', error);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({ type: 'connected', userId: ws.userId }));

    } catch (error: any) {
      console.error('[Team Chat WS] Authentication error:', error);
      ws.close(4001, 'Authentication failed');
    }
  });

  return wss;
}

/**
 * Handle user joining a team chat
 */
async function handleJoinTeam(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { teamId } = message;
  if (!teamId || !ws.userId) {
    throw new Error('Team ID and user ID required');
  }

  // Verify user is a member of the team
  const team = await storage.getTeam(teamId);
  if (!team) {
    throw new Error('Team not found');
  }

  if (team.organizationId !== ws.organizationId) {
    throw new Error('Access denied');
  }

  // Check if user is a team member
  const members = await storage.getTeamMembers(teamId);
  const isMember = members.some(m => m.userId === ws.userId);
  
  if (!isMember) {
    throw new Error('You are not a member of this team');
  }

  ws.teamId = teamId;

  // Add to team connections
  if (!teamConnections.has(teamId)) {
    teamConnections.set(teamId, new Set());
  }
  teamConnections.get(teamId)!.add(ws);

  // Get recent messages
  const recentMessages = await storage.getTeamChatMessages(teamId, 50);

  // Send team chat state to joining user
  ws.send(JSON.stringify({
    type: 'team_joined',
    team,
    recentMessages,
  }));

  // Broadcast to other team members
  broadcastToTeam(teamId, teamConnections, {
    type: 'user_joined',
    data: { userId: ws.userId }
  }, ws);

  console.log(`[Team Chat WS] User ${ws.userId} joined team ${teamId}`);
}

/**
 * Handle user leaving team chat
 */
async function handleLeaveTeam(
  ws: TeamChatWebSocket,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  if (!ws.teamId) return;

  const teamId = ws.teamId;

  // Remove from connections
  const connections = teamConnections.get(teamId);
  if (connections) {
    connections.delete(ws);
  }

  // Broadcast leave event
  broadcastToTeam(teamId, teamConnections, {
    type: 'user_left',
    data: { userId: ws.userId }
  });

  ws.teamId = undefined;
  console.log(`[Team Chat WS] User ${ws.userId} left team ${teamId}`);
}

/**
 * Handle sending message
 */
async function handleSendMessage(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { message: content, metadata } = message;
  if (!content || !ws.teamId || !ws.userId) {
    throw new Error('Message content, team ID, and user ID required');
  }

  // Save message to database
  const chatMessage = await storage.createTeamChatMessage({
    teamId: ws.teamId,
    senderId: ws.userId,
    message: content,
    metadata: metadata || {},
  });

  // Broadcast to all team members
  broadcastToTeam(ws.teamId, teamConnections, {
    type: 'new_message',
    data: chatMessage
  });

  console.log(`[Team Chat WS] Message sent in team ${ws.teamId} by user ${ws.userId}`);
}

/**
 * Handle typing indicator
 */
async function handleTypingIndicator(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>,
  isTyping: boolean
) {
  if (!ws.teamId || !ws.userId) {
    throw new Error('Team ID and user ID required');
  }

  // Broadcast typing indicator to other team members
  broadcastToTeam(ws.teamId, teamConnections, {
    type: 'typing_indicator',
    data: { userId: ws.userId, isTyping }
  }, ws);
}

/**
 * Broadcast message to all clients in a team
 */
function broadcastToTeam(
  teamId: string,
  teamConnections: Map<string, Set<TeamChatWebSocket>>,
  message: BroadcastMessage,
  excludeWs?: TeamChatWebSocket
) {
  const connections = teamConnections.get(teamId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  for (const client of Array.from(connections)) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}
