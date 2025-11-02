import type { Express, Response } from "express";
import { requireAuth, type AuthRequest } from "./auth";
import { storage } from "./storage";

/**
 * Common session management routes for AI agents (Parity, Cadence, Forma)
 * These routes handle CRUD operations for agent conversation sessions
 */
export function registerAgentSessionRoutes(app: Express, agentSlug: string) {
  const basePath = `/api/agents/${agentSlug}/sessions`;

  // Create a new session
  app.post(basePath, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Session name is required" });
      }

      const session = await storage.createAgentSession({
        agentSlug,
        userId: req.user!.id,
        organizationId: req.user!.organizationId!,
        name,
      });

      res.json(session);
    } catch (error) {
      console.error(`Error creating ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Get all sessions for current user
  app.get(basePath, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const sessions = await storage.getAgentSessionsByUser(req.user!.id, agentSlug);
      res.json(sessions);
    } catch (error) {
      console.error(`Error fetching ${agentSlug} sessions:`, error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get a specific session with its messages
  app.get(`${basePath}/:id`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const session = await storage.getAgentSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== req.user!.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const messages = await storage.getAgentMessagesBySession(id);
      
      res.json({
        ...session,
        messages,
      });
    } catch (error) {
      console.error(`Error fetching ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Update session name
  app.patch(`${basePath}/:id`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Session name is required" });
      }

      const session = await storage.getAgentSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== req.user!.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updated = await storage.updateAgentSession(id, name);
      res.json(updated);
    } catch (error) {
      console.error(`Error updating ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // Delete a session
  app.delete(`${basePath}/:id`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const session = await storage.getAgentSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== req.user!.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteAgentSession(id);
      res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Get messages for a session
  app.get(`${basePath}/:id/messages`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const session = await storage.getAgentSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== req.user!.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const messages = await storage.getAgentMessagesBySession(id);
      res.json(messages);
    } catch (error) {
      console.error(`Error fetching messages for ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Add a message to a session
  app.post(`${basePath}/:id/messages`, requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { role, content, metadata } = req.body;

      if (!role || !content) {
        return res.status(400).json({ error: "Role and content are required" });
      }

      const session = await storage.getAgentSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== req.user!.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const message = await storage.createAgentMessage({
        sessionId: id,
        role,
        content,
        metadata: metadata || {},
      });

      res.json(message);
    } catch (error) {
      console.error(`Error adding message to ${agentSlug} session:`, error);
      res.status(500).json({ error: "Failed to add message" });
    }
  });
}
