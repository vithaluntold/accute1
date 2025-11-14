import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, AlertCircle, CheckCircle, Clock, User, Reply, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { LiveChatConversation, LiveChatMessage } from "@shared/schema";
import { canAccessLiveChat } from "@shared/accessControl";

interface MessageWithReplies extends LiveChatMessage {
  replies: MessageWithReplies[];
}

// Recursive message thread component
function MessageThread({ 
  message, 
  depth = 0,
  onReply,
  user
}: { 
  message: MessageWithReplies; 
  depth?: number;
  onReply: (msg: LiveChatMessage) => void;
  user: any;
}) {
  // Cap indentation at 3 levels but render all messages
  const maxIndentDepth = 3;
  const indentLevel = Math.min(depth, maxIndentDepth);
  const shouldIndent = indentLevel > 0;
  const isOwnMessage = message.senderId === user.id;
  const isAgent = message.senderType === 'agent';
  
  return (
    <div className={shouldIndent ? "ml-8 border-l-2 border-primary/30 pl-4 mt-3" : ""}>
      {/* Render the message */}
      <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
        <Avatar className={depth > 0 ? "h-7 w-7" : "h-8 w-8"}>
          <AvatarFallback>
            {isAgent ? 'A' : 'U'}
          </AvatarFallback>
        </Avatar>
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
          <div
            className={`rounded-lg px-4 py-2 ${
              isOwnMessage
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
          >
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
            {message.replies?.length > 0 && (
              <Badge variant="secondary" className="h-4 text-xs" data-testid={`badge-reply-count-${message.id}`}>
                {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs mt-1"
            onClick={() => onReply(message)}
            data-testid={`button-reply-${message.id}`}
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
        </div>
      </div>
      
      {/* Recursively render ALL replies (indentation capped but all messages shown) */}
      {message.replies?.length > 0 && (
        <div className="space-y-2">
          {message.replies.map((reply) => (
            <MessageThread 
              key={reply.id} 
              message={reply} 
              depth={depth + 1}
              onReply={onReply}
              user={user}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LiveChat() {
  const user = getUser();
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [replyToMessage, setReplyToMessage] = useState<LiveChatMessage | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Check subscription and access by trying to fetch conversations
  // The API will handle access control and return appropriate errors
  useEffect(() => {
    async function checkAccess() {
      if (!user) {
        return;
      }

      // Agents always have access
      if (user.role === 'superadmin' || user.role === 'admin') {
        setHasAccess(true);
        return;
      }

      try {
        // Try to fetch conversations - this will validate access on the backend
        const response = await fetch('/api/live-chat/conversations');
        if (response.ok) {
          setHasAccess(true);
        } else if (response.status === 403) {
          // Access denied - not an Edge subscriber
          setHasAccess(false);
        } else {
          // Other error - assume no access for safety
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Failed to check access:', error);
        setHasAccess(false);
      }
    }

    checkAccess();
  }, [user]);

  // Fetch conversations
  const { data: conversationsData, isLoading: loadingConversations } = useQuery<{ conversations: LiveChatConversation[] }>({
    queryKey: ['/api/live-chat/conversations'],
    enabled: hasAccess && !!user,
  });

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: loadingMessages } = useQuery<{ messages: LiveChatMessage[] }>({
    queryKey: ['/api/live-chat/conversations', selectedConversation, 'messages'],
    enabled: !!selectedConversation,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (data: { subject: string; priority: string }) => {
      return await apiRequest('/api/live-chat/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-chat/conversations'] });
      setSelectedConversation(data.conversation.id);
      toast({
        title: "Chat started",
        description: "An agent will respond shortly",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start chat",
        variant: "destructive",
      });
    },
  });

  // Setup WebSocket connection
  useEffect(() => {
    if (!selectedConversation || !user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-chat`;
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('[Live Chat] WebSocket connected');
      // Join the conversation
      socket.send(JSON.stringify({
        type: 'join_conversation',
        conversationId: selectedConversation
      }));
      setWs(socket);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'new_message':
            setMessages(prev => [...prev, data.data]);
            queryClient.invalidateQueries({ queryKey: ['/api/live-chat/conversations', selectedConversation, 'messages'] });
            break;
          case 'typing_indicator':
            if (!data.data.isTyping) {
              setIsTyping(false);
            } else if (data.data.userId !== user.id) {
              setIsTyping(true);
              setTimeout(() => setIsTyping(false), 3000);
            }
            break;
          case 'joined':
            console.log('[Live Chat] Joined conversation');
            break;
          case 'error':
            console.error('[Live Chat] WebSocket error:', data.error);
            toast({
              title: "Connection error",
              description: data.error,
              variant: "destructive",
            });
            break;
        }
      } catch (error) {
        console.error('[Live Chat] Failed to parse message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('[Live Chat] WebSocket error:', error);
      toast({
        title: "Connection error",
        description: "Failed to connect to chat server",
        variant: "destructive",
      });
    };

    socket.onclose = () => {
      console.log('[Live Chat] WebSocket disconnected');
      setWs(null);
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'leave_conversation' }));
        socket.close();
      }
      wsRef.current = null;
    };
  }, [selectedConversation, user, toast]);

  // Update messages when data changes
  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages);
    }
  }, [messagesData]);

  // Build message tree with all levels
  const buildMessageTree = useMemo(() => {
    if (!messages) return [];
    
    // Create map of all messages by ID for quick lookup
    const messageMap = new Map(messages.map(m => [m.id, { ...m, replies: [] as MessageWithReplies[] }]));
    
    // Separate root messages from replies
    const rootMessages: MessageWithReplies[] = [];
    
    messages.forEach(msg => {
      if (!msg.inReplyTo) {
        // This is a root message
        rootMessages.push(messageMap.get(msg.id)!);
      } else {
        // This is a reply - attach to parent
        const parent = messageMap.get(msg.inReplyTo);
        if (parent) {
          parent.replies.push(messageMap.get(msg.id)!);
        } else {
          // Parent not found - treat as root (orphaned)
          rootMessages.push(messageMap.get(msg.id)!);
        }
      }
    });
    
    return rootMessages;
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = () => {
    if (!messageContent.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'send_message',
      content: messageContent,
      inReplyTo: replyToMessage?.id || null,
    }));

    setMessageContent("");
    setReplyToMessage(null);
  };

  // Handle reply
  const handleReply = (message: LiveChatMessage) => {
    setReplyToMessage(message);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  // Handle typing
  const handleTyping = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'start_typing' }));
  };

  const handleStopTyping = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'stop_typing' }));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to access live chat support</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-10 w-10 text-primary" />
              <div>
                <CardTitle>24/7 Priority Support</CardTitle>
                <CardDescription>Available exclusively for Edge subscription users</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get instant access to our dedicated support team with the Edge plan. Enjoy:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                <span>24/7 live chat support with real agents</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                <span>Priority response times</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                <span>Dedicated account management</span>
              </li>
            </ul>
            <Button className="w-full" data-testid="button-upgrade-edge">
              Upgrade to Edge
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const conversations = conversationsData?.conversations || [];

  return (
    <div className="h-screen flex flex-col p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Chat Support</h1>
          <p className="text-muted-foreground">24/7 priority support for Edge subscribers</p>
        </div>
        <Button
          onClick={() => createConversationMutation.mutate({ subject: "Support Request", priority: "normal" })}
          disabled={createConversationMutation.isPending}
          data-testid="button-new-chat"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 min-h-0">
        {/* Conversations list */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <CardDescription>Your support conversations</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {loadingConversations ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No conversations yet. Start a new chat!
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv.id)}
                      className={`w-full text-left p-4 hover-elevate active-elevate-2 transition-colors ${
                        selectedConversation === conv.id ? 'bg-accent' : ''
                      }`}
                      data-testid={`conversation-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{conv.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(conv.lastMessageAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={conv.status === 'active' ? 'default' : 'secondary'}>
                          {conv.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {conversations.find(c => c.id === selectedConversation)?.subject || 'Chat'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      {ws && ws.readyState === WebSocket.OPEN ? (
                        <>
                          <span className="flex h-2 w-2 rounded-full bg-green-500" />
                          Connected
                        </>
                      ) : (
                        <>
                          <span className="flex h-2 w-2 rounded-full bg-gray-400" />
                          Connecting...
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="flex-1 min-h-0 p-4">
                <ScrollArea className="h-full pr-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading messages...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {buildMessageTree.map(rootMessage => (
                        <div key={rootMessage.id} data-testid={`thread-${rootMessage.id}`}>
                          <MessageThread 
                            message={rootMessage} 
                            depth={0} 
                            onReply={handleReply}
                            user={user}
                          />
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>A</AvatarFallback>
                          </Avatar>
                          <div className="bg-muted rounded-lg px-4 py-2">
                            <div className="flex gap-1">
                              <span className="animate-bounce">·</span>
                              <span className="animate-bounce delay-100">·</span>
                              <span className="animate-bounce delay-200">·</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              <Separator />

              <div className="p-4 space-y-2">
                {/* Reply indicator */}
                {replyToMessage && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md" data-testid="reply-indicator">
                    <Reply className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground flex-1">
                      Replying to: <span className="font-medium">{replyToMessage.content.substring(0, 50)}{replyToMessage.content.length > 50 ? '...' : ''}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCancelReply}
                      data-testid="button-cancel-reply"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Textarea
                    value={messageContent}
                    onChange={(e) => {
                      setMessageContent(e.target.value);
                      handleTyping();
                    }}
                    onBlur={handleStopTyping}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                        handleStopTyping();
                      }
                    }}
                    placeholder="Type your message..."
                    className="resize-none"
                    rows={3}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={() => {
                      sendMessage();
                      handleStopTyping();
                    }}
                    disabled={!messageContent.trim() || !ws || ws.readyState !== WebSocket.OPEN}
                    size="icon"
                    className="h-auto"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">Select a conversation or start a new chat</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
