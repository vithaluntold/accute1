import { apiClient } from './api';
import Constants from 'expo-constants';

const WS_URL = Constants.expoConfig?.extra?.apiUrl?.replace('http', 'ws') || 'ws://localhost:5000';

export interface ChatMessage {
  id: string;
  teamId: string;
  senderId: string;
  message: string;
  createdAt: string;
  sender: {
    firstName: string;
    lastName: string;
  };
}

interface WebSocketMessage {
  type: 'connected' | 'team_joined' | 'new_message' | 'user_joined' | 'user_left' | 'typing_indicator' | 'error' | 'pong';
  userId?: string;
  team?: any;
  recentMessages?: ChatMessage[];
  data?: any;
  error?: string;
}

type MessageHandler = (message: ChatMessage) => void;
type ErrorHandler = (error: Error) => void;
type ConnectionHandler = () => void;
type TeamJoinedHandler = (messages: ChatMessage[]) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private teamJoinedHandlers: Set<TeamJoinedHandler> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;
  private currentTeamId: string | null = null;

  connect(teamId: string) {
    const token = apiClient.getToken();
    if (!token) {
      console.error('No auth token available for WebSocket connection');
      return;
    }

    this.isManualDisconnect = false;
    this.currentTeamId = teamId;
    const wsUrl = `${WS_URL}/ws/team-chat?token=${encodeURIComponent(token)}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        // Send join_team message
        if (this.ws && teamId) {
          this.ws.send(JSON.stringify({ type: 'join_team', teamId }));
        }
        this.connectHandlers.forEach(handler => handler());
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connected':
              console.log('WebSocket authenticated, user ID:', message.userId);
              break;
            
            case 'team_joined':
              console.log('Joined team, received recent messages');
              if (message.recentMessages) {
                this.teamJoinedHandlers.forEach(handler => handler(message.recentMessages!));
              }
              break;
            
            case 'new_message':
              if (message.data) {
                this.messageHandlers.forEach(handler => handler(message.data));
              }
              break;
            
            case 'user_joined':
              console.log('User joined:', message.data?.userId);
              break;
            
            case 'user_left':
              console.log('User left:', message.data?.userId);
              break;
            
            case 'error':
              console.error('WebSocket error:', message.error);
              const err = new Error(message.error || 'WebSocket error');
              this.errorHandlers.forEach(handler => handler(err));
              break;
            
            case 'pong':
              // Heartbeat response
              break;
            
            default:
              console.log('Unknown message type:', message);
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        const err = new Error('WebSocket connection error');
        this.errorHandlers.forEach(handler => handler(err));
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.disconnectHandlers.forEach(handler => handler());
        
        // Auto-reconnect unless manually disconnected
        if (!this.isManualDisconnect) {
          this.scheduleReconnect(teamId);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect(teamId);
    }
  }

  private scheduleReconnect(teamId: string) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualDisconnect) {
        console.log('Attempting to reconnect WebSocket...');
        this.connect(teamId);
      }
    }, 3000);
  }

  disconnect() {
    this.isManualDisconnect = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendMessage(content: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'send_message', message: content }));
    } else {
      console.error('WebSocket is not connected');
      throw new Error('Cannot send message: WebSocket not connected');
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onTeamJoined(handler: TeamJoinedHandler) {
    this.teamJoinedHandlers.add(handler);
    return () => this.teamJoinedHandlers.delete(handler);
  }

  onError(handler: ErrorHandler) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler) {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler) {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const webSocketClient = new WebSocketClient();
