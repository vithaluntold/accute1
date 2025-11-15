import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC, CallType } from './useWebRTC';

interface TeamChatWebSocketOptions {
  teamId: string;
  userId: string;
  onMessage?: (message: any) => void;
  onIncomingCall?: (data: { callId: string; callerId: string; callerName: string; callType: CallType; teamId: string }) => void;
  onCallAccepted?: (data: { callId: string }) => void;
  onCallRejected?: (data: { callId: string }) => void;
  onCallEnded?: (data: { callId: string }) => void;
  onError?: (error: string) => void;
}

export function useTeamChatWebSocket(options: TeamChatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Keep ref in sync with state
  useEffect(() => {
    currentCallIdRef.current = currentCallId;
  }, [currentCallId]);

  const webRTC = useWebRTC({
    onCallStarted: (callId) => {
      setCurrentCallId(callId);
    },
    onCallAccepted: (callId) => {
      options.onCallAccepted?.({ callId });
    },
    onCallRejected: (callId) => {
      options.onCallRejected?.({ callId });
      setCurrentCallId(null);
    },
    onCallEnded: (callId) => {
      options.onCallEnded?.({ callId });
      setCurrentCallId(null);
    },
    onIceCandidate: (candidate) => {
      // Send ICE candidate through WebSocket
      const ws = wsRef.current;
      const callId = currentCallIdRef.current;
      
      if (callId && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ice_candidate',
          callId,
          candidate: candidate.toJSON(),
          teamId: options.teamId,
        }));
      }
    },
    onError: (error) => {
      options.onError?.(error.message);
    },
  });

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/team-chat`;
    
    console.log('[TeamChat WS] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[TeamChat WS] Connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Join team
      ws.send(JSON.stringify({
        type: 'join_team',
        teamId: options.teamId,
        userId: options.userId,
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[TeamChat WS] Message received:', message.type);

        switch (message.type) {
          case 'new_message':
            options.onMessage?.(message.data);
            break;

          // WebRTC signaling messages
          case 'call_started':
            // Caller receives confirmation
            webRTC.setCallId(message.data.callId);
            webRTC.setRemoteUserId(message.data.receiverId);
            webRTC.setRemoteUserName(message.data.receiverName);
            webRTC.setCallState('ringing');
            setCurrentCallId(message.data.callId);
            break;

          case 'incoming_call':
            // Receiver gets incoming call
            options.onIncomingCall?.(message.data);
            break;

          case 'call_accepted':
            // Both parties receive this
            webRTC.setCallState('connecting');
            break;

          case 'call_rejected':
            // Caller receives rejection
            webRTC.cleanup();
            setCurrentCallId(null);
            break;

          case 'call_ended':
            // Either party hung up
            webRTC.cleanup();
            setCurrentCallId(null);
            break;

          case 'sdp_offer':
            // Receiver gets SDP offer
            await webRTC.handleOffer(message.data.sdp);
            break;

          case 'sdp_answer':
            // Caller gets SDP answer
            await webRTC.handleAnswer(message.data.sdp);
            break;

          case 'ice_candidate':
            // Either party receives ICE candidate
            await webRTC.handleIceCandidate(message.data.candidate);
            break;

          case 'error':
            console.error('[TeamChat WS] Error:', message.error);
            options.onError?.(message.error);
            break;
        }
      } catch (error) {
        console.error('[TeamChat WS] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[TeamChat WS] Error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('[TeamChat WS] Disconnected');
      setIsConnected(false);
      wsRef.current = null;

      // Attempt reconnection
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[TeamChat WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, [options.teamId, options.userId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    } else {
      console.warn('[TeamChat WS] Cannot send message: not connected');
    }
  }, [isConnected]);

  // WebRTC call methods
  const startCall = useCallback(async (receiverId: string, callType: CallType) => {
    try {
      // Create WebRTC offer
      const config = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };
      const offer = await webRTC.createOffer(config, callType);

      // Send start_call message
      sendMessage('start_call', {
        receiverId,
        callType,
        teamId: options.teamId,
      });

      // Send SDP offer
      sendMessage('sdp_offer', {
        callId: currentCallId,
        sdp: offer,
        teamId: options.teamId,
      });
    } catch (error) {
      console.error('[TeamChat WS] Failed to start call:', error);
      options.onError?.('Failed to start call');
    }
  }, [webRTC, sendMessage, currentCallId, options.teamId, options.onError]);

  const acceptCall = useCallback(async (callId: string, callType: CallType, offer: any) => {
    try {
      webRTC.setCallId(callId);
      setCurrentCallId(callId);

      // Create WebRTC answer
      const config = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };
      const answer = await webRTC.createAnswer(config, callType, offer);

      // Send accept_call message
      sendMessage('accept_call', {
        callId,
        teamId: options.teamId,
      });

      // Send SDP answer
      sendMessage('sdp_answer', {
        callId,
        sdp: answer,
        teamId: options.teamId,
      });
    } catch (error) {
      console.error('[TeamChat WS] Failed to accept call:', error);
      options.onError?.('Failed to accept call');
    }
  }, [webRTC, sendMessage, options.teamId, options.onError]);

  const rejectCall = useCallback((callId: string) => {
    sendMessage('reject_call', {
      callId,
      teamId: options.teamId,
    });
  }, [sendMessage, options.teamId]);

  const endCall = useCallback(() => {
    if (currentCallId) {
      sendMessage('end_call', {
        callId: currentCallId,
        teamId: options.teamId,
      });
      webRTC.cleanup();
      setCurrentCallId(null);
    }
  }, [currentCallId, sendMessage, webRTC, options.teamId]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
      webRTC.cleanup();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    currentCallId,
    webRTC,
    sendMessage,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
