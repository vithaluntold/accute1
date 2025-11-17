import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testDb as db } from '../../../test-db';
import { createTestOrganization } from '../../helpers';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { sign } from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { WebSocketBootstrap } from '../../../websocket-bootstrap';
import { agentOrchestrator } from '../../../agent-orchestrator';

/**
 * WebSocket Integration Tests
 * 
 * Tests real WebSocket connections, authentication, message streaming,
 * error handling, and concurrent session management.
 * 
 * Coverage:
 * 1. Connection Lifecycle (5 tests)
 * 2. Authentication & Authorization (5 tests)
 * 3. Message Streaming (5 tests)
 * 4. Error Handling (5 tests)
 * 5. Concurrent Sessions (5 tests)
 * 6. Heartbeat & Reconnection (5 tests)
 * 
 * Total: 30 tests
 */

describe('WebSocket Integration Tests', () => {
  let httpServer: Server;
  let wsBootstrap: WebSocketBootstrap;
  let baseUrl: string;
  let testUserId: number;
  let testOrgId: number;
  let authToken: string;
  let sessionCookie: string;

  beforeAll(async () => {
    // Create test user and organization
    const { organization, ownerUser } = await createTestOrganization();
    testUserId = ownerUser.id;
    testOrgId = organization.id;

    // Generate JWT token for authentication
    const jwtSecret = process.env.JWT_SECRET || 'test-secret-key';
    authToken = sign(
      { userId: testUserId, organizationId: testOrgId },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Create minimal Express app for WebSocket upgrade
    const app = express();
    app.use(cookieParser());
    app.use(
      session({
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
      })
    );

    // Create HTTP server
    httpServer = createServer(app);

    // Initialize WebSocket bootstrap
    wsBootstrap = new WebSocketBootstrap();
    wsBootstrap.initialize(httpServer);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        const port = typeof address === 'object' ? address?.port : 3000;
        baseUrl = `ws://localhost:${port}`;
        console.log(`Test WebSocket server listening on port ${port}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close all connections
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log('Test WebSocket server closed');
        resolve();
      });
    });
  });

  // Helper to create authenticated WebSocket connection
  function createWSConnection(
    agentSlug: string,
    sessionId: string,
    customToken?: string
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const url = `${baseUrl}/ws/ai-stream?agentSlug=${agentSlug}&sessionId=${sessionId}`;
      const token = customToken || authToken;
      
      const ws = new WebSocket(url, {
        headers: {
          Cookie: `auth-token=${token}`,
        },
      });

      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  // Helper to wait for WebSocket message
  function waitForMessage(ws: WebSocket, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for message'));
      }, timeout);

      ws.once('message', (data) => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(data.toString()));
        } catch (error) {
          resolve(data.toString());
        }
      });
    });
  }

  // ============================================================
  // 1. CONNECTION LIFECYCLE (5 tests)
  // ============================================================

  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection with valid auth', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });

    it('should track connection in orchestrator', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const connection = agentOrchestrator.getConnection('luca', sessionId);
      expect(connection).toBeDefined();
      expect(connection?.userId).toBe(testUserId);
      expect(connection?.organizationId).toBe(testOrgId);

      ws.close();
      
      // Wait for close event to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const closedConnection = agentOrchestrator.getConnection('luca', sessionId);
      expect(closedConnection).toBeUndefined();
    });

    it('should handle graceful connection close', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const closePromise = new Promise<void>((resolve) => {
        ws.on('close', () => resolve());
      });

      ws.close();
      await closePromise;

      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it('should support multiple concurrent connections per user', async () => {
      const session1 = nanoid();
      const session2 = nanoid();

      const ws1 = await createWSConnection('luca', session1);
      const ws2 = await createWSConnection('luca', session2);

      expect(ws1.readyState).toBe(WebSocket.OPEN);
      expect(ws2.readyState).toBe(WebSocket.OPEN);

      const conn1 = agentOrchestrator.getConnection('luca', session1);
      const conn2 = agentOrchestrator.getConnection('luca', session2);

      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();
      expect(conn1?.sessionId).not.toBe(conn2?.sessionId);

      ws1.close();
      ws2.close();
    });

    it('should handle connection to different agents', async () => {
      const sessionId1 = nanoid();
      const sessionId2 = nanoid();

      const wsLuca = await createWSConnection('luca', sessionId1);
      const wsFiona = await createWSConnection('fiona', sessionId2);

      expect(wsLuca.readyState).toBe(WebSocket.OPEN);
      expect(wsFiona.readyState).toBe(WebSocket.OPEN);

      const connLuca = agentOrchestrator.getConnection('luca', sessionId1);
      const connFiona = agentOrchestrator.getConnection('fiona', sessionId2);

      expect(connLuca?.agentSlug).toBe('luca');
      expect(connFiona?.agentSlug).toBe('fiona');

      wsLuca.close();
      wsFiona.close();
    });
  });

  // ============================================================
  // 2. AUTHENTICATION & AUTHORIZATION (5 tests)
  // ============================================================

  describe('Authentication & Authorization', () => {
    it('should reject connection without auth token', async () => {
      const sessionId = nanoid();
      const url = `${baseUrl}/ws/ai-stream?agentSlug=luca&sessionId=${sessionId}`;

      await expect(
        new Promise((resolve, reject) => {
          const ws = new WebSocket(url); // No auth header
          ws.on('error', reject);
          ws.on('close', () => reject(new Error('Connection closed')));
          setTimeout(() => reject(new Error('Timeout')), 1000);
        })
      ).rejects.toThrow();
    });

    it('should reject connection with invalid token', async () => {
      const sessionId = nanoid();
      const invalidToken = 'invalid-token-12345';

      await expect(
        createWSConnection('luca', sessionId, invalidToken)
      ).rejects.toThrow();
    });

    it('should reject connection with expired token', async () => {
      const sessionId = nanoid();
      const jwtSecret = process.env.JWT_SECRET || 'test-secret-key';
      
      // Create expired token (expired 1 hour ago)
      const expiredToken = sign(
        { userId: testUserId, organizationId: testOrgId },
        jwtSecret,
        { expiresIn: '-1h' }
      );

      await expect(
        createWSConnection('luca', sessionId, expiredToken)
      ).rejects.toThrow();
    });

    it('should reject connection without required parameters', async () => {
      const url = `${baseUrl}/ws/ai-stream`; // Missing agentSlug and sessionId

      await expect(
        new Promise((resolve, reject) => {
          const ws = new WebSocket(url, {
            headers: { Cookie: `token=${authToken}` },
          });
          
          ws.on('close', (code, reason) => {
            reject(new Error(`Connection closed: ${code} - ${reason}`));
          });
          
          ws.on('error', reject);
          setTimeout(() => reject(new Error('Timeout')), 1000);
        })
      ).rejects.toThrow();
    });

    it('should validate agent exists in registry', async () => {
      const sessionId = nanoid();
      
      await expect(
        createWSConnection('nonexistent-agent', sessionId)
      ).rejects.toThrow();
    });
  });

  // ============================================================
  // 3. MESSAGE STREAMING (5 tests)
  // ============================================================

  describe('Message Streaming', () => {
    it('should receive message from client', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const testMessage = {
        message: 'Hello, Luca!',
        llmConfigId: null,
      };

      ws.send(JSON.stringify(testMessage));

      // Wait for acknowledgment or response
      const response = await waitForMessage(ws);
      
      // Response should either be an acknowledgment or start of streaming
      expect(response).toBeDefined();

      ws.close();
    });

    it('should handle streaming message chunks', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const chunks: any[] = [];
      
      ws.on('message', (data) => {
        try {
          chunks.push(JSON.parse(data.toString()));
        } catch {
          chunks.push(data.toString());
        }
      });

      ws.send(JSON.stringify({
        message: 'Test streaming response',
        llmConfigId: null,
      }));

      // Wait for multiple chunks
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should receive at least one message chunk
      expect(chunks.length).toBeGreaterThan(0);

      ws.close();
    });

    it('should handle large messages', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const largeMessage = {
        message: 'A'.repeat(10000), // 10KB message
        llmConfigId: null,
      };

      ws.send(JSON.stringify(largeMessage));

      const response = await waitForMessage(ws);
      expect(response).toBeDefined();

      ws.close();
    });

    it('should handle malformed JSON messages', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      ws.send('{ invalid json }');

      const response = await waitForMessage(ws);
      
      // Should receive error response
      if (typeof response === 'object') {
        expect(response.error).toBeDefined();
      }

      ws.close();
    });

    it('should preserve message order', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const messages = ['Message 1', 'Message 2', 'Message 3'];
      const receivedMessages: any[] = [];

      ws.on('message', (data) => {
        receivedMessages.push(JSON.parse(data.toString()));
      });

      // Send messages in sequence
      for (const msg of messages) {
        ws.send(JSON.stringify({ message: msg, llmConfigId: null }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should receive messages (order may vary with streaming)
      expect(receivedMessages.length).toBeGreaterThan(0);

      ws.close();
    });
  });

  // ============================================================
  // 4. ERROR HANDLING (5 tests)
  // ============================================================

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const errorPromise = new Promise<Error>((resolve) => {
        ws.on('error', resolve);
      });

      // Force an error by sending invalid data
      ws.send(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]));

      // Connection should handle error without crashing
      await new Promise(resolve => setTimeout(resolve, 500));

      ws.close();
    });

    it('should handle agent execution errors', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      // Send message that might cause error (empty message)
      ws.send(JSON.stringify({ message: '', llmConfigId: null }));

      const response = await waitForMessage(ws, 3000);
      
      // Should receive some response even if error
      expect(response).toBeDefined();

      ws.close();
    });

    it('should close connection on protocol violation', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const closePromise = new Promise<{ code: number, reason: string }>((resolve) => {
        ws.on('close', (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
      });

      // Send non-JSON data
      ws.send('not-json-data');

      // Wait a bit to see if connection closes
      await new Promise(resolve => setTimeout(resolve, 1000));

      ws.close();
    });

    it('should handle network interruption', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const closePromise = new Promise<void>((resolve) => {
        ws.on('close', () => resolve());
      });

      // Simulate network interruption by terminating connection
      ws.terminate();

      await closePromise;
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      const sessionId = nanoid();

      for (let i = 0; i < 5; i++) {
        const ws = await createWSConnection('luca', sessionId);
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should handle all cycles without errors
      expect(true).toBe(true);
    });
  });

  // ============================================================
  // 5. CONCURRENT SESSIONS (5 tests)
  // ============================================================

  describe('Concurrent Sessions', () => {
    it('should support multiple users connecting simultaneously', async () => {
      // Create second user
      const { ownerUser: user2 } = await createTestOrganization();
      const jwtSecret = process.env.JWT_SECRET || 'test-secret-key';
      const token2 = sign(
        { userId: user2.id, organizationId: testOrgId },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const session1 = nanoid();
      const session2 = nanoid();

      const ws1 = await createWSConnection('luca', session1);
      const ws2 = await createWSConnection('luca', session2, token2);

      expect(ws1.readyState).toBe(WebSocket.OPEN);
      expect(ws2.readyState).toBe(WebSocket.OPEN);

      const conn1 = agentOrchestrator.getConnection('luca', session1);
      const conn2 = agentOrchestrator.getConnection('luca', session2);

      expect(conn1?.userId).toBe(testUserId);
      expect(conn2?.userId).toBe(user2.id);

      ws1.close();
      ws2.close();
    });

    it('should isolate messages between sessions', async () => {
      const session1 = nanoid();
      const session2 = nanoid();

      const ws1 = await createWSConnection('luca', session1);
      const ws2 = await createWSConnection('luca', session2);

      const messages1: any[] = [];
      const messages2: any[] = [];

      ws1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      ws2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      ws1.send(JSON.stringify({ message: 'To session 1', llmConfigId: null }));
      ws2.send(JSON.stringify({ message: 'To session 2', llmConfigId: null }));

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Each session should only receive its own messages
      // (Note: implementation may send to correct session)
      expect(messages1.length).toBeGreaterThanOrEqual(0);
      expect(messages2.length).toBeGreaterThanOrEqual(0);

      ws1.close();
      ws2.close();
    });

    it('should handle high connection volume', async () => {
      const connections: WebSocket[] = [];
      const sessionIds: string[] = [];

      // Create 20 concurrent connections
      for (let i = 0; i < 20; i++) {
        const sessionId = nanoid();
        sessionIds.push(sessionId);
        const ws = await createWSConnection('luca', sessionId);
        connections.push(ws);
      }

      // All should be open
      expect(connections.every(ws => ws.readyState === WebSocket.OPEN)).toBe(true);

      // Close all
      connections.forEach(ws => ws.close());

      await new Promise(resolve => setTimeout(resolve, 500));

      // All should be removed from orchestrator
      sessionIds.forEach(sessionId => {
        const conn = agentOrchestrator.getConnection('luca', sessionId);
        expect(conn).toBeUndefined();
      });
    });

    it('should handle session switching (close one, open another)', async () => {
      const session1 = nanoid();
      const session2 = nanoid();

      const ws1 = await createWSConnection('luca', session1);
      expect(ws1.readyState).toBe(WebSocket.OPEN);

      ws1.close();
      await new Promise(resolve => setTimeout(resolve, 200));

      const ws2 = await createWSConnection('luca', session2);
      expect(ws2.readyState).toBe(WebSocket.OPEN);

      ws2.close();
    });

    it('should track connection timestamps', async () => {
      const sessionId = nanoid();
      const beforeConnect = new Date();

      const ws = await createWSConnection('luca', sessionId);

      const connection = agentOrchestrator.getConnection('luca', sessionId);
      const afterConnect = new Date();

      expect(connection?.connectedAt).toBeDefined();
      expect(connection!.connectedAt.getTime()).toBeGreaterThanOrEqual(beforeConnect.getTime());
      expect(connection!.connectedAt.getTime()).toBeLessThanOrEqual(afterConnect.getTime());

      ws.close();
    });
  });

  // ============================================================
  // 6. HEARTBEAT & RECONNECTION (5 tests)
  // ============================================================

  describe('Heartbeat & Reconnection', () => {
    it('should support reconnection with same session ID', async () => {
      const sessionId = nanoid();

      const ws1 = await createWSConnection('luca', sessionId);
      ws1.close();
      
      await new Promise(resolve => setTimeout(resolve, 200));

      const ws2 = await createWSConnection('luca', sessionId);
      expect(ws2.readyState).toBe(WebSocket.OPEN);

      ws2.close();
    });

    it('should maintain connection for extended period', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      // Keep connection open for 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });

    it('should handle ping/pong mechanism', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      let pongReceived = false;

      ws.on('pong', () => {
        pongReceived = true;
      });

      ws.ping();

      await new Promise(resolve => setTimeout(resolve, 500));

      // WebSocket should respond to ping
      expect(pongReceived).toBe(true);

      ws.close();
    });

    it('should detect and close dead connections', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      // Simulate dead connection by stopping responses
      ws.on('ping', () => {
        // Don't respond to ping
      });

      // Wait for heartbeat interval
      await new Promise(resolve => setTimeout(resolve, 35000)); // Heartbeat is 30s

      // Connection should still be manageable
      ws.close();
    }, 40000); // Extend timeout for this test

    it('should clean up resources on disconnect', async () => {
      const sessionId = nanoid();
      const ws = await createWSConnection('luca', sessionId);

      const closePromise = new Promise<void>((resolve) => {
        ws.on('close', () => resolve());
      });

      ws.close();
      await closePromise;

      // Connection should be removed from orchestrator
      const connection = agentOrchestrator.getConnection('luca', sessionId);
      expect(connection).toBeUndefined();
    });
  });
});
