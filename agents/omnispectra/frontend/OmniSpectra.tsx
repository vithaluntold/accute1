import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { apiRequest } from "@/lib/queryClient";
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
  timestamp: string;
}

export default function OmniSpectra() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm OmniSpectra. I can help you track assignments, monitor team workload, check availability, and answer questions about project progress. How can I help you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "How many assignments are currently overdue?",
    "Which team member has the most active assignments?",
    "Show me team workload distribution",
    "What are the current bottlenecks?",
  ]);
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // SSE streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const streamingResponseRef = useRef<string>("");
  const streamingMessageIdRef = useRef<string | null>(null);

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
  
  // Initialize SSE for streaming
  const { sendMessage: sendSSEMessage, isStreaming, cancelStream } = useAgentSSE({
    onStreamStart: () => {
      streamingMessageIdRef.current = Date.now().toString();
      streamingResponseRef.current = "";
      setStreamingMessage("");
    },
    onChunk: (chunk: string) => {
      streamingResponseRef.current += chunk;
      setStreamingMessage(streamingResponseRef.current);
    },
    onComplete: async (fullResponse: string) => {
      const assistantMessage: Message = {
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Clear streaming state
      setStreamingMessage("");
      streamingResponseRef.current = "";
      streamingMessageIdRef.current = null;
    },
    onError: (error: string) => {
      console.error('[OmniSpectra SSE] Error:', error);
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      });
      setStreamingMessage("");
      streamingResponseRef.current = "";
      streamingMessageIdRef.current = null;
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/agents/omnispectra/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message,
          history: messages.slice(-10),
          context: {},
          ...(selectedLlmConfig && { llmConfigId: selectedLlmConfig }),
        }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: data.timestamp,
        },
      ]);
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create session mutation - creates a real database session for SSE streaming
  const createSessionMutation = useMutation({
    mutationFn: async (title: string = "New Chat") => {
      const response = await apiRequest("POST", "/api/agents/omnispectra/sessions", { title });
      return await response.json();
    },
    onError: () => {
      toast({
        title: "Session Error",
        description: "Failed to create chat session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    if (!selectedLlmConfig) {
      toast({
        title: "Configuration Required",
        description: "Please select an LLM configuration first",
        variant: "destructive",
      });
      return;
    }

    // Create session if it doesn't exist
    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession = await createSessionMutation.mutateAsync("New Chat");
      sessionId = newSession.sessionId; // Use sessionId field, not id
      setCurrentSessionId(sessionId);
    }

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    const userInput = input;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    streamingResponseRef.current = "";

    // Use SSE for streaming with real session ID
    try {
      await sendSSEMessage({
        agentSlug: 'omnispectra',
        message: userInput,
        sessionId,
        llmConfigId: selectedLlmConfig,
        contextData: {
          history: messages.slice(-10),
          context: {},
        }
      });
    } catch (error) {
      console.error('[OmniSpectra] SSE streaming failed, using HTTP fallback:', error);
      chatMutation.mutate(userInput);
    }
  };

  const handleSuggestion = async (suggestion: string) => {
    if (isStreaming) return;

    if (!selectedLlmConfig) {
      toast({
        title: "Configuration Required",
        description: "Please select an LLM configuration first",
        variant: "destructive",
      });
      return;
    }

    // Create session if it doesn't exist
    let sessionId = currentSessionId;
    if (!sessionId) {
      const newSession = await createSessionMutation.mutateAsync("New Chat");
      sessionId = newSession.sessionId; // Use sessionId field, not id
      setCurrentSessionId(sessionId);
    }
    
    // Add user message immediately
    const userMessage: Message = {
      role: "user",
      content: suggestion,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    streamingResponseRef.current = "";
    
    // Use SSE for streaming with real session ID
    try {
      await sendSSEMessage({
        agentSlug: 'omnispectra',
        message: suggestion,
        sessionId,
        llmConfigId: selectedLlmConfig,
        contextData: {
          history: messages.slice(-10),
          context: {},
        }
      });
    } catch (error) {
      console.error('[OmniSpectra] SSE streaming failed, using HTTP fallback:', error);
      chatMutation.mutate(suggestion);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-6 pb-20 gap-4">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              OmniSpectra
              <Badge variant="secondary">AI Assistant</Badge>
            </CardTitle>
            <div className="w-64">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
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
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                  data-testid={`message-${index}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {streamingMessage && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                    <p className="text-xs mt-1 opacity-70">Streaming...</p>
                  </div>
                </div>
              )}
              {chatMutation.isPending && !isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm">Thinking...</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestion(suggestion)}
                  data-testid={`suggestion-${index}`}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask about work status..."
              disabled={isStreaming || chatMutation.isPending}
              data-testid="input-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || chatMutation.isPending}
              data-testid="button-send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
