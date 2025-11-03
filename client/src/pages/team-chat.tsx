import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessagesSquare, Plus, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function TeamChatPage() {
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const { toast } = useToast();

  const { data: channels } = useQuery({
    queryKey: ["/api/chat/channels"],
  });

  const { data: messages } = useQuery({
    queryKey: ["/api/chat/channels", selectedChannel?.id, "messages"],
    enabled: !!selectedChannel,
  });

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
    });
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
                  {messages?.map((message: any) => (
                    <div key={message.id} className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-sm">User</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{message.content}</p>
                    </div>
                  ))}
                </ScrollArea>
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
