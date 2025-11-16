import { db } from './db';
import { agentSessions, agentMessages, AgentSession, AgentMessage } from '@shared/schema';
import { and, eq, desc, or, isNull } from 'drizzle-orm';

class AgentSessionService {
  /**
   * Get or create a session for an agent
   */
  async getOrCreateSession(
    agentSlug: string,
    sessionId: string,
    userId: string,
    organizationId: string
  ): Promise<AgentSession> {
    let session = await db.query.agentSessions.findFirst({
      where: and(
        eq(agentSessions.sessionId, sessionId),
        eq(agentSessions.userId, userId)
      ),
    });
    
    if (!session) {
      const [newSession] = await db
        .insert(agentSessions)
        .values({
          agentSlug,
          sessionId,
          userId,
          organizationId,
          title: null,
          metadata: {},
        })
        .returning();
      
      session = newSession as AgentSession;
      console.log(`[SessionService] Created new session: ${agentSlug}/${sessionId} for user ${userId}`);
    }
    
    return session as AgentSession;
  }
  
  /**
   * Save a message to a session
   */
  async saveMessage(
    sessionDbId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<void> {
    await db.insert(agentMessages).values({
      sessionId: sessionDbId,
      role,
      content,
      metadata: metadata || {},
    });
    
    await db
      .update(agentSessions)
      .set({ updatedAt: new Date() })
      .where(eq(agentSessions.id, sessionDbId));
  }
  
  /**
   * Get conversation history
   */
  async getHistory(
    sessionDbId: string,
    limit: number = 50
  ): Promise<AgentMessage[]> {
    const messages = await db.query.agentMessages.findMany({
      where: eq(agentMessages.sessionId, sessionDbId),
      orderBy: [desc(agentMessages.createdAt)],
      limit,
    });
    
    return messages.reverse() as AgentMessage[];
  }
  
  /**
   * Update session title (auto-generate from first message)
   */
  async updateSessionTitle(
    sessionDbId: string,
    title: string
  ): Promise<void> {
    await db
      .update(agentSessions)
      .set({ title })
      .where(eq(agentSessions.id, sessionDbId));
  }
  
  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string,
    organizationId: string,
    agentSlug?: string,
    limit: number = 50
  ): Promise<AgentSession[]> {
    const conditions = [
      eq(agentSessions.userId, userId),
      eq(agentSessions.organizationId, organizationId),
    ];
    
    if (agentSlug) {
      conditions.push(eq(agentSessions.agentSlug, agentSlug));
    }
    
    return await db.query.agentSessions.findMany({
      where: and(...conditions),
      orderBy: [desc(agentSessions.updatedAt)],
      limit,
    }) as AgentSession[];
  }
  
  /**
   * Delete a session and all its messages
   */
  async deleteSession(sessionDbId: string, userId: string): Promise<void> {
    const session = await db.query.agentSessions.findFirst({
      where: and(
        eq(agentSessions.id, sessionDbId),
        eq(agentSessions.userId, userId)
      ),
    });
    
    if (!session) {
      throw new Error('Session not found or access denied');
    }
    
    await db
      .delete(agentSessions)
      .where(eq(agentSessions.id, sessionDbId));
    
    console.log(`[SessionService] Deleted session: ${sessionDbId}`);
  }
  
  /**
   * Get session by session ID (external ID)
   */
  async getSessionBySessionId(
    sessionId: string,
    userId: string
  ): Promise<AgentSession | null> {
    const session = await db.query.agentSessions.findFirst({
      where: and(
        eq(agentSessions.sessionId, sessionId),
        eq(agentSessions.userId, userId)
      ),
    });
    
    return (session as AgentSession) || null;
  }
  
  /**
   * Update session metadata
   */
  async updateSessionMetadata(
    sessionDbId: string,
    metadata: any
  ): Promise<void> {
    await db
      .update(agentSessions)
      .set({ 
        metadata,
        updatedAt: new Date()
      })
      .where(eq(agentSessions.id, sessionDbId));
  }
}

export const sessionService = new AgentSessionService();
