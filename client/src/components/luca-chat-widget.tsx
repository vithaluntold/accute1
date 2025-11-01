import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Sparkles, User, Loader2, Settings2, MessageCircle, X, ChevronDown, Calculator, FileText, TrendingUp, HelpCircle } from "lucide-react";
import lucaLogoUrl from "@assets/Luca Transparent symbol (1)_1761720299435.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface QuickAction {
  label: string;
  icon: any;
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    label: "Tax questions",
    icon: Calculator,
    prompt: "I need help understanding tax implications for my business"
  },
  {
    label: "Accounting concepts",
    icon: FileText,
    prompt: "Can you explain accounting concepts and principles?"
  },
  {
    label: "Financial analysis",
    icon: TrendingUp,
    prompt: "Help me analyze financial statements"
  },
  {
    label: "General support",
    icon: HelpCircle,
    prompt: "I need general accounting support"
  }
];

export function LucaChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
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
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll when dialog is open on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
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
  }, [isOpen, isMobile]);

  // Fetch available LLM configurations
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
          streamingMessageIdRef.current = data.messageId;
          streamingContentRef.current = "";
          
          const assistantMessage: Message = {
            id: data.messageId,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            isStreaming: true,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else if (data.type === 'stream_chunk' && streamingMessageIdRef.current) {
          streamingContentRef.current += data.content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === streamingMessageIdRef.current
                ? { ...msg, content: streamingContentRef.current }
                : msg
            )
          );
        } else if (data.type === 'stream_end' && streamingMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === streamingMessageIdRef.current
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
          streamingMessageIdRef.current = null;
          streamingContentRef.current = "";
          setIsStreaming(false);
        } else if (data.type === 'error') {
          toast({
            title: "Error",
            description: data.message || "An error occurred",
            variant: "destructive",
          });
          setIsStreaming(false);
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
  }, [toast]);

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

  const handleSend = (messageText?: string) => {
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

    setShowQuickActions(false);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    const ws = connectWebSocket();
    
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({
          type: 'execute_agent',
          agentName: 'luca',
          input: textToSend,
          llmConfigId: selectedLlmConfig,
        }));
      }, { once: true });
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'execute_agent',
        agentName: 'luca',
        input: textToSend,
        llmConfigId: selectedLlmConfig,
      }));
    }

    setInput("");
    setIsExpanded(true);
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSend(action.prompt);
  };

  return (
    <>
      {/* Floating Widget - Compact Preview */}
      {!isOpen && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] animate-in slide-in-from-bottom-4 duration-500"
          style={{
            bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : '24px',
            right: isMobile ? 'calc(16px + env(safe-area-inset-right))' : '24px',
          }}
        >
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 p-2 bg-gradient-to-br from-primary to-pink-500 border-2 border-white/20"
            onClick={() => setIsOpen(true)}
            data-testid="button-open-luca-chat"
          >
            <img 
              src={lucaLogoUrl} 
              alt="Luca" 
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            <span className="sr-only">Open Luca AI Assistant</span>
          </Button>
        </div>
      )}

      {/* Expanded Chat Widget */}
      {isOpen && !isExpanded && (
        <div
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] animate-in slide-in-from-bottom-8 fade-in duration-300"
          style={{
            bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : '24px',
            right: isMobile ? 'calc(16px + env(safe-area-inset-right))' : '24px',
            width: isMobile ? 'calc(100vw - 32px)' : '380px',
            maxWidth: isMobile ? '100%' : '380px',
          }}
        >
          <div className="bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
            {/* Header with Gradient */}
            <div className="relative bg-gradient-to-br from-primary via-purple-500 to-pink-500 p-6 pb-8">
              <div className="absolute inset-0 bg-black/20" />
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-luca-preview"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="relative flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-white shadow-lg">
                  <img 
                    src={lucaLogoUrl} 
                    alt="Luca" 
                    className="h-10 w-10 object-contain"
                    draggable={false}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white text-lg">
                      {getGreeting()}
                    </h3>
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                  </div>
                  <p className="text-white/90 text-base font-medium mb-1">
                    How can Luca help today?
                  </p>
                  <div className="flex items-center gap-2 text-white/70 text-xs">
                    <span className="font-medium">Luca AI Assistant</span>
                    <span>•</span>
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs h-5">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      Online
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 space-y-2">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-200 group hover-elevate active-elevate-2"
                    data-testid={`button-quick-action-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{action.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Start Conversation Button */}
            <div className="p-4 pt-2 border-t">
              <Button
                className="w-full gap-2"
                onClick={() => setIsExpanded(true)}
                data-testid="button-start-conversation"
              >
                <MessageCircle className="h-4 w-4" />
                Start a conversation
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Accounting, Finance & Taxation Expert
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Full Chat Dialog */}
      <Dialog open={isOpen && isExpanded} onOpenChange={(open) => {
        if (!open) {
          setIsOpen(false);
          setIsExpanded(false);
        }
      }}>
        <DialogContent 
          className={`p-0 flex flex-col ${
            isMobile 
              ? 'w-full h-full max-w-full max-h-full rounded-none m-0' 
              : 'max-w-2xl h-[600px] max-h-[85vh]'
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

          <div className="flex flex-col h-full">
            {/* Compact Header with Gradient */}
            <div className="relative bg-gradient-to-r from-primary via-purple-500 to-pink-500 px-4 py-3">
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative flex items-center gap-3">
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
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  onClick={() => {
                    setIsExpanded(false);
                    setShowQuickActions(true);
                  }}
                  data-testid="button-minimize-chat"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
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
            <ScrollArea 
              className={`flex-1 ${isMobile ? 'p-3' : 'p-4'}`} 
              ref={scrollRef}
              style={{
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {messages.length === 0 && showQuickActions ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center text-center p-6">
                    <div className="p-3 rounded-xl bg-primary/10 mb-3">
                      <img 
                        src={lucaLogoUrl} 
                        alt="Luca" 
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                    <h4 className="font-semibold mb-1.5">Choose a topic to get started</h4>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Or type your own question below
                    </p>
                  </div>

                  <div className="grid gap-2">
                    {quickActions.map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={index}
                          onClick={() => handleQuickAction(action)}
                          className="text-left px-4 py-3 rounded-xl bg-muted/50 hover:bg-muted transition-all duration-200 group hover-elevate active-elevate-2"
                          data-testid={`button-quick-action-expanded-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium">{action.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : messages.length === 0 ? (
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
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-pink-500/20">
                            <img 
                              src={lucaLogoUrl} 
                              alt="Luca" 
                              className="h-5 w-5 object-contain"
                            />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 ${
                          isMobile ? 'max-w-[85%]' : 'max-w-[80%]'
                        } ${
                          message.role === "user"
                            ? "bg-gradient-to-br from-primary to-purple-500 text-white shadow-md"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
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

            {/* Input */}
            <div 
              className={`border-t bg-muted/30 ${isMobile ? 'p-3' : 'p-4'}`}
              style={isMobile ? {
                paddingBottom: 'calc(12px + env(safe-area-inset-bottom))'
              } : {}}
            >
              <div className="flex gap-2">
                <Textarea
                  placeholder={isMobile ? "Ask Luca..." : "Ask about accounting, finance, or taxation..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className={`${isMobile ? 'min-h-[50px] text-base' : 'min-h-[60px]'} resize-none bg-background`}
                  disabled={isStreaming}
                  data-testid="input-chat-message"
                  style={{
                    fontSize: isMobile ? '16px' : undefined,
                  }}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  className={`${isMobile ? 'h-[50px] w-[50px]' : 'h-[60px] w-[60px]'} flex-shrink-0 bg-gradient-to-br from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90`}
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
