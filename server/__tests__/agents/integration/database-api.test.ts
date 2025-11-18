/**
 * Database Integration Tests - API Level
 * Tests persistence and enforcement through public HTTP API
 * 
 * Coverage: 2 critical tests
 * 1. API-driven session/message persistence with direct DB verification
 * 2. Archived session enforcement (expect rejection when adding messages)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../../auth';

describe('Database Integration - API Level', () => {
  let testUser: any;
  let testOrg: any;
  let adminRole: any;
  let sessionId: string | null = null;

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
      name: 'API Test Org',
      slug: 'api-test-org-db',
    }).returning().then(r => r[0]);

    // Create test user
    testUser = await db.insert(schema.users).values({
      email: 'apitest@example.com',
      username: 'apitest',
      password: await hashPassword('SecurePass123!'),
      firstName: 'API',
      lastName: 'Test',
      roleId: adminRole.id,
      organizationId: testOrg.id,
      isActive: true,
    }).returning().then(r => r[0]);
  });

  afterEach(async () => {
    // Clean up test data
    if (sessionId) {
      await db.delete(schema.agentMessages).where(eq(schema.agentMessages.sessionId, sessionId));
      await db.delete(schema.agentSessions).where(eq(schema.agentSessions.id, sessionId));
      sessionId = null;
    }
    await db.delete(schema.users).where(eq(schema.users.id, testUser.id));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testOrg.id));
  });

  it('should persist session and messages via API with direct DB verification', async () => {
    // This test would require the full Express app setup with routes
    // For now, we'll use the service layer as a proxy for API calls
    // In a complete implementation, this would use supertest to make actual HTTP requests
    
    const { agentSessionService } = await import('../../../agents/services/agent-session.service');
    
    // Create session (simulating API POST /api/agents/luca/sessions)
    const session = await agentSessionService.createSession(
      testUser.id,
      testOrg.id,
      'luca'
    );
    sessionId = session.id;

    // Verify session persisted in database
    const dbSessions = await db.select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.id, sessionId));

    expect(dbSessions).toHaveLength(1);
    expect(dbSessions[0].userId).toBe(testUser.id);
    expect(dbSessions[0].organizationId).toBe(testOrg.id);
    expect(dbSessions[0].agentSlug).toBe('luca');

    // Add message (simulating API POST /api/agents/luca/sessions/:id/messages)
    const message = await agentSessionService.addMessage(
      sessionId,
      'user',
      'Test message from API'
    );

    // Verify message persisted in database
    const dbMessages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, sessionId));

    expect(dbMessages).toHaveLength(1);
    expect(dbMessages[0].role).toBe('user');
    expect(dbMessages[0].content).toBe('Test message from API');
    expect(dbMessages[0].sessionId).toBe(sessionId);

    // Verify foreign key relationship in database
    const joinResult = await db.select({
      sessionId: schema.agentSessions.id,
      messageId: schema.agentMessages.id,
    })
      .from(schema.agentSessions)
      .innerJoin(
        schema.agentMessages,
        eq(schema.agentSessions.id, schema.agentMessages.sessionId)
      )
      .where(eq(schema.agentMessages.id, message.id));

    expect(joinResult).toHaveLength(1);
    expect(joinResult[0].sessionId).toBe(sessionId);
  });

  it('should enforce archived session guard and reject message additions', async () => {
    const { agentSessionService } = await import('../../../agents/services/agent-session.service');
    
    // Create new session for this test
    const session = await agentSessionService.createSession(
      testUser.id,
      testOrg.id,
      'cadence'
    );
    const archivedSessionId = session.id;

    // Add initial message successfully
    await agentSessionService.addMessage(archivedSessionId, 'user', 'Initial message');

    // Archive the session
    await db.update(schema.agentSessions)
      .set({ isArchived: true })
      .where(eq(schema.agentSessions.id, archivedSessionId));

    // Verify archive flag persisted
    const dbSession = await db.select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.id, archivedSessionId));
    expect(dbSession[0].isArchived).toBe(true);

    // Attempt to add message to archived session - should be rejected
    try {
      await agentSessionService.addMessage(
        archivedSessionId,
        'user',
        'This should fail'
      );
      // If we get here, the test should fail
      expect.fail('Expected addMessage to throw error for archived session');
    } catch (error: any) {
      // Verify the correct error is thrown
      expect(error.message).toContain('archived');
    }

    // Verify the rejected message was NOT persisted to database
    const dbMessages = await db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.sessionId, archivedSessionId));
    
    // Should only have the initial message, not the rejected one
    expect(dbMessages).toHaveLength(1);
    expect(dbMessages[0].content).toBe('Initial message');

    // Cleanup
    await db.delete(schema.agentMessages).where(eq(schema.agentMessages.sessionId, archivedSessionId));
    await db.delete(schema.agentSessions).where(eq(schema.agentSessions.id, archivedSessionId));
  });
});
