import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessagesSquare, Plus, Send, Reply, X, Phone, Video, PhoneOff, History } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { ChatMessage } from "@shared/schema";
import { useTeamChatWebSocket } from "@/hooks/useTeamChatWebSocket";
import IncomingCallModal from "@/components/IncomingCallModal";
import VideoCallWindow from "@/components/VideoCallWindow";
import CallHistoryDialog from "@/components/CallHistoryDialog";

interface MessageWithReplies extends ChatMessage {
  replies: MessageWithReplies[];
}

interface ChannelMember {
  id: string;
  userId: string;
  channelId: string;
  role: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

// Recursive message thread component
function MessageThread({ 
  message, 
  depth = 0,
  onReply
}: { 
  message: MessageWithReplies; 
  depth?: number;
  onReply: (msg: ChatMessage) => void;
}) {
  // Cap indentation at 3 levels but render all messages
  const maxIndentDepth = 3;
  const indentLevel = Math.min(depth, maxIndentDepth);
  const shouldIndent = indentLevel > 0;
  
  return (
    <div className={shouldIndent ? "ml-8 border-l-2 border-primary/30 pl-4" : ""}>
      {/* Render the message */}
      <div className="flex gap-3 group mb-3">
        <Avatar className={depth > 0 ? "h-7 w-7" : "h-8 w-8"}>
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-sm">User</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm mt-1">{message.content}</p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onReply(message)}
              data-testid={`button-reply-${message.id}`}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
            {message.replies?.length > 0 && (
              <Badge variant="secondary" className="h-5 text-xs" data-testid={`badge-reply-count-${message.id}`}>
                {message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* Recursively render ALL replies (indentation capped but all messages shown) */}
      {message.replies?.length > 0 && (
        <div className="mt-2 space-y-2">
          {message.replies.map((reply) => (
            <MessageThread 
              key={reply.id} 
              message={reply} 
              depth={depth + 1}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamChatPage() {
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const { toast } = useToast();

  // Get current user from query
  const { data: currentUser } = useQuery({
    queryKey: ["/api/users/me"],
  });

  const { data: channels } = useQuery({
    queryKey: ["/api/chat/channels"],
  });

  const { data: messages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/channels", selectedChannel?.id, "messages"],
    enabled: !!selectedChannel,
  });

  const { data: members = [] } = useQuery<ChannelMember[]>({
    queryKey: ["/api/chat/channels", selectedChannel?.id, "members"],
    enabled: !!selectedChannel,
  });

  // WebRTC WebSocket integration
  const webRTCSocket = useTeamChatWebSocket({
    channelId: selectedChannel?.id || null,
    userId: currentUser?.id || "",
    onError: (error) => {
      toast({
        title: "WebRTC Error",
        description: error,
        variant: "destructive",
      });
    },
  });

  // Build message tree with all levels
  const buildMessageTree = useMemo(() => {
    if (!messages) return [];
    
    // Create map of all messages by ID for quick lookup
    const messageMap = new Map(messages.map(m => [m.id, { ...m, replies: [] as MessageWithReplies[] }]));
    
    // Separate root messages from replies
    const rootMessages: MessageWithReplies[] = [];
    
    messages.forEach(msg => {
      if (!msg.parentMessageId) {
        // This is a root message
        rootMessages.push(messageMap.get(msg.id)!);
      } else {
        // This is a reply - attach to parent
        const parent = messageMap.get(msg.parentMessageId);
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

  const createChannelMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/chat/channels", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
      setCreateDialogOpen(false);
      setNewChannelName("");
      setNewChannelDescription("");
      setSelectedChannel(data);
      toast({
        title: "Success",
        description: "Channel created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create channel",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/chat/channels/${selectedChannel.id}/messages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/channels", selectedChannel.id, "messages"],
      });
      setNewMessage("");
      setReplyToMessage(null);
    },
  });

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) {
      toast({
        title: "Validation Error",
        description: "Channel name is required",
        variant: "destructive",
      });
      return;
    }
    
    createChannelMutation.mutate({
      name: newChannelName,
      description: newChannelDescription,
      type: "group",
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChannel) return;
    
    sendMessageMutation.mutate({
      content: newMessage,
      parentMessageId: replyToMessage?.id || null,
    });
  };

  const handleReply = (message: ChatMessage) => {
    setReplyToMessage(message);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleStartCall = async (memberId: string, callType: 'audio' | 'video') => {
    if (!currentUser) {
      toast({
        title: "Error",
        description: "You must be logged in to start a call",
        variant: "destructive",
      });
      return;
    }

    if (!webRTCSocket.isConnected) {
      toast({
        title: "Error",
        description: "Not connected to chat server. Please wait...",
        variant: "destructive",
      });
      return;
    }

    try {
      await webRTCSocket.startCall(memberId, callType);
      toast({
        title: "Call initiated",
        description: `${callType === 'audio' ? 'Audio' : 'Video'} call started`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start call",
        variant: "destructive",
      });
    }
  };

  const handleAcceptCall = async () => {
    if (!webRTCSocket.incomingCall) {
      return;
    }

    if (!webRTCSocket.isConnected) {
      toast({
        title: "Error",
        description: "Connection lost. Unable to accept call.",
        variant: "destructive",
      });
      return;
    }

    try {
      await webRTCSocket.acceptCall(
        webRTCSocket.incomingCall.callId,
        webRTCSocket.incomingCall.callType
      );
      toast({
        title: "Call accepted",
        description: "Connected to call",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept call",
        variant: "destructive",
      });
    }
  };

  const handleRejectCall = () => {
    if (!webRTCSocket.incomingCall) {
      return;
    }

    webRTCSocket.rejectCall(webRTCSocket.incomingCall.callId);
    toast({
      title: "Call rejected",
      description: "Call declined",
    });
  };

  const handleEndCall = () => {
    webRTCSocket.endCall();
  };

  // Hook handles connection automatically based on channelId changes

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">Team Chat</h1>
        <Button
          variant="outline"
          onClick={() => setCallHistoryOpen(true)}
          data-testid="button-call-history"
        >
          <History className="h-4 w-4 mr-2" />
          Call History
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-6 h-[calc(100vh-200px)]">
        {/* Channels Sidebar */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Channels</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCreateDialogOpen(true)}
              data-testid="button-new-channel"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              {channels?.map((channel: any) => (
                <div
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className={`p-4 border-b cursor-pointer hover-elevate ${
                    selectedChannel?.id === channel.id ? "bg-accent" : ""
                  }`}
                  data-testid={`channel-${channel.id}`}
                >
                  <h4 className="font-medium">#{channel.name}</h4>
                  {channel.description && (
                    <p className="text-xs text-muted-foreground mt-1">{channel.description}</p>
                  )}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages Area */}
        <Card className="col-span-4">
          {selectedChannel ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>#{selectedChannel.name}</CardTitle>
                  {selectedChannel.description && (
                    <p className="text-sm text-muted-foreground">{selectedChannel.description}</p>
                  )}
                </div>
                {webRTCSocket.isConnected && (
                  <Badge variant="outline" className="gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Connected
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ScrollArea className="h-[calc(100vh-450px)] border rounded-md p-4">
                  <div className="space-y-4">
                    {buildMessageTree.map(rootMessage => (
                      <div key={rootMessage.id} data-testid={`thread-${rootMessage.id}`}>
                        <MessageThread 
                          message={rootMessage} 
                          depth={0} 
                          onReply={handleReply}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>

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
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1"
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    data-testid="button-send-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessagesSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a channel to view messages</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Members Sidebar */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Members</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              {selectedChannel ? (
                <div className="space-y-2 p-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 p-2 rounded-md hover-elevate"
                      data-testid={`member-${member.userId}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {member.user?.name?.substring(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.user?.name || member.user?.email || 'Unknown'}
                        </p>
                        {member.role === 'admin' && (
                          <Badge variant="secondary" className="h-4 text-xs">Admin</Badge>
                        )}
                      </div>
                      {currentUser && member.userId !== currentUser.id && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleStartCall(member.userId, 'audio')}
                            disabled={!webRTCSocket.isConnected || webRTCSocket.webRTC.callState !== 'idle'}
                            data-testid={`button-audio-call-${member.userId}`}
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleStartCall(member.userId, 'video')}
                            disabled={!webRTCSocket.isConnected || webRTCSocket.webRTC.callState !== 'idle'}
                            data-testid={`button-video-call-${member.userId}`}
                          >
                            <Video className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground p-4">
                  Select a channel to view members
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Incoming Call Modal */}
      {webRTCSocket.incomingCall && (
        <IncomingCallModal
          isOpen={!!webRTCSocket.incomingCall}
          callerName={webRTCSocket.incomingCall.callerName || 'Unknown'}
          callType={webRTCSocket.incomingCall.callType}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Video Call Window */}
      {webRTCSocket.callState === 'active' && (
        <VideoCallWindow
          isOpen={true}
          callType={webRTCSocket.activeCall?.callType || 'audio'}
          localStream={webRTCSocket.webRTC.localStream}
          remoteStream={webRTCSocket.webRTC.remoteStream}
          onToggleMute={() => webRTCSocket.webRTC.toggleMute()}
          onToggleVideo={() => webRTCSocket.webRTC.toggleVideo()}
          onToggleScreenShare={() => webRTCSocket.webRTC.toggleScreenShare()}
          onHangUp={handleEndCall}
          isMuted={webRTCSocket.webRTC.isMuted}
          isVideoOff={webRTCSocket.webRTC.isVideoOff}
          isScreenSharing={webRTCSocket.webRTC.isScreenSharing}
        />
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-channel">
          <DialogHeader>
            <DialogTitle>Create New Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="channel-name">Channel Name</Label>
              <Input
                id="channel-name"
                placeholder="e.g., general, random, team-updates"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                data-testid="input-channel-name"
              />
            </div>
            <div>
              <Label htmlFor="channel-description">Description (Optional)</Label>
              <Textarea
                id="channel-description"
                placeholder="What's this channel about?"
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                data-testid="input-channel-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              data-testid="button-cancel-channel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateChannel}
              disabled={createChannelMutation.isPending}
              data-testid="button-create-channel"
            >
              {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call History Dialog */}
      <CallHistoryDialog
        isOpen={callHistoryOpen}
        onClose={() => setCallHistoryOpen(false)}
        channelId={selectedChannel?.id}
      />
    </div>
  );
}
