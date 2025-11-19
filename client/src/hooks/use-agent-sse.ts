import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UseAgentSSEOptions {
  onStreamStart?: () => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

interface SendMessageOptions {
  agentSlug: string;
  message: string;
  sessionId: string; // Required for security and audit trail
  llmConfigId?: string;
  contextType?: string;
  contextId?: string;
  contextData?: any;
}

/**
 * Hook for SSE-based AI agent streaming
 * Replaces WebSocket with Server-Sent Events for better compatibility
 */
export function useAgentSSE({
  onStreamStart,
  onChunk,
  onComplete,
  onError,
}: UseAgentSSEOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const accumulatedResponseRef = useRef('');
  const currentStreamIdRef = useRef<string | null>(null);

  /**
   * Close current SSE connection
   */
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    currentStreamIdRef.current = null;
  }, []);

  /**
   * Send a message and start streaming response
   */
  const sendMessage = useCallback(async (options: SendMessageOptions): Promise<void> => {
    const { agentSlug, message, sessionId, llmConfigId, contextType, contextId, contextData } = options;

    // Close any existing connection
    closeConnection();

    try {
      setIsStreaming(true);
      accumulatedResponseRef.current = '';

      // Notify stream start
      if (onStreamStart) {
        onStreamStart();
      }

      // Step 1: Initialize stream via POST
      console.log(`[SSE ${agentSlug}] Initializing stream...`);
      const data = await apiRequest('POST', '/api/ai-agent/stream', {
        agentSlug,
        message,
        sessionId,
        llmConfigId,
        contextType,
        contextId,
        contextData,
      });
      
      const streamId = data.streamId;
      if (!streamId) {
        throw new Error('Stream initialization failed: no streamId returned');
      }

      currentStreamIdRef.current = streamId;
      console.log(`[SSE ${agentSlug}] Stream initialized: ${streamId}`);

      // Step 2: Connect to SSE endpoint
      const sseUrl = `/api/ai-agent/stream/${streamId}`;
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      // Handle incoming messages
      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              console.log(`[SSE] Connected to stream ${streamId}`);
              break;

            case 'stream_start':
              console.log(`[SSE] Stream started`);
              accumulatedResponseRef.current = '';
              break;

            case 'stream_chunk':
              const chunk = data.chunk || '';
              accumulatedResponseRef.current += chunk;
              if (onChunk) {
                onChunk(chunk);
              }
              break;

            case 'stream_end':
              console.log(`[SSE] Stream completed, length: ${accumulatedResponseRef.current.length}`);
              setIsStreaming(false);
              if (onComplete) {
                onComplete(accumulatedResponseRef.current);
              }
              closeConnection();
              break;

            case 'error':
              console.error('[SSE] Stream error:', data.error);
              setIsStreaming(false);
              if (onError) {
                onError(data.error || 'Stream error');
              }
              closeConnection();
              break;

            default:
              console.log('[SSE] Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('[SSE] Failed to parse SSE message:', error);
        }
      });

      // Handle errors
      eventSource.addEventListener('error', (event) => {
        console.error('[SSE] EventSource error:', event);
        setIsStreaming(false);
        
        // Only report error if we haven't already completed
        if (eventSource.readyState === EventSource.CLOSED && accumulatedResponseRef.current === '') {
          if (onError) {
            onError('Connection lost. Please try again.');
          }
        }
        
        closeConnection();
      });

    } catch (error: any) {
      console.error('[SSE] Failed to send message:', error);
      setIsStreaming(false);
      if (onError) {
        onError(error.message || 'Failed to send message');
      }
      throw error;
    }
  }, [onStreamStart, onChunk, onComplete, onError, closeConnection]);

  /**
   * Cancel the current stream
   */
  const cancelStream = useCallback(async () => {
    if (!currentStreamIdRef.current) {
      closeConnection();
      setIsStreaming(false);
      return;
    }

    try {
      await apiRequest('POST', `/api/ai-agent/stream/${currentStreamIdRef.current}/cancel`, {});
      console.log('[SSE] Stream cancelled');
    } catch (error) {
      console.error('[SSE] Failed to cancel stream:', error);
    } finally {
      closeConnection();
      setIsStreaming(false);
    }
  }, [closeConnection]);

  return {
    isStreaming,
    sendMessage,
    cancelStream,
    disconnect: closeConnection,
  };
}
