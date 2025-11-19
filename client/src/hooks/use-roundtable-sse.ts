import { useCallback, useRef, useState, useEffect } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type {
  RoundtableParticipant,
  RoundtableMessage,
} from '@shared/schema';

interface UseRoundtableSSEOptions {
  sessionId: string | null;
  onParticipantJoined?: (participant: RoundtableParticipant) => void;
  onParticipantLeft?: (participant: RoundtableParticipant) => void;
  onNewMessage?: (message: RoundtableMessage) => void;
  onAgentResponse?: (message: RoundtableMessage) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for SSE-based Roundtable collaboration
 * Replaces WebSocket with Server-Sent Events for multi-party communication
 * 
 * Pattern: HTTP POST for actions, SSE for receiving updates
 */
export function useRoundtableSSE({
  sessionId,
  onParticipantJoined,
  onParticipantLeft,
  onNewMessage,
  onAgentResponse,
  onError,
}: UseRoundtableSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [participants, setParticipants] = useState<RoundtableParticipant[]>([]);
  const [messages, setMessages] = useState<RoundtableMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<RoundtableMessage[]>([]);
  const [typingParticipants, setTypingParticipants] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [currentPresentation, setCurrentPresentation] = useState<{
    deliverable: any;
    presenterParticipantId: string;
    presenterName: string;
  } | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  /**
   * Close current SSE connection
   */
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      console.log(`[Roundtable SSE] Closing connection for session ${sessionId}`);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, [sessionId]);

  /**
   * Connect to SSE stream
   */
  const connect = useCallback(() => {
    if (!sessionId) {
      console.log('[Roundtable SSE] No session ID, skipping connection');
      return;
    }

    // Close existing connection
    closeConnection();

    try {
      console.log(`[Roundtable SSE] Connecting to session ${sessionId}...`);
      const sseUrl = `/api/roundtable/sessions/${sessionId}/stream`;
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(`[Roundtable SSE] Connected to session ${sessionId}`);
        setIsConnected(true);
        setIsReconnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onerror = (err) => {
        console.error('[Roundtable SSE] Connection error:', err);
        setIsConnected(false);

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[Roundtable SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          setIsReconnecting(true);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          const errorMsg = 'Connection lost. Please refresh the page.';
          setError(errorMsg);
          if (onError) {
            onError(errorMsg);
          }
        }
      };

      // Handle roster_update event
      eventSource.addEventListener('roster_update', (event) => {
        const data = JSON.parse(event.data);
        setParticipants(data.participants || []);
      });

      // Handle participant_joined event
      eventSource.addEventListener('participant_joined', (event) => {
        const data = JSON.parse(event.data);
        setParticipants(prev => {
          const exists = prev.some(p => p.id === data.participant.id);
          if (exists) return prev;
          return [...prev, data.participant];
        });
        if (onParticipantJoined) {
          onParticipantJoined(data.participant);
        }
      });

      // Handle participant_left event
      eventSource.addEventListener('participant_left', (event) => {
        const data = JSON.parse(event.data);
        setParticipants(prev => prev.filter(p => p.id !== data.participant.id));
        if (onParticipantLeft) {
          onParticipantLeft(data.participant);
        }
      });

      // Handle new_message event
      eventSource.addEventListener('new_message', (event) => {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data.message]);
        if (onNewMessage) {
          onNewMessage(data.message);
        }
      });

      // Handle private_message event
      eventSource.addEventListener('private_message', (event) => {
        const data = JSON.parse(event.data);
        setPrivateMessages(prev => [...prev, data.message]);
      });

      // Handle agent_response event
      eventSource.addEventListener('agent_response', (event) => {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data.message]);
        if (onAgentResponse) {
          onAgentResponse(data.message);
        }
      });

      // Handle agent_added event
      eventSource.addEventListener('agent_added', (event) => {
        const data = JSON.parse(event.data);
        setParticipants(prev => {
          const exists = prev.some(p => p.id === data.participant.id);
          if (exists) return prev;
          return [...prev, data.participant];
        });
        
        // Invalidate session query to refresh full state
        queryClient.invalidateQueries({ queryKey: [`/api/roundtable/sessions/${sessionId}`] });
      });

      // Handle typing_indicator event
      eventSource.addEventListener('typing_indicator', (event) => {
        const data = JSON.parse(event.data);
        setTypingParticipants(prev => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.participantId);
          } else {
            newSet.delete(data.participantId);
          }
          return newSet;
        });
      });

      // Handle deliverable_created event
      eventSource.addEventListener('deliverable_created', (event) => {
        // Invalidate session query to refresh deliverables
        queryClient.invalidateQueries({ queryKey: [`/api/roundtable/sessions/${sessionId}`] });
      });

      // Handle deliverable_presentation event
      eventSource.addEventListener('deliverable_presentation', (event) => {
        const data = JSON.parse(event.data);
        setCurrentPresentation({
          deliverable: data.deliverable,
          presenterParticipantId: data.presenterParticipantId,
          presenterName: data.presenterName,
        });
      });

      // Handle presentation_ended event
      eventSource.addEventListener('presentation_ended', (event) => {
        setCurrentPresentation(null);
      });

    } catch (err) {
      console.error('[Roundtable SSE] Connection failed:', err);
      const errorMsg = 'Failed to establish connection';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [sessionId, closeConnection, onParticipantJoined, onParticipantLeft, onNewMessage, onAgentResponse, onError]);

  /**
   * Send message to main channel
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId) return;

    try {
      await apiRequest('POST', `/api/roundtable/sessions/${sessionId}/messages`, {
        content,
        channelType: 'main',
      });
    } catch (err: any) {
      console.error('[Roundtable SSE] Send message error:', err);
      const errorMsg = err.message || 'Failed to send message';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [sessionId, onError]);

  /**
   * Send private message to specific participant
   */
  const sendPrivateMessage = useCallback(async (recipientParticipantId: string, content: string) => {
    if (!sessionId) return;

    try {
      await apiRequest('POST', `/api/roundtable/sessions/${sessionId}/messages`, {
        content,
        channelType: 'private',
        recipientParticipantId,
      });
    } catch (err: any) {
      console.error('[Roundtable SSE] Send private message error:', err);
      const errorMsg = err.message || 'Failed to send private message';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [sessionId, onError]);

  /**
   * Start typing indicator
   */
  const startTyping = useCallback(async () => {
    if (!sessionId) return;

    try {
      await apiRequest('POST', `/api/roundtable/sessions/${sessionId}/messages`, {
        action: 'typing_start',
      });
    } catch (err) {
      // Silently fail for typing indicators
      console.error('[Roundtable SSE] Start typing error:', err);
    }
  }, [sessionId]);

  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(async () => {
    if (!sessionId) return;

    try {
      await apiRequest('POST', `/api/roundtable/sessions/${sessionId}/messages`, {
        action: 'typing_stop',
      });
    } catch (err) {
      // Silently fail for typing indicators
      console.error('[Roundtable SSE] Stop typing error:', err);
    }
  }, [sessionId]);

  /**
   * Start deliverable presentation
   */
  const presentDeliverable = useCallback(async (deliverableId: string) => {
    if (!sessionId) return;

    try {
      await apiRequest('POST', `/api/roundtable/sessions/${sessionId}/presentations/start`, {
        deliverableId,
      });
    } catch (err: any) {
      console.error('[Roundtable SSE] Start presentation error:', err);
      const errorMsg = err.message || 'Failed to start presentation';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [sessionId, onError]);

  /**
   * End deliverable presentation
   */
  const endPresentation = useCallback(async () => {
    if (!sessionId) return;

    try {
      await apiRequest('POST', `/api/roundtable/sessions/${sessionId}/presentations/stop`, {});
    } catch (err: any) {
      console.error('[Roundtable SSE] End presentation error:', err);
      const errorMsg = err.message || 'Failed to end presentation';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    }
  }, [sessionId, onError]);

  // Connect on mount and when sessionId changes
  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      closeConnection();
    };
  }, [sessionId, connect, closeConnection]);

  return {
    isConnected,
    isReconnecting,
    error,
    participants,
    messages,
    privateMessages,
    typingParticipants,
    currentPresentation,
    sendMessage,
    sendPrivateMessage,
    startTyping,
    stopTyping,
    presentDeliverable,
    endPresentation,
  };
}
