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
  DialogDescription,
} from "@/components/ui/dialog";
import { MessageSquare, Plus, Send, ListTodo } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function MessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [convertToTaskOpen, setConvertToTaskOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedStepId, setSelectedStepId] = useState<string>("");
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

  const { data: assignments } = useQuery({
    queryKey: ["/api/assignments"],
    enabled: convertToTaskOpen,
  });

  const { data: workflows } = useQuery({
    queryKey: ["/api/workflows"],
    enabled: convertToTaskOpen,
  });

  const { data: stages } = useQuery({
    queryKey: [`/api/workflows/${selectedWorkflowId}/stages`],
    enabled: !!selectedWorkflowId && convertToTaskOpen,
  });

  const { data: steps } = useQuery({
    queryKey: [`/api/workflows/stages/${selectedStageId}/steps`],
    enabled: !!selectedStageId && convertToTaskOpen,
  });

  const createConversationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/conversations", data),
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
      apiRequest("POST", `/api/conversations/${selectedConversation.id}/messages`, data),
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

  const convertToTaskMutation = useMutation({
    mutationFn: async (data: { stepId: string }) => {
      // Get all messages to create a comprehensive task description
      const messageContent = (messages as any[])
        ?.map((m: any) => `${m.senderType === "staff" ? "Staff" : "Client"}: ${m.content}`)
        .join("\n\n") || "";

      return await apiRequest("POST", `/api/workflows/steps/${data.stepId}/tasks`, {
        name: selectedConversation.subject || "Task from conversation",
        description: `Converted from conversation:\n\n${messageContent}`,
        type: "manual",
        status: "pending",
        priority: "medium",
        order: 0,
      });
    },
    onSuccess: () => {
      toast({ title: "Successfully converted to task" });
      setConvertToTaskOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to convert to task", variant: "destructive" });
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
                    {clients?.filter((client: any) => client.status === 'active').map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.companyName}
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConvertToTaskOpen(true)}
                      data-testid="button-convert-to-task"
                    >
                      <ListTodo className="w-4 h-4 mr-2" />
                      Convert to Task
                    </Button>
                    <Badge>{selectedConversation.status}</Badge>
                  </div>
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

      {/* Convert to Task Dialog */}
      <Dialog
        open={convertToTaskOpen}
        onOpenChange={(open) => {
          setConvertToTaskOpen(open);
          if (!open) {
            // Reset selections when dialog closes
            setSelectedWorkflowId("");
            setSelectedStageId("");
            setSelectedStepId("");
          }
        }}
      >
        <DialogContent data-testid="dialog-convert-to-task">
          <DialogHeader>
            <DialogTitle>Convert Conversation to Task</DialogTitle>
            <DialogDescription>
              Create a workflow task from this conversation. The conversation subject will become the task name, and all messages will be included in the task description.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedStepId) {
                convertToTaskMutation.mutate({ stepId: selectedStepId });
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium">Select Workflow</label>
              <Select
                name="workflowId"
                required
                value={selectedWorkflowId}
                onValueChange={(value) => {
                  setSelectedWorkflowId(value);
                  setSelectedStageId(""); // Reset stage when workflow changes
                  setSelectedStepId(""); // Reset step when workflow changes
                }}
              >
                <SelectTrigger data-testid="select-workflow">
                  <SelectValue placeholder="Choose a workflow" />
                </SelectTrigger>
                <SelectContent>
                  {(workflows as any[])?.map((workflow: any) => (
                    <SelectItem key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Select Stage</label>
              <Select
                name="stageId"
                required
                value={selectedStageId}
                onValueChange={(value) => {
                  setSelectedStageId(value);
                  setSelectedStepId(""); // Reset step when stage changes
                }}
                disabled={!selectedWorkflowId}
              >
                <SelectTrigger data-testid="select-stage">
                  <SelectValue placeholder={selectedWorkflowId ? "Choose a stage" : "Select workflow first"} />
                </SelectTrigger>
                <SelectContent>
                  {(stages as any[])?.map((stage: any) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Select Step</label>
              <Select
                name="stepId"
                required
                value={selectedStepId}
                onValueChange={setSelectedStepId}
                disabled={!selectedStageId}
              >
                <SelectTrigger data-testid="select-step">
                  <SelectValue placeholder={selectedStageId ? "Choose a step" : "Select stage first"} />
                </SelectTrigger>
                <SelectContent>
                  {(steps as any[])?.length > 0 ? (
                    (steps as any[]).map((step: any) => (
                      <SelectItem key={step.id} value={step.id}>
                        {step.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-steps" disabled>No steps available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConvertToTaskOpen(false)}
                data-testid="button-cancel-convert"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={convertToTaskMutation.isPending || !selectedStepId}
                data-testid="button-confirm-convert"
              >
                {convertToTaskMutation.isPending ? "Converting..." : "Create Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
