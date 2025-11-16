import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, Send, Sparkles, Workflow, Plus, ArrowRight, Clock, CheckCircle2, Upload, FileText, MessageSquare, Trash2, Edit2, Store, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AgentTodoList, type TodoItem } from "@/components/agent-todo-list";
import { getUser } from "@/lib/auth";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Message {
  role: "user" | "assistant";
  content: string;
  workflowUpdate?: WorkflowState;
}

interface WorkflowState {
  name: string;
  description?: string;
  stages: Stage[];
  status: "building" | "complete";
}

interface Stage {
  id: string;
  name: string;
  order: number;
  steps: Step[];
}

interface Step {
  id: string;
  name: string;
  description?: string;
  order: number;
  status: "pending" | "added" | "complete";
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

export default function CadenceAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Cadence, your workflow builder. I can help you in two ways:\n\n1️⃣ Conversational Building:\n   • Describe your workflow and I'll build it with you\n\n2️⃣ Upload a Document:\n   • Upload a workflow specification (PDF, DOCX, XLSX, TXT)\n   • I'll extract the hierarchy and create your workflow automatically\n   • Document should contain: Workflow > Stages > Steps > Tasks structure\n\nHow would you like to start?"
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Session management state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showSessionSidebar, setShowSessionSidebar] = useState(true);
  
  // Marketplace template state
  const [marketplaceTemplateId, setMarketplaceTemplateId] = useState<string | null>(null);
  const [marketplaceMetadata, setMarketplaceMetadata] = useState<{
    name?: string;
    description?: string;
    category?: string;
  }>({});
  
  // LLM configuration state
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read marketplace template params from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("marketplaceTemplateId");
    const name = params.get("name");
    const description = params.get("description");
    const category = params.get("category");

    if (templateId) {
      setMarketplaceTemplateId(templateId);
      setMarketplaceMetadata({ name: name || undefined, description: description || undefined, category: category || undefined });
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch sessions
  const { data: sessions = [] } = useQuery<AgentSession[]>({
    queryKey: ["/api/agents/cadence/sessions"],
  });

  // Fetch available LLM configurations
  const { data: llmConfigs = [] } = useQuery<any[]>({
    queryKey: ["/api/llm-configurations"],
  });

  // Auto-select default LLM config (or first available)
  useEffect(() => {
    if (llmConfigs.length > 0 && !selectedLlmConfig) {
      const defaultConfig = llmConfigs.find((c) => c.isDefault);
      const configToSelect = defaultConfig || llmConfigs[0];
      if (configToSelect) {
        setSelectedLlmConfig(configToSelect.id);
      }
    }
  }, [llmConfigs, selectedLlmConfig]);

  // Create new session (explicit creation via UI button)
  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/agents/cadence/sessions", { name });
      return await response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/cadence/sessions"] });
      setCurrentSessionId(newSession.id);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Cadence, your workflow builder. What workflow would you like to create?"
      }]);
      setWorkflowState(null);
    },
  });

  // Create session implicitly (for sendMessage without resetting messages)
  const createSessionSilently = async (name: string) => {
    const response = await apiRequest("POST", "/api/agents/cadence/sessions", { name });
    const newSession = await response.json();
    queryClient.invalidateQueries({ queryKey: ["/api/agents/cadence/sessions"] });
    setCurrentSessionId(newSession.id);
    return newSession;
  };

  // Update session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("PATCH", `/api/agents/cadence/sessions/${id}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/cadence/sessions"] });
      setEditingSessionId(null);
      setEditingTitle("");
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/agents/cadence/sessions/${id}`, {});
      return await response.json();
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/cadence/sessions"] });
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null);
        setMessages([{
          role: "assistant",
          content: "Hi! I'm Cadence. What workflow would you like to create?"
        }]);
        setWorkflowState(null);
      }
    },
  });

  // Load session messages when switching sessions
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    }
  }, [currentSessionId]);

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/agents/cadence/sessions/${sessionId}`, {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          workflowUpdate: msg.metadata?.workflowUpdate,
        }));
        setMessages(loadedMessages);
        
        // Restore last workflow if exists (use a copy to avoid mutation)
        const reversedCopy = [...loadedMessages].reverse();
        const lastMsgWithWorkflow = reversedCopy.find(m => m.workflowUpdate);
        if (lastMsgWithWorkflow?.workflowUpdate) {
          setWorkflowState(lastMsgWithWorkflow.workflowUpdate);
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
    const userInput = input; // Save before clearing
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Create session if needed
      let sessionId = currentSessionId;
      if (!sessionId) {
        const sessionName = `Workflow Session ${new Date().toLocaleDateString()}`;
        const newSession = await createSessionSilently(sessionName);
        sessionId = newSession.id;
      }

      const response = await fetch("/api/agents/cadence/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          message: userInput, 
          history: messages,
          currentWorkflow: workflowState,
          ...(selectedLlmConfig && { llmConfigId: selectedLlmConfig })
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response,
        workflowUpdate: data.workflowUpdate
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update workflow state if provided
      if (data.workflowUpdate) {
        setWorkflowState(data.workflowUpdate);
      }

      // Persist messages to session
      if (sessionId) {
        await apiRequest("POST", `/api/agents/cadence/sessions/${sessionId}/messages`, {
          role: "user",
          content: userInput,
        });
        await apiRequest("POST", `/api/agents/cadence/sessions/${sessionId}/messages`, {
          role: "assistant",
          content: data.response,
          metadata: data.workflowUpdate ? { workflowUpdate: data.workflowUpdate } : {},
        });
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsLoading(true);
    setTodos([
      { id: "1", content: "Uploading document...", status: "in_progress" },
      { id: "2", content: "Parsing document content", status: "pending" },
      { id: "3", content: "Extracting workflow structure", status: "pending" },
      { id: "4", content: "Creating stages and steps", status: "pending" },
      { id: "5", content: "Finalizing workflow", status: "pending" }
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedLlmConfig) {
        formData.append("llmConfigId", selectedLlmConfig);
      }

      setMessages(prev => [...prev, {
        role: "user",
        content: `📄 Uploaded document: ${file.name}`
      }]);

      setTodos(prev => prev.map(t => 
        t.id === "1" ? { ...t, status: "completed" as const } :
        t.id === "2" ? { ...t, status: "in_progress" as const } : t
      ));

      const response = await fetch("/api/agents/cadence/upload-document", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      
      setTodos(prev => prev.map(t => ({ ...t, status: "completed" as const })));
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        workflowUpdate: data.workflowUpdate
      }]);

      if (data.workflowUpdate) {
        setWorkflowState(data.workflowUpdate);
      }

      const totalSteps = data.workflowUpdate?.stages.reduce((acc: number, stage: Stage) => acc + stage.steps.length, 0) || 0;
      toast({
        title: "Document processed",
        description: `Created workflow with ${data.workflowUpdate?.stages.length || 0} stages and ${totalSteps} steps.`
      });

      setTodos([]);
      setUploadedFile(null);
    } catch (error) {
      console.error("Upload error:", error);
      setTodos([]);
      toast({
        title: "Upload failed",
        description: "Failed to process document. Please try again.",
        variant: "destructive"
      });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I couldn't process that document. Please try again or describe your workflow requirements instead."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full pb-20">
      {/* Session Sidebar */}
      {showSessionSidebar && (
        <>
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
                        key={session.id}
                        className={`group p-2 rounded-md cursor-pointer hover-elevate ${
                          currentSessionId === session.id ? "bg-accent" : ""
                        }`}
                        onClick={() => setCurrentSessionId(session.id)}
                        data-testid={`session-${session.id}`}
                      >
                        {editingSessionId === session.id ? (
                          <div className="flex items-center gap-1">
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
                          </div>
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
                                data-testid="button-edit-session"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Delete this session?")) {
                                    deleteSessionMutation.mutate(session.id);
                                  }
                                }}
                                data-testid="button-delete-session"
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
              <CardFooter className="border-t p-3">
                <div className="w-full space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Settings2 className="h-3 w-3" />
                    <span>LLM Configuration</span>
                  </div>
                  <Select value={selectedLlmConfig} onValueChange={setSelectedLlmConfig}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-llm-config">
                      <SelectValue placeholder="Select LLM..." />
                    </SelectTrigger>
                    <SelectContent>
                      {llmConfigs.map((config: any) => (
                        <SelectItem key={config.id} value={config.id} className="text-xs">
                          {config.name}
                          {config.isDefault && <Badge variant="secondary" className="ml-2 text-[10px] h-4">Default</Badge>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardFooter>
            </Card>
          </ResizablePanel>
          <ResizableHandle />
        </>
      )}

      {/* Chat Interface */}
      <ResizablePanel defaultSize={showSessionSidebar ? 40 : 50} minSize={30}>
        <Card className="flex flex-col h-full mr-2">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Cadence
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Workflow timing and scheduling optimizer
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        
        {/* Marketplace Banner */}
        {marketplaceTemplateId && (
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-2 text-sm flex items-center gap-2">
            <Store className="h-4 w-4" />
            <div className="flex-1">
              <strong>Marketplace Mode:</strong> Building template "{marketplaceMetadata.name || 'Untitled'}"
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              Global Template
            </Badge>
          </div>
        )}
        
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-start">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-lg max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted p-3 rounded-lg animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          {/* Todo List - shown during document processing */}
          {todos.length > 0 && (
            <div className="px-4 pt-4">
              <AgentTodoList todos={todos} title="Processing Document" />
            </div>
          )}

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.txt"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                variant="outline"
                size="icon"
                title="Upload workflow document"
                data-testid="button-upload-document"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Describe the workflow you want to build..."
                disabled={isLoading}
                data-testid="input-cadence-message"
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                data-testid="button-send-message"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Panel - Live Workflow Preview */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full ml-2">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Live Workflow Preview
            {workflowState?.status === "complete" && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Badge>
            )}
            {workflowState?.status === "building" && (
              <Badge variant="secondary" className="gap-1 animate-pulse">
                <Clock className="h-3 w-3" />
                Building...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-auto">
          <ScrollArea className="h-full p-6" type="always">
            {!workflowState ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400/20 to-pink-500/20 flex items-center justify-center mb-4">
                  <Workflow className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Workflow Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Start chatting with Cadence to build your workflow. I'll show you the workflow structure as we build it together.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Workflow Header */}
                <div>
                  <h2 className="text-2xl font-bold mb-2">{workflowState.name}</h2>
                  {workflowState.description && (
                    <p className="text-sm text-muted-foreground">{workflowState.description}</p>
                  )}
                </div>

                <Separator />

                {/* Stages */}
                <div className="space-y-6">
                  {workflowState.stages.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Let's add some stages to your workflow...
                    </div>
                  ) : (
                    workflowState.stages.map((stage, stageIdx) => (
                      <div key={stage.id} className="space-y-3">
                        {/* Stage Header */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                            {stageIdx + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{stage.name}</h3>
                          </div>
                        </div>

                        {/* Steps */}
                        {stage.steps.length > 0 && (
                          <div className="ml-11 space-y-2">
                            {stage.steps.map((step, stepIdx) => (
                              <div
                                key={step.id}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                  step.status === "added"
                                    ? "border-primary bg-primary/5 animate-pulse"
                                    : step.status === "complete"
                                    ? "border-green-500/50 bg-green-500/5"
                                    : "border-border bg-card"
                                }`}
                                data-testid={`workflow-step-${step.id}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-muted-foreground text-xs font-medium flex-shrink-0 mt-0.5">
                                    {stepIdx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{step.name}</div>
                                    {step.description && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {step.description}
                                      </div>
                                    )}
                                  </div>
                                  {step.status === "complete" && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  )}
                                  {step.status === "added" && (
                                    <Plus className="h-4 w-4 text-primary flex-shrink-0 animate-pulse" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Arrow between stages */}
                        {stageIdx < workflowState.stages.length - 1 && (
                          <div className="flex items-center justify-center py-2">
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Action Buttons */}
                {workflowState.status === "complete" && (
                  <div className="pt-4 border-t">
                    <Button 
                      className="w-full" 
                      data-testid="button-save-workflow"
                      onClick={async () => {
                        try {
                          const user = getUser();
                          const isSuperAdmin = user?.role === "super_admin";
                          const scope = isSuperAdmin ? "global" : "organization";
                          
                          const response = await fetch("/api/agents/cadence/save-workflow", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ 
                              workflow: workflowState,
                              scope
                            }),
                          });
                          const data = await response.json();
                          if (data.success) {
                            const workflowId = data.workflowId;
                            
                            // If this is for a marketplace template, link it back
                            if (marketplaceTemplateId && workflowId) {
                              try {
                                await apiRequest("PATCH", `/api/marketplace/items/${marketplaceTemplateId}`, {
                                  sourceId: workflowId
                                });
                                toast({
                                  title: "Marketplace Template Created",
                                  description: "Workflow template has been created and linked to marketplace"
                                });
                              } catch (error: any) {
                                toast({
                                  title: "Warning",
                                  description: "Template created but failed to link to marketplace",
                                  variant: "destructive"
                                });
                              }
                            } else {
                              toast({ 
                                title: isSuperAdmin ? "Published to Marketplace" : "Saved to Templates",
                                description: isSuperAdmin 
                                  ? "Workflow published globally to marketplace" 
                                  : "Workflow saved to your organization's templates"
                              });
                            }
                            window.location.href = "/workflows";
                          }
                        } catch (error) {
                          console.error("Failed to save workflow:", error);
                          toast({ 
                            title: "Error", 
                            description: "Failed to save workflow. Please try again.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      {getUser()?.role === "super_admin" ? (
                        <>
                          <Store className="h-4 w-4 mr-2" />
                          Publish to Marketplace
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Save to Templates
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
