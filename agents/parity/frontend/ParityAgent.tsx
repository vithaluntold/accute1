import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Sparkles, Download, Copy, CheckCircle2, Save, Plus, Trash2, Edit2, MessageSquare, Store, Upload, Settings2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getUser } from "@/lib/auth";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface Message {
  role: "user" | "assistant";
  content: string;
  document?: GeneratedDocument;
}

interface GeneratedDocument {
  title: string;
  type: string;
  content: string;
  status: "generating" | "complete";
}

interface AgentSession {
  id: string;
  sessionId: string;
  name: string;
  agentSlug: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export default function ParityAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Parity, your intelligent document generator and compliance assistant. I can help you create:\n\n• Engagement Letters\n• Service Agreements\n• Financial Reports\n• Compliance Documents\n• Tax Forms\n• Client Contracts\n\nWhat document would you like to create today?"
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<GeneratedDocument | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("engagement_letter");
  const [templateDescription, setTemplateDescription] = useState("");
  const [editableContent, setEditableContent] = useState("");
  
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
  
  // SSE streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const streamingResponseRef = useRef<string>("");
  const streamingMessageIdRef = useRef<string | null>(null);
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Initialize SSE for streaming
  const { sendMessage: sendSSEMessage, isStreaming, cancelStream } = useAgentSSE({
    onStreamStart: () => {
      streamingMessageIdRef.current = Date.now().toString();
      streamingResponseRef.current = "";
      setStreamingMessage("");
      setIsLoading(true);
    },
    onChunk: (chunk: string) => {
      streamingResponseRef.current += chunk;
      setStreamingMessage(streamingResponseRef.current);
    },
    onComplete: async (fullResponse: string) => {
      try {
        // Parse response for document update
        let document = null;
        let responseText = fullResponse;
        
        // Try to extract JSON block for document
        const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            if (jsonData.document) {
              document = jsonData.document;
            }
            // Keep the conversational part before the JSON
            responseText = fullResponse.split('```json')[0].trim();
          } catch (e) {
            console.error('Failed to parse document JSON:', e);
          }
        }
        
        const assistantMessage: Message = { 
          role: "assistant", 
          content: responseText,
          document
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Update document state if provided
        if (document) {
          setCurrentDocument(document);
        }
        
        // Clear streaming state
        setStreamingMessage("");
        streamingResponseRef.current = "";
        streamingMessageIdRef.current = null;
        setIsLoading(false);
      } catch (error) {
        console.error('Error handling stream complete:', error);
        setStreamingMessage("");
        streamingResponseRef.current = "";
        streamingMessageIdRef.current = null;
        setIsLoading(false);
      }
    },
    onError: (error: string) => {
      console.error('[Parity SSE] Error:', error);
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      });
      setStreamingMessage("");
      streamingResponseRef.current = "";
      streamingMessageIdRef.current = null;
      setIsLoading(false);
    }
  });

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
      
      // Pre-fill form fields
      if (name) setTemplateName(name);
      if (description) setTemplateDescription(description);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch sessions
  const { data: sessions = [] } = useQuery<AgentSession[]>({
    queryKey: ["/api/agents/parity/sessions"],
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
      const response = await apiRequest("POST", "/api/agents/parity/sessions", { name });
      return await response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/parity/sessions"] });
      setCurrentSessionId(newSession.sessionId);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Parity, your intelligent document generator. What document would you like to create?"
      }]);
      setCurrentDocument(null);
    },
  });

  // Create session implicitly (for sendMessage without resetting messages)
  const createSessionSilently = async (name: string) => {
    const response = await apiRequest("POST", "/api/agents/parity/sessions", { name });
    const newSession = await response.json();
    queryClient.invalidateQueries({ queryKey: ["/api/agents/parity/sessions"] });
    setCurrentSessionId(newSession.sessionId);
    return newSession;
  };

  // Update session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, name }: { sessionId: string; name: string }) => {
      const response = await apiRequest("PATCH", `/api/agents/parity/sessions/${sessionId}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/parity/sessions"] });
      setEditingSessionId(null);
      setEditingTitle("");
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest("DELETE", `/api/agents/parity/sessions/${sessionId}`, {});
      return await response.json();
    },
    onSuccess: (_data, deletedSessionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/parity/sessions"] });
      if (currentSessionId === deletedSessionId) {
        setCurrentSessionId(null);
        setMessages([{
          role: "assistant",
          content: "Hi! I'm Parity. What document would you like to create?"
        }]);
        setCurrentDocument(null);
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
      const response = await fetch(`/api/agents/parity/sessions/${sessionId}`, {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          document: msg.metadata?.document,
        }));
        setMessages(loadedMessages);
        
        // Restore last document if exists (use a copy to avoid mutation)
        const reversedCopy = [...loadedMessages].reverse();
        const lastMsgWithDoc = reversedCopy.find(m => m.document);
        if (lastMsgWithDoc?.document) {
          setCurrentDocument(lastMsgWithDoc.document);
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

    if (!selectedLlmConfig) {
      toast({
        title: "Configuration Required",
        description: "Please select an LLM configuration first",
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: "user", content: input };
    const userInput = input; // Save before clearing
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    
    // Reset streaming state
    setStreamingMessage("");
    streamingResponseRef.current = "";

    try {
      // Create session if needed
      let sessionId = currentSessionId;
      if (!sessionId) {
        const sessionName = `Document Session ${new Date().toLocaleDateString()}`;
        const newSession = await createSessionSilently(sessionName);
        sessionId = newSession.sessionId;
      }

      // Use SSE for streaming
      console.log('[Parity] Using SSE streaming with sessionId:', sessionId);
      await sendSSEMessage({
        agentSlug: 'parity',
        message: userInput,
        sessionId: sessionId,
        llmConfigId: selectedLlmConfig,
        contextData: {
          history: messages,
          currentDocument: currentDocument,
        }
      });
    } catch (error) {
      console.error('[Parity] SSE streaming failed, using HTTP fallback:', error);
      setIsLoading(true);
      
      try {
        // Fallback to HTTP for non-streaming
        const response = await fetch("/api/agents/parity/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            message: userInput, 
            history: messages,
            currentDocument: currentDocument,
            llmConfigId: selectedLlmConfig
          }),
        });

        const data = await response.json();
        
        // Check if the response contains an error
        if (data.error) {
          console.error("API Error:", data.error, data.details);
          const errorMessage: Message = {
            role: "assistant",
            content: `Sorry, I encountered an error: ${data.error}${data.details ? ` (${data.details})` : ''}`
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsLoading(false);
          return;
        }
        
        const assistantMessage: Message = { 
          role: "assistant", 
          content: data.response || "No response received",
          document: data.document
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Update document if provided
        if (data.document) {
          setCurrentDocument(data.document);
        }

        setIsLoading(false);
      } catch (httpError) {
        console.error("HTTP fallback error:", httpError);
        const errorMessage: Message = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please ensure you have configured your AI provider credentials in Settings > LLM Configuration."
        };
        setMessages(prev => [...prev, errorMessage]);
        setStreamingMessage("");
        streamingResponseRef.current = "";
        setIsLoading(false);
      }
    }
  };

  const copyToClipboard = () => {
    if (currentDocument?.content) {
      navigator.clipboard.writeText(currentDocument.content);
      toast({
        title: "Copied to clipboard",
        description: "Document content has been copied to your clipboard."
      });
    }
  };

  const downloadDocument = () => {
    if (currentDocument?.content) {
      const blob = new Blob([currentDocument.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDocument.title || 'document'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: "Your document is being downloaded."
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsLoading(true);

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

      const response = await fetch("/api/agents/parity/upload-document", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I've processed your document "${file.name}". The extracted content is ready. What would you like me to do with it? I can:\n\n• Generate a professional document based on this content\n• Analyze the document structure\n• Create templates from it\n• Answer questions about it\n\nJust let me know how I can help!`
      }]);

      toast({
        title: "Document uploaded",
        description: `Successfully processed ${file.name}`
      });

      setUploadedFile(null);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process document. Please try again.",
        variant: "destructive"
      });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Sorry, I couldn't process that document. ${error.message || 'Please try again'}.`
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

  const openSaveDialog = () => {
    if (currentDocument) {
      setTemplateName(currentDocument.title);
      setTemplateCategory(
        currentDocument.type.toLowerCase().includes("engagement") ? "engagement_letter" :
        currentDocument.type.toLowerCase().includes("agreement") ? "service_agreement" :
        currentDocument.type.toLowerCase().includes("contract") ? "contract" :
        "engagement_letter"
      );
      setTemplateDescription(`Generated ${currentDocument.type}`);
      setEditableContent(currentDocument.content);
      setShowSaveDialog(true);
    }
  };

  const saveAsTemplate = async () => {
    try {
      const user = getUser();
      const isSuperAdmin = user?.role === "super_admin";
      const scope = isSuperAdmin ? "global" : "organization";
      
      const response = await fetch("/api/agents/parity/save-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: templateName,
          category: templateCategory,
          description: templateDescription,
          content: editableContent,
          scope
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const templateId = data.templateId;
        
        // If this is for a marketplace template, link it back
        if (marketplaceTemplateId && templateId) {
          try {
            await apiRequest("PATCH", `/api/marketplace/items/${marketplaceTemplateId}`, {
              sourceId: templateId
            });
            toast({
              title: "Marketplace Template Created",
              description: "Document template has been created and linked to marketplace"
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
            title: isSuperAdmin ? "Published to Marketplace" : "Template Saved",
            description: isSuperAdmin 
              ? "Document template published globally to marketplace" 
              : "Document template saved to your organization's templates"
          });
        }
        setShowSaveDialog(false);
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to save template.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
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
                        key={session.sessionId}
                        className={`group p-2 rounded-md cursor-pointer hover-elevate ${
                          currentSessionId === session.sessionId ? "bg-accent" : ""
                        }`}
                        onClick={() => setCurrentSessionId(session.sessionId)}
                        data-testid={`session-${session.sessionId}`}
                      >
                        {editingSessionId === session.sessionId ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateSessionMutation.mutate({ sessionId: session.sessionId, name: editingTitle });
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
                                    deleteSessionMutation.mutate(session.sessionId);
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
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Parity
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Document generator & compliance assistant
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
                    
                    {msg.document && msg.document.status === "complete" && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span>Document generated: {msg.document.title}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {streamingMessage && (
                <div className="flex gap-3 justify-start">
                  <div className="flex items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="rounded-lg px-4 py-2.5 bg-muted max-w-[80%]">
                    <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                    <p className="text-xs mt-2 text-muted-foreground">Streaming...</p>
                  </div>
                </div>
              )}
              
              {isLoading && !streamingMessage && (
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
                      <span className="text-sm text-muted-foreground">Generating...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isStreaming}
                variant="outline"
                size="icon"
                title="Upload document to analyze"
                data-testid="button-upload-document"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Input
                placeholder="Describe the document you need..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && !isStreaming && sendMessage()}
                disabled={isLoading || isStreaming}
                data-testid="input-parity-message"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || isStreaming || !input.trim()}
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

      {/* Right Panel - Document Preview */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full ml-2">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Document Preview
            </div>
            {currentDocument && currentDocument.status === "complete" && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={copyToClipboard}
                  data-testid="button-copy-document"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadDocument}
                  data-testid="button-download-document"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button 
                  size="sm"
                  onClick={openSaveDialog}
                  data-testid="button-save-template"
                >
                  {getUser()?.role === "super_admin" ? (
                    <>
                      <Store className="h-4 w-4 mr-1" />
                      Publish to Marketplace
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save as Template
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          {!currentDocument ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No Document Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start a conversation with Parity to generate professional documents, contracts, and compliance materials.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full" type="always">
              <div className="p-6 space-y-4">
                {/* Document Header */}
                <div className="space-y-2 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-xl" data-testid="text-document-title">
                      {currentDocument.title}
                    </h3>
                    {currentDocument.status === "generating" ? (
                      <Badge variant="secondary" className="animate-pulse">
                        Generating...
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Type: {currentDocument.type}
                  </p>
                </div>

                {/* Document Content */}
                <div className="prose prose-sm max-w-none">
                  <div 
                    className="whitespace-pre-wrap font-mono text-sm bg-muted/50 p-4 rounded-md"
                    data-testid="text-document-content"
                  >
                    {currentDocument.content}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </ResizablePanel>
    </ResizablePanelGroup>

    {/* Save as Template Dialog */}
    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Edit and save this document as a reusable template for future use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard CPA Engagement Letter"
              data-testid="input-template-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">Category</Label>
            <Select value={templateCategory} onValueChange={setTemplateCategory}>
              <SelectTrigger id="template-category" data-testid="select-template-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engagement_letter">Engagement Letter</SelectItem>
                <SelectItem value="service_agreement">Service Agreement</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="compliance_form">Compliance Form</SelectItem>
                <SelectItem value="legal_notice">Legal Notice</SelectItem>
                <SelectItem value="tax_form">Tax Form</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Input
              id="template-description"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Brief description of this template"
              data-testid="input-template-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-content">Content (Editable)</Label>
            <Textarea
              id="template-content"
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
              placeholder="Document content..."
              data-testid="textarea-template-content"
            />
            <p className="text-xs text-muted-foreground">
              You can edit the content before saving as a template
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSaveDialog(false)}
            data-testid="button-cancel-save"
          >
            Cancel
          </Button>
          <Button
            onClick={saveAsTemplate}
            disabled={!templateName.trim() || !editableContent.trim()}
            data-testid="button-confirm-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
