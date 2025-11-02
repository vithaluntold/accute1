import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../services/api';
import { webSocketClient, ChatMessage } from '../../services/websocket';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface Team {
  id: string;
  name: string;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => apiClient.get('/api/teams'),
  });

  // Don't fetch messages via API - get them from WebSocket team_joined event

  // Set up WebSocket connection
  useEffect(() => {
    if (!selectedTeamId) return;

    // Reset messages when switching teams
    setMessages([]);

    webSocketClient.connect(selectedTeamId);

    const unsubscribeTeamJoined = webSocketClient.onTeamJoined((recentMessages) => {
      setMessages(recentMessages);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    });

    const unsubscribeMessage = webSocketClient.onMessage((message) => {
      setMessages((prev) => [...prev, message]);
      // Scroll to bottom on new message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const unsubscribeConnect = webSocketClient.onConnect(() => {
      setIsConnected(true);
    });

    const unsubscribeDisconnect = webSocketClient.onDisconnect(() => {
      setIsConnected(false);
    });

    return () => {
      unsubscribeTeamJoined();
      unsubscribeMessage();
      unsubscribeConnect();
      unsubscribeDisconnect();
      webSocketClient.disconnect();
    };
  }, [selectedTeamId]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedTeamId) return;

    try {
      webSocketClient.sendMessage(inputText.trim());
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.senderId === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <Text style={styles.senderName}>
            {item.sender?.firstName} {item.sender?.lastName}
          </Text>
        )}
        <View style={isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble}>
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading teams...</Text>
      </View>
    );
  }

  if (!selectedTeamId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select a Team</Text>
        </View>
        <FlatList
          data={teams}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.teamItem}
              onPress={() => setSelectedTeamId(item.id)}
            >
              <View style={styles.teamIcon}>
                <Ionicons name="people" size={24} color="#0066CC" />
              </View>
              <Text style={styles.teamName}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No teams available</Text>
            </View>
          }
        />
      </View>
    );
  }

  const currentTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedTeamId(null)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.chatHeaderTitle}>{currentTeam?.name}</Text>
        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#10b981' : '#ef4444' },
            ]}
          />
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id || `msg-${index}`}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || !isConnected}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() && isConnected ? '#fff' : '#999'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066CC',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backButton: {
    marginRight: 12,
  },
  chatHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  connectionStatus: {
    padding: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  ownMessageBubble: {
    backgroundColor: '#0066CC',
    padding: 12,
    borderRadius: 12,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});
