import { useState, useMemo } from "react";
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
import { MessagesSquare, Plus, Send, Reply, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { ChatMessage } from "@shared/schema";

interface MessageWithReplies extends ChatMessage {
  replies: MessageWithReplies[];
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
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const { toast } = useToast();

  const { data: channels } = useQuery({
    queryKey: ["/api/chat/channels"],
  });

  const { data: messages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/channels", selectedChannel?.id, "messages"],
    enabled: !!selectedChannel,
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-3xl font-display">Team Chat</h1>

      <div className="grid grid-cols-4 gap-6 h-[calc(100vh-200px)]">
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

        <Card className="col-span-3">
          {selectedChannel ? (
            <>
              <CardHeader>
                <CardTitle>#{selectedChannel.name}</CardTitle>
                {selectedChannel.description && (
                  <p className="text-sm text-muted-foreground">{selectedChannel.description}</p>
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
      </div>

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
    </div>
  );
}
