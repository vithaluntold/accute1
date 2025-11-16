import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Send, Plus, Trash2, Edit2, Save, Settings2, Store } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getUser } from "@/lib/auth";
import { useAgentWebSocket } from "@/hooks/use-agent-websocket";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface Message {
  role: "user" | "assistant";
  content: string;
  templateUpdate?: MessageTemplate;
}

interface MessageTemplate {
  name: string;
  category: string;
  content: string;
  variables: string[];
  status: "building" | "complete";
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

export default function EchoAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Echo, your message template specialist. I can help you create professional message templates with merge fields for client communication. What type of message template would you like to create?"
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<MessageTemplate | null>(null);
  
  // Session management state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  
  // LLM configuration state
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  
  // WebSocket streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const streamingResponseRef = useRef<string>("");
  
  // Marketplace template state
  const [marketplaceTemplateId, setMarketplaceTemplateId] = useState<string | null>(null);
  const [marketplaceMetadata, setMarketplaceMetadata] = useState<{
    name?: string;
    description?: string;
    category?: string;
  }>({});
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize WebSocket for streaming
  const { isConnected, sendMessage: sendWebSocketMessage, isStreaming } = useAgentWebSocket({
    agentName: 'echo',
    onStreamChunk: (chunk: string) => {
      streamingResponseRef.current += chunk;
      setStreamingMessage(streamingResponseRef.current);
    },
    onStreamComplete: async (fullResponse: string) => {
      try {
        // Parse response for template update
        let templateUpdate = null;
        let responseText = fullResponse;
        
        // Try to extract JSON block for templateUpdate
        const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            if (jsonData.templateUpdate) {
              templateUpdate = jsonData.templateUpdate;
            }
            // Keep the conversational part before the JSON
            responseText = fullResponse.split('```json')[0].trim();
          } catch (e) {
            console.error('Failed to parse templateUpdate JSON:', e);
          }
        }
        
        const assistantMessage: Message = { 
          role: "assistant", 
          content: responseText,
          templateUpdate
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        
        // Update template state if provided
        if (templateUpdate) {
          setCurrentTemplate(templateUpdate);
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
    queryKey: ["/api/agents/echo/sessions"],
  });

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/agents/echo/sessions", { name });
      return await response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/echo/sessions"] });
      setCurrentSessionId(newSession.id);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Echo. What message template would you like to create?"
      }]);
      setCurrentTemplate(null);
    },
  });

  const createSessionSilently = async (name: string) => {
    const response = await apiRequest("POST", "/api/agents/echo/sessions", { name });
    const newSession = await response.json();
    queryClient.invalidateQueries({ queryKey: ["/api/agents/echo/sessions"] });
    setCurrentSessionId(newSession.id);
    return newSession;
  };

  // Update session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await apiRequest("PATCH", `/api/agents/echo/sessions/${id}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/echo/sessions"] });
      setEditingSessionId(null);
      setEditingTitle("");
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/agents/echo/sessions/${id}`, {});
      return await response.json();
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/echo/sessions"] });
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null);
        setMessages([{
          role: "assistant",
          content: "Hi! I'm Echo. What message template would you like to create?"
        }]);
        setCurrentTemplate(null);
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
      const response = await fetch(`/api/agents/echo/sessions/${sessionId}`, {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          templateUpdate: msg.metadata?.templateUpdate,
        }));
        setMessages(loadedMessages);
        
        const reversedCopy = [...loadedMessages].reverse();
        const lastMsgWithTemplate = reversedCopy.find(m => m.templateUpdate);
        if (lastMsgWithTemplate?.templateUpdate) {
          setCurrentTemplate(lastMsgWithTemplate.templateUpdate);
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
        const sessionName = `Message Template ${new Date().toLocaleDateString()}`;
        const newSession = await createSessionSilently(sessionName);
        sessionId = newSession.id;
      }

      // Try WebSocket streaming first
      if (isConnected) {
        console.log('[Echo] Using WebSocket streaming');
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
        console.log('[Echo] WebSocket not connected, falling back to HTTP');
        const response = await fetch("/api/agents/echo/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ 
            message: userInput, 
          history: messages,
          currentTemplate,
          llmConfigId: selectedLlmConfig
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response,
        templateUpdate: data.templateUpdate
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.templateUpdate) {
        setCurrentTemplate(data.templateUpdate);
      }

      if (sessionId) {
        await apiRequest("POST", `/api/agents/echo/sessions/${sessionId}/messages`, {
          role: "user",
          content: userInput,
        });
        await apiRequest("POST", `/api/agents/echo/sessions/${sessionId}/messages`, {
          role: "assistant",
          content: data.response,
          metadata: data.templateUpdate ? { templateUpdate: data.templateUpdate } : {},
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

  const saveTemplate = async () => {
    if (!currentTemplate) return;

    try {
      const user = getUser();
      const isSuperAdmin = user?.role === "super_admin";
      const scope = isSuperAdmin ? "global" : "organization";
      
      const response = await fetch("/api/agents/echo/save-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...currentTemplate,
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
              description: "Message template has been created and linked to marketplace"
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
              ? "Message template published globally" 
              : "Message template saved to your organization"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive"
      });
    }
  };

  const highlightMergeFields = (text: string) => {
    const parts = text.split(/({{[^}]+}})/g);
    return parts.map((part, idx) => {
      if (part.startsWith("{{") && part.endsWith("}}")) {
        return (
          <Badge key={idx} variant="secondary" className="mx-1">
            {part}
          </Badge>
        );
      }
      return <span key={idx}>{part}</span>;
    });
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
              <MessageSquare className="h-5 w-5" />
              Echo - Message Template Builder
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
                  placeholder="Describe the message template you need..."
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

      {/* Template Preview Panel */}
      <ResizablePanel defaultSize={40}>
        <Card className="flex flex-col h-full ml-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm">Template Preview</span>
              {currentTemplate && (
                <Button 
                  size="sm" 
                  onClick={saveTemplate}
                  data-testid="button-save-template"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {currentTemplate ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{currentTemplate.name}</h3>
                    <Badge variant="outline" className="mt-2">
                      {currentTemplate.category}
                    </Badge>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Message Content:</h4>
                    <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
                      {highlightMergeFields(currentTemplate.content)}
                    </div>
                  </div>
                  
                  {currentTemplate.variables && currentTemplate.variables.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-2">Merge Fields:</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentTemplate.variables.map((variable, idx) => (
                            <Badge key={idx} variant="secondary">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Start chatting to build your message template</p>
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
