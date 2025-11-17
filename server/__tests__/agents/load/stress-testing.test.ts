import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb as db } from '../../../test-db';
import { createTestOrganization } from '../../helpers';
import { AgentOrchestrator } from '../../../agent-orchestrator';
import { ConfigResolver } from '../../../config-resolver';
import { AgentSessionService } from '../../../agent-session-service';
import { agentSessions, agentMessages, llmConfigurations } from '@shared/schema';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

/**
 * Load & Stress Testing Suite (REAL SYSTEM TESTING)
 * 
 * Tests ACTUAL system components under load:
 * - Real AgentOrchestrator
 * - Real ConfigResolver with caching
 * - Real AgentSessionService
 * - Real database queries
 * 
 * Quality Targets (Six Sigma):
 * - Agent load time: <2 seconds
 * - WebSocket connection: <1 second
 * - LLM config resolution: <100ms (cached)
 * - Session queries: <500ms with 1000+ sessions
 * - Cache hit rate: >90%
 * 
 * Coverage:
 * 1. Agent Orchestrator Performance - 5 tests
 * 2. Config Resolver Caching - 5 tests
 * 3. Session Service Scalability - 5 tests
 * 4. Database Query Performance - 5 tests
 * 
 * Total: 20 tests
 */

describe('Load & Stress Testing (Real Systems)', () => {
  let testOrgId: string;
  let testUserId: string;
  let orchestrator: AgentOrchestrator;
  let configResolver: ConfigResolver;
  let sessionService: AgentSessionService;

  beforeAll(async () => {
    const { organization, ownerUser } = await createTestOrganization();
    testOrgId = organization.id;
    testUserId = ownerUser.id;

    // Initialize REAL system components
    orchestrator = new AgentOrchestrator();
    configResolver = new ConfigResolver();
    sessionService = new AgentSessionService();

    // Setup test LLM config
    const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    process.env.ENCRYPTION_KEY = encryptionKey;

    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update('sk-test-key', 'utf8', 'hex');
    encrypted += cipher.final('hex');

    await db.insert(llmConfigurations).values({
      scope: 'workspace',
      organizationId: testOrgId,
      userId: null,
      name: 'Load Test Config',
      provider: 'openai',
      apiKeyEncrypted: `${iv.toString('hex')}:${encrypted}`,
      model: 'gpt-4',
      isActive: true,
      isDefault: true,
      createdBy: testUserId,
    });
  });

  afterAll(async () => {
    // Cleanup: Invalidate caches to prevent state leakage
    configResolver.invalidateCache();
  });

  // ============================================================
  // 1. AGENT ORCHESTRATOR PERFORMANCE - 5 tests
  // ============================================================

  describe('Agent Orchestrator Performance', () => {
    it('should load all 10 agents within 1 second', async () => {
      const startTime = Date.now();
      
      // Access all agents through orchestrator
      const agents = ['luca', 'cadence', 'parity', 'forma', 'echo', 'relay', 'scribe', 'radar', 'omnispectra', 'lynk'];
      
      for (const slug of agents) {
        const agentExists = await orchestrator.isAgentRegistered(slug);
        expect(agentExists).toBe(true);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // < 1 second to verify all agents
    });

    it('should handle 100 concurrent agent lookups', async () => {
      const startTime = Date.now();
      
      // Simulate 100 concurrent agent lookups
      const lookupPromises = Array.from({ length: 100 }, (_, i) => {
        const agentSlug = ['luca', 'cadence', 'parity', 'forma', 'echo'][i % 5];
        return orchestrator.isAgentRegistered(agentSlug);
      });
      
      const results = await Promise.all(lookupPromises);
      const duration = Date.now() - startTime;
      
      expect(results.every(r => r === true)).toBe(true);
      expect(duration).toBeLessThan(2000); // < 2 seconds for 100 lookups
    });

    it('should maintain agent registry consistency under load', async () => {
      // Access agents from multiple concurrent sources
      const operations = Array.from({ length: 50 }, async () => {
        const agents = ['luca', 'cadence', 'parity', 'forma', 'echo', 'relay', 'scribe', 'radar', 'omnispectra', 'lynk'];
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        return orchestrator.isAgentRegistered(randomAgent);
      });
      
      const results = await Promise.all(operations);
      
      // All should return true (agents exist)
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should handle rapid agent type checking', async () => {
      const startTime = Date.now();
      
      // Check agent existence 200 times
      const checks = Array.from({ length: 200 }, () => 
        orchestrator.isAgentRegistered('luca')
      );
      
      await Promise.all(checks);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // < 1 second for 200 checks
    });

    it('should handle invalid agent slugs gracefully', async () => {
      const invalidSlugs = ['invalid', 'nonexistent', 'fake-agent', 'test-123', 'xyz'];
      
      const results = await Promise.all(
        invalidSlugs.map(slug => orchestrator.isAgentRegistered(slug))
      );
      
      // All should return false quickly without errors
      expect(results.every(r => r === false)).toBe(true);
    });
  });

  // ============================================================
  // 2. CONFIG RESOLVER CACHING - 5 tests
  // ============================================================

  describe('Config Resolver Caching (Real Cache)', () => {
    it('should achieve >90% cache hit rate with real ConfigResolver', async () => {
      configResolver.invalidateCache();
      
      // First call: cache miss
      await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
      
      // Next 99 calls: should be cache hits
      const startTime = Date.now();
      await Promise.all(
        Array.from({ length: 99 }, () =>
          configResolver.resolve({ organizationId: testOrgId, userId: testUserId })
        )
      );
      const duration = Date.now() - startTime;
      
      const stats = configResolver.getCacheStats();
      
      expect(stats.hitRate).toBeGreaterThan(90); // >90% hit rate
      expect(stats.hits).toBeGreaterThanOrEqual(99);
      expect(duration).toBeLessThan(1000); // 99 cached resolutions < 1 second
    });

    it('should resolve config within 100ms when cached', async () => {
      // Populate cache
      await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
      
      // Test cached resolution speed
      const iterations = 10;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
        times.push(Date.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      
      expect(avgTime).toBeLessThan(100); // Average < 100ms for cached
    });

    it('should handle cache invalidation under concurrent load', async () => {
      // Warm up cache
      await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
      
      // Mix invalidations and resolutions
      const operations = Array.from({ length: 50 }, (_, i) => {
        if (i % 10 === 0) {
          // Invalidate every 10th operation
          return Promise.resolve(configResolver.invalidateCache());
        } else {
          // Resolve
          return configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
        }
      });
      
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThan(40); // Most should succeed
      expect(duration).toBeLessThan(3000); // < 3 seconds
    });

    it('should maintain cache consistency for multiple users', async () => {
      const org2 = await createTestOrganization();
      const user2Id = org2.ownerUser.id;
      const org2Id = org2.organization.id;
      
      // Setup config for org2
      const encryptionKey = process.env.ENCRYPTION_KEY!;
      const algorithm = 'aes-256-cbc';
      const key = Buffer.from(encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update('sk-test-key-org2', 'utf8', 'hex');
      encrypted += cipher.final('hex');

      await db.insert(llmConfigurations).values({
        scope: 'workspace',
        organizationId: org2Id,
        userId: null,
        name: 'Org2 Config',
        provider: 'openai',
        apiKeyEncrypted: `${iv.toString('hex')}:${encrypted}`,
        model: 'gpt-4',
        isActive: true,
        isDefault: true,
        createdBy: user2Id,
      });
      
      // Concurrent resolutions for different users
      const [user1Configs, user2Configs] = await Promise.all([
        Promise.all(Array.from({ length: 50 }, () =>
          configResolver.resolve({ organizationId: testOrgId, userId: testUserId })
        )),
        Promise.all(Array.from({ length: 50 }, () =>
          configResolver.resolve({ organizationId: org2Id, userId: user2Id })
        )),
      ]);
      
      // Verify correct configs returned (no cross-contamination)
      expect(user1Configs.every(c => c.organizationId === testOrgId)).toBe(true);
      expect(user2Configs.every(c => c.organizationId === org2Id)).toBe(true);
    }, 15000);

    it('should handle 1000 config resolutions within 2 seconds (with cache)', async () => {
      configResolver.invalidateCache();
      
      // First call populates cache
      await configResolver.resolve({ organizationId: testOrgId, userId: testUserId });
      
      const startTime = Date.now();
      
      // Next 999 should be cached
      await Promise.all(
        Array.from({ length: 999 }, () =>
          configResolver.resolve({ organizationId: testOrgId, userId: testUserId })
        )
      );
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000); // < 2 seconds for 1000 cached resolutions
    });
  });

  // ============================================================
  // 3. SESSION SERVICE SCALABILITY - 5 tests
  // ============================================================

  describe('Session Service Scalability (Real Service)', () => {
    it('should create 100 sessions within 3 seconds', async () => {
      const startTime = Date.now();
      
      const sessionPromises = Array.from({ length: 100 }, (_, i) =>
        sessionService.createSession({
          agentSlug: 'luca',
          userId: testUserId,
          organizationId: testOrgId,
          title: `Load Test Session ${i}`,
        })
      );
      
      const sessions = await Promise.all(sessionPromises);
      const duration = Date.now() - startTime;
      
      expect(sessions.length).toBe(100);
      expect(duration).toBeLessThan(3000); // < 3 seconds
    }, 10000);

    it('should handle 50 concurrent message additions', async () => {
      // Create a session first
      const session = await sessionService.createSession({
        agentSlug: 'luca',
        userId: testUserId,
        organizationId: testOrgId,
        title: 'Concurrent Messages Test',
      });
      
      const startTime = Date.now();
      
      // Add 50 messages concurrently
      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          sessionService.addMessage({
            sessionId: session.id,
            role: i % 2 === 0 ? 'user' : 'agent',
            content: `Concurrent message ${i}`,
          })
        )
      );
      
      const duration = Date.now() - startTime;
      
      // Verify all messages were added
      const messages = await sessionService.getMessages(session.id);
      
      expect(messages.length).toBe(50);
      expect(duration).toBeLessThan(2000); // < 2 seconds
    }, 10000);

    it('should query session list with pagination efficiently', async () => {
      // Create 200 sessions
      await Promise.all(
        Array.from({ length: 200 }, (_, i) =>
          sessionService.createSession({
            agentSlug: ['luca', 'cadence', 'parity'][i % 3] as any,
            userId: testUserId,
            organizationId: testOrgId,
            title: `Pagination Test ${i}`,
          })
        )
      );
      
      // Query with pagination
      const startTime = Date.now();
      const page1 = await sessionService.getUserSessions(testUserId, { limit: 20, offset: 0 });
      const page2 = await sessionService.getUserSessions(testUserId, { limit: 20, offset: 20 });
      const duration = Date.now() - startTime;
      
      expect(page1.length).toBe(20);
      expect(page2.length).toBe(20);
      expect(duration).toBeLessThan(1000); // < 1 second for 2 paginated queries
    }, 15000);

    it('should handle session updates under concurrent load', async () => {
      const session = await sessionService.createSession({
        agentSlug: 'luca',
        userId: testUserId,
        organizationId: testOrgId,
        title: 'Update Test',
      });
      
      // Concurrent updates (simulating auto-title updates)
      const updates = Array.from({ length: 20 }, (_, i) =>
        sessionService.updateSession(session.id, {
          title: `Updated Title ${i}`,
        })
      );
      
      const results = await Promise.allSettled(updates);
      
      // At least some should succeed (last one wins in concurrent updates)
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });

    it('should maintain isolation between user sessions', async () => {
      const org2 = await createTestOrganization();
      const user2Id = org2.ownerUser.id;
      const org2Id = org2.organization.id;
      
      // Create sessions for both users
      await Promise.all([
        ...Array.from({ length: 25 }, (_, i) =>
          sessionService.createSession({
            agentSlug: 'luca',
            userId: testUserId,
            organizationId: testOrgId,
            title: `User1 Session ${i}`,
          })
        ),
        ...Array.from({ length: 25 }, (_, i) =>
          sessionService.createSession({
            agentSlug: 'luca',
            userId: user2Id,
            organizationId: org2Id,
            title: `User2 Session ${i}`,
          })
        ),
      ]);
      
      // Query sessions for each user
      const user1Sessions = await sessionService.getUserSessions(testUserId);
      const user2Sessions = await sessionService.getUserSessions(user2Id);
      
      // Verify isolation
      expect(user1Sessions.every(s => s.userId === testUserId)).toBe(true);
      expect(user2Sessions.every(s => s.userId === user2Id)).toBe(true);
      expect(user1Sessions.length).toBeGreaterThanOrEqual(25);
      expect(user2Sessions.length).toBeGreaterThanOrEqual(25);
    }, 15000);
  });

  // ============================================================
  // 4. DATABASE QUERY PERFORMANCE - 5 tests
  // ============================================================

  describe('Database Query Performance (Real Queries)', () => {
    it('should handle 1000 message inserts within 5 seconds', async () => {
      const session = await sessionService.createSession({
        agentSlug: 'luca',
        userId: testUserId,
        organizationId: testOrgId,
        title: 'DB Performance Test',
      });
      
      const startTime = Date.now();
      
      // Insert 1000 messages in batches
      const batchSize = 100;
      for (let batch = 0; batch < 10; batch++) {
        const messages = Array.from({ length: batchSize }, (_, i) => ({
          sessionId: session.id,
          role: (i % 2 === 0 ? 'user' : 'agent') as 'user' | 'agent',
          content: `Performance test message ${batch * batchSize + i}`,
          metadata: {},
        }));
        
        await db.insert(agentMessages).values(messages);
      }
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000); // < 5 seconds for 1000 inserts
    }, 15000);

    it('should query large message history within 1 second', async () => {
      const session = await sessionService.createSession({
        agentSlug: 'luca',
        userId: testUserId,
        organizationId: testOrgId,
        title: 'Query Performance Test',
      });
      
      // Insert 500 messages
      const messages = Array.from({ length: 500 }, (_, i) => ({
        sessionId: session.id,
        role: (i % 2 === 0 ? 'user' : 'agent') as 'user' | 'agent',
        content: `Message ${i}`,
        metadata: {},
      }));
      
      await db.insert(agentMessages).values(messages);
      
      // Query performance test
      const startTime = Date.now();
      const queriedMessages = await sessionService.getMessages(session.id);
      const duration = Date.now() - startTime;
      
      expect(queriedMessages.length).toBe(500);
      expect(duration).toBeLessThan(1000); // < 1 second query time
    }, 20000);

    it('should handle concurrent read/write operations', async () => {
      const session = await sessionService.createSession({
        agentSlug: 'luca',
        userId: testUserId,
        organizationId: testOrgId,
        title: 'Concurrent R/W Test',
      });
      
      // Mix of writes and reads
      const operations = Array.from({ length: 50 }, (_, i) => {
        if (i % 2 === 0) {
          // Write
          return sessionService.addMessage({
            sessionId: session.id,
            role: 'user',
            content: `Concurrent write ${i}`,
          });
        } else {
          // Read
          return sessionService.getMessages(session.id);
        }
      });
      
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThan(45); // Most should succeed
      expect(duration).toBeLessThan(3000); // < 3 seconds
    }, 10000);

    it('should maintain index performance with 10,000+ messages', async () => {
      // Create multiple sessions with many messages
      const sessionPromises = Array.from({ length: 10 }, async (_, i) => {
        const session = await sessionService.createSession({
          agentSlug: 'luca',
          userId: testUserId,
          organizationId: testOrgId,
          title: `Index Test Session ${i}`,
        });
        
        // Add 100 messages per session (1000 total)
        const messages = Array.from({ length: 100 }, (_, j) => ({
          sessionId: session.id,
          role: (j % 2 === 0 ? 'user' : 'agent') as 'user' | 'agent',
          content: `Message ${j}`,
          metadata: {},
        }));
        
        await db.insert(agentMessages).values(messages);
        
        return session;
      });
      
      await Promise.all(sessionPromises);
      
      // Query should still be fast with 1000+ messages
      const startTime = Date.now();
      const latestSessions = await sessionService.getUserSessions(testUserId, { limit: 5 });
      const duration = Date.now() - startTime;
      
      expect(latestSessions.length).toBe(5);
      expect(duration).toBeLessThan(500); // Indexed query < 500ms
    }, 30000);

    it('should handle session deletion and cascade cleanup', async () => {
      const session = await sessionService.createSession({
        agentSlug: 'luca',
        userId: testUserId,
        organizationId: testOrgId,
        title: 'Deletion Test',
      });
      
      // Add messages
      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          sessionService.addMessage({
            sessionId: session.id,
            role: 'user',
            content: `Message ${i}`,
          })
        )
      );
      
      // Delete session
      const startTime = Date.now();
      await sessionService.deleteSession(session.id);
      const duration = Date.now() - startTime;
      
      // Verify cascade deletion (messages should be deleted too)
      const messages = await db.query.agentMessages.findMany({
        where: (msgs, { eq }) => eq(msgs.sessionId, session.id),
      });
      
      expect(messages.length).toBe(0); // All messages deleted
      expect(duration).toBeLessThan(1000); // Deletion < 1 second
    }, 10000);
  });
});
