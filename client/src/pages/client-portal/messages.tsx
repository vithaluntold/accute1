import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageSquare, Plus, Send, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  subject: string;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: string;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export default function ClientPortalMessages() {
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [newConversationSubject, setNewConversationSubject] = useState("");
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/client-portal/conversations"],
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/client-portal/conversations", selectedConversationId, "messages"],
    enabled: !!selectedConversationId,
  });

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (subject: string) => {
      const response = await apiRequest("POST", "/api/client-portal/conversations", { subject });
      return response.json();
    },
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-portal/conversations"] });
      setSelectedConversationId(newConversation.id);
      setNewConversationSubject("");
      setIsNewConversationOpen(false);
      toast({
        title: "Conversation created",
        description: "You can now send messages to your team.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return await apiRequest("POST", `/api/client-portal/conversations/${conversationId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-portal/conversations", selectedConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-portal/conversations"] });
      setMessageContent("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const handleSendMessage = () => {
    if (!selectedConversationId || !messageContent.trim()) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      content: messageContent.trim(),
    });
  };

  const handleCreateConversation = () => {
    if (!newConversationSubject.trim()) {
      toast({
        title: "Error",
        description: "Please enter a subject for the conversation.",
        variant: "destructive",
      });
      return;
    }

    createConversationMutation.mutate(newConversationSubject.trim());
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  const getSenderName = (message: Message) => {
    if (message.sender) {
      const { firstName, lastName, email } = message.sender;
      if (firstName && lastName) {
        return `${firstName} ${lastName}`;
      }
      return email;
    }
    return message.senderType === "client" ? "You" : "Team";
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={MessageSquare}
        title="Messages"
        description="Communicate with your team and get support"
        testId="client-messages"
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card data-testid="card-messages">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Messages</CardTitle>
                <CardDescription>
                  Secure communication with your accounting team
                </CardDescription>
              </div>
              <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-conversation">
                    <Plus className="h-4 w-4 mr-2" />
                    New Conversation
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-new-conversation">
                  <DialogHeader>
                    <DialogTitle>Start New Conversation</DialogTitle>
                    <DialogDescription>
                      Start a new conversation with your accounting team
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        placeholder="Enter conversation subject..."
                        value={newConversationSubject}
                        onChange={(e) => setNewConversationSubject(e.target.value)}
                        data-testid="input-conversation-subject"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsNewConversationOpen(false)}
                      data-testid="button-cancel-conversation"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateConversation}
                      disabled={createConversationMutation.isPending}
                      data-testid="button-create-conversation"
                    >
                      {createConversationMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {conversationsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-conversations">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium mb-2">No conversations yet</p>
                <p className="text-sm mb-4">
                  Start a conversation to communicate with your team
                </p>
                <Button onClick={() => setIsNewConversationOpen(true)} data-testid="button-start-first-conversation">
                  <Plus className="h-4 w-4 mr-2" />
                  Start Conversation
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
                {/* Conversations List */}
                <div className="md:col-span-1 border rounded-md" data-testid="conversations-list">
                  <ScrollArea className="h-[600px]">
                    <div className="p-4 space-y-2">
                      {conversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className={`p-3 rounded-md cursor-pointer transition-colors hover-elevate active-elevate-2 ${
                            selectedConversationId === conversation.id
                              ? "bg-accent"
                              : ""
                          }`}
                          onClick={() => setSelectedConversationId(conversation.id)}
                          data-testid={`conversation-${conversation.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium text-sm line-clamp-1">
                              {conversation.subject}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {conversation.status}
                            </Badge>
                          </div>
                          {conversation.lastMessageAt && (
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                                addSuffix: true,
                              })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Messages Area */}
                <div className="md:col-span-2 border rounded-md flex flex-col" data-testid="messages-area">
                  {selectedConversation ? (
                    <>
                      {/* Conversation Header */}
                      <div className="p-4 border-b">
                        <h3 className="font-semibold" data-testid="conversation-subject">
                          {selectedConversation.subject}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Started {formatDistanceToNow(new Date(selectedConversation.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>

                      {/* Messages */}
                      <ScrollArea className="flex-1 p-4">
                        {messagesLoading ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>Loading messages...</p>
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-messages">
                            <p className="text-sm">No messages yet. Start the conversation!</p>
                          </div>
                        ) : (
                          <div className="space-y-4" data-testid="messages-list">
                            {messages.map((message) => {
                              const isClient = message.senderType === "client";
                              return (
                                <div
                                  key={message.id}
                                  className={`flex gap-3 ${isClient ? "flex-row-reverse" : ""}`}
                                  data-testid={`message-${message.id}`}
                                >
                                  <div className="flex-shrink-0">
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                      isClient ? "bg-primary text-primary-foreground" : "bg-muted"
                                    }`}>
                                      <User className="h-4 w-4" />
                                    </div>
                                  </div>
                                  <div className={`flex-1 max-w-[70%] ${isClient ? "text-right" : ""}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className={`text-sm font-medium ${isClient ? "order-2" : ""}`}>
                                        {getSenderName(message)}
                                      </p>
                                      <p className={`text-xs text-muted-foreground ${isClient ? "order-1" : ""}`}>
                                        {formatDistanceToNow(new Date(message.createdAt), {
                                          addSuffix: true,
                                        })}
                                      </p>
                                    </div>
                                    <div
                                      className={`p-3 rounded-lg ${
                                        isClient
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted"
                                      }`}
                                    >
                                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </ScrollArea>

                      <Separator />

                      {/* Message Input */}
                      <div className="p-4">
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Type your message..."
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            className="resize-none"
                            rows={3}
                            data-testid="input-message"
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!messageContent.trim() || sendMessageMutation.isPending}
                            size="icon"
                            className="h-auto"
                            data-testid="button-send-message"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Press Enter to send, Shift+Enter for new line
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      <p>Select a conversation to view messages</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
