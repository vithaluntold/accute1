import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Sparkles, User, Loader2, Settings2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AIAgentChatProps {
  agentName: "Parity" | "Cadence" | "Forma" | "Kanban View";
  trigger?: React.ReactNode;
  mode?: "dialog" | "popover";
  contextData?: any;
  onResponse?: (response: string) => void;
}

export function AIAgentChat({
  agentName,
  trigger,
  mode = "popover",
  contextData,
  onResponse,
}: AIAgentChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingContentRef = useRef<string>("");
  const { toast } = useToast();

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

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return wsRef.current;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/ai-stream`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('WebSocket authenticated');
        } else if (data.type === 'stream_start') {
          // Create a new assistant message placeholder
          const messageId = Date.now().toString();
          streamingMessageIdRef.current = messageId;
          streamingContentRef.current = "";
          setMessages((prev) => [
            ...prev,
            {
              id: messageId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              isStreaming: true,
            },
          ]);
        } else if (data.type === 'stream_chunk') {
          // Append chunk to the streaming message
          if (streamingMessageIdRef.current) {
            streamingContentRef.current += data.chunk;
            setMessages((prev) => 
              prev.map((msg) =>
                msg.id === streamingMessageIdRef.current
                  ? { ...msg, content: streamingContentRef.current }
                  : msg
              )
            );
          }
        } else if (data.type === 'stream_end') {
          // Mark streaming as complete
          if (streamingMessageIdRef.current) {
            const finalContent = streamingContentRef.current;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageIdRef.current
                  ? { ...msg, isStreaming: false, content: finalContent }
                  : msg
              )
            );
            // Call onResponse with the complete content from ref (not stale closure)
            if (onResponse && finalContent) {
              onResponse(finalContent);
            }
          }
          streamingMessageIdRef.current = null;
          streamingContentRef.current = "";
          setIsStreaming(false);
        } else if (data.type === 'error') {
          // Display error in the streaming message
          if (streamingMessageIdRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === streamingMessageIdRef.current
                  ? { 
                      ...msg, 
                      content: `❌ Error: ${data.error || 'Failed to get AI response'}`,
                      isStreaming: false 
                    }
                  : msg
              )
            );
          } else {
            toast({
              title: "Error",
              description: data.error || "Failed to get AI response",
              variant: "destructive",
            });
          }
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
          streamingContentRef.current = "";
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to AI streaming service",
        variant: "destructive",
      });
      setIsStreaming(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      wsRef.current = null;
      setIsStreaming(false);
    };

    wsRef.current = ws;
    return ws;
  }, [toast, onResponse, messages]);

  // Cleanup WebSocket on unmount or when dialog closes
  useEffect(() => {
    if (!open && wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

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

    // Connect and send via WebSocket
    const ws = connectWebSocket();
    
    // Wait for connection to open if not already open
    if (ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({
          type: 'execute_agent',
          agentName,
          input: input.trim(),
          llmConfigId: selectedLlmConfig,
          contextData,
        }));
      }, { once: true });
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'execute_agent',
        agentName,
        input: input.trim(),
        llmConfigId: selectedLlmConfig,
        contextData,
      }));
    } else {
      toast({
        title: "Connection Error",
        description: "Unable to connect to AI service",
        variant: "destructive",
      });
      setIsStreaming(false);
    }

    setInput("");
  };

  const getAgentDescription = () => {
    switch (agentName) {
      case "Parity":
        return "Data consistency and validation expert";
      case "Cadence":
        return "Workflow timing and scheduling optimizer";
      case "Forma":
        return "Document formatting and validation specialist";
      case "Kanban View":
        return "Task organization and visualization helper";
      default:
        return "AI Assistant";
    }
  };

  const getAgentIcon = () => {
    return <Bot className="h-5 w-5" />;
  };

  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            {getAgentIcon()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold" data-testid="text-agent-name">
                {agentName}
              </h3>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {getAgentDescription()}
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="font-medium mb-2">Chat with {agentName}</h4>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask me anything! I'm here to help with {getAgentDescription().toLowerCase()}.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="chat-messages">
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
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`rounded-lg p-3 max-w-[80%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                  data-testid={`message-${message.role}`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isStreaming && streamingMessageIdRef.current === null && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg p-3 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type your message..."
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
  );

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2" data-testid={`button-chat-${agentName.toLowerCase().replace(" ", "-")}`}>
      <Sparkles className="h-4 w-4" />
      Chat with {agentName}
    </Button>
  );

  if (mode === "dialog") {
    return (
      <>
        {trigger ? (
          <div onClick={() => setOpen(true)}>{trigger}</div>
        ) : (
          <div onClick={() => setOpen(true)}>{defaultTrigger}</div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl h-[600px] p-0 flex flex-col" data-testid={`dialog-chat-${agentName.toLowerCase().replace(" ", "-")}`}>
            <DialogHeader className="sr-only">
              <DialogTitle>Chat with {agentName}</DialogTitle>
              <DialogDescription>{getAgentDescription()}</DialogDescription>
            </DialogHeader>
            {chatContent}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || defaultTrigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 h-[500px] p-0 flex flex-col" data-testid={`popover-chat-${agentName.toLowerCase().replace(" ", "-")}`}>
        {chatContent}
      </PopoverContent>
    </Popover>
  );
}
