import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquare, Plus, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const { toast } = useToast();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["/api/conversations"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: messages } = useQuery({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    enabled: !!selectedConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/conversations", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewConversationOpen(false);
      toast({ title: "Conversation created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create conversation", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest(`/api/conversations/${selectedConversation.id}/messages`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setNewMessage("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    sendMessageMutation.mutate({
      content: newMessage,
      senderType: "staff",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">Secure Messages</h1>
        <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-conversation">
              <Plus className="w-4 h-4 mr-2" />
              New Conversation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createConversationMutation.mutate({
                  clientId: formData.get("clientId"),
                  subject: formData.get("subject"),
                  status: "active",
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">Client</label>
                <Select name="clientId" required>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  name="subject"
                  placeholder="Conversation subject"
                  required
                  data-testid="input-subject"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-create-conversation">
                Create Conversation
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              {conversations?.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No conversations yet</p>
              ) : (
                conversations?.map((conversation: any) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`p-4 border-b cursor-pointer hover-elevate ${
                      selectedConversation?.id === conversation.id ? "bg-accent" : ""
                    }`}
                    data-testid={`conversation-${conversation.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{conversation.subject || "No Subject"}</h4>
                      <Badge variant={conversation.status === "active" ? "default" : "secondary"}>
                        {conversation.status}
                      </Badge>
                    </div>
                    {conversation.lastMessageAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          {selectedConversation ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedConversation.subject}</CardTitle>
                  <Badge>{selectedConversation.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ScrollArea className="h-[calc(100vh-450px)] border rounded-md p-4">
                  {messages?.map((message: any) => (
                    <div
                      key={message.id}
                      className={`mb-4 ${
                        message.senderType === "staff" ? "text-right" : "text-left"
                      }`}
                    >
                      <div
                        className={`inline-block max-w-[70%] p-3 rounded-lg ${
                          message.senderType === "staff"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </p>
                      </div>
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
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
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
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view messages</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
