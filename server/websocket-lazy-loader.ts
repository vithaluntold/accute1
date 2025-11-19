import { WebSocketServer } from 'ws';
import { Server, IncomingMessage } from 'http';
import { Socket } from 'net';
import { setupTeamChatWebSocket } from './team-chat-websocket';
import { setupLiveChatWebSocket } from './live-chat-websocket';

/**
 * Lazy WebSocket Loader
 * 
 * Initializes WebSocket servers on-demand when first upgrade request arrives.
 * This reduces server startup time and memory footprint for deployments where
 * real-time chat features are not actively used.
 * 
 * Pattern:
 * - Each WebSocket server is initialized once on first connection
 * - Singleton pattern ensures only one server instance per feature
 * - Upgrade requests are routed by pathname to appropriate server
 */

interface LazyWebSocketServer {
  wss: WebSocketServer | null;
  initializer: (httpServer: Server) => WebSocketServer;
}

// Singleton storage for lazy-loaded WebSocket servers
const lazyServers: Map<string, LazyWebSocketServer> = new Map([
  ['/ws/team-chat', {
    wss: null,
    initializer: setupTeamChatWebSocket
  }],
  ['/ws/live-chat', {
    wss: null,
    initializer: setupLiveChatWebSocket
  }],
]);

/**
 * Setup lazy WebSocket initialization
 * Registers an upgrade listener that initializes WebSocket servers on first connection
 */
export function setupLazyWebSocketLoader(httpServer: Server): void {
  console.log('🔧 Setting up lazy WebSocket loader...');
  
  httpServer.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    try {
      // Defensive: ensure we have a valid URL to parse
      const host = request.headers.host || 'localhost';
      const url = request.url || '/';
      const pathname = new URL(url, `http://${host}`).pathname;
      
      console.log(`[Lazy WS] Upgrade request for ${pathname}`);
      
      // Check if this is a lazy-loaded WebSocket endpoint
      const lazyServer = lazyServers.get(pathname);
      
      if (lazyServer) {
        // Initialize server if not already initialized
        if (!lazyServer.wss) {
          console.log(`🔌 First connection to ${pathname} - initializing WebSocket server...`);
          try {
            lazyServer.wss = lazyServer.initializer(httpServer);
            console.log(`✅ ${pathname} WebSocket server initialized (lazy)`);
          } catch (error) {
            console.error(`❌ Failed to initialize ${pathname} WebSocket server:`, error);
            socket.destroy();
            return;
          }
        }
        
        // Forward the upgrade to the WebSocket server
        lazyServer.wss.handleUpgrade(request, socket, head, (ws) => {
          lazyServer.wss!.emit('connection', ws, request);
        });
      }
      // Note: Other upgrade requests (e.g., future features) will pass through
      // and can be handled by other listeners or default behavior
    } catch (error) {
      console.error('[Lazy WS] Upgrade error:', error);
      socket.destroy();
    }
  });
  
  console.log('✅ Lazy WebSocket loader ready');
}

/**
 * Get initialized WebSocket server (for testing/monitoring)
 */
export function getWebSocketServer(pathname: string): WebSocketServer | null {
  return lazyServers.get(pathname)?.wss || null;
}

/**
 * Cleanup all initialized WebSocket servers (for graceful shutdown)
 */
export function cleanupLazyWebSockets(): void {
  for (const [pathname, { wss }] of lazyServers.entries()) {
    if (wss) {
      console.log(`🔌 Closing ${pathname} WebSocket server...`);
      wss.close();
    }
  }
}
