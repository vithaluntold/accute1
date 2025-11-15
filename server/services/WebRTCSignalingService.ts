/**
 * WebRTC Signaling Service
 * Manages WebRTC peer connections and signaling for voice/video calls
 */

export interface CallSession {
  callId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  conversationId?: string; // For Live Chat calls
  teamId?: string; // For Team Chat calls
  callType: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended';
  startedAt: Date;
  endedAt?: Date;
  organizationId: string;
}

/**
 * WebRTC Configuration with free STUN servers
 */
export const WEBRTC_CONFIG = {
  iceServers: [
    // Google's free STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Active call sessions (in-memory for now)
 * Maps callId -> CallSession
 */
const activeCalls = new Map<string, CallSession>();

/**
 * Maps userId -> Set<callId> for quick lookup
 */
const userCalls = new Map<string, Set<string>>();

export class WebRTCSignalingService {
  /**
   * Create a new call session
   */
  static createCall(params: {
    callId: string;
    callerId: string;
    callerName: string;
    receiverId: string;
    receiverName: string;
    conversationId?: string;
    teamId?: string;
    callType: 'audio' | 'video';
    organizationId: string;
  }): CallSession {
    const session: CallSession = {
      ...params,
      status: 'ringing',
      startedAt: new Date(),
    };

    activeCalls.set(params.callId, session);

    // Track calls for both users
    if (!userCalls.has(params.callerId)) {
      userCalls.set(params.callerId, new Set());
    }
    if (!userCalls.has(params.receiverId)) {
      userCalls.set(params.receiverId, new Set());
    }
    userCalls.get(params.callerId)!.add(params.callId);
    userCalls.get(params.receiverId)!.add(params.callId);

    return session;
  }

  /**
   * Get call session by ID
   */
  static getCall(callId: string): CallSession | undefined {
    return activeCalls.get(callId);
  }

  /**
   * Update call status
   */
  static updateCallStatus(
    callId: string,
    status: 'active' | 'ended'
  ): CallSession | undefined {
    const call = activeCalls.get(callId);
    if (!call) return undefined;

    call.status = status;
    if (status === 'ended') {
      call.endedAt = new Date();
    }

    return call;
  }

  /**
   * End a call
   */
  static endCall(callId: string): CallSession | undefined {
    const call = activeCalls.get(callId);
    if (!call) return undefined;

    call.status = 'ended';
    call.endedAt = new Date();

    // Clean up tracking
    if (userCalls.has(call.callerId)) {
      userCalls.get(call.callerId)!.delete(callId);
    }
    if (userCalls.has(call.receiverId)) {
      userCalls.get(call.receiverId)!.delete(callId);
    }

    // Remove from active calls after 5 seconds (allow time for cleanup messages)
    setTimeout(() => {
      activeCalls.delete(callId);
    }, 5000);

    return call;
  }

  /**
   * Get active calls for a user
   */
  static getUserActiveCalls(userId: string): CallSession[] {
    const callIds = userCalls.get(userId);
    if (!callIds || callIds.size === 0) return [];

    return Array.from(callIds)
      .map((id) => activeCalls.get(id))
      .filter((call): call is CallSession => call !== undefined && call.status !== 'ended');
  }

  /**
   * Check if user is in a call
   */
  static isUserInCall(userId: string): boolean {
    return this.getUserActiveCalls(userId).length > 0;
  }

  /**
   * Get WebRTC configuration
   */
  static getWebRTCConfig() {
    return WEBRTC_CONFIG;
  }

  /**
   * Validate that users can start a call
   */
  static canStartCall(callerId: string, receiverId: string): {
    valid: boolean;
    reason?: string;
  } {
    if (callerId === receiverId) {
      return { valid: false, reason: 'Cannot call yourself' };
    }

    const callerActiveCalls = this.getUserActiveCalls(callerId);
    if (callerActiveCalls.length > 0) {
      return { valid: false, reason: 'You are already in a call' };
    }

    const receiverActiveCalls = this.getUserActiveCalls(receiverId);
    if (receiverActiveCalls.length > 0) {
      return { valid: false, reason: 'User is already in a call' };
    }

    return { valid: true };
  }
}
