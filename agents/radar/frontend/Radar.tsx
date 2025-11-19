import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Calendar, FileText, Activity, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ActivityLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: any;
  createdAt: string;
  userId?: string;
}

export default function Radar() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm Radar, your comprehensive activity tracking assistant. I maintain timestamped audit trails for legal evidence and client accountability. Ask me about activity logs, generate accountability reports, or track project timelines. How can I help you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedResource, setSelectedResource] = useState<{type: string, id: string} | null>(null);
  const [selectedLlmConfig, setSelectedLlmConfig] = useState<string>("");
  
  // WebSocket streaming state
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const streamingResponseRef = useRef<string>("");

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
  
  // Initialize WebSocket for streaming
  const { sendMessage: sendWebSocketMessage, isStreaming } = useAgentWebSocket({
    agentName: 'radar',
    onStreamChunk: (chunk: string) => {
      streamingResponseRef.current += chunk;
      setStreamingMessage(streamingResponseRef.current);
    },
    onStreamComplete: async (fullResponse: string) => {
      const assistantMessage: Message = {
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Clear streaming state
      setStreamingMessage("");
      streamingResponseRef.current = "";
    },
    onError: (error: string) => {
      console.error('[Radar WebSocket] Error:', error);
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      });
      setStreamingMessage("");
      streamingResponseRef.current = "";
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/agents/radar/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message,
          history: messages.slice(-10),
          assignmentId: selectedResource?.type === 'assignment' ? selectedResource.id : undefined,
          projectId: selectedResource?.type === 'project' ? selectedResource.id : undefined,
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
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    const userInput = input;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    streamingResponseRef.current = "";

    // Try WebSocket first
    const wsSuccess = await sendWebSocketMessage({
      input: userInput,
      llmConfigId: selectedLlmConfig,
      contextData: {
        history: messages.slice(-10),
        assignmentId: selectedResource?.type === 'assignment' ? selectedResource.id : undefined,
        projectId: selectedResource?.type === 'project' ? selectedResource.id : undefined,
      }
    });

    // Fallback to HTTP if WebSocket fails
    if (!wsSuccess) {
      console.log('[Radar] WebSocket unavailable, using HTTP fallback');
      chatMutation.mutate(userInput);
    }
  };

  const handleQuickQuery = async (query: string) => {
    if (isStreaming) return;
    
    // Add user message immediately
    const userMessage: Message = {
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    streamingResponseRef.current = "";
    
    // Try WebSocket first
    const wsSuccess = await sendWebSocketMessage({
      input: query,
      llmConfigId: selectedLlmConfig,
      contextData: {
        history: messages.slice(-10),
        assignmentId: selectedResource?.type === 'assignment' ? selectedResource.id : undefined,
        projectId: selectedResource?.type === 'project' ? selectedResource.id : undefined,
      }
    });

    // Fallback to HTTP if WebSocket fails
    if (!wsSuccess) {
      console.log('[Radar] WebSocket unavailable, using HTTP fallback');
      chatMutation.mutate(query);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-6 pb-20 gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Radar
                <Badge variant="secondary">Activity Logger</Badge>
              </CardTitle>
              <CardDescription className="mt-2">
                Comprehensive activity tracking for legal evidence and client accountability
              </CardDescription>
            </div>
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
      </Card>

      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat" data-testid="tab-chat">
            <Send className="h-4 w-4 mr-2" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Calendar className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 flex flex-col gap-4 pt-6">
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
                        className={`max-w-[85%] rounded-lg p-4 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        <p className="text-xs mt-2 opacity-70">
                          {new Date(message.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {streamingMessage && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{streamingMessage}</p>
                        <p className="text-xs mt-2 opacity-70">Streaming...</p>
                      </div>
                    </div>
                  )}
                  {chatMutation.isPending && !isStreaming && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-4">
                        <p className="text-sm">Analyzing activity logs...</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuery("Show me all activities from the last 7 days")}
                  data-testid="quick-query-7days"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuery("Generate accountability report for pending tasks")}
                  data-testid="quick-query-pending"
                >
                  Pending Tasks Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuery("Show me client communication delays")}
                  data-testid="quick-query-delays"
                >
                  Client Delays
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuery("Timeline of document requests and submissions")}
                  data-testid="quick-query-documents"
                >
                  Document Timeline
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about activity logs, timelines, or generate reports..."
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
        </TabsContent>

        <TabsContent value="timeline" className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Chronological view of all tracked activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select an assignment or project to view its activity timeline, or use the chat to query specific activities.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="flex-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Accountability Reports</CardTitle>
              <CardDescription>Generate evidence-ready reports for compliance and legal purposes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use the chat to generate custom accountability reports:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Client delay evidence reports</li>
                  <li>Task progression timelines</li>
                  <li>Communication history exports</li>
                  <li>Deadline compliance reports</li>
                  <li>Team activity summaries</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
