import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC, CallType } from './useWebRTC';

interface TeamChatWebSocketOptions {
  channelId: string | null;
  userId: string;
  onMessage?: (message: any) => void;
  onIncomingCall?: (data: { callId: string; callerId: string; callerName: string; callType: CallType; channelId: string }) => void;
  onCallAccepted?: (data: { callId: string }) => void;
  onCallRejected?: (data: { callId: string }) => void;
  onCallEnded?: (data: { callId: string }) => void;
  onError?: (error: string) => void;
}

interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callType: CallType;
  channelId: string;
}

export function useTeamChatWebSocket(options: TeamChatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
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
          teamId: options.channelId,
        }));
      }
    },
    onError: (error) => {
      options.onError?.(error.message);
    },
  });

  const connect = useCallback(() => {
    // Don't connect if no channel is selected or no user is logged in
    if (!options.channelId || !options.userId) {
      console.log('[TeamChat WS] Skipping connection: missing channel or user', {
        hasChannel: !!options.channelId,
        hasUser: !!options.userId
      });
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/team-chat`;
    
    console.log('[TeamChat WS] Connecting to:', wsUrl, {
      channelId: options.channelId,
      userId: options.userId
    });
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[TeamChat WS] Connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Join channel (using teamId field for compatibility)
      ws.send(JSON.stringify({
        type: 'join_team',
        teamId: options.channelId, // Use channelId as teamId
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
            // Caller receives confirmation with callId
            webRTC.setCallId(message.data.callId);
            webRTC.setRemoteUserId(message.data.receiverId);
            webRTC.setRemoteUserName(message.data.receiverName);
            webRTC.setCallState('ringing');
            setCurrentCallId(message.data.callId);
            
            // Now send the SDP offer that was created earlier
            if (pendingOfferRef.current) {
              sendMessage('sdp_offer', {
                callId: message.data.callId,
                sdp: pendingOfferRef.current,
                teamId: options.channelId,
              });
              pendingOfferRef.current = null;
            }
            break;

          case 'incoming_call':
            // Receiver gets incoming call  
            webRTC.setCallId(message.data.callId);
            webRTC.setRemoteUserId(message.data.callerId);
            webRTC.setRemoteUserName(message.data.callerName);
            setIncomingCall(message.data);
            options.onIncomingCall?.(message.data);
            break;

          case 'call_accepted':
            // Both parties receive this
            webRTC.setCallState('connecting');
            setIncomingCall(null); // Clear incoming call
            break;

          case 'call_rejected':
            // Caller receives rejection
            webRTC.cleanup();
            setCurrentCallId(null);
            setIncomingCall(null); // Clear incoming call
            break;

          case 'call_ended':
            // Either party hung up
            webRTC.cleanup();
            setCurrentCallId(null);
            setIncomingCall(null); // Clear incoming call
            break;

          case 'sdp_offer':
            // Receiver gets SDP offer - buffer it until accept
            incomingOfferRef.current = message.data.sdp;
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
  }, [options.channelId, options.userId]);

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
      
      // Buffer the offer - will be sent after call_started with callId
      pendingOfferRef.current = offer;

      // Send start_call message (no callId yet - server will generate it)
      sendMessage('start_call', {
        receiverId,
        callType,
        teamId: options.channelId,
      });
    } catch (error) {
      console.error('[TeamChat WS] Failed to start call:', error);
      options.onError?.('Failed to start call');
      pendingOfferRef.current = null;
    }
  }, [webRTC, sendMessage, options.channelId, options.onError]);

  const acceptCall = useCallback(async (callId: string, callType: CallType) => {
    try {
      // Get the buffered SDP offer
      const offer = incomingOfferRef.current;
      if (!offer) {
        throw new Error('No SDP offer available');
      }

      webRTC.setCallId(callId);
      setCurrentCallId(callId);
      setIncomingCall(null); // Clear incoming call immediately

      // Create WebRTC answer
      const config = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };
      const answer = await webRTC.createAnswer(config, callType, offer);
      
      // Clear the buffered offer
      incomingOfferRef.current = null;

      // Send accept_call message
      sendMessage('accept_call', {
        callId,
        teamId: options.channelId,
      });

      // Send SDP answer
      sendMessage('sdp_answer', {
        callId,
        sdp: answer,
        teamId: options.channelId,
      });
    } catch (error) {
      console.error('[TeamChat WS] Failed to accept call:', error);
      options.onError?.('Failed to accept call');
    }
  }, [webRTC, sendMessage, options.channelId, options.onError]);

  const rejectCall = useCallback((callId: string) => {
    setIncomingCall(null); // Clear incoming call immediately
    sendMessage('reject_call', {
      callId,
      teamId: options.channelId,
    });
  }, [sendMessage, options.channelId]);

  const endCall = useCallback(() => {
    if (currentCallId) {
      sendMessage('end_call', {
        callId: currentCallId,
        teamId: options.channelId,
      });
      webRTC.cleanup();
      setCurrentCallId(null);
    }
  }, [currentCallId, sendMessage, webRTC, options.channelId]);

  // Connect/disconnect when channelId or userId changes
  useEffect(() => {
    if (options.channelId && options.userId) {
      connect();
    }
    return () => {
      disconnect();
      webRTC.cleanup();
    };
  }, [options.channelId, options.userId]);

  return {
    isConnected,
    currentCallId,
    incomingCall,
    webRTC,
    sendMessage,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
