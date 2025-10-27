import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessagesSquare, Plus, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function TeamChatPage() {
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();

  const { data: channels } = useQuery({
    queryKey: ["/api/chat/channels"],
  });

  const { data: messages } = useQuery({
    queryKey: ["/api/chat/channels", selectedChannel?.id, "messages"],
    enabled: !!selectedChannel,
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
          <CardHeader>
            <CardTitle className="text-lg">Channels</CardTitle>
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
    </div>
  );
}
