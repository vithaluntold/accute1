import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, Plus, Trash2, Edit2, CheckCircle, Calendar, User, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface Message {
  role: "user" | "assistant";
  content: string;
  taskExtraction?: TaskExtraction;
}

interface TaskExtraction {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assignee?: string;
  tags: string[];
  messageSubject: string;
  messageSender: string;
  status: "extracted" | "confirmed";
}

interface AgentSession {
  id: string;
  sessionId: string; // Unique session identifier for SSE
  name?: string;
  title?: string;
  agentSlug: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export default function LynkAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Lynk, your messaging intelligence specialist. I analyze client messages and convert them into actionable tasks. Share a client message or describe what needs to be done, and I'll help you create a structured task."
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [taskExtraction, setTaskExtraction] = useState<TaskExtraction | null>(null);
  
  // Session management state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  
  // LLM configuration state
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  
  // SSE streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const streamingResponseRef = useRef<string>("");
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize SSE for streaming
  const { sendMessage: sendSSEMessage, isStreaming } = useAgentSSE({
    onStreamStart: () => {
      streamingResponseRef.current = "";
      setStreamingMessage("");
    },
    onChunk: (chunk: string) => {
      streamingResponseRef.current += chunk;
      setStreamingMessage(streamingResponseRef.current);
    },
    onComplete: async (fullResponse: string) => {
      // Parse response for task extraction
      let taskExtraction = null;
      let responseText = fullResponse;
      
      try {
        const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[1]);
          if (jsonData.taskExtraction) {
            taskExtraction = jsonData.taskExtraction;
            responseText = fullResponse.split('```json')[0].trim();
          }
        }
      } catch (e) {
        console.error('[Lynk] Failed to parse task extraction:', e);
      }
      
      const assistantMessage: Message = {
        role: "assistant",
        content: responseText,
        taskExtraction,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (taskExtraction) {
        setTaskExtraction(taskExtraction);
      }
      
      // Save messages to session
      if (currentSessionId) {
        await apiRequest("POST", `/api/agents/lynk/sessions/${currentSessionId}/messages`, {
          role: "assistant",
          content: responseText,
          metadata: taskExtraction ? { taskExtraction } : {},
        });
      }
      
      // Clear streaming state
      setStreamingMessage("");
      streamingResponseRef.current = "";
      setIsLoading(false);
    },
    onError: (error: string) => {
      console.error('[Lynk SSE] Error:', error);
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      });
      setStreamingMessage("");
      streamingResponseRef.current = "";
      setIsLoading(false);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch LLM configurations
  const { data: llmConfigs = [] } = useQuery<any[]>({
    queryKey: ["/api/llm-configurations"],
  });

  // Auto-select default LLM config
  useEffect(() => {
    const defaultConfig = llmConfigs.find((c) => c.isDefault);
    if (defaultConfig && !selectedLlmConfig) {
      setSelectedLlmConfig(defaultConfig.id);
    }
  }, [llmConfigs, selectedLlmConfig]);

  // Fetch sessions
  const { data: sessions = [] } = useQuery<AgentSession[]>({
    queryKey: ["/api/agents/lynk/sessions"],
  });

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/agents/lynk/sessions", { title });
      return await response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/lynk/sessions"] });
      setCurrentSessionId(newSession.sessionId); // Use sessionId field, not id
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Lynk. Share a client message or describe a task to get started."
      }]);
      setTaskExtraction(null);
    },
  });

  const createSessionSilently = async (title: string) => {
    const response = await apiRequest("POST", "/api/agents/lynk/sessions", { title });
    const newSession = await response.json();
    queryClient.invalidateQueries({ queryKey: ["/api/agents/lynk/sessions"] });
    setCurrentSessionId(newSession.sessionId); // Use sessionId field, not id
    return newSession;
  };

  // Update session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("PATCH", `/api/agents/lynk/sessions/${id}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/lynk/sessions"] });
      setEditingSessionId(null);
      setEditingTitle("");
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("DELETE", `/api/agents/lynk/sessions/${sessionId}`, {});
      return await response.json();
    },
    onSuccess: (_data, deletedSessionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/lynk/sessions"] });
      if (currentSessionId === deletedSessionId) {
        setCurrentSessionId(null);
        setMessages([{
          role: "assistant",
          content: "Hi! I'm Lynk. Share a client message or describe a task to get started."
        }]);
        setTaskExtraction(null);
      }
    },
  });

  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    }
  }, [currentSessionId]);

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/agents/lynk/sessions/${sessionId}`, {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          taskExtraction: msg.metadata?.taskExtraction,
        }));
        setMessages(loadedMessages);
        
        const reversedCopy = [...loadedMessages].reverse();
        const lastMsgWithTask = reversedCopy.find(m => m.taskExtraction);
        if (lastMsgWithTask?.taskExtraction) {
          setTaskExtraction(lastMsgWithTask.taskExtraction);
        }
      }
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Error",
        description: "Failed to load session",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: "user", content: input };
    const userInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    streamingResponseRef.current = "";

    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const sessionTitle = `Message Session ${new Date().toLocaleDateString()}`;
        const newSession = await createSessionSilently(sessionTitle);
        sessionId = newSession.sessionId; // Use sessionId field, not id
      }

      // Save user message to session
      if (sessionId) {
        await apiRequest("POST", `/api/agents/lynk/sessions/${sessionId}/messages`, {
          role: "user",
          content: userInput,
        });
      }

      // Use SSE for streaming with real database sessionId
      try {
        await sendSSEMessage({
          agentSlug: 'lynk',
          message: userInput,
          sessionId: sessionId, // Real database sessionId
          llmConfigId: selectedLlmConfig,
          contextData: {
            history: messages,
            messageContent: userInput.length > 100 ? userInput : undefined,
          }
        });
      } catch (sseError) {
        // Fallback to HTTP if SSE fails
        console.log('[Lynk] SSE unavailable, using HTTP fallback');
        const response = await fetch("/api/agents/lynk/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            message: userInput, 
            history: messages,
            messageContent: userInput.length > 100 ? userInput : undefined,
            llmConfigId: selectedLlmConfig
          }),
        });

        const data = await response.json();
        const assistantMessage: Message = { 
          role: "assistant", 
          content: data.response,
          taskExtraction: data.taskExtraction
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        if (data.taskExtraction) {
          setTaskExtraction(data.taskExtraction);
        }

        if (sessionId) {
          await apiRequest("POST", `/api/agents/lynk/sessions/${sessionId}/messages`, {
            role: "assistant",
            content: data.response,
            metadata: data.taskExtraction ? { taskExtraction: data.taskExtraction } : {},
          });
        }
        
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please configure your AI provider in Settings > LLM Configuration."
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  const createTask = async () => {
    if (!taskExtraction) return;

    try {
      const response = await fetch("/api/agents/lynk/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: taskExtraction.title,
          description: taskExtraction.description,
          priority: taskExtraction.priority,
          dueDate: taskExtraction.dueDate,
          messageSubject: taskExtraction.messageSubject,
          messageSender: taskExtraction.messageSender,
          tags: taskExtraction.tags
        }),
      });

      if (response.ok) {
        toast({
          title: "Task Created",
          description: "Task successfully created from client message"
        });
        setTaskExtraction(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task.",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full pb-20">
      {/* Session Sidebar */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        <Card className="flex flex-col h-full mr-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Sessions
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => createSessionMutation.mutate(`Session ${sessions.length + 1}`)}
                disabled={createSessionMutation.isPending}
                data-testid="button-new-session"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className={`group p-2 rounded-md cursor-pointer hover-elevate ${
                      currentSessionId === session.sessionId ? "bg-accent" : ""
                    }`}
                    onClick={() => setCurrentSessionId(session.sessionId)}
                    data-testid={`session-${session.sessionId}`}
                  >
                    {editingSessionId === session.sessionId ? (
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateSessionMutation.mutate({ id: session.sessionId, name: editingTitle });
                          } else if (e.key === "Escape") {
                            setEditingSessionId(null);
                          }
                        }}
                        className="h-7 text-xs"
                        autoFocus
                        data-testid="input-edit-session"
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs truncate flex-1">{session.title || session.name || "Untitled"}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(session.sessionId);
                              setEditingTitle(session.title || session.name || "");
                            }}
                            data-testid={`button-edit-session-${session.sessionId}`}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSessionMutation.mutate(session.sessionId);
                            }}
                            data-testid={`button-delete-session-${session.sessionId}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          {llmConfigs.length > 0 && (
            <div className="p-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">AI Provider</span>
              </div>
              <Select value={selectedLlmConfig} onValueChange={setSelectedLlmConfig}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-llm-config">
                  <SelectValue placeholder="Select AI provider" />
                </SelectTrigger>
                <SelectContent>
                  {llmConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      <div className="flex items-center gap-2">
                        <span>{config.name}</span>
                        {config.isDefault && (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Card>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Main Chat Area */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full mx-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5" />
              Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                      data-testid={`message-${index}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {streamingMessage && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                      <p className="text-xs mt-1 opacity-70">Streaming...</p>
                    </div>
                  </div>
                )}
                {isLoading && !isStreaming && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm">Analyzing...</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Paste client message or describe task..."
                  disabled={isLoading || isStreaming}
                  data-testid="input-message"
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || isStreaming || !input.trim()}
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Task Preview Panel */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
        <Card className="flex flex-col h-full ml-2">
          <CardHeader className="border-b">
            <CardTitle className="text-sm">Extracted Task</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 overflow-auto">
            {taskExtraction ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <p className="text-sm font-medium mt-1" data-testid="task-title">{taskExtraction.title}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <p className="text-sm mt-1 text-muted-foreground" data-testid="task-description">
                    {taskExtraction.description}
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <div className="mt-1">
                      <Badge variant={getPriorityColor(taskExtraction.priority)} data-testid="task-priority">
                        {taskExtraction.priority}
                      </Badge>
                    </div>
                  </div>

                  {taskExtraction.dueDate && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm" data-testid="task-due-date">{taskExtraction.dueDate}</span>
                      </div>
                    </div>
                  )}
                </div>

                {taskExtraction.assignee && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Suggested Assignee</label>
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm" data-testid="task-assignee">{taskExtraction.assignee}</span>
                    </div>
                  </div>
                )}

                {taskExtraction.tags.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tags</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {taskExtraction.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs" data-testid={`task-tag-${index}`}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Message Subject</label>
                  <p className="text-sm mt-1" data-testid="message-subject">{taskExtraction.messageSubject}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sender</label>
                  <p className="text-sm mt-1" data-testid="message-sender">{taskExtraction.messageSender}</p>
                </div>

                <Button
                  onClick={createTask}
                  className="w-full"
                  data-testid="button-create-task"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No task extracted yet.</p>
                <p className="mt-1 text-xs">
                  Share a client message and I'll identify actionable tasks.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
