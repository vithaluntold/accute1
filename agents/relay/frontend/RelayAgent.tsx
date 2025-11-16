import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Inbox, Send, Plus, Trash2, Edit2, CheckCircle, Calendar, User, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAgentWebSocket } from "@/hooks/use-agent-websocket";
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
  emailSubject: string;
  emailSender: string;
  status: "extracted" | "confirmed";
}

interface AgentSession {
  id: string;
  name: string;
  agentSlug: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export default function RelayAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Relay, your inbox intelligence specialist. I analyze emails and convert them into actionable tasks. Paste an email or describe what needs to be done, and I'll help you create a structured task."
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
  
  // WebSocket streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const streamingResponseRef = useRef<string>("");
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize WebSocket for streaming
  const { isConnected, sendMessage: sendWebSocketMessage, isStreaming } = useAgentWebSocket({
    agentName: 'relay',
    onStreamChunk: (chunk: string) => {
      streamingResponseRef.current += chunk;
      setStreamingMessage(streamingResponseRef.current);
    },
    onStreamComplete: async (fullResponse: string) => {
      try {
        // Parse response for task extraction
        let taskExtraction = null;
        let responseText = fullResponse;
        
        // Try to extract JSON block for taskExtraction
        const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            if (jsonData.taskExtraction) {
              taskExtraction = jsonData.taskExtraction;
            }
            // Keep the conversational part before the JSON
            responseText = fullResponse.split('```json')[0].trim();
          } catch (e) {
            console.error('Failed to parse taskExtraction JSON:', e);
          }
        }
        
        const assistantMessage: Message = { 
          role: "assistant", 
          content: responseText,
          taskExtraction
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Update task extraction state if provided
        if (taskExtraction) {
          setTaskExtraction(taskExtraction);
        }
        
        // Clear streaming state
        setStreamingMessage("");
        streamingResponseRef.current = "";
        setIsLoading(false);
      } catch (error) {
        console.error('Error handling stream complete:', error);
        setStreamingMessage("");
        streamingResponseRef.current = "";
        setIsLoading(false);
      }
    },
    onError: (error: string) => {
      console.error('WebSocket error:', error);
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
    queryKey: ["/api/agents/relay/sessions"],
  });

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/agents/relay/sessions", { name });
      return await response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/relay/sessions"] });
      setCurrentSessionId(newSession.id);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Relay. Paste an email or describe a task to get started."
      }]);
      setTaskExtraction(null);
    },
  });

  const createSessionSilently = async (name: string) => {
    const response = await apiRequest("POST", "/api/agents/relay/sessions", { name });
    const newSession = await response.json();
    queryClient.invalidateQueries({ queryKey: ["/api/agents/relay/sessions"] });
    setCurrentSessionId(newSession.id);
    return newSession;
  };

  // Update session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("PATCH", `/api/agents/relay/sessions/${id}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/relay/sessions"] });
      setEditingSessionId(null);
      setEditingTitle("");
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/agents/relay/sessions/${id}`, {});
      return await response.json();
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/relay/sessions"] });
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null);
        setMessages([{
          role: "assistant",
          content: "Hi! I'm Relay. Paste an email or describe a task to get started."
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
      const response = await fetch(`/api/agents/relay/sessions/${sessionId}`, {
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
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const userInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    
    // Reset streaming state
    setStreamingMessage("");
    streamingResponseRef.current = "";

    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const sessionName = `Task Session ${new Date().toLocaleDateString()}`;
        const newSession = await createSessionSilently(sessionName);
        sessionId = newSession.id;
      }

      // Try WebSocket streaming first
      if (isConnected) {
        console.log('[Relay] Using WebSocket streaming');
        const sent = await sendWebSocketMessage({
          input: userInput,
          ...(selectedLlmConfig && { llmConfigId: selectedLlmConfig }),
        });
        
        if (!sent) {
          throw new Error('Failed to send WebSocket message');
        }
        
        // WebSocket callbacks will handle the streaming response
        // Don't set isLoading=false here - callbacks handle it
      } else {
        // Fallback to HTTP for non-streaming
        console.log('[Relay] WebSocket not connected, falling back to HTTP');
        const response = await fetch("/api/agents/relay/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            message: userInput, 
            history: messages,
            emailContent: userInput.includes("From:") || userInput.includes("Subject:") ? userInput : undefined,
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
        await apiRequest("POST", `/api/agents/relay/sessions/${sessionId}/messages`, {
          role: "user",
          content: userInput,
        });
        await apiRequest("POST", `/api/agents/relay/sessions/${sessionId}/messages`, {
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
      setStreamingMessage("");
      streamingResponseRef.current = "";
      setIsLoading(false);
    }
  };

  const createTask = async () => {
    if (!taskExtraction) return;

    try {
      const response = await fetch("/api/agents/relay/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: taskExtraction.title,
          description: taskExtraction.description,
          priority: taskExtraction.priority,
          dueDate: taskExtraction.dueDate,
          emailSubject: taskExtraction.emailSubject,
          emailSender: taskExtraction.emailSender,
          tags: taskExtraction.tags
        }),
      });

      if (response.ok) {
        toast({
          title: "Task Created",
          description: "Task successfully created from email"
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
                <Inbox className="h-4 w-4" />
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
                    key={session.id}
                    className={`group p-2 rounded-md cursor-pointer hover-elevate ${
                      currentSessionId === session.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setCurrentSessionId(session.id)}
                    data-testid={`session-${session.id}`}
                  >
                    {editingSessionId === session.id ? (
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateSessionMutation.mutate({ id: session.id, name: editingTitle });
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
                        <span className="text-xs truncate flex-1">{session.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(session.id);
                              setEditingTitle(session.name);
                            }}
                            data-testid={`button-edit-session-${session.id}`}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSessionMutation.mutate(session.id);
                            }}
                            data-testid={`button-delete-session-${session.id}`}
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

      <ResizableHandle />

      {/* Chat Panel */}
      <ResizablePanel defaultSize={40}>
        <Card className="flex flex-col h-full mx-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Relay - Inbox to Task Converter
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    }`}>
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <Separator />
            <div className="p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Paste an email or describe the task..."
                  disabled={isLoading}
                  data-testid="input-message"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={isLoading || !input.trim()}
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </ResizablePanel>

      <ResizableHandle />

      {/* Task Preview Panel */}
      <ResizablePanel defaultSize={40}>
        <Card className="flex flex-col h-full ml-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm">Task Preview</span>
              {taskExtraction && (
                <Button 
                  size="sm" 
                  onClick={createTask}
                  data-testid="button-create-task"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {taskExtraction ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{taskExtraction.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={getPriorityColor(taskExtraction.priority)}>
                        {taskExtraction.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{taskExtraction.status}</Badge>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Description:</h4>
                    <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
                      {taskExtraction.description}
                    </div>
                  </div>
                  
                  {taskExtraction.dueDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Due Date:</span>
                      <span>{taskExtraction.dueDate}</span>
                    </div>
                  )}
                  
                  {taskExtraction.assignee && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Assignee:</span>
                      <span>{taskExtraction.assignee}</span>
                    </div>
                  )}
                  
                  {taskExtraction.tags && taskExtraction.tags.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-2">Tags:</h4>
                        <div className="flex flex-wrap gap-2">
                          {taskExtraction.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  
                  <Separator />
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><span className="font-medium">Email Subject:</span> {taskExtraction.emailSubject}</div>
                    <div><span className="font-medium">From:</span> {taskExtraction.emailSender}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Paste an email or describe a task to extract it</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
