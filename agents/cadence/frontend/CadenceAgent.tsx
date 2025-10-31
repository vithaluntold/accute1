import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, Send, Sparkles, Workflow, Plus, ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface Message {
  role: "user" | "assistant";
  content: string;
  workflowUpdate?: WorkflowState;
}

interface WorkflowState {
  name: string;
  description?: string;
  stages: Stage[];
  status: "building" | "complete";
}

interface Stage {
  id: string;
  name: string;
  order: number;
  steps: Step[];
}

interface Step {
  id: string;
  name: string;
  description?: string;
  order: number;
  status: "pending" | "added" | "complete";
}

export default function CadenceAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Cadence, your workflow timing and scheduling optimizer. Tell me what workflow you'd like to build, and I'll help you create it step by step. For example: 'Create a client onboarding workflow' or 'Build a monthly tax filing process'."
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/cadence/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          message: input, 
          history: messages,
          currentWorkflow: workflowState 
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response,
        workflowUpdate: data.workflowUpdate
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update workflow state if provided
      if (data.workflowUpdate) {
        setWorkflowState(data.workflowUpdate);
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full gap-4">
      {/* Left Panel - Chat Interface */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Cadence
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Workflow timing and scheduling optimizer
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
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
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-lg max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted p-3 rounded-lg animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Describe the workflow you want to build..."
                disabled={isLoading}
                data-testid="input-cadence-message"
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                data-testid="button-send-message"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Panel - Live Workflow Preview */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Live Workflow Preview
            {workflowState?.status === "complete" && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Badge>
            )}
            {workflowState?.status === "building" && (
              <Badge variant="secondary" className="gap-1 animate-pulse">
                <Clock className="h-3 w-3" />
                Building...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full p-6">
            {!workflowState ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                  <Workflow className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Workflow Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Start chatting with Cadence to build your workflow. I'll show you the workflow structure as we build it together.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Workflow Header */}
                <div>
                  <h2 className="text-2xl font-bold mb-2">{workflowState.name}</h2>
                  {workflowState.description && (
                    <p className="text-sm text-muted-foreground">{workflowState.description}</p>
                  )}
                </div>

                <Separator />

                {/* Stages */}
                <div className="space-y-6">
                  {workflowState.stages.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Let's add some stages to your workflow...
                    </div>
                  ) : (
                    workflowState.stages.map((stage, stageIdx) => (
                      <div key={stage.id} className="space-y-3">
                        {/* Stage Header */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                            {stageIdx + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{stage.name}</h3>
                          </div>
                        </div>

                        {/* Steps */}
                        {stage.steps.length > 0 && (
                          <div className="ml-11 space-y-2">
                            {stage.steps.map((step, stepIdx) => (
                              <div
                                key={step.id}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                  step.status === "added"
                                    ? "border-primary bg-primary/5 animate-pulse"
                                    : step.status === "complete"
                                    ? "border-green-500/50 bg-green-500/5"
                                    : "border-border bg-card"
                                }`}
                                data-testid={`workflow-step-${step.id}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex items-center justify-center w-6 h-6 rounded bg-muted text-muted-foreground text-xs font-medium flex-shrink-0 mt-0.5">
                                    {stepIdx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{step.name}</div>
                                    {step.description && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {step.description}
                                      </div>
                                    )}
                                  </div>
                                  {step.status === "complete" && (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  )}
                                  {step.status === "added" && (
                                    <Plus className="h-4 w-4 text-primary flex-shrink-0 animate-pulse" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Arrow between stages */}
                        {stageIdx < workflowState.stages.length - 1 && (
                          <div className="flex items-center justify-center py-2">
                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Action Buttons */}
                {workflowState.status === "complete" && (
                  <div className="pt-4 border-t">
                    <Button 
                      className="w-full" 
                      data-testid="button-save-workflow"
                      onClick={async () => {
                        try {
                          const response = await fetch("/api/agents/cadence/save-workflow", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ workflow: workflowState }),
                          });
                          const data = await response.json();
                          if (data.success) {
                            // Show success message and navigate
                            alert("Workflow saved successfully!");
                            window.location.href = "/workflows";
                          }
                        } catch (error) {
                          console.error("Failed to save workflow:", error);
                          alert("Failed to save workflow. Please try again.");
                        }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Workflow
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
