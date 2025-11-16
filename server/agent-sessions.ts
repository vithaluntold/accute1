import type { Express, Response } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { sessionService } from "./agent-session-service";
import { nanoid } from "nanoid";

/**
 * Common session management routes for AI agents (All 10 agents with auto-title generation)
 * These routes handle CRUD operations for agent conversation sessions using AgentSessionService
 */
export function registerAgentSessionRoutes(app: Express, agentSlug: string) {
  const basePath = `/api/agents/${agentSlug}/sessions`;

  // Create a new session
  app.post(basePath, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { name, title } = req.body;
      
      // Support both name and title for backward compatibility
      const sessionTitle = title || name || null;
      
      // Generate unique session ID
      const sessionId = `${agentSlug}-${nanoid(16)}`;

      const session = await sessionService.getOrCreateSession(
        agentSlug,
        sessionId,
        req.user!.id,
        req.user!.organizationId!
      );

      // Update title if provided
      if (sessionTitle) {
        await sessionService.updateSessionTitle(session.id, sessionTitle);
        session.title = sessionTitle;
      }

      res.json(session);
    } catch (error) {
      console.error(`Error creating ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Get all sessions for current user
  app.get(basePath, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const sessions = await sessionService.getUserSessions(
        req.user!.id,
        req.user!.organizationId!,
        agentSlug
      );
      res.json(sessions);
    } catch (error) {
      console.error(`Error fetching ${agentSlug} sessions:`, error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get a specific session with its messages
  app.get(`${basePath}/:sessionId`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      const session = await sessionService.getSessionBySessionId(sessionId, req.user!.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const messages = await sessionService.getHistory(session.id);
      
      res.json({
        ...session,
        messages,
      });
    } catch (error) {
      console.error(`Error fetching ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Update session title/name
  app.patch(`${basePath}/:sessionId`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { name, title } = req.body;

      // Support both name and title for backward compatibility
      const newTitle = title || name;
      
      if (!newTitle) {
        return res.status(400).json({ error: "Title or name is required" });
      }

      const session = await sessionService.getSessionBySessionId(sessionId, req.user!.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await sessionService.updateSessionTitle(session.id, newTitle);
      
      const updated = await sessionService.getSessionBySessionId(sessionId, req.user!.id);
      res.json(updated);
    } catch (error) {
      console.error(`Error updating ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // Delete a session
  app.delete(`${basePath}/:sessionId`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = await sessionService.getSessionBySessionId(sessionId, req.user!.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await sessionService.deleteSession(session.id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Get messages for a session
  app.get(`${basePath}/:sessionId/messages`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = await sessionService.getSessionBySessionId(sessionId, req.user!.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const messages = await sessionService.getHistory(session.id);
      res.json(messages);
    } catch (error) {
      console.error(`Error fetching messages for ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Add a message to a session
  app.post(`${basePath}/:sessionId/messages`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { role, content, metadata } = req.body;

      if (!role || !content) {
        return res.status(400).json({ error: "Role and content are required" });
      }

      const session = await sessionService.getSessionBySessionId(sessionId, req.user!.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await sessionService.saveMessage(session.id, role, content, metadata || {});
      
      const messages = await sessionService.getHistory(session.id);
      const newMessage = messages[messages.length - 1];
      
      res.json(newMessage);
    } catch (error) {
      console.error(`Error adding message to ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to add message" });
    }
  });
}
