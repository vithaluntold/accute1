import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'cookie';
import { storage } from './storage';
import { chatThreadingService } from './services/ChatThreadingService';
import { WebRTCSignalingService } from './services/WebRTCSignalingService';
import crypto from 'crypto';

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
    | 'ping'
    // WebRTC call signaling
    | 'start_call'
    | 'accept_call'
    | 'reject_call'
    | 'end_call'
    | 'ice_candidate'
    | 'sdp_offer'
    | 'sdp_answer';
  teamId?: string;
  message?: string;
  metadata?: any;
  inReplyTo?: string; // Thread support - backward compatible
  // WebRTC call data
  callId?: string;
  callType?: 'audio' | 'video';
  receiverId?: string;
  sdp?: any;
  candidate?: any;
}

interface BroadcastMessage {
  type:
    | 'new_message'
    | 'user_joined'
    | 'user_left'
    | 'typing_indicator'
    | 'error'
    // WebRTC call events
    | 'call_started'
    | 'incoming_call'
    | 'call_accepted'
    | 'call_rejected'
    | 'call_ended'
    | 'ice_candidate'
    | 'sdp_offer'
    | 'sdp_answer';
  data?: any;
  error?: string;
}

/**
 * Setup WebSocket server for Team Chat
 */
export function setupTeamChatWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    noServer: true, // Lazy loading - upgrade handled externally
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
            console.error('[Team Chat WS] JWT_SECRET not configured');
            ws.close(4001, 'Server configuration error');
            return;
          }

          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, jwtSecret) as any;
            userId = decoded.userId;
          } catch (error) {
            console.log('[Team Chat WS] Invalid JWT token');
          }
        }
      }

      if (!userId) {
        console.log('[Team Chat WS] No valid authentication found');
        ws.close(4001, 'Authentication required');
        return;
      }

      const user = await storage.getUser(userId);
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
            // WebRTC call signaling
            case 'start_call':
              await handleStartCall(ws, message, teamConnections);
              break;
            case 'accept_call':
              await handleAcceptCall(ws, message, teamConnections);
              break;
            case 'reject_call':
              await handleRejectCall(ws, message, teamConnections);
              break;
            case 'end_call':
              await handleEndCall(ws, message, teamConnections);
              break;
            case 'ice_candidate':
              await handleIceCandidate(ws, message, teamConnections);
              break;
            case 'sdp_offer':
              await handleSdpOffer(ws, message, teamConnections);
              break;
            case 'sdp_answer':
              await handleSdpAnswer(ws, message, teamConnections);
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
    throw new Error('Team ID (or Channel ID) and user ID required');
  }

  // Try as team first, then fallback to channel (for chat channels)
  let team = await storage.getTeam(teamId);
  
  if (!team) {
    // Check if it's a chat channel instead
    const channel = await storage.getChatChannel(teamId);
    if (channel && channel.organizationId === ws.organizationId) {
      // Verify user is a member of the channel
      const members = await storage.getChatChannelMembers(teamId);
      const isMember = members.some(m => m.userId === ws.userId);
      
      if (!isMember) {
        throw new Error('Access denied: not a channel member');
      }
      
      // Treat channel as team for WebSocket purposes
      ws.teamId = teamId;
      
      // Add to connections
      if (!teamConnections.has(teamId)) {
        teamConnections.set(teamId, new Set());
      }
      teamConnections.get(teamId)!.add(ws);
      
      console.log(`[Team Chat WS] User ${ws.userId} joined channel ${teamId}`);
      
      // Broadcast user joined
      broadcastToTeam(
        teamId,
        {
          type: 'user_joined',
          data: { userId: ws.userId }
        },
        teamConnections,
        ws
      );
      
      return;
    }
    
    throw new Error('Team or Channel not found');
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
  const { message: content, metadata, inReplyTo } = message;
  if (!content || !ws.teamId || !ws.userId || !ws.organizationId) {
    throw new Error('Message content, team ID, user ID, and organization ID required');
  }

  try {
    // Generate message ID before resolving threadId
    const messageId = crypto.randomUUID();

    // Resolve threadId using ChatThreadingService
    const threadId = await chatThreadingService.resolveTeamChatThreadId(
      messageId,
      ws.teamId,
      inReplyTo || null,
      ws.organizationId
    );

    // Save message to database with threading
    const chatMessage = await storage.createTeamChatMessage({
      id: messageId, // Pass pre-generated ID
      teamId: ws.teamId,
      senderId: ws.userId,
      message: content,
      metadata: metadata || {},
      threadId,
      inReplyTo: inReplyTo || null,
    });

    // Broadcast to all team members
    broadcastToTeam(ws.teamId, teamConnections, {
      type: 'new_message',
      data: chatMessage
    });

    console.log(`[Team Chat WS] Message sent in team ${ws.teamId} by user ${ws.userId}, thread: ${threadId}`);
  } catch (error: any) {
    console.error('[Team Chat WS] Send message error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message || 'Failed to send message'
    }));
  }
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

/**
 * Send message to specific user in team
 */
function sendToUser(
  userId: string,
  teamId: string,
  teamConnections: Map<string, Set<TeamChatWebSocket>>,
  message: BroadcastMessage
) {
  const connections = teamConnections.get(teamId);
  if (!connections) return;

  const messageStr = JSON.stringify(message);
  for (const client of Array.from(connections)) {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

// ==================== WebRTC Call Signal Handlers ====================

/**
 * Handle start call request
 */
async function handleStartCall(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { callType, receiverId, teamId } = message;
  
  if (!callType || !receiverId || !teamId || !ws.userId || !ws.organizationId) {
    throw new Error('Call type, receiver ID, team ID, user ID, and organization ID required');
  }

  // Validate users can start call
  const validation = WebRTCSignalingService.canStartCall(ws.userId, receiverId);
  if (!validation.valid) {
    ws.send(JSON.stringify({
      type: 'error',
      error: validation.reason
    }));
    return;
  }

  // Get user names
  const caller = await storage.getUser(ws.userId);
  const receiver = await storage.getUser(receiverId);
  
  if (!caller || !receiver) {
    throw new Error('User not found');
  }

  // Verify both users are in the same team
  const teamMembers = await storage.getTeamMembers(teamId);
  const callerInTeam = teamMembers.some(m => m.userId === ws.userId);
  const receiverInTeam = teamMembers.some(m => m.userId === receiverId);
  
  if (!callerInTeam || !receiverInTeam) {
    throw new Error('Both users must be members of the team');
  }

  // Create call session
  const callId = crypto.randomUUID();
  const callSession = WebRTCSignalingService.createCall({
    callId,
    callerId: ws.userId,
    callerName: caller.fullName || caller.email,
    receiverId,
    receiverName: receiver.fullName || receiver.email,
    teamId,
    callType,
    organizationId: ws.organizationId,
  });

  // Send call started confirmation to caller (not accepted yet!)
  ws.send(JSON.stringify({
    type: 'call_started',
    data: { 
      callId, 
      receiverId,
      receiverName: receiver.fullName || receiver.email,
      callType 
    }
  }));

  // Notify receiver about incoming call
  sendToUser(receiverId, teamId, teamConnections, {
    type: 'incoming_call',
    data: {
      callId,
      callerId: ws.userId,
      callerName: caller.fullName || caller.email,
      callType,
      teamId,
    }
  });

  console.log(`[Team Chat WS] Call started: ${callId}, ${ws.userId} -> ${receiverId}`);
}

/**
 * Handle accept call
 */
async function handleAcceptCall(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { callId, teamId } = message;
  
  if (!callId || !teamId || !ws.userId) {
    throw new Error('Call ID, team ID, and user ID required');
  }

  const callSession = WebRTCSignalingService.getCall(callId);
  if (!callSession) {
    throw new Error('Call not found');
  }

  // Verify user is the receiver
  if (callSession.receiverId !== ws.userId) {
    throw new Error('Unauthorized');
  }

  // Update call status
  WebRTCSignalingService.updateCallStatus(callId, 'active');

  // Notify caller that call was accepted
  sendToUser(callSession.callerId, teamId, teamConnections, {
    type: 'call_accepted',
    data: { callId, receiverId: ws.userId }
  });

  console.log(`[Team Chat WS] Call accepted: ${callId}`);
}

/**
 * Handle reject call
 */
async function handleRejectCall(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { callId, teamId } = message;
  
  if (!callId || !teamId || !ws.userId) {
    throw new Error('Call ID, team ID, and user ID required');
  }

  const callSession = WebRTCSignalingService.getCall(callId);
  if (!callSession) {
    throw new Error('Call not found');
  }

  // Verify user is the receiver
  if (callSession.receiverId !== ws.userId) {
    throw new Error('Unauthorized');
  }

  // End call
  WebRTCSignalingService.endCall(callId);

  // Notify caller that call was rejected
  sendToUser(callSession.callerId, teamId, teamConnections, {
    type: 'call_rejected',
    data: { callId }
  });

  console.log(`[Team Chat WS] Call rejected: ${callId}`);
}

/**
 * Handle end call
 */
async function handleEndCall(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { callId, teamId } = message;
  
  if (!callId || !teamId || !ws.userId) {
    throw new Error('Call ID, team ID, and user ID required');
  }

  const callSession = WebRTCSignalingService.getCall(callId);
  if (!callSession) {
    return; // Call already ended
  }

  // Verify user is part of the call
  if (callSession.callerId !== ws.userId && callSession.receiverId !== ws.userId) {
    throw new Error('Unauthorized');
  }

  // End call
  WebRTCSignalingService.endCall(callId);

  // Notify other participant
  const otherUserId = callSession.callerId === ws.userId 
    ? callSession.receiverId 
    : callSession.callerId;

  sendToUser(otherUserId, teamId, teamConnections, {
    type: 'call_ended',
    data: { callId }
  });

  console.log(`[Team Chat WS] Call ended: ${callId}`);
}

/**
 * Handle ICE candidate
 */
async function handleIceCandidate(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { callId, candidate, teamId } = message;
  
  if (!callId || !candidate || !teamId || !ws.userId) {
    throw new Error('Call ID, candidate, team ID, and user ID required');
  }

  const callSession = WebRTCSignalingService.getCall(callId);
  if (!callSession) {
    throw new Error('Call not found');
  }

  // Verify user is part of the call
  if (callSession.callerId !== ws.userId && callSession.receiverId !== ws.userId) {
    throw new Error('Unauthorized');
  }

  // Forward ICE candidate to other participant
  const otherUserId = callSession.callerId === ws.userId 
    ? callSession.receiverId 
    : callSession.callerId;

  sendToUser(otherUserId, teamId, teamConnections, {
    type: 'ice_candidate',
    data: { callId, candidate, from: ws.userId }
  });
}

/**
 * Handle SDP offer
 */
async function handleSdpOffer(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { callId, sdp, teamId } = message;
  
  if (!callId || !sdp || !teamId || !ws.userId) {
    throw new Error('Call ID, SDP, team ID, and user ID required');
  }

  const callSession = WebRTCSignalingService.getCall(callId);
  if (!callSession) {
    throw new Error('Call not found');
  }

  // Verify user is the caller
  if (callSession.callerId !== ws.userId) {
    throw new Error('Unauthorized');
  }

  // Forward SDP offer to receiver
  sendToUser(callSession.receiverId, teamId, teamConnections, {
    type: 'sdp_offer',
    data: { callId, sdp, from: ws.userId }
  });
}

/**
 * Handle SDP answer
 */
async function handleSdpAnswer(
  ws: TeamChatWebSocket,
  message: TeamChatMessage,
  teamConnections: Map<string, Set<TeamChatWebSocket>>
) {
  const { callId, sdp, teamId } = message;
  
  if (!callId || !sdp || !teamId || !ws.userId) {
    throw new Error('Call ID, SDP, team ID, and user ID required');
  }

  const callSession = WebRTCSignalingService.getCall(callId);
  if (!callSession) {
    throw new Error('Call not found');
  }

  // Verify user is the receiver
  if (callSession.receiverId !== ws.userId) {
    throw new Error('Unauthorized');
  }

  // Forward SDP answer to caller
  sendToUser(callSession.callerId, teamId, teamConnections, {
    type: 'sdp_answer',
    data: { callId, sdp, from: ws.userId }
  });
}
