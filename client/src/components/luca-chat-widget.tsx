import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Send, 
  Sparkles, 
  User, 
  Loader2, 
  Settings2, 
  MessageCircle, 
  X, 
  ChevronDown, 
  Maximize2,
  Minimize2,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  Check,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import lucaLogoUrl from "@assets/Luca Transparent symbol (1)_1761720299435.png";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  userId: string;
  organizationId?: string;
  llmConfigId?: string;
  isPinned: boolean;
  isActive: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  messages?: ChatMessage[];
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  metadata: any;
  createdAt: Date;
}

export function LucaChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingContentRef = useRef<string>("");
  const { toast } = useToast();

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Detect mobile devices and screen size changes
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setShowSidebar(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll when dialog is open on mobile
  useEffect(() => {
    if ((isOpen || isFullScreen) && isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen, isFullScreen, isMobile]);

  // Fetch available LLM configurations
  const { data: llmConfigs = [] } = useQuery<any[]>({
    queryKey: ["/api/llm-configurations"],
  });

  // Fetch chat sessions
  const { data: sessions = [], refetch: refetchSessions } = useQuery<ChatSession[]>({
    queryKey: ["/api/luca-chat-sessions"],
    enabled: isOpen || isFullScreen,
  });

  // Auto-select default LLM config
  useEffect(() => {
    const defaultConfig = llmConfigs.find((c) => c.isDefault);
    if (defaultConfig && !selectedLlmConfig) {
      setSelectedLlmConfig(defaultConfig.id);
    }
  }, [llmConfigs, selectedLlmConfig]);

  // Load session messages when switching sessions
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    }
  }, [currentSessionId]);

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/luca-chat-sessions/${sessionId}`);
      const data = await response.json();
      
      const loadedMessages: Message[] = data.messages?.map((msg: ChatMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      })) || [];
      
      setMessages(loadedMessages);
    } catch (error) {
      console.error('[Luca Chat] Error loading session messages:', error);
    }
  };

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (title: string = "New Chat") => {
      const payload: any = { title };
      if (selectedLlmConfig) {
        payload.llmConfigId = selectedLlmConfig;
      }
      const response = await apiRequest("POST", "/api/luca-chat-sessions", payload);
      return await response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/luca-chat-sessions"] });
      setCurrentSessionId(newSession.id);
      setMessages([]);
    },
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ChatSession> }) => {
      const response = await apiRequest("PATCH", `/api/luca-chat-sessions/${id}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/luca-chat-sessions"] });
      setEditingSessionId(null);
      setEditingTitle("");
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/luca-chat-sessions/${id}`);
      return await response.json();
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/luca-chat-sessions"] });
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    },
  });

  // Add message to session mutation
  const addMessageMutation = useMutation({
    mutationFn: async ({ sessionId, role, content }: { sessionId: string; role: string; content: string }) => {
      const response = await apiRequest("POST", `/api/luca-chat-sessions/${sessionId}/messages`, {
        role,
        content,
        metadata: {}
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/luca-chat-sessions"] });
    },
  });

  const handleNewChat = () => {
    createSessionMutation.mutate("New Chat");
  };

  const handleRenameSession = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim()) {
      updateSessionMutation.mutate({
        id: sessionId,
        updates: { title: editingTitle.trim() },
      });
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm("Are you sure you want to delete this chat session?")) {
      deleteSessionMutation.mutate(sessionId);
    }
  };

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/ai-stream`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'stream_start') {
          const messageId = data.messageId || data.conversationId || Date.now().toString();
          streamingMessageIdRef.current = messageId;
          streamingContentRef.current = "";
          
          const assistantMessage: Message = {
            id: messageId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else if (data.type === 'stream_chunk') {
          // Handle first chunk - create message if not exists
          if (!streamingMessageIdRef.current) {
            const messageId = Date.now().toString();
            streamingMessageIdRef.current = messageId;
            streamingContentRef.current = "";
            
            const assistantMessage: Message = {
              id: messageId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              isStreaming: true,
            };
            setMessages((prev) => [...prev, assistantMessage]);
          }
          
          // Append chunk (backend sends 'chunk' not 'content')
          const chunkText = data.chunk || data.content || '';
          streamingContentRef.current += chunkText;
          
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === streamingMessageIdRef.current
                ? { ...msg, content: streamingContentRef.current }
                : msg
            )
          );
        } else if (data.type === 'stream_end') {
          if (streamingMessageIdRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageIdRef.current
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
            
            // Assistant messages are now saved by the backend WebSocket handler
            // Reload the current session to sync with database-persisted messages
            if (currentSessionId) {
              loadSessionMessages(currentSessionId);
              // Also invalidate sessions list to update timestamps
              queryClient.invalidateQueries({ 
                queryKey: ["/api/luca-chat-sessions"] 
              });
            }
            
            streamingMessageIdRef.current = null;
            streamingContentRef.current = "";
          }
          setIsStreaming(false);
        } else if (data.type === 'error') {
          toast({
            title: "Error",
            description: data.error || data.message || "An error occurred",
            variant: "destructive",
          });
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
          streamingContentRef.current = "";
        }
      } catch (error) {
        console.error('[Luca Chat] Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[Luca Chat] WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to AI service",
        variant: "destructive",
      });
      setIsStreaming(false);
    };

    wsRef.current = ws;
    return ws;
  }, [toast, currentSessionId, addMessageMutation]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isStreaming) {
      return;
    }

    if (!selectedLlmConfig) {
      toast({
        title: "Configuration Required",
        description: "Please configure an LLM provider in Settings first",
        variant: "destructive",
      });
      return;
    }

    let sessionId = currentSessionId;
    
    if (!sessionId) {
      const newSession = await createSessionMutation.mutateAsync("New Chat");
      sessionId = newSession.id;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    
    if (sessionId) {
      addMessageMutation.mutate({
        sessionId,
        role: "user",
        content: textToSend,
      });
    }
    
    setIsStreaming(true);

    const ws = connectWebSocket();
    
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({
          type: 'execute_agent',
          agentName: 'luca',
          input: textToSend,
          llmConfigId: selectedLlmConfig,
          lucaSessionId: sessionId,
        }));
      }, { once: true });
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'execute_agent',
        agentName: 'luca',
        input: textToSend,
        llmConfigId: selectedLlmConfig,
        lucaSessionId: sessionId,
      }));
    }

    setInput("");
    setIsExpanded(true);
  };

  const renderChatInterface = () => (
    <div className="flex h-full">
      {/* Session Sidebar */}
      {showSidebar && !isMobile && (
        <div className="w-64 border-r flex flex-col bg-muted/30">
          {/* Sidebar Header */}
          <div className="p-3 border-b space-y-2">
            <Button
              className="w-full gap-2"
              onClick={handleNewChat}
              data-testid="button-new-chat"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>

          {/* Session List */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setCurrentSessionId(session.id)}
                  data-testid={`session-item-${session.id}`}
                >
                  {editingSessionId === session.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveRename(session.id);
                          } else if (e.key === 'Escape') {
                            setEditingSessionId(null);
                            setEditingTitle("");
                          }
                        }}
                        className="h-7 text-sm"
                        autoFocus
                        data-testid={`input-rename-session-${session.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleSaveRename(session.id)}
                        data-testid={`button-save-rename-${session.id}`}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.lastMessageAt).toLocaleDateString()}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-session-menu-${session.id}`}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameSession(session.id, session.title);
                            }}
                            data-testid={`button-rename-session-${session.id}`}
                          >
                            <Edit2 className="h-3 w-3 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="text-destructive"
                            data-testid={`button-delete-session-${session.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="relative bg-gradient-to-r from-[#e5a660] to-[#d76082] px-4 py-3 border-b">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center gap-3">
            {!showSidebar && !isMobile && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white"
                onClick={() => setShowSidebar(true)}
                data-testid="button-show-sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            
            <div className="p-1.5 rounded-lg bg-white shadow-md">
              <img 
                src={lucaLogoUrl} 
                alt="Luca" 
                className="h-7 w-7 object-contain"
                draggable={false}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white" data-testid="text-agent-name">
                  Luca
                </h3>
                <div className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
              </div>
              <p className="text-xs text-white/80">
                Accounting, Finance & Taxation Expert
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {showSidebar && !isMobile && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0"
                  onClick={() => setShowSidebar(false)}
                  data-testid="button-hide-sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              )}
              
              {!isMobile && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  data-testid="button-toggle-fullscreen"
                >
                  {isFullScreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              )}
              
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0"
                onClick={() => {
                  if (isFullScreen) {
                    setIsFullScreen(false);
                  } else {
                    setIsExpanded(false);
                  }
                }}
                data-testid="button-minimize-chat"
              >
                {isFullScreen ? <X className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* LLM Config Selector */}
          {llmConfigs.length > 0 && (
            <div className="relative flex items-center gap-2 mt-3">
              <Settings2 className="h-3.5 w-3.5 text-white/70" />
              <Select value={selectedLlmConfig} onValueChange={setSelectedLlmConfig}>
                <SelectTrigger className="h-7 text-xs bg-white/10 border-white/20 text-white" data-testid="select-llm-config">
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

          {llmConfigs.length === 0 && (
            <div className="relative mt-3 p-2 rounded-lg bg-yellow-500/20 border border-yellow-400/30">
              <p className="text-xs text-yellow-100">
                No LLM providers configured. Go to Settings to add one.
              </p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <img 
                    src={lucaLogoUrl} 
                    alt="Luca" 
                    className="h-12 w-12 object-contain"
                  />
                </div>
                <h4 className="font-semibold mb-2">Welcome to Luca</h4>
                <p className="text-sm text-muted-foreground max-w-md">
                  I'm your AI assistant specializing in accounting, finance, and taxation.
                  Ask me anything!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-[#e5a660]/20 to-[#d76082]/20">
                          <img 
                            src={lucaLogoUrl} 
                            alt="Luca" 
                            className="h-5 w-5 object-contain"
                          />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-muted"
                      }`}
                    >
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {message.isStreaming && (
                        <div className="flex items-center gap-1 mt-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-secondary">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message Luca..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isStreaming}
              data-testid="input-message"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
              data-testid="button-send-message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Luca can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Widget - Compact Preview */}
      {!isOpen && !isFullScreen && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] animate-in slide-in-from-bottom-4 duration-500"
          style={{
            bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : '24px',
            right: isMobile ? 'calc(16px + env(safe-area-inset-right))' : '24px',
          }}
        >
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 p-2 bg-primary border-2 border-primary/20"
            onClick={() => setIsOpen(true)}
            data-testid="button-open-luca-chat"
          >
            <img 
              src={lucaLogoUrl} 
              alt="Luca" 
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
            <span className="sr-only">Open Luca AI Assistant</span>
          </Button>
        </div>
      )}

      {/* Expanded Chat Widget (Preview State) - Floating Bubbles */}
      {isOpen && !isExpanded && !isFullScreen && (
        <div
          className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-[9999] animate-in slide-in-from-bottom-8 fade-in duration-300 flex flex-col items-end gap-3"
          style={{
            bottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom))' : '96px',
            right: isMobile ? 'calc(16px + env(safe-area-inset-right))' : '24px',
            maxWidth: isMobile ? 'calc(100vw - 32px)' : '400px',
          }}
        >
          {/* Close button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-card/95 backdrop-blur-sm border shadow-lg hover-elevate"
            onClick={() => setIsOpen(false)}
            data-testid="button-close-luca-preview"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Greeting Bubble */}
          <div className="bg-card/95 backdrop-blur-sm rounded-2xl shadow-lg border p-4 max-w-[320px] animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <img 
                    src={lucaLogoUrl} 
                    alt="Luca" 
                    className="h-6 w-6 object-contain"
                    draggable={false}
                  />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-card" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm">Luca</h3>
                  <Badge variant="secondary" className="text-xs h-4 px-1.5">AI</Badge>
                </div>
                <p className="text-sm">
                  {getGreeting()}! 👋
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  How can I help you today?
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accounting & Tax Expert
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons - Floating Pills */}
          <button
            onClick={() => setIsExpanded(true)}
            className="bg-card/95 backdrop-blur-sm rounded-full shadow-lg border px-5 py-3 text-sm font-medium hover-elevate active-elevate-2 transition-all max-w-[280px] text-left animate-in slide-in-from-right-4 duration-300 delay-75"
            data-testid="button-start-conversation"
          >
            Start a conversation
          </button>

          <button
            onClick={() => setIsExpanded(true)}
            className="bg-card/95 backdrop-blur-sm rounded-full shadow-lg border px-5 py-3 text-sm font-medium hover-elevate active-elevate-2 transition-all max-w-[280px] text-left animate-in slide-in-from-right-4 duration-300 delay-100"
          >
            Ask a tax question
          </button>

          <button
            onClick={() => setIsExpanded(true)}
            className="bg-card/95 backdrop-blur-sm rounded-full shadow-lg border px-5 py-3 text-sm font-medium hover-elevate active-elevate-2 transition-all max-w-[280px] text-left animate-in slide-in-from-right-4 duration-300 delay-150"
          >
            Get accounting help
          </button>
        </div>
      )}

      {/* Full Chat Dialog */}
      <Dialog open={isOpen && isExpanded && !isFullScreen} onOpenChange={(open) => {
        if (!open) {
          setIsOpen(false);
          setIsExpanded(false);
        }
      }}>
        <DialogContent 
          className={`p-0 flex flex-col overflow-hidden ${
            isMobile 
              ? 'w-full h-full max-w-full max-h-full rounded-none m-0' 
              : 'max-w-4xl h-[600px] max-h-[85vh]'
          }`}
          data-testid="dialog-chat-luca"
          style={isMobile ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: 'none',
          } : {}}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Chat with Luca</DialogTitle>
            <DialogDescription>Your accounting, finance & taxation expert</DialogDescription>
          </DialogHeader>

          {renderChatInterface()}
        </DialogContent>
      </Dialog>

      {/* Full Screen Mode */}
      {isFullScreen && (
        <div className="fixed inset-0 z-[9999] bg-background" data-testid="fullscreen-chat-luca">
          {renderChatInterface()}
        </div>
      )}
    </>
  );
}
