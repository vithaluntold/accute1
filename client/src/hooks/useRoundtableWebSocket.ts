import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  RoundtableParticipant,
  RoundtableMessage,
  RoundtableDeliverable,
} from '@shared/schema';

/**
 * WebSocket message types from server
 */
type WebSocketMessage =
  | { type: 'roster_update'; participants: RoundtableParticipant[] }
  | { type: 'new_message'; message: RoundtableMessage }
  | { type: 'private_message'; message: RoundtableMessage }
  | { type: 'deliverable_presentation'; deliverable: RoundtableDeliverable; presenterName: string }
  | { type: 'presentation_ended' }
  | { type: 'typing_indicator'; participantId: string; isTyping: boolean }
  | { type: 'presence_update'; participantId: string; status: string }
  | { type: 'error'; error: string };

/**
 * WebSocket message to send to server
 */
type OutgoingMessage =
  | { type: 'join_session'; sessionId: string }
  | { type: 'leave_session'; sessionId: string }
  | { type: 'send_message'; content: string }
  | { type: 'send_private_message'; recipientParticipantId: string; content: string }
  | { type: 'start_typing' }
  | { type: 'stop_typing' };

interface RoundtableWebSocketState {
  // Connection state
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;

  // Session data
  participants: RoundtableParticipant[];
  messages: RoundtableMessage[];
  privateMessages: Record<string, RoundtableMessage[]>; // Keyed by participantId
  currentPresentation: {
    deliverable: RoundtableDeliverable;
    presenterName: string;
  } | null;

  // Presence indicators
  typingParticipants: Set<string>;
  participantStatuses: Record<string, string>;

  // Actions
  sendMessage: (content: string) => void;
  sendPrivateMessage: (recipientId: string, content: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  disconnect: () => void;
}

/**
 * Custom hook for managing Roundtable WebSocket connection
 */
export function useRoundtableWebSocket(
  sessionId: string | null
): RoundtableWebSocketState {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RoundtableParticipant[]>([]);
  const [messages, setMessages] = useState<RoundtableMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<
    Record<string, RoundtableMessage[]>
  >({});
  const [currentPresentation, setCurrentPresentation] = useState<{
    deliverable: RoundtableDeliverable;
    presenterName: string;
  } | null>(null);
  const [typingParticipants, setTypingParticipants] = useState<Set<string>>(
    new Set()
  );
  const [participantStatuses, setParticipantStatuses] = useState<
    Record<string, string>
  >({});

  /**
   * Send a message through WebSocket
   */
  const send = useCallback((message: OutgoingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!sessionId) return;

    try {
      // Use secure WebSocket if page is HTTPS
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/roundtable`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Join session
        send({ type: 'join_session', sessionId });
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          switch (data.type) {
            case 'roster_update':
              setParticipants(data.participants);
              break;

            case 'new_message':
              setMessages((prev) => [...prev, data.message]);
              break;

            case 'private_message':
              setPrivateMessages((prev) => {
                // Determine the other participant (either sender or recipient)
                const otherParticipantId =
                  data.message.senderId === sessionId
                    ? data.message.recipientParticipantId
                    : data.message.senderId;

                if (!otherParticipantId) return prev;

                return {
                  ...prev,
                  [otherParticipantId]: [
                    ...(prev[otherParticipantId] || []),
                    data.message,
                  ],
                };
              });
              break;

            case 'deliverable_presentation':
              setCurrentPresentation({
                deliverable: data.deliverable,
                presenterName: data.presenterName,
              });
              break;

            case 'presentation_ended':
              setCurrentPresentation(null);
              break;

            case 'typing_indicator':
              setTypingParticipants((prev) => {
                const newSet = new Set(prev);
                if (data.isTyping) {
                  newSet.add(data.participantId);
                } else {
                  newSet.delete(data.participantId);
                }
                return newSet;
              });
              break;

            case 'presence_update':
              setParticipantStatuses((prev) => ({
                ...prev,
                [data.participantId]: data.status,
              }));
              break;

            case 'error':
              setError(data.error);
              break;
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error occurred');
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection
        if (
          sessionId &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          setIsReconnecting(true);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY * reconnectAttemptsRef.current);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Failed to reconnect. Please refresh the page.');
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to create connection');
    }
  }, [sessionId, send]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      if (sessionId) {
        send({ type: 'leave_session', sessionId });
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsReconnecting(false);
  }, [sessionId, send]);

  /**
   * Send a message to main chat
   */
  const sendMessage = useCallback(
    (content: string) => {
      send({ type: 'send_message', content });
    },
    [send]
  );

  /**
   * Send a private message
   */
  const sendPrivateMessage = useCallback(
    (recipientId: string, content: string) => {
      send({
        type: 'send_private_message',
        recipientParticipantId: recipientId,
        content,
      });
    },
    [send]
  );

  /**
   * Indicate user is typing
   */
  const startTyping = useCallback(() => {
    send({ type: 'start_typing' });
  }, [send]);

  /**
   * Indicate user stopped typing
   */
  const stopTyping = useCallback(() => {
    send({ type: 'stop_typing' });
  }, [send]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  return {
    isConnected,
    isReconnecting,
    error,
    participants,
    messages,
    privateMessages,
    currentPresentation,
    typingParticipants,
    participantStatuses,
    sendMessage,
    sendPrivateMessage,
    startTyping,
    stopTyping,
    disconnect,
  };
}
