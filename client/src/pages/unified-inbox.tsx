import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, Mail, MessageSquare, Bell, Search, Star, Filter } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UnifiedConversation {
  id: string;
  type: 'email' | 'team_chat' | 'live_chat';
  subject: string;
  preview: string;
  participants: string[];
  lastMessageAt: string;
  unreadCount: number;
  isStarred?: boolean;
  clientName?: string;
  metadata: any;
}

interface UnifiedMessage {
  id: string;
  conversationId: string;
  type: string;
  content: string;
  sender: {
    id: string;
    name: string;
    email?: string;
  };
  createdAt: string;
  isRead: boolean;
  attachments: any[];
  metadata: any;
}

const CONVERSATION_TYPE_ICONS = {
  email: Mail,
  team_chat: MessageSquare,
  live_chat: Bell,
};

const CONVERSATION_TYPE_LABELS = {
  email: "Email",
  team_chat: "Team Chat",
  live_chat: "Live Chat",
};

export default function UnifiedInbox() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<UnifiedConversation | null>(null);

  // Fetch conversations with filters
  const { data: conversations, isLoading, error } = useQuery<UnifiedConversation[]>({
    queryKey: [
      "/api/unified-inbox/conversations",
      selectedType,
      searchQuery,
      showUnreadOnly
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('type', selectedType);
      if (searchQuery) params.append('search', searchQuery);
      if (showUnreadOnly) params.append('unreadOnly', 'true');
      
      const response = await fetch(`/api/unified-inbox/conversations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: messagesLoading } = useQuery<UnifiedMessage[]>({
    queryKey: [
      "/api/unified-inbox/conversations",
      selectedConversation?.id,
      "messages",
      selectedConversation?.type
    ],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const response = await fetch(
        `/api/unified-inbox/conversations/${selectedConversation.id}/messages?type=${selectedConversation.type}`
      );
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!selectedConversation,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (conversation: UnifiedConversation) => {
      if (conversation.type === 'team_chat') return; // Team chat doesn't support read status
      
      await apiRequest(`/api/unified-inbox/conversations/${conversation.id}/read`, {
        method: 'PATCH',
        body: { type: conversation.type },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-inbox/conversations"] });
    },
  });

  const handleConversationClick = (conversation: UnifiedConversation) => {
    setSelectedConversation(conversation);
    if (conversation.unreadCount > 0) {
      markAsReadMutation.mutate(conversation);
    }
  };

  const getTypeIcon = (type: string) => {
    const Icon = CONVERSATION_TYPE_ICONS[type as keyof typeof CONVERSATION_TYPE_ICONS] || Inbox;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Unified Inbox"
        description="All your communications in one place - email, chat, and portal messages"
        icon={Inbox}
      />
      
      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Conversations List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Conversations
                {conversations && (
                  <Badge variant="secondary" className="ml-auto">
                    {conversations.length}
                  </Badge>
                )}
              </CardTitle>
              
              {/* Search and Filters */}
              <div className="space-y-2 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-conversations"
                  />
                </div>
                
                <Tabs value={selectedType} onValueChange={setSelectedType}>
                  <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1" data-testid="tab-all">All</TabsTrigger>
                    <TabsTrigger value="email" className="flex-1" data-testid="tab-email">Email</TabsTrigger>
                    <TabsTrigger value="team_chat" className="flex-1" data-testid="tab-team-chat">Chat</TabsTrigger>
                    <TabsTrigger value="live_chat" className="flex-1" data-testid="tab-live-chat">Portal</TabsTrigger>
                  </TabsList>
                </Tabs>

                <Button
                  variant={showUnreadOnly ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                  data-testid="button-toggle-unread"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {showUnreadOnly ? "Show All" : "Unread Only"}
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {isLoading ? (
                  <div className="space-y-2 p-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="p-4 text-center text-destructive">
                    <p>Failed to load conversations</p>
                    <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
                  </div>
                ) : !conversations || conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations found</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`p-4 hover-elevate cursor-pointer transition-colors ${
                          selectedConversation?.id === conversation.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => handleConversationClick(conversation)}
                        data-testid={`conversation-${conversation.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {getTypeIcon(conversation.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium truncate">{conversation.subject}</p>
                              {conversation.unreadCount > 0 && (
                                <Badge variant="default" className="ml-2">{conversation.unreadCount}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {conversation.preview}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {CONVERSATION_TYPE_LABELS[conversation.type as keyof typeof CONVERSATION_TYPE_LABELS]}
                              </Badge>
                              {conversation.clientName && (
                                <Badge variant="secondary" className="text-xs">
                                  {conversation.clientName}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto">
                                {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Message Thread */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedConversation ? selectedConversation.subject : "Select a conversation"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedConversation ? (
                <div className="text-center text-muted-foreground py-12">
                  <Inbox className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No conversation selected</p>
                  <p className="text-sm">Select a conversation from the left to view messages</p>
                </div>
              ) : messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : !messages || messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No messages in this conversation</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className="border rounded-lg p-4"
                        data-testid={`message-${message.id}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{message.sender.name}</p>
                            {message.sender.email && (
                              <p className="text-sm text-muted-foreground">{message.sender.email}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2">
                            <Badge variant="outline">{message.attachments.length} attachment(s)</Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
