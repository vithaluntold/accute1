import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { requireAuth, type AuthRequest } from "./auth";
import { RoundtableOrchestrator } from "./roundtable-orchestrator";
import {
  insertRoundtableSessionSchema,
  insertRoundtableMessageSchema,
  insertRoundtableParticipantSchema,
  type RoundtableSession,
  type RoundtableMessage,
  type RoundtableParticipant,
} from "@shared/schema";
import { z } from "zod";
import { agentRegistry } from "./agent-registry";

/**
 * SSE Roundtable Routes
 * 
 * Implements Server-Sent Events for Roundtable multi-party collaboration.
 * Follows the same pattern as AI agent chat: HTTP POST for actions, SSE for updates.
 * 
 * Architecture:
 * - POST /api/roundtable/sessions/:sessionId/messages - Send messages/actions
 * - GET /api/roundtable/sessions/:sessionId/stream - Receive real-time updates via SSE
 * 
 * Security:
 * - All routes require authentication
 * - Session ownership validation (user must be participant)
 * - Strict participant validation for private messages
 */

interface SSEClient {
  sessionId: string;
  userId: string;
  organizationId: string;
  participantId: string;
  response: Response;
}

// Track active SSE connections by session
const activeStreams = new Map<string, Set<SSEClient>>();

// Orchestrator for agent coordination
const orchestrator = new RoundtableOrchestrator(storage);

/**
 * Broadcast event to all participants in a session
 */
function broadcastToSession(sessionId: string, eventType: string, data: any) {
  const clients = activeStreams.get(sessionId);
  if (!clients || clients.size === 0) return;

  const sseData = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  
  clients.forEach(client => {
    try {
      client.response.write(sseData);
    } catch (error) {
      console.error(`[Roundtable SSE] Failed to send to client ${client.userId}:`, error);
      clients.delete(client);
    }
  });
}

/**
 * Send event to specific participant (for private messages)
 */
function sendToParticipant(sessionId: string, participantId: string, eventType: string, data: any) {
  const clients = activeStreams.get(sessionId);
  if (!clients) return;

  const sseData = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

  clients.forEach(client => {
    if (client.participantId === participantId) {
      try {
        client.response.write(sseData);
      } catch (error) {
        console.error(`[Roundtable SSE] Failed to send private message:`, error);
        clients.delete(client);
      }
    }
  });
}

export function registerSSERoundtableRoutes(app: Express) {
  /**
   * Create new Roundtable session
   */
  app.post("/api/roundtable/sessions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, objective, llmConfigId } = insertRoundtableSessionSchema.parse(req.body);
      
      const session = await storage.createRoundtableSession({
        userId: req.user!.id,
        organizationId: req.user!.organizationId!,
        title,
        description,
        objective,
        llmConfigId,
      });

      // Add user as first participant
      const userParticipant = await storage.addRoundtableParticipant({
        sessionId: session.id,
        participantType: 'user',
        participantId: req.user!.id,
        displayName: `${req.user!.firstName} ${req.user!.lastName}`,
      });

      res.json({ session, participant: userParticipant });
    } catch (error) {
      console.error('[Roundtable] Create session error:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  /**
   * Get session details with participants and messages
   */
  app.get("/api/roundtable/sessions/:sessionId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Verify user is participant
      const participants = await storage.getRoundtableParticipants(sessionId);
      const isParticipant = participants.some(p => 
        p.participantType === 'user' && p.participantId === req.user!.id
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session' });
      }

      const session = await storage.getRoundtableSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const messages = await storage.getRoundtableMessages(sessionId);
      const deliverables = await storage.getRoundtableDeliverables(sessionId);

      res.json({ session, participants, messages, deliverables });
    } catch (error) {
      console.error('[Roundtable] Get session error:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  /**
   * Send message or perform action in session
   */
  app.post("/api/roundtable/sessions/:sessionId/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { content, channelType, recipientParticipantId, action } = req.body;

      // Verify user is participant
      const participants = await storage.getRoundtableParticipants(sessionId);
      const userParticipant = participants.find(p => 
        p.participantType === 'user' && p.participantId === req.user!.id
      );

      if (!userParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session' });
      }

      // Handle different action types
      if (action === 'typing_start') {
        broadcastToSession(sessionId, 'typing_indicator', {
          participantId: userParticipant.id,
          displayName: userParticipant.displayName,
          isTyping: true,
        });
        return res.json({ success: true });
      }

      if (action === 'typing_stop') {
        broadcastToSession(sessionId, 'typing_indicator', {
          participantId: userParticipant.id,
          displayName: userParticipant.displayName,
          isTyping: false,
        });
        return res.json({ success: true });
      }

      // Create message
      const message = await storage.createRoundtableMessage({
        sessionId,
        senderType: 'user',
        senderId: req.user!.id,
        senderDisplayName: userParticipant.displayName,
        channelType: channelType || 'main',
        recipientParticipantId,
        content,
        metadata: {},
      });

      // Broadcast to appropriate recipients
      if (channelType === 'private' && recipientParticipantId) {
        // Send to sender (confirmation)
        sendToParticipant(sessionId, userParticipant.id, 'private_message', { message });
        // Send to recipient
        sendToParticipant(sessionId, recipientParticipantId, 'private_message', { message });
      } else {
        // Broadcast to all participants
        broadcastToSession(sessionId, 'new_message', { message });
      }

      // Trigger agent responses if mentioned or relevant
      // This happens asynchronously - agents will respond via their own SSE events
      orchestrator.handleUserMessage(sessionId, message).catch(err => {
        console.error('[Roundtable] Agent orchestration error:', err);
      });

      res.json({ message });
    } catch (error) {
      console.error('[Roundtable] Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  /**
   * Add AI agent to session
   */
  app.post("/api/roundtable/sessions/:sessionId/participants", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { agentSlug, role } = req.body;

      // Verify user is participant
      const participants = await storage.getRoundtableParticipants(sessionId);
      const isParticipant = participants.some(p => 
        p.participantType === 'user' && p.participantId === req.user!.id
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session' });
      }

      // Check if agent already in session
      const agentExists = participants.some(p => 
        p.participantType === 'agent' && p.participantId === agentSlug
      );

      if (agentExists) {
        return res.status(400).json({ error: 'Agent already in session' });
      }

      // Get agent info from registry
      const agent = agentRegistry.getAgent(agentSlug);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Add agent as participant
      const participant = await storage.addRoundtableParticipant({
        sessionId,
        participantType: 'agent',
        participantId: agentSlug,
        displayName: agent.name,
        role: role || 'participant',
      });

      // Broadcast agent joined
      broadcastToSession(sessionId, 'agent_added', { participant, agent });

      res.json({ participant });
    } catch (error) {
      console.error('[Roundtable] Add agent error:', error);
      res.status(500).json({ error: 'Failed to add agent' });
    }
  });

  /**
   * Remove participant (agent or user) from session
   */
  app.delete("/api/roundtable/sessions/:sessionId/participants/:participantId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId, participantId } = req.params;

      // Verify user is participant
      const participants = await storage.getRoundtableParticipants(sessionId);
      const isParticipant = participants.some(p => 
        p.participantType === 'user' && p.participantId === req.user!.id
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session' });
      }

      const participant = participants.find(p => p.id === participantId);
      if (!participant) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      // Remove participant
      await storage.removeRoundtableParticipant(participantId);

      // Broadcast participant left
      broadcastToSession(sessionId, 'participant_left', { participant });

      res.json({ success: true });
    } catch (error) {
      console.error('[Roundtable] Remove participant error:', error);
      res.status(500).json({ error: 'Failed to remove participant' });
    }
  });

  /**
   * SSE Stream - Real-time updates for Roundtable session
   */
  app.get("/api/roundtable/sessions/:sessionId/stream", requireAuth, async (req: AuthRequest, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId!;

    try {
      // Verify user is participant
      const participants = await storage.getRoundtableParticipants(sessionId);
      const userParticipant = participants.find(p => 
        p.participantType === 'user' && p.participantId === userId
      );

      if (!userParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session' });
      }

      // Setup SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const client: SSEClient = {
        sessionId,
        userId,
        organizationId,
        participantId: userParticipant.id,
        response: res,
      };

      // Add client to active streams
      if (!activeStreams.has(sessionId)) {
        activeStreams.set(sessionId, new Set());
      }
      activeStreams.get(sessionId)!.add(client);

      console.log(`[Roundtable SSE] User ${userId} connected to session ${sessionId}`);

      // Send initial roster update
      const currentParticipants = await storage.getRoundtableParticipants(sessionId);
      res.write(`event: roster_update\ndata: ${JSON.stringify({ participants: currentParticipants })}\n\n`);

      // Hydrate active presentation for reconnecting clients
      const session = await storage.getRoundtableSession(sessionId);
      if (session?.activePresentationDeliverableId) {
        const deliverable = await storage.getRoundtableDeliverable(session.activePresentationDeliverableId);
        const presenterParticipant = currentParticipants.find(p => 
          p.id === session.activePresentationPresenterParticipantId
        );
        
        if (deliverable && presenterParticipant) {
          console.log(`[Roundtable SSE] Hydrating active presentation for user ${userId}`);
          res.write(`event: deliverable_presentation\ndata: ${JSON.stringify({
            deliverable,
            presenterParticipantId: presenterParticipant.id,
            presenterName: presenterParticipant.displayName,
          })}\n\n`);
        }
      }

      // Broadcast user joined
      broadcastToSession(sessionId, 'participant_joined', { 
        participant: userParticipant,
        userId,
      });

      // Handle client disconnect
      req.on('close', () => {
        console.log(`[Roundtable SSE] User ${userId} disconnected from session ${sessionId}`);
        const clients = activeStreams.get(sessionId);
        if (clients) {
          clients.delete(client);
          if (clients.size === 0) {
            activeStreams.delete(sessionId);
          }
        }

        // Broadcast user left (only if they're still connected elsewhere)
        const stillConnected = Array.from(activeStreams.get(sessionId) || []).some(c => c.userId === userId);
        if (!stillConnected) {
          broadcastToSession(sessionId, 'participant_left', { 
            participant: userParticipant,
            userId,
          });
        }
      });

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          res.write(': heartbeat\n\n');
        } catch (error) {
          clearInterval(heartbeat);
        }
      }, 15000);

      req.on('close', () => clearInterval(heartbeat));

    } catch (error) {
      console.error('[Roundtable SSE] Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to establish SSE connection' });
      }
    }
  });

  /**
   * Start deliverable presentation
   */
  app.post("/api/roundtable/sessions/:sessionId/presentations/start", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { deliverableId } = req.body;

      // Verify user is participant
      const participants = await storage.getRoundtableParticipants(sessionId);
      const userParticipant = participants.find(p => 
        p.participantType === 'user' && p.participantId === req.user!.id
      );

      if (!userParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session' });
      }

      // Get deliverable
      const deliverable = await storage.getRoundtableDeliverable(deliverableId);
      if (!deliverable || deliverable.sessionId !== sessionId) {
        return res.status(404).json({ error: 'Deliverable not found' });
      }

      // Get session to check for existing presentation
      const session = await storage.getRoundtableSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Prevent concurrent presentations
      if (session.activePresentationDeliverableId) {
        return res.status(409).json({ 
          error: 'Another presentation is already active. Please end it first.',
        });
      }

      // Persist presentation state
      await storage.updateRoundtableSession(sessionId, {
        activePresentationDeliverableId: deliverableId,
        activePresentationPresenterParticipantId: userParticipant.id,
      });

      // Broadcast presentation started
      broadcastToSession(sessionId, 'deliverable_presentation', {
        deliverable,
        presenterParticipantId: userParticipant.id,
        presenterName: userParticipant.displayName,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[Roundtable] Start presentation error:', error);
      res.status(500).json({ error: 'Failed to start presentation' });
    }
  });

  /**
   * Stop deliverable presentation
   */
  app.post("/api/roundtable/sessions/:sessionId/presentations/stop", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Get session
      const session = await storage.getRoundtableSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify user is participant
      const participants = await storage.getRoundtableParticipants(sessionId);
      const userParticipant = participants.find(p => 
        p.participantType === 'user' && p.participantId === req.user!.id
      );

      if (!userParticipant) {
        return res.status(403).json({ error: 'Not a participant in this session' });
      }

      // Authorization: Only presenter or session owner can end presentation
      const isPresenter = session.activePresentationPresenterParticipantId === userParticipant.id;
      const isSessionOwner = session.userId === req.user!.id;

      if (!isPresenter && !isSessionOwner) {
        return res.status(403).json({ 
          error: 'Only the presenter or session owner can end the presentation',
        });
      }

      // Clear presentation state
      await storage.updateRoundtableSession(sessionId, {
        activePresentationDeliverableId: null as any,
        activePresentationPresenterParticipantId: null as any,
      });

      // Broadcast presentation ended
      broadcastToSession(sessionId, 'presentation_ended', {});

      res.json({ success: true });
    } catch (error) {
      console.error('[Roundtable] Stop presentation error:', error);
      res.status(500).json({ error: 'Failed to stop presentation' });
    }
  });

  console.log('✅ SSE Roundtable routes registered');
}

/**
 * Broadcast agent response to session (called by RoundtableOrchestrator)
 */
export function broadcastAgentResponse(sessionId: string, message: RoundtableMessage) {
  broadcastToSession(sessionId, 'agent_response', { message });
}

/**
 * Broadcast deliverable creation (called by agent execution)
 */
export function broadcastDeliverableCreated(sessionId: string, deliverable: any) {
  broadcastToSession(sessionId, 'deliverable_created', { deliverable });
}
