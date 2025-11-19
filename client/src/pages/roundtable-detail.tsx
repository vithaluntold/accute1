import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useRoundtableSSE } from '@/hooks/use-roundtable-sse';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import {
  Users,
  MessageSquare,
  Send,
  Presentation,
  X,
  CheckCircle2,
  XCircle,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type {
  RoundtableSession,
  RoundtableParticipant,
  RoundtableMessage,
} from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function RoundtableDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const privateMessageInputRef = useRef<HTMLTextAreaElement>(null);
  
  const [messageContent, setMessageContent] = useState('');
  const [privateMessageContent, setPrivateMessageContent] = useState('');
  const [selectedPrivateChat, setSelectedPrivateChat] = useState<string | null>(null);

  // Fetch session data
  const { data: sessionData, isLoading } = useQuery<{
    session: RoundtableSession;
    messages: RoundtableMessage[];
    participants: RoundtableParticipant[];
  }>({
    queryKey: [`/api/roundtable/sessions/${id}`],
    enabled: !!id,
  });

  // SSE connection for real-time updates
  const {
    isConnected,
    isReconnecting,
    error: sseError,
    participants: liveParticipants,
    messages: liveMessages,
    privateMessages,
    typingParticipants,
    currentPresentation,
    sendMessage,
    sendPrivateMessage,
    startTyping,
    stopTyping,
    presentDeliverable,
    endPresentation,
  } = useRoundtableSSE({
    sessionId: id || null,
    onNewMessage: () => {
      // Message received, auto-scroll handled by useEffect
    },
    onAgentResponse: () => {
      toast({
        title: 'Agent Response',
        description: 'An agent has responded',
      });
    },
    onError: (error) => {
      toast({
        title: 'Connection Error',
        description: error,
        variant: 'destructive',
      });
    },
  });

  // Merge initial data with live data
  const allMessages = [...(sessionData?.messages || []), ...liveMessages];
  const allParticipants = liveParticipants.length > 0 
    ? liveParticipants 
    : sessionData?.participants || [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  // Handle message send
  const handleSendMessage = () => {
    if (messageContent.trim()) {
      sendMessage(messageContent);
      setMessageContent('');
      stopTyping();
    }
  };

  // Handle private message send
  const handleSendPrivateMessage = () => {
    if (privateMessageContent.trim() && selectedPrivateChat) {
      sendPrivateMessage(selectedPrivateChat, privateMessageContent);
      setPrivateMessageContent('');
    }
  };

  // Handle typing indicators
  const handleTyping = () => {
    startTyping();
  };

  // Add agent to session
  const handleAddAgent = async (agentSlug: string) => {
    try {
      await apiRequest('POST', `/api/roundtable/sessions/${id}/participants`, { agentSlug });
      
      toast({
        title: 'Agent Added',
        description: `${agentSlug} has joined the roundtable`,
      });

      queryClient.invalidateQueries({ queryKey: [`/api/roundtable/sessions/${id}`] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add agent',
        variant: 'destructive',
      });
    }
  };

  // Approve deliverable
  const handleApproveDeliverable = async (deliverableId: string) => {
    try {
      await apiRequest('POST', `/api/roundtable/deliverables/${deliverableId}/approve`, { 
        feedback: 'Approved via Roundtable' 
      });

      toast({
        title: 'Deliverable Approved',
        description: 'The deliverable has been saved as a template',
      });

      queryClient.invalidateQueries({ queryKey: [`/api/roundtable/sessions/${id}`] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve deliverable',
        variant: 'destructive',
      });
    }
  };

  // Reject deliverable
  const handleRejectDeliverable = async (deliverableId: string) => {
    try {
      await apiRequest('POST', `/api/roundtable/deliverables/${deliverableId}/reject`, { 
        feedback: 'Needs revision' 
      });

      toast({
        title: 'Deliverable Rejected',
        description: 'The agent has been notified',
      });

      queryClient.invalidateQueries({ queryKey: [`/api/roundtable/sessions/${id}`] });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject deliverable',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" data-testid="loading-roundtable">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const availableAgents = [
    { slug: 'luca', name: 'Luca', role: 'Project Manager' },
    { slug: 'cadence', name: 'Cadence', role: 'Workflow Specialist' },
    { slug: 'forma', name: 'Forma', role: 'Form Builder' },
    { slug: 'echo', name: 'Echo', role: 'Email Specialist' },
    { slug: 'radar', name: 'Radar', role: 'Risk Assessment' },
    { slug: 'parity', name: 'Parity', role: 'Legal Specialist' },
    { slug: 'scribe', name: 'Scribe', role: 'Document Generator' },
    { slug: 'relay', name: 'Relay', role: 'Communication Hub' },
    { slug: 'lynk', name: 'Lynk', role: 'Integration Specialist' },
    { slug: 'omnispectra', name: 'OmniSpectra', role: 'Analytics Expert' },
  ];

  const activeAgentSlugs = allParticipants
    .filter(p => p.participantType === 'agent')
    .map(p => p.participantId);

  return (
    <div className="flex h-screen flex-col" data-testid="roundtable-detail">
      {/* Header */}
      <div className="shrink-0 border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold font-orbitron">
              AI Roundtable
            </h1>
            <p className="text-sm text-muted-foreground">
              {sessionData?.session?.objective || 'Loading...'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
                Connected
              </Badge>
            ) : isReconnecting ? (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                Reconnecting...
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-600">
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - 3 Panel Layout with Resizable Panels */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Left Panel - Agents List */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <Card className="h-full rounded-none border-l-0 border-t-0 border-b-0">
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <h2 className="font-semibold">Team</h2>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-1 p-2">
                {allParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 rounded-md p-2 hover-elevate"
                    data-testid={`participant-${participant.participantId}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {participant.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {participant.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {participant.role || participant.participantType}
                      </p>
                    </div>
                    {participant.status === 'active' && (
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Add Agent
                </p>
                {availableAgents.map((agent) => (
                  <Button
                    key={agent.slug}
                    variant={activeAgentSlugs.includes(agent.slug) ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleAddAgent(agent.slug)}
                    disabled={activeAgentSlugs.includes(agent.slug)}
                    data-testid={`button-add-agent-${agent.slug}`}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {agent.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Main Discussion */}
        <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {allMessages
                  .filter(m => m.channelType === 'main')
                  .map((message) => (
                    <div
                      key={message.id}
                      className="flex items-start gap-3"
                      data-testid={`message-${message.id}`}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {message.senderName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-sm">
                            {message.senderName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Message Input */}
          <div className="border-t p-4 shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={messageInputRef}
                placeholder="Type your message..."
                value={messageContent}
                onChange={(e) => {
                  setMessageContent(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="min-h-[40px] max-h-[96px] resize-none overflow-y-auto"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  const newHeight = Math.min(target.scrollHeight, 96);
                  target.style.height = newHeight + 'px';
                }}
                data-testid="input-main-message"
              />
              <Button 
                onClick={handleSendMessage}
                size="icon"
                className="shrink-0"
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {typingParticipants.size > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Someone is typing...
              </p>
            )}
          </div>
        </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Private Chats */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
        <Card className="h-full rounded-none border-r-0 border-t-0 border-b-0">
          <Tabs value={selectedPrivateChat || undefined} className="h-full flex flex-col">
            <div className="border-b p-4 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <h2 className="font-semibold">Private Chats</h2>
              </div>
            </div>

            <TabsList className="w-full rounded-none border-b">
              {allParticipants
                .filter(p => p.participantType === 'agent')
                .map((participant) => (
                  <TabsTrigger
                    key={participant.id}
                    value={participant.id}
                    onClick={() => setSelectedPrivateChat(participant.id)}
                    className="flex-1"
                    data-testid={`tab-private-chat-${participant.participantId}`}
                  >
                    {participant.displayName}
                  </TabsTrigger>
                ))}
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {selectedPrivateChat && (
                <TabsContent value={selectedPrivateChat} className="h-full flex flex-col m-0">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {(privateMessages[selectedPrivateChat] || []).map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.senderType === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`rounded-lg p-2 max-w-[80%] ${
                              message.senderType === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="border-t p-4 shrink-0">
                    <div className="flex gap-2 items-end">
                      <Textarea
                        ref={privateMessageInputRef}
                        placeholder="Private message..."
                        value={privateMessageContent}
                        onChange={(e) => setPrivateMessageContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendPrivateMessage();
                          }
                        }}
                        className="min-h-[40px] max-h-[96px] resize-none overflow-y-auto"
                        rows={1}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          const newHeight = Math.min(target.scrollHeight, 96);
                          target.style.height = newHeight + 'px';
                        }}
                        data-testid="input-private-message"
                      />
                      <Button 
                        size="icon"
                        className="shrink-0"
                        onClick={handleSendPrivateMessage}
                        data-testid="button-send-private-message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        </Card>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Bottom Panel - Screenshare/Presentation */}
      {currentPresentation && (
        <Card className="shrink-0 border-l-0 border-r-0 border-b-0 rounded-none">
          <div className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Presentation className="h-5 w-5" />
                <div>
                  <h3 className="font-semibold">
                    {currentPresentation.deliverable.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Presented by {currentPresentation.presenterName}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApproveDeliverable(currentPresentation.deliverable.id)}
                  data-testid="button-approve-deliverable"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve & Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRejectDeliverable(currentPresentation.deliverable.id)}
                  data-testid="button-reject-deliverable"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <pre className="text-sm overflow-auto max-h-64">
                {JSON.stringify(currentPresentation.deliverable.payload, null, 2)}
              </pre>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
