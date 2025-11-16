import { useEffect, useRef, useState, useCallback } from 'react';

interface UseAgentWebSocketOptions {
  agentName: string;
  onStreamChunk?: (chunk: string) => void;
  onStreamComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void; // Called when WebSocket closes unexpectedly
}

interface SendMessageOptions {
  input: string;
  llmConfigId?: string;
  conversationId?: string;
  contextType?: string;
  contextId?: string;
  contextData?: any;
  lucaSessionId?: string;
}

export function useAgentWebSocket({
  agentName,
  onStreamChunk,
  onStreamComplete,
  onError,
  onClose
}: UseAgentWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const accumulatedResponseRef = useRef('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Determine WebSocket URL based on current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/ai-stream`;
    
    console.log(`[${agentName} WebSocket] Connecting to:`, wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[${agentName} WebSocket] Connected`);
      setIsConnected(true);
      setConnectionAttempts(0);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'connected':
            console.log(`[${agentName} WebSocket] Authenticated:`, message.userId);
            break;
            
          case 'stream_start':
            console.log(`[${agentName} WebSocket] Stream started`);
            setIsStreaming(true);
            accumulatedResponseRef.current = '';
            break;
            
          case 'stream_chunk':
            const chunk = message.chunk || '';
            accumulatedResponseRef.current += chunk;
            if (onStreamChunk) {
              onStreamChunk(chunk);
            }
            break;
            
          case 'stream_end':
            console.log(`[${agentName} WebSocket] Stream completed, length:`, accumulatedResponseRef.current.length);
            setIsStreaming(false);
            if (onStreamComplete) {
              onStreamComplete(accumulatedResponseRef.current);
            }
            accumulatedResponseRef.current = '';
            break;
            
          case 'error':
            console.error(`[${agentName} WebSocket] Error:`, message.error);
            setIsStreaming(false);
            if (onError) {
              onError(message.error || 'Unknown error');
            }
            break;
            
          case 'pong':
            // Heartbeat response
            break;
            
          default:
            console.log(`[${agentName} WebSocket] Unknown message type:`, message.type);
        }
      } catch (error) {
        console.error(`[${agentName} WebSocket] Failed to parse message:`, error);
      }
    };

    ws.onerror = (error) => {
      console.error(`[${agentName} WebSocket] Error:`, error);
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log(`[${agentName} WebSocket] Disconnected:`, event.code, event.reason);
      setIsConnected(false);
      setIsStreaming(false);
      wsRef.current = null;

      // Call onClose callback to clean up any pending state
      if (onClose) {
        onClose();
      }

      // Only reconnect if component is still mounted and not intentionally closed
      if (isMountedRef.current && connectionAttempts < 3 && event.code !== 1000) {
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 5000);
        console.log(`[${agentName} WebSocket] Reconnecting in ${delay}ms (attempt ${connectionAttempts + 1}/3)`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setConnectionAttempts(prev => prev + 1);
            connect();
          }
        }, delay);
      }
    };
  }, [agentName, onStreamChunk, onStreamComplete, onError, onClose, connectionAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      // Close without triggering reconnect
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (options: SendMessageOptions): Promise<boolean> => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error(`[${agentName} WebSocket] Not connected, cannot send message`);
      if (onError) {
        onError('WebSocket not connected. Please try again.');
      }
      return false;
    }

    try {
      const message = {
        type: 'execute_agent',
        agentName,
        input: options.input,
        llmConfigId: options.llmConfigId,
        conversationId: options.conversationId,
        contextType: options.contextType,
        contextId: options.contextId,
        contextData: options.contextData,
        lucaSessionId: options.lucaSessionId,
      };

      console.log(`[${agentName} WebSocket] Sending message:`, { 
        type: message.type, 
        inputLength: options.input.length,
        llmConfigId: options.llmConfigId
      });
      
      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[${agentName} WebSocket] Failed to send message:`, error);
      if (onError) {
        onError('Failed to send message. Please try again.');
      }
      return false;
    }
  }, [agentName, onError]);

  // Connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Send periodic ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000); // Every 25 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  return {
    isConnected,
    isStreaming,
    sendMessage,
    reconnect: connect,
    disconnect,
  };
}
