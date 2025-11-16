import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { orchestrator } from './agent-orchestrator';
import cookie from 'cookie';
import { verifyToken } from './auth';

class WebSocketBootstrap {
  private wss: WebSocketServer | null = null;
  private initialized: boolean = false;
  
  /**
   * Initialize WebSocket server (EAGER, not lazy)
   */
  initialize(httpServer: Server): void {
    if (this.initialized) {
      console.warn('[WebSocket] Server already initialized, skipping');
      return;
    }
    
    console.log('[WebSocket] Initializing WebSocket server (EAGER)...');
    
    this.wss = new WebSocketServer({ noServer: true });
    
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
    
    httpServer.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });
    
    this.setupHeartbeat();
    
    this.initialized = true;
    console.log('✅ WebSocket server initialized (ready for connections)');
  }
  
  /**
   * Handle upgrade request with normalized URL parsing
   */
  private handleUpgrade(
    request: IncomingMessage,
    socket: any,
    head: Buffer
  ): void {
    try {
      const url = this.parseURL(request);
      
      if (url.pathname !== '/ws/ai-stream') {
        console.log(`[WebSocket] Rejecting upgrade for path: ${url.pathname}`);
        socket.destroy();
        return;
      }
      
      console.log('[WebSocket] Upgrade request received for WebSocket connection');
      
      const user = this.authenticate(request);
      if (!user) {
        console.log('[WebSocket] Authentication failed');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      
      this.wss!.handleUpgrade(request, socket, head, (ws) => {
        this.wss!.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('[WebSocket] Error handling upgrade:', error);
      socket.destroy();
    }
  }
  
  /**
   * Parse URL with proper error handling (supports query params)
   */
  private parseURL(request: IncomingMessage): URL {
    const urlString = request.url || '/';
    const host = request.headers.host || 'localhost';
    
    return new URL(urlString, `http://${host}`);
  }
  
  /**
   * Authenticate WebSocket request via cookie
   */
  private authenticate(request: IncomingMessage): any | null {
    try {
      const cookies = cookie.parse(request.headers.cookie || '');
      const token = cookies['auth-token'];
      
      if (!token) {
        return null;
      }
      
      return verifyToken(token);
    } catch (error) {
      console.error('[WebSocket] Authentication error:', error);
      return null;
    }
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const url = this.parseURL(request);
    const agentSlug = url.searchParams.get('agentSlug');
    const sessionId = url.searchParams.get('sessionId');
    
    if (!agentSlug || !sessionId) {
      ws.close(1008, 'Missing required parameters: agentSlug, sessionId');
      return;
    }
    
    const user = this.authenticate(request);
    if (!user) {
      ws.close(1008, 'Authentication required');
      return;
    }
    
    try {
      orchestrator.handleConnection(
        ws,
        agentSlug,
        sessionId,
        user.userId,
        user.organizationId
      );
      
      console.log(`[WebSocket] Connection established: ${agentSlug}/${sessionId} (user: ${user.userId})`);
      
      ws.on('message', async (data) => {
        await this.handleMessage(ws, agentSlug, sessionId, user, data);
      });
      
      ws.on('close', () => {
        orchestrator.closeConnection(agentSlug, sessionId);
        console.log(`[WebSocket] Connection closed: ${agentSlug}/${sessionId}`);
      });
      
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error on ${agentSlug}/${sessionId}:`, error);
      });
    } catch (error: any) {
      console.error('[WebSocket] Failed to register connection:', error);
      ws.close(1011, error.message);
    }
  }
  
  /**
   * Handle incoming message
   */
  private async handleMessage(
    ws: WebSocket,
    agentSlug: string,
    sessionId: string,
    user: any,
    data: any
  ): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      
      const { handleAIAgentExecution } = await import('./websocket');
      await handleAIAgentExecution(
        agentSlug,
        message.message,
        user,
        message.llmConfigId,
        ws,
        sessionId // Pass sessionId to the handler
      );
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
      ws.send(JSON.stringify({ error: 'Failed to process message' }));
    }
  }
  
  /**
   * Setup heartbeat to detect broken connections
   */
  private setupHeartbeat(): void {
    const interval = setInterval(() => {
      if (!this.wss) return;
      
      this.wss.clients.forEach((ws: any) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    
    if (this.wss) {
      this.wss.on('close', () => {
        clearInterval(interval);
      });
    }
  }
  
  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    orchestratorStats: ReturnType<typeof orchestrator.getConnectionStats>;
  } {
    return {
      totalConnections: this.wss?.clients.size || 0,
      orchestratorStats: orchestrator.getConnectionStats(),
    };
  }
}

export const wsBootstrap = new WebSocketBootstrap();
