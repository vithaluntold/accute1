import { useCallback, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface UseAgentSSEOptions {
  agentSlug: string;
  sessionId: string;
  onStreamChunk?: (chunk: string) => void;
  onStreamComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

interface SendMessageOptions {
  message: string;
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
  agentSlug,
  sessionId,
  onStreamChunk,
  onStreamComplete,
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
  const sendMessage = useCallback(async (options: SendMessageOptions): Promise<boolean> => {
    const { message, llmConfigId, contextType, contextId, contextData } = options;

    // Close any existing connection
    closeConnection();

    try {
      setIsStreaming(true);
      accumulatedResponseRef.current = '';

      // Step 1: Initialize stream via POST
      console.log(`[SSE ${agentSlug}] Initializing stream...`);
      const { streamId } = await apiRequest<{ streamId: string; status: string }>('/api/ai-agent/stream', {
        method: 'POST',
        body: JSON.stringify({
          agentSlug,
          message,
          sessionId,
          llmConfigId,
          contextType,
          contextId,
          contextData,
        }),
      });

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
              console.log(`[SSE ${agentSlug}] Connected to stream ${streamId}`);
              break;

            case 'stream_start':
              console.log(`[SSE ${agentSlug}] Stream started`);
              accumulatedResponseRef.current = '';
              break;

            case 'stream_chunk':
              const chunk = data.chunk || '';
              accumulatedResponseRef.current += chunk;
              if (onStreamChunk) {
                onStreamChunk(chunk);
              }
              break;

            case 'stream_end':
              console.log(`[SSE ${agentSlug}] Stream completed, length: ${accumulatedResponseRef.current.length}`);
              setIsStreaming(false);
              if (onStreamComplete) {
                onStreamComplete(accumulatedResponseRef.current);
              }
              closeConnection();
              break;

            case 'error':
              console.error(`[SSE ${agentSlug}] Stream error:`, data.error);
              setIsStreaming(false);
              if (onError) {
                onError(data.error || 'Stream error');
              }
              closeConnection();
              break;

            default:
              console.log(`[SSE ${agentSlug}] Unknown message type:`, data.type);
          }
        } catch (error) {
          console.error(`[SSE ${agentSlug}] Failed to parse SSE message:`, error);
        }
      });

      // Handle errors
      eventSource.addEventListener('error', (event) => {
        console.error(`[SSE ${agentSlug}] EventSource error:`, event);
        setIsStreaming(false);
        
        // Only report error if we haven't already completed
        if (eventSource.readyState === EventSource.CLOSED && accumulatedResponseRef.current === '') {
          if (onError) {
            onError('Connection lost. Please try again.');
          }
        }
        
        closeConnection();
      });

      return true;
    } catch (error: any) {
      console.error(`[SSE ${agentSlug}] Failed to send message:`, error);
      setIsStreaming(false);
      if (onError) {
        onError(error.message || 'Failed to send message');
      }
      return false;
    }
  }, [agentSlug, sessionId, onStreamChunk, onStreamComplete, onError, closeConnection]);

  /**
   * Cancel the current stream
   */
  const cancelStream = useCallback(async () => {
    if (!currentStreamIdRef.current) {
      return;
    }

    try {
      await apiRequest(`/api/ai-agent/stream/${currentStreamIdRef.current}/cancel`, {
        method: 'POST',
      });
      console.log(`[SSE ${agentSlug}] Stream cancelled`);
    } catch (error) {
      console.error(`[SSE ${agentSlug}] Failed to cancel stream:`, error);
    } finally {
      closeConnection();
      setIsStreaming(false);
    }
  }, [agentSlug, closeConnection]);

  return {
    isStreaming,
    sendMessage,
    cancelStream,
    disconnect: closeConnection,
  };
}
