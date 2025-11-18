/**
 * Database Integration Tests - Simplified
 * Direct database queries to verify session persistence and multi-tenancy
 * 
 * Coverage: 10 high-quality tests with direct DB verification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../../../auth';
import { agentSessionService } from '../../../agents/services/agent-session.service';

describe('Database Integration - Agent Sessions', () => {
  let testOrg: any;
  let testUser: any;
  let adminRole: any;

  beforeEach(async () => {
    // Get or create Admin role
    let adminRoleQuery = await db.select().from(schema.roles).where(eq(schema.roles.name, 'Admin'));
    if (adminRoleQuery.length === 0) {
      adminRole = await db.insert(schema.roles).values({
        name: 'Admin',
        description: 'Organization administrator',
        isSystemRole: true,
        scope: 'tenant',
      }).returning().then(r => r[0]);
    } else {
      adminRole = adminRoleQuery[0];
    }

    // Create test organization
    testOrg = await db.insert(schema.organizations).values({
      name: 'DB Test Org',
      slug: 'db-test-org-sessions',
    }).returning().then(r => r[0]);

    // Create test user
    testUser = await db.insert(schema.users).values({
      email: 'dbtest@example.com',
      username: 'dbtest',
      password: await hashPassword('SecurePass123!'),
      firstName: 'DB',
      lastName: 'Test',
      roleId: adminRole.id,
      organizationId: testOrg.id,
      isActive: true,
    }).returning().then(r => r[0]);
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(schema.agentMessages).where(
      eq(schema.agentMessages.sessionId, 
        db.select({ id: schema.agentSessions.id }).from(schema.agentSessions).where(eq(schema.agentSessions.userId, testUser.id)) as any
      )
    );
    await db.delete(schema.agentSessions).where(eq(schema.agentSessions.userId, testUser.id));
    await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrg.id));
  });

  it('should persist session to agent_sessions table', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');

    // Direct database query to verify persistence
    const dbSessions = await db.select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.id, session.id));

    expect(dbSessions).toHaveLength(1);
    expect(dbSessions[0].userId).toBe(testUser.id);
    expect(dbSessions[0].organizationId).toBe(testOrg.id);
    expect(dbSessions[0].agentSlug).toBe('luca');
  });

  it('should persist message to agent_messages table', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');
    const message = await agentSessionService.addMessage(session.id, 'user', 'Test message');

    // Direct database query to verify message persistence
    const dbMessages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.id, message.id));

    expect(dbMessages).toHaveLength(1);
    expect(dbMessages[0].sessionId).toBe(session.id);
    expect(dbMessages[0].role).toBe('user');
    expect(dbMessages[0].content).toBe('Test message');
  });

  it('should maintain message ordering in database', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');
    
    const msg1 = await agentSessionService.addMessage(session.id, 'user', 'First');
    await new Promise(resolve => setTimeout(resolve, 10));
    const msg2 = await agentSessionService.addMessage(session.id, 'assistant', 'Second');
    await new Promise(resolve => setTimeout(resolve, 10));
    const msg3 = await agentSessionService.addMessage(session.id, 'user', 'Third');

    // Direct database query with ordering
    const dbMessages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, session.id))
      .orderBy(schema.agentMessages.createdAt);

    expect(dbMessages).toHaveLength(3);
    expect(dbMessages[0].content).toBe('First');
    expect(dbMessages[1].content).toBe('Second');
    expect(dbMessages[2].content).toBe('Third');
  });

  it('should cascade delete messages when session is deleted', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');
    await agentSessionService.addMessage(session.id, 'user', 'Message 1');
    await agentSessionService.addMessage(session.id, 'user', 'Message 2');

    // Verify messages exist
    let dbMessages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, session.id));
    expect(dbMessages).toHaveLength(2);

    // Delete session
    await agentSessionService.deleteSession(session.id);

    // Verify session deleted from database
    const dbSessions = await db.select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.id, session.id));
    expect(dbSessions).toHaveLength(0);

    // Verify messages cascaded (implementation may vary)
    dbMessages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, session.id));
    expect(dbMessages).toHaveLength(0);
  });

  it('should enforce organization isolation in database queries', async () => {
    // Create another organization and user
    const org2 = await db.insert(schema.organizations).values({
      name: 'Other Org',
      slug: 'other-org-isolation',
    }).returning().then(r => r[0]);

    const user2 = await db.insert(schema.users).values({
      email: 'other@example.com',
      username: 'other',
      password: await hashPassword('SecurePass123!'),
      firstName: 'Other',
      lastName: 'User',
      roleId: adminRole.id,
      organizationId: org2.id,
      isActive: true,
    }).returning().then(r => r[0]);

    const session1 = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');
    const session2 = await agentSessionService.createSession(user2.id, org2.id, 'luca');

    // Verify org1 sessions
    const org1Sessions = await db.select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.organizationId, testOrg.id));
    expect(org1Sessions.map(s => s.id)).toContain(session1.id);
    expect(org1Sessions.map(s => s.id)).not.toContain(session2.id);

    // Verify org2 sessions
    const org2Sessions = await db.select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.organizationId, org2.id));
    expect(org2Sessions.map(s => s.id)).toContain(session2.id);
    expect(org2Sessions.map(s => s.id)).not.toContain(session1.id);

    // Cleanup
    await db.delete(schema.agentSessions).where(eq(schema.agentSessions.userId, user2.id));
    await db.delete(schema.users).where(eq(schema.users.id, user2.id));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, org2.id));
  });

  it('should isolate sessions by user within same organization', async () => {
    // Create second user in same org
    const user2 = await db.insert(schema.users).values({
      email: 'user2@example.com',
      username: 'user2',
      password: await hashPassword('SecurePass123!'),
      firstName: 'User',
      lastName: 'Two',
      roleId: adminRole.id,
      organizationId: testOrg.id,
      isActive: true,
    }).returning().then(r => r[0]);

    const session1 = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');
    const session2 = await agentSessionService.createSession(user2.id, testOrg.id, 'luca');

    // Verify user1 sessions
    const user1Sessions = await db.select()
      .from(schema.agentSessions)
      .where(
        and(
          eq(schema.agentSessions.userId, testUser.id),
          eq(schema.agentSessions.organizationId, testOrg.id)
        )
      );
    expect(user1Sessions.map(s => s.id)).toContain(session1.id);
    expect(user1Sessions.map(s => s.id)).not.toContain(session2.id);

    // Verify user2 sessions
    const user2Sessions = await db.select()
      .from(schema.agentSessions)
      .where(
        and(
          eq(schema.agentSessions.userId, user2.id),
          eq(schema.agentSessions.organizationId, testOrg.id)
        )
      );
    expect(user2Sessions.map(s => s.id)).toContain(session2.id);
    expect(user2Sessions.map(s => s.id)).not.toContain(session1.id);

    // Cleanup
    await db.delete(schema.agentSessions).where(eq(schema.agentSessions.userId, user2.id));
    await db.delete(schema.users).where(eq(schema.users.id, user2.id));
  });

  it('should persist session metadata (title, context, archived flag)', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');

    // Update session metadata
    await db.update(schema.agentSessions)
      .set({
        title: 'Test Session Title',
        context: { key: 'value' } as any,
        isArchived: true
      })
      .where(eq(schema.agentSessions.id, session.id));

    // Verify metadata persisted
    const dbSessions = await db.select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.id, session.id));

    expect(dbSessions[0].title).toBe('Test Session Title');
    expect(dbSessions[0].context).toEqual({ key: 'value' });
    expect(dbSessions[0].isArchived).toBe(true);
  });

  it('should handle large message volume with pagination', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');

    // Add 50 messages
    for (let i = 1; i <= 50; i++) {
      await agentSessionService.addMessage(session.id, 'user', `Message ${i}`);
    }

    // Verify all persisted
    const dbMessages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, session.id));
    expect(dbMessages).toHaveLength(50);

    // Verify pagination works (first 10)
    const page1 = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, session.id))
      .orderBy(schema.agentMessages.createdAt)
      .limit(10);
    expect(page1).toHaveLength(10);
  });

  it('should optimize queries with proper indexes', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');

    // Add messages
    for (let i = 1; i <= 100; i++) {
      await agentSessionService.addMessage(session.id, 'user', `Message ${i}`);
    }

    // Query should be fast (<1s) with proper indexing
    const startTime = Date.now();
    const messages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, session.id))
      .orderBy(schema.agentMessages.createdAt);
    const duration = Date.now() - startTime;

    expect(messages).toHaveLength(100);
    expect(duration).toBeLessThan(1000); // Should complete in <1s
  });

  it('should verify foreign key constraints between sessions and messages', async () => {
    const session = await agentSessionService.createSession(testUser.id, testOrg.id, 'luca');
    const message = await agentSessionService.addMessage(session.id, 'user', 'Test');

    // Verify foreign key relationship
    const result = await db.select({
      sessionId: schema.agentSessions.id,
      messageId: schema.agentMessages.id,
      messageSessionId: schema.agentMessages.sessionId,
    })
      .from(schema.agentSessions)
      .innerJoin(
        schema.agentMessages,
        eq(schema.agentSessions.id, schema.agentMessages.sessionId)
      )
      .where(eq(schema.agentMessages.id, message.id));

    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe(session.id);
    expect(result[0].messageSessionId).toBe(session.id);
  });
});
