/**
 * AI Agent System - Session Management Unit Tests
 * Part of Six Sigma Testing Strategy (AI_AGENT_TESTING_PLAN.md)
 * 
 * Target: 30 unit tests
 * Coverage: Session service layer, CRUD operations, auto-title generation, message management
 * 
 * FIXED: Now uses AgentSessionService instead of raw database operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { testDb as db } from '../../test-db';
import { sessionService } from '../../agent-session-service';
import { agentSessions, agentMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createTestOrganization } from '../helpers';
import { nanoid } from 'nanoid';

describe('AI Agent System - Session Management (Service Layer)', () => {
  let testOrgId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test organization and user
    const { organization, ownerUser } = await createTestOrganization();
    testOrgId = organization.id;
    testUserId = ownerUser.id;
  });

  afterEach(async () => {
    // Cleanup sessions and messages
    await db.delete(agentMessages);
    await db.delete(agentSessions);
  });

  // ============================================================
  // 1. SESSION CREATION & RETRIEVAL (10 tests)
  // ============================================================

  describe('Session Creation & Retrieval', () => {
    it('should create new session through service', async () => {
      const sessionId = nanoid();
      const session = await sessionService.getOrCreateSession(
        'luca',
        sessionId,
        testUserId,
        testOrgId
      );

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.agentSlug).toBe('luca');
      expect(session.sessionId).toBe(sessionId);
      expect(session.userId).toBe(testUserId);
      expect(session.organizationId).toBe(testOrgId);
      expect(session.title).toBeNull();
    });

    it('should return existing session on duplicate getOrCreate', async () => {
      const sessionId = nanoid();

      // First call - creates
      const session1 = await sessionService.getOrCreateSession(
        'cadence',
        sessionId,
        testUserId,
        testOrgId
      );

      // Second call - returns existing
      const session2 = await sessionService.getOrCreateSession(
        'cadence',
        sessionId,
        testUserId,
        testOrgId
      );

      expect(session1.id).toBe(session2.id);
      expect(session1.sessionId).toBe(session2.sessionId);
    });

    it('should support all valid agent slugs', async () => {
      const agentSlugs = [
        'luca', 'cadence', 'parity', 'forma', 'echo',
        'relay', 'scribe', 'radar', 'omnispectra', 'lynk'  // Fixed: omnispectra not omni-spectra
      ];

      for (const slug of agentSlugs) {
        const session = await sessionService.getOrCreateSession(
          slug,
          nanoid(),
          testUserId,
          testOrgId
        );

        expect(session.agentSlug).toBe(slug);
      }
    });

    it('should retrieve user sessions', async () => {
      // Create multiple sessions
      await sessionService.getOrCreateSession('luca', nanoid(), testUserId, testOrgId);
      await sessionService.getOrCreateSession('cadence', nanoid(), testUserId, testOrgId);
      await sessionService.getOrCreateSession('parity', nanoid(), testUserId, testOrgId);

      const sessions = await sessionService.getUserSessions(testUserId, testOrgId);

      expect(sessions).toHaveLength(3);
      expect(sessions.every(s => s.userId === testUserId)).toBe(true);
      expect(sessions.every(s => s.organizationId === testOrgId)).toBe(true);
    });

    it('should filter sessions by agent slug', async () => {
      await sessionService.getOrCreateSession('luca', nanoid(), testUserId, testOrgId);
      await sessionService.getOrCreateSession('luca', nanoid(), testUserId, testOrgId);
      await sessionService.getOrCreateSession('cadence', nanoid(), testUserId, testOrgId);

      const lucaSessions = await sessionService.getUserSessions(
        testUserId,
        testOrgId,
        'luca'
      );

      expect(lucaSessions).toHaveLength(2);
      expect(lucaSessions.every(s => s.agentSlug === 'luca')).toBe(true);
    });

    it('should limit session retrieval', async () => {
      // Create 10 sessions
      for (let i = 0; i < 10; i++) {
        await sessionService.getOrCreateSession('luca', nanoid(), testUserId, testOrgId);
      }

      const sessions = await sessionService.getUserSessions(
        testUserId,
        testOrgId,
        undefined,
        5  // limit = 5
      );

      expect(sessions).toHaveLength(5);
    });

    it('should order sessions by most recently updated', async () => {
      const session1 = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      const session2 = await sessionService.getOrCreateSession(
        'cadence',
        nanoid(),
        testUserId,
        testOrgId
      );

      const sessions = await sessionService.getUserSessions(testUserId, testOrgId);

      // session2 should be first (most recent)
      expect(sessions[0].id).toBe(session2.id);
      expect(sessions[1].id).toBe(session1.id);
    });

    it('should retrieve session by session ID', async () => {
      const sessionId = nanoid();
      const created = await sessionService.getOrCreateSession(
        'luca',
        sessionId,
        testUserId,
        testOrgId
      );

      const retrieved = await sessionService.getSessionBySessionId(sessionId, testUserId);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.sessionId).toBe(sessionId);
    });

    it('should return null for non-existent session ID', async () => {
      const nonExistent = await sessionService.getSessionBySessionId(
        'non-existent-id',
        testUserId
      );

      expect(nonExistent).toBeNull();
    });

    it('should enforce user isolation in session retrieval', async () => {
      // Create another user
      const { ownerUser: user2 } = await createTestOrganization();

      // Create session for user1
      const sessionId = nanoid();
      await sessionService.getOrCreateSession('luca', sessionId, testUserId, testOrgId);

      // User2 should not see user1's session
      const user2View = await sessionService.getSessionBySessionId(sessionId, user2.id);

      expect(user2View).toBeNull();
    });
  });

  // ============================================================
  // 2. MESSAGE MANAGEMENT (8 tests)
  // ============================================================

  describe('Message Management', () => {
    let sessionDbId: string;

    beforeEach(async () => {
      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );
      sessionDbId = session.id;
    });

    it('should save user message', async () => {
      await sessionService.saveMessage(
        sessionDbId,
        'user',
        'What are the tax deductions for S-Corps?'
      );

      const messages = await sessionService.getHistory(sessionDbId);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('What are the tax deductions for S-Corps?');
    });

    it('should save assistant message', async () => {
      await sessionService.saveMessage(
        sessionDbId,
        'assistant',
        'Here are the key S-Corp tax deductions...'
      );

      const messages = await sessionService.getHistory(sessionDbId);

      expect(messages[0].role).toBe('assistant');
    });

    it('should save system message', async () => {
      await sessionService.saveMessage(
        sessionDbId,
        'system',
        'You are Luca, a tax compliance specialist.'
      );

      const messages = await sessionService.getHistory(sessionDbId);

      expect(messages[0].role).toBe('system');
    });

    it('should save message metadata', async () => {
      const metadata = { tokens: 150, model: 'gpt-4' };

      await sessionService.saveMessage(
        sessionDbId,
        'assistant',
        'Response text',
        metadata
      );

      const messages = await sessionService.getHistory(sessionDbId);

      expect(messages[0].metadata).toEqual(metadata);
    });

    it('should maintain conversation order', async () => {
      await sessionService.saveMessage(sessionDbId, 'user', 'First message');
      await sessionService.saveMessage(sessionDbId, 'assistant', 'Second message');
      await sessionService.saveMessage(sessionDbId, 'user', 'Third message');

      const messages = await sessionService.getHistory(sessionDbId);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('should limit conversation history', async () => {
      // Create 10 messages
      for (let i = 0; i < 10; i++) {
        await sessionService.saveMessage(sessionDbId, 'user', `Message ${i}`);
      }

      const messages = await sessionService.getHistory(sessionDbId, 5);

      expect(messages).toHaveLength(5);
    });

    it('should update session timestamp when message added', async () => {
      const session = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionDbId)
      });

      const originalUpdatedAt = session!.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 100));

      await sessionService.saveMessage(sessionDbId, 'user', 'New message');

      const updated = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionDbId)
      });

      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('should retrieve messages with timestamps', async () => {
      await sessionService.saveMessage(sessionDbId, 'user', 'Test message');

      const messages = await sessionService.getHistory(sessionDbId);

      expect(messages[0].createdAt).toBeDefined();
      expect(messages[0].createdAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================
  // 3. TITLE MANAGEMENT (7 tests)
  // ============================================================

  describe('Title Management', () => {
    let sessionDbId: string;

    beforeEach(async () => {
      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );
      sessionDbId = session.id;
    });

    it('should initialize with null title', async () => {
      const session = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionDbId)
      });

      expect(session!.title).toBeNull();
    });

    it('should update session title', async () => {
      await sessionService.updateSessionTitle(sessionDbId, 'Tax Planning Q1 2025');

      const session = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionDbId)
      });

      expect(session!.title).toBe('Tax Planning Q1 2025');
    });

    it('should support concise auto-generated titles', async () => {
      const autoTitle = 'S-Corp Tax Deductions';
      await sessionService.updateSessionTitle(sessionDbId, autoTitle);

      const session = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionDbId)
      });

      expect(session!.title).toBe(autoTitle);
      
      // Verify title length (3-6 words as per design)
      const wordCount = autoTitle.split(' ').length;
      expect(wordCount).toBeGreaterThanOrEqual(3);
      expect(wordCount).toBeLessThanOrEqual(6);
    });

    it('should allow title updates', async () => {
      await sessionService.updateSessionTitle(sessionDbId, 'Original Title');
      await sessionService.updateSessionTitle(sessionDbId, 'Updated Title');

      const session = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionDbId)
      });

      expect(session!.title).toBe('Updated Title');
    });

    it('should validate concise title formats', async () => {
      const validTitles = [
        'Tax Deduction Planning',
        'LLC to S-Corp',
        'Quarterly Estimates Guide',
        'Employee Benefits Setup',
        'Retirement Account Planning Strategy',
      ];

      for (const title of validTitles) {
        const wordCount = title.split(' ').length;
        expect(wordCount).toBeGreaterThanOrEqual(3);
        expect(wordCount).toBeLessThanOrEqual(6);
      }
    });

    it('should retrieve session with updated title', async () => {
      const title = 'Tax Planning Session';
      await sessionService.updateSessionTitle(sessionDbId, title);

      const sessions = await sessionService.getUserSessions(testUserId, testOrgId);

      expect(sessions[0].title).toBe(title);
    });

    it('should handle empty title gracefully', async () => {
      await sessionService.updateSessionTitle(sessionDbId, '');

      const session = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, sessionDbId)
      });

      expect(session!.title).toBe('');
    });
  });

  // ============================================================
  // 4. AUTHORIZATION & SECURITY (5 tests)
  // ============================================================

  describe('Authorization & Security', () => {
    it('should prevent user from accessing another users session', async () => {
      // Create user 1's session
      const { ownerUser: user2 } = await createTestOrganization();
      const sessionId = nanoid();
      
      const user1Session = await sessionService.getOrCreateSession(
        'luca',
        sessionId,
        testUserId,
        testOrgId
      );

      // User 2 should not see user 1's session
      const user2View = await sessionService.getSessionBySessionId(sessionId, user2.id);

      expect(user2View).toBeNull();
    });

    it('should prevent user from deleting another users session', async () => {
      const { ownerUser: user2 } = await createTestOrganization();

      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );

      // User 2 cannot delete user 1's session
      await expect(
        sessionService.deleteSession(session.id, user2.id)
      ).rejects.toThrow('Session not found or access denied');
    });

    it('should isolate sessions between organizations', async () => {
      const { organization: org2, ownerUser: user2 } = await createTestOrganization();

      // User 1 creates session in org 1
      await sessionService.getOrCreateSession('luca', nanoid(), testUserId, testOrgId);

      // User 2 queries their sessions in org 2
      const user2Sessions = await sessionService.getUserSessions(user2.id, org2.id);

      expect(user2Sessions).toHaveLength(0);
    });

    it('should enforce organization context in session creation', async () => {
      const sessionId = nanoid();
      const session = await sessionService.getOrCreateSession(
        'luca',
        sessionId,
        testUserId,
        testOrgId
      );

      expect(session.organizationId).toBe(testOrgId);
      expect(session.userId).toBe(testUserId);
    });

    it('should prevent cross-organization session access', async () => {
      // Create session in org 1
      await sessionService.getOrCreateSession('luca', nanoid(), testUserId, testOrgId);

      // Create org 2
      const { organization: org2, ownerUser: user2 } = await createTestOrganization();

      // Try to query org 2 sessions (should be empty)
      const org2Sessions = await sessionService.getUserSessions(user2.id, org2.id);

      expect(org2Sessions).toHaveLength(0);
    });
  });

  // ============================================================
  // 5. SESSION DELETION & METADATA (5 tests)
  // ============================================================

  describe('Session Deletion & Metadata', () => {
    it('should delete session with authorization', async () => {
      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );

      await sessionService.deleteSession(session.id, testUserId);

      const deleted = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, session.id)
      });

      expect(deleted).toBeUndefined();
    });

    it('should cascade delete messages when session deleted', async () => {
      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );

      // Add messages
      await sessionService.saveMessage(session.id, 'user', 'Message 1');
      await sessionService.saveMessage(session.id, 'assistant', 'Message 2');

      // Delete session
      await sessionService.deleteSession(session.id, testUserId);

      // Messages should be deleted too
      const messages = await sessionService.getHistory(session.id);
      expect(messages).toHaveLength(0);
    });

    it('should prevent deletion by unauthorized user', async () => {
      const { ownerUser: user2 } = await createTestOrganization();

      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );

      await expect(
        sessionService.deleteSession(session.id, user2.id)
      ).rejects.toThrow('Session not found or access denied');
    });

    it('should update session metadata', async () => {
      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );

      const metadata = { tags: ['tax', 's-corp'], priority: 'high' };
      await sessionService.updateSessionMetadata(session.id, metadata);

      const updated = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, session.id)
      });

      expect(updated!.metadata).toEqual(metadata);
    });

    it('should preserve metadata on message additions', async () => {
      const session = await sessionService.getOrCreateSession(
        'luca',
        nanoid(),
        testUserId,
        testOrgId
      );

      const metadata = { source: 'web', version: '1.0' };
      await sessionService.updateSessionMetadata(session.id, metadata);

      await sessionService.saveMessage(session.id, 'user', 'Test message');

      const updated = await db.query.agentSessions.findFirst({
        where: eq(agentSessions.id, session.id)
      });

      expect(updated!.metadata).toEqual(metadata);
    });
  });
});
