import { useState, useRef, useCallback, useEffect } from 'react';

export type CallType = 'audio' | 'video';
export type CallState = 'idle' | 'initiating' | 'ringing' | 'connecting' | 'active' | 'ended';

interface WebRTCConfig {
  iceServers: Array<{ urls: string[] }>;
}

interface UseWebRTCOptions {
  onCallStarted?: (callId: string) => void;
  onCallAccepted?: (callId: string) => void;
  onCallRejected?: (callId: string) => void;
  onCallEnded?: (callId: string) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onError?: (error: Error) => void;
}

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [callType, setCallType] = useState<CallType>('audio');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [remoteUserName, setRemoteUserName] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);

  /**
   * Initialize local media stream
   */
  const initializeLocalStream = useCallback(async (type: CallType) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error('[WebRTC] Failed to get local media:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }, [options]);

  /**
   * Create RTCPeerConnection with ICE servers
   */
  const createPeerConnection = useCallback((config: WebRTCConfig) => {
    const pc = new RTCPeerConnection(config);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] New ICE candidate:', event.candidate);
        options.onIceCandidate?.(event.candidate);
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        setCallState('active');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        // Auto-cleanup on disconnect
        cleanup();
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [options]);

  /**
   * Create SDP offer (caller initiates)
   */
  const createOffer = useCallback(async (config: WebRTCConfig, type: CallType): Promise<RTCSessionDescriptionInit> => {
    try {
      setCallType(type);
      setCallState('initiating');

      // Get local media
      const stream = await initializeLocalStream(type);
      
      // Create peer connection
      const pc = createPeerConnection(config);

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
      });

      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Offer created and set as local description');

      return offer;
    } catch (error) {
      console.error('[WebRTC] Failed to create offer:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }, [createPeerConnection, initializeLocalStream, options]);

  /**
   * Create SDP answer (receiver accepts)
   */
  const createAnswer = useCallback(async (
    config: WebRTCConfig, 
    type: CallType, 
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> => {
    try {
      setCallType(type);
      setCallState('connecting');

      // Get local media
      const stream = await initializeLocalStream(type);
      
      // Create peer connection
      const pc = createPeerConnection(config);

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Set remote description (the offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[WebRTC] Answer created and set as local description');

      // Process any queued ICE candidates
      if (iceCandidateQueueRef.current.length > 0) {
        console.log('[WebRTC] Processing queued ICE candidates:', iceCandidateQueueRef.current.length);
        for (const candidate of iceCandidateQueueRef.current) {
          await pc.addIceCandidate(candidate);
        }
        iceCandidateQueueRef.current = [];
      }

      return answer;
    } catch (error) {
      console.error('[WebRTC] Failed to create answer:', error);
      options.onError?.(error as Error);
      throw error;
    }
  }, [createPeerConnection, initializeLocalStream, options]);

  /**
   * Handle incoming SDP offer (receiver side)
   */
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC] No peer connection available');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] Remote offer set');

      // Process any queued ICE candidates
      if (iceCandidateQueueRef.current.length > 0) {
        console.log('[WebRTC] Processing queued ICE candidates:', iceCandidateQueueRef.current.length);
        for (const candidate of iceCandidateQueueRef.current) {
          await pc.addIceCandidate(candidate);
        }
        iceCandidateQueueRef.current = [];
      }
    } catch (error) {
      console.error('[WebRTC] Failed to handle offer:', error);
      options.onError?.(error as Error);
    }
  }, [options]);

  /**
   * Handle incoming SDP answer (caller side)
   */
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC] No peer connection available');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] Remote answer set');
      setCallState('connecting');

      // Process any queued ICE candidates
      if (iceCandidateQueueRef.current.length > 0) {
        console.log('[WebRTC] Processing queued ICE candidates:', iceCandidateQueueRef.current.length);
        for (const candidate of iceCandidateQueueRef.current) {
          await pc.addIceCandidate(candidate);
        }
        iceCandidateQueueRef.current = [];
      }
    } catch (error) {
      console.error('[WebRTC] Failed to handle answer:', error);
      options.onError?.(error as Error);
    }
  }, [options]);

  /**
   * Handle incoming ICE candidate
   */
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    
    if (!pc) {
      console.error('[WebRTC] No peer connection available');
      return;
    }

    try {
      // If we haven't set remote description yet, queue the candidate
      if (!pc.remoteDescription) {
        console.log('[WebRTC] Queueing ICE candidate (no remote description yet)');
        iceCandidateQueueRef.current.push(new RTCIceCandidate(candidate));
        return;
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] ICE candidate added');
    } catch (error) {
      console.error('[WebRTC] Failed to add ICE candidate:', error);
      options.onError?.(error as Error);
    }
  }, [options]);

  /**
   * Toggle audio mute
   */
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  }, []);

  /**
   * Toggle video mute
   */
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoMuted(!videoTrack.enabled);
    }
  }, []);

  /**
   * Toggle screen sharing
   */
  const toggleScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false,
        });

        screenStreamRef.current = screenStream;

        // Replace video track with screen track
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }

        // Handle screen share stop (user clicks browser's "Stop sharing" button)
        screenTrack.onended = () => {
          toggleScreenShare(); // Stop screen sharing
        };

        setIsScreenSharing(true);
      } else {
        // Stop screen sharing and restore camera
        const localStream = localStreamRef.current;
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          
          if (sender && cameraTrack) {
            await sender.replaceTrack(cameraTrack);
          }
        }

        // Stop screen stream
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }

        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to toggle screen share:', error);
      options.onError?.(error as Error);
    }
  }, [isScreenSharing, options]);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up resources');

    // Stop all local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Stop screen sharing
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Reset state
    remoteStreamRef.current = null;
    iceCandidateQueueRef.current = [];
    setCallState('idle');
    setCallId(null);
    setRemoteUserId(null);
    setRemoteUserName(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
  }, []);

  /**
   * Get local stream for video element
   */
  const getLocalStream = useCallback(() => {
    return localStreamRef.current;
  }, []);

  /**
   * Get remote stream for video element
   */
  const getRemoteStream = useCallback(() => {
    return remoteStreamRef.current;
  }, []);

  /**
   * Get current peer connection
   */
  const getPeerConnection = useCallback(() => {
    return peerConnectionRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // State
    callState,
    callId,
    callType,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    remoteUserId,
    remoteUserName,

    // Actions
    setCallState,
    setCallId,
    setRemoteUserId,
    setRemoteUserName,
    createOffer,
    createAnswer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    cleanup,

    // Getters
    getLocalStream,
    getRemoteStream,
    getPeerConnection,
  };
}
