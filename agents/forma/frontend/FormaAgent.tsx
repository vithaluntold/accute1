import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormInput, Send, Sparkles, Plus, Type, CheckSquare, Calendar, Hash, Mail, Phone, Upload, FileText, MessageSquare, Trash2, Edit2, Store, Save } from "lucide-react";
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

interface Message {
  role: "user" | "assistant";
  content: string;
  formUpdate?: FormState;
}

interface FormState {
  name: string;
  description?: string;
  fields: FormField[];
  status: "building" | "complete";
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "checkbox" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
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

export default function FormaAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Forma, your AI form builder. I can help you in two ways:\n\n1️⃣ Conversational Building:\n   • Just tell me what form you need\n   • I'll ask questions and build it with you\n\n2️⃣ Upload a Document:\n   • Upload a questionnaire (PDF, DOCX, XLSX, TXT)\n   • I'll extract the questions and create your form automatically\n\nHow would you like to start?"
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState<FormState | null>(null);
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
    queryKey: ["/api/agents/forma/sessions"],
  });

  // Create new session (explicit creation via UI button)
  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/agents/forma/sessions", { name });
      return await response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/forma/sessions"] });
      setCurrentSessionId(newSession.id);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Forma, your AI form builder. What form would you like to create?"
      }]);
      setFormState(null);
    },
  });

  // Create session implicitly (for sendMessage without resetting messages)
  const createSessionSilently = async (name: string) => {
    const response = await apiRequest("POST", "/api/agents/forma/sessions", { name });
    const newSession = await response.json();
    queryClient.invalidateQueries({ queryKey: ["/api/agents/forma/sessions"] });
    setCurrentSessionId(newSession.id);
    return newSession;
  };

  // Update session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("PATCH", `/api/agents/forma/sessions/${id}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/forma/sessions"] });
      setEditingSessionId(null);
      setEditingTitle("");
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/agents/forma/sessions/${id}`, {});
      return await response.json();
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/forma/sessions"] });
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null);
        setMessages([{
          role: "assistant",
          content: "Hi! I'm Forma. What form would you like to create?"
        }]);
        setFormState(null);
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
      const response = await fetch(`/api/agents/forma/sessions/${sessionId}`, {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          formUpdate: msg.metadata?.formUpdate,
        }));
        setMessages(loadedMessages);
        
        // Restore last form if exists (use a copy to avoid mutation)
        const reversedCopy = [...loadedMessages].reverse();
        const lastMsgWithForm = reversedCopy.find(m => m.formUpdate);
        if (lastMsgWithForm?.formUpdate) {
          setFormState(lastMsgWithForm.formUpdate);
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
        const sessionName = `Form Session ${new Date().toLocaleDateString()}`;
        const newSession = await createSessionSilently(sessionName);
        sessionId = newSession.id;
      }

      const response = await fetch("/api/agents/forma/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          message: userInput, 
          history: messages,
          currentForm: formState 
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response,
        formUpdate: data.formUpdate
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.formUpdate) {
        setFormState(data.formUpdate);
      }

      // Persist messages to session
      if (sessionId) {
        await apiRequest("POST", `/api/agents/forma/sessions/${sessionId}/messages`, {
          role: "user",
          content: userInput,
        });
        await apiRequest("POST", `/api/agents/forma/sessions/${sessionId}/messages`, {
          role: "assistant",
          content: data.response,
          metadata: data.formUpdate ? { formUpdate: data.formUpdate } : {},
        });
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please configure your AI provider in Settings > LLM Configuration."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveForm = async () => {
    if (!formState) return;

    try {
      const user = getUser();
      const isSuperAdmin = user?.role === "super_admin";
      const scope = isSuperAdmin ? "global" : "organization";
      
      const response = await fetch("/api/agents/forma/save-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formState,
          scope
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const formId = data.formId;
        
        // If this is for a marketplace template, link it back
        if (marketplaceTemplateId && formId) {
          try {
            await apiRequest("PATCH", `/api/marketplace/items/${marketplaceTemplateId}`, {
              sourceId: formId
            });
            toast({
              title: "Marketplace Template Created",
              description: "Form template has been created and linked to marketplace"
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
            title: isSuperAdmin ? "Published to Marketplace" : "Form Saved",
            description: isSuperAdmin 
              ? "Form published globally to marketplace" 
              : "Form saved to your organization's templates"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save form.",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsLoading(true);
    setTodos([
      { id: "1", content: "Uploading document...", status: "in_progress" },
      { id: "2", content: "Parsing document content", status: "pending" },
      { id: "3", content: "Extracting questions", status: "pending" },
      { id: "4", content: "Converting to form fields", status: "pending" },
      { id: "5", content: "Finalizing form structure", status: "pending" }
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setMessages(prev => [...prev, {
        role: "user",
        content: `📄 Uploaded document: ${file.name}`
      }]);

      setTodos(prev => prev.map(t => 
        t.id === "1" ? { ...t, status: "completed" as const } :
        t.id === "2" ? { ...t, status: "in_progress" as const } : t
      ));

      const response = await fetch("/api/agents/forma/upload-document", {
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
        formUpdate: data.formUpdate
      }]);

      if (data.formUpdate) {
        setFormState(data.formUpdate);
      }

      toast({
        title: "Document processed",
        description: `Created form with ${data.formUpdate?.fields.length || 0} fields from your document.`
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
        content: "Sorry, I couldn't process that document. Please try again or describe your form requirements instead."
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

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "email": return Mail;
      case "number": return Hash;
      case "date": return Calendar;
      case "checkbox": return CheckSquare;
      case "phone": return Phone;
      default: return Type;
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
              <FormInput className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Forma
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Conversational form builder
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
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`rounded-lg px-4 py-2.5 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-white animate-pulse" />
                    </div>
                  </div>
                  <div className="rounded-lg px-4 py-2.5 bg-muted">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                      <span className="text-sm text-muted-foreground">Building form...</span>
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
          
          {/* Input Area */}
          <div className="border-t p-4">
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
                title="Upload questionnaire document"
                data-testid="button-upload-document"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Input
                placeholder="Describe your form or add fields..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage()}
                disabled={isLoading}
                data-testid="input-forma-message"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !input.trim()}
                size="icon"
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Panel - Live Form Preview */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full ml-2">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FormInput className="h-5 w-5 text-primary" />
              Form Preview
            </CardTitle>
            {formState && formState.fields.length > 0 && (
              <div className="flex gap-2">
                {formState.status === "building" && (
                  <Button 
                    onClick={() => setFormState(prev => prev ? {...prev, status: "complete"} : null)}
                    size="sm"
                    variant="outline"
                    data-testid="button-mark-complete"
                  >
                    Mark as Complete
                  </Button>
                )}
                <Button 
                  onClick={saveForm}
                  size="sm"
                  data-testid="button-save-form"
                >
                  {getUser()?.role === "super_admin" ? (
                    <>
                      <Store className="h-4 w-4 mr-1" />
                      Publish to Marketplace
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save to Templates
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-auto">
          {!formState ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FormInput className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No Form Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start chatting with Forma to build your form. I'll create fields as we talk!
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full w-full" type="always">
              <div className="p-6 space-y-6 pb-20">
                {/* Form Header */}
                <div className="space-y-2 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-2xl" data-testid="text-form-title">
                      {formState.name}
                    </h3>
                    {formState.status === "building" ? (
                      <Badge variant="secondary" className="animate-pulse">
                        Building...
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        Complete
                      </Badge>
                    )}
                  </div>
                  {formState.description && (
                    <p className="text-sm text-muted-foreground">{formState.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formState.fields.length} {formState.fields.length === 1 ? 'field' : 'fields'}
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {formState.fields.sort((a, b) => a.order - b.order).map((field) => {
                    const FieldIcon = getFieldIcon(field.type);
                    return (
                      <div
                        key={field.id}
                        className="p-4 rounded-lg border bg-card hover-elevate transition-base"
                        data-testid={`field-${field.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
                            <FieldIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="font-medium text-sm">
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </label>
                              <Badge variant="outline" className="text-xs">{field.type}</Badge>
                            </div>
                            
                            {/* Field Preview */}
                            {field.type === "textarea" ? (
                              <textarea
                                className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                                placeholder={field.placeholder || field.label}
                                rows={3}
                                disabled
                              />
                            ) : field.type === "select" ? (
                              <select
                                className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                                disabled
                              >
                                <option>{field.placeholder || "Select an option"}</option>
                                {field.options?.map((opt, i) => (
                                  <option key={i}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === "checkbox" ? (
                              <div className="flex items-center gap-2">
                                <input type="checkbox" disabled className="rounded" />
                                <span className="text-sm text-muted-foreground">{field.placeholder}</span>
                              </div>
                            ) : (
                              <input
                                type={field.type}
                                className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                                placeholder={field.placeholder || field.label}
                                disabled
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {formState.fields.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No fields yet. Keep chatting to add fields!
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
