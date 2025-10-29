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
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Sparkles, User, Loader2, Settings2, MessageCircle } from "lucide-react";
import lucaLogoUrl from "@assets/Luca Transparent symbol (1)_1761720299435.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export function LucaChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingContentRef = useRef<string>("");
  const { toast } = useToast();

  // Debug logging
  useEffect(() => {
    console.log('[Luca Widget] Component mounted and rendered');
  }, []);

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

  const handleSend = () => {
    if (!input.trim() || isStreaming) {
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
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
          input: input.trim(),
          llmConfigId: selectedLlmConfig,
        }));
      }, { once: true });
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'execute_agent',
        agentName: 'luca',
        input: input.trim(),
        llmConfigId: selectedLlmConfig,
      }));
    }

    setInput("");
  };

  return (
    <>
      {/* Floating Chat Button - Fixed positioning, high z-index */}
      <Button
        size="lg"
        className="!fixed !bottom-6 !right-6 !h-14 !w-14 !rounded-full !shadow-2xl !z-[9999] hover:scale-105 transition-all duration-200 !p-2"
        onClick={() => {
          console.log('[Luca Widget] Button clicked');
          setIsOpen(true);
        }}
        data-testid="button-open-luca-chat"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
        }}
      >
        <img 
          src={lucaLogoUrl} 
          alt="Luca" 
          className="w-full h-full object-contain"
        />
        <span className="sr-only">Open Luca AI Assistant</span>
      </Button>

      {/* Chat Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl h-[600px] p-0 flex flex-col" data-testid="dialog-chat-luca">
          <DialogHeader className="sr-only">
            <DialogTitle>Chat with Luca</DialogTitle>
            <DialogDescription>Your accounting, finance & taxation expert</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <img 
                    src={lucaLogoUrl} 
                    alt="Luca" 
                    className="h-6 w-6 object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold" data-testid="text-agent-name">
                      Luca
                    </h3>
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your accounting, finance & taxation expert
                  </p>
                </div>
              </div>

              {/* LLM Config Selector */}
              {llmConfigs.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedLlmConfig} onValueChange={setSelectedLlmConfig}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-llm-config">
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
                <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    No LLM providers configured. Go to Settings to add one.
                  </p>
                </div>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
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
                    Ask me anything about financial statements, tax compliance, or accounting principles.
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
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10">
                            <img 
                              src={lucaLogoUrl} 
                              alt="Luca" 
                              className="h-5 w-5 object-contain"
                            />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`rounded-lg px-4 py-2 max-w-[80%] ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.isStreaming && (
                          <Loader2 className="h-3 w-3 animate-spin mt-1" />
                        )}
                      </div>
                      {message.role === "user" && (
                        <Avatar className="h-8 w-8">
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
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ask Luca about accounting, finance, or taxation..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="min-h-[60px] resize-none"
                  disabled={isStreaming}
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  className="h-[60px] w-[60px]"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
