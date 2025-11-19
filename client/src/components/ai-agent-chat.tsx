import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Bot, Send, Sparkles, User, Loader2, Settings2, FileText, Download } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AITransparencyIndicator, AIReasoning, type AITransparencyData } from "@/components/ai-transparency-indicator";
import { ProcessingIndicator } from "@/components/ui-psychology/ProcessingIndicator";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { getAgentSlug } from "@/lib/agent-utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  transparency?: AITransparencyData;
}

interface AIAgentChatProps {
  agentName: "Parity" | "Cadence" | "Forma" | "Kanban View" | "luca";
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
  const [reasoningOpenMap, setReasoningOpenMap] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingContentRef = useRef<string>("");
  const { toast } = useToast();
  
  // Use SSE hook for agent streaming
  const { sendMessage, isStreaming, cancelStream } = useAgentSSE({
    onStreamStart: () => {
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
    },
    onChunk: (chunk: string) => {
      // Append chunk to the streaming message
      if (streamingMessageIdRef.current) {
        streamingContentRef.current += chunk;
        setMessages((prev) => 
          prev.map((msg) =>
            msg.id === streamingMessageIdRef.current
              ? { ...msg, content: streamingContentRef.current }
              : msg
          )
        );
      }
    },
    onComplete: (fullResponse: string) => {
      // Mark streaming as complete
      if (streamingMessageIdRef.current) {
        const finalContent = fullResponse;
        
        // Generate AI transparency data (mock for now - will be from backend later)
        const generateTransparencyData = (): AITransparencyData => {
          const wordCount = finalContent.split(/\s+/).length;
          const hasNumbers = /\d/.test(finalContent);
          const hasStructure = finalContent.includes('\n') || finalContent.includes('•') || finalContent.includes('-');
          
          let confidence = 85; // Base confidence
          if (wordCount > 100) confidence += 5;
          if (hasNumbers) confidence += 3;
          if (hasStructure) confidence += 2;
          confidence = Math.min(95, confidence);
          
          return {
            confidence,
            reasoning: `Response analyzed for ${wordCount} words of context. ${hasNumbers ? 'Contains data-driven insights. ' : ''}${hasStructure ? 'Uses structured formatting. ' : ''}Note: This is an estimated confidence score. Real AI transparency will be available when backend integration is complete.`,
            modelUsed: selectedLlmConfig ? llmConfigs.find(c => c.id === selectedLlmConfig)?.model || "AI Model" : "AI Model",
            isEstimated: true,
          };
        };
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingMessageIdRef.current
              ? { 
                  ...msg, 
                  isStreaming: false, 
                  content: finalContent,
                  transparency: generateTransparencyData()
                }
              : msg
          )
        );
        
        // Call onResponse callback
        if (onResponse && finalContent) {
          onResponse(finalContent);
        }
      }
      streamingMessageIdRef.current = null;
      streamingContentRef.current = "";
    },
    onError: (error: string) => {
      // Display error in the streaming message
      if (streamingMessageIdRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingMessageIdRef.current
              ? { 
                  ...msg, 
                  content: `❌ Error: ${error}`,
                  isStreaming: false 
                }
              : msg
          )
        );
      } else {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      }
      streamingMessageIdRef.current = null;
      streamingContentRef.current = "";
    },
  });

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

  // Generate PDF document mutation
  const generateDocumentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', '/api/documents/generate-engagement-letter', {
        content,
        title: 'Engagement Letter',
      });
      return await response.json();
    },
    onSuccess: (document: any) => {
      toast({
        title: "Document Generated",
        description: "Your engagement letter has been created successfully.",
      });
      // Download the PDF
      window.open(`/api/documents/${document.id}/download`, '_blank');
      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create session when dialog opens
  useEffect(() => {
    const createSession = async () => {
      if (open && !sessionId) {
        try {
          const response = await apiRequest('POST', '/api/ai-agent/sessions', {
            agentSlug: getAgentSlug(agentName),
            title: `${agentName} Chat`,
          });
          setSessionId(response.id);
        } catch (error) {
          console.error('[AI Chat] Failed to create session:', error);
          toast({
            title: "Error",
            description: "Failed to initialize chat session",
            variant: "destructive",
          });
        }
      }
    };

    createSession();
  }, [open, sessionId, agentName, toast]);

  // Cleanup stream and reset session when dialog closes
  useEffect(() => {
    if (!open) {
      cancelStream();
      // Reset session state for clean reopening
      setSessionId(null);
      setMessages([]);
      streamingMessageIdRef.current = null;
      streamingContentRef.current = "";
    }
  }, [open, cancelStream]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
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

    if (!sessionId) {
      toast({
        title: "Session Not Ready",
        description: "Please wait for chat session to initialize",
        variant: "destructive",
      });
      return;
    }

    // Add user message to UI
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const messageText = input.trim();
    setInput("");

    // Send message via SSE hook
    try {
      await sendMessage({
        agentSlug: getAgentSlug(agentName),
        message: messageText,
        sessionId,
        llmConfigId: selectedLlmConfig,
        contextType: contextData ? 'custom' : undefined,
        contextId: contextData?.id,
        contextData,
      });
    } catch (error) {
      // Remove streaming placeholder on error
      if (streamingMessageIdRef.current) {
        setMessages((prev) => prev.filter((msg) => msg.id !== streamingMessageIdRef.current));
        streamingMessageIdRef.current = null;
        streamingContentRef.current = "";
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    }
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
      case "luca":
        return "Your accounting, finance & taxation expert";
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
                  {message.role === "assistant" && message.isStreaming && !message.content ? (
                    <ProcessingIndicator 
                      status="processing" 
                      variant="ai" 
                      className="bg-transparent dark:bg-transparent"
                    />
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                      {/* AI Transparency for assistant messages */}
                      {message.role === "assistant" && message.transparency && (
                        <>
                          <AITransparencyIndicator 
                            data={message.transparency} 
                            variant="inline"
                            showReasoning={reasoningOpenMap[message.id] || false}
                            onToggleReasoning={(show) => setReasoningOpenMap(prev => ({
                              ...prev,
                              [message.id]: show
                            }))}
                          />
                          {message.transparency.reasoning && (
                            <AIReasoning 
                              reasoning={message.transparency.reasoning}
                              isOpen={reasoningOpenMap[message.id] || false}
                              onToggle={(open) => setReasoningOpenMap(prev => ({
                                ...prev,
                                [message.id]: open
                              }))}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
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
                  <ProcessingIndicator 
                    status="processing" 
                    variant="ai" 
                    className="bg-transparent dark:bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Generate Document Button - appears when there's substantial content from Parity */}
      {agentName === "Parity" && messages.length > 0 && (
        (() => {
          const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant" && !m.isStreaming);
          const hasSubstantialContent = lastAssistantMessage && lastAssistantMessage.content.length > 500;
          
          if (hasSubstantialContent) {
            return (
              <div className="border-t p-3 bg-muted/30">
                <Button
                  onClick={() => generateDocumentMutation.mutate(lastAssistantMessage.content)}
                  disabled={generateDocumentMutation.isPending}
                  variant="default"
                  className="w-full gap-2"
                  data-testid="button-generate-document"
                >
                  {generateDocumentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Generate Document (PDF)
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Create a professional PDF document from this engagement letter
                </p>
              </div>
            );
          }
          return null;
        })()
      )}

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
