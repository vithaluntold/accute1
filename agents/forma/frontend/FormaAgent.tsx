import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormInput, Send, Sparkles, Plus, Type, CheckSquare, Calendar, Hash, Mail, Phone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

interface Message {
  role: "user" | "assistant";
  content: string;
  formUpdate?: FormState;
}

interface FormState {
  name: string;
  description?: string;
  fields: FormField[];
  status: "building" | "complete";
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "checkbox" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
}

export default function FormaAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Forma, your AI form builder. Tell me what form you need and I'll build it conversationally. For example:\n\n• 'Create a client intake form'\n• 'Build a tax document request form'\n• 'Make an employee onboarding form'\n\nWhat form would you like to create?"
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState<FormState | null>(null);
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/forma/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          message: input, 
          history: messages,
          currentForm: formState 
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response,
        formUpdate: data.formUpdate
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.formUpdate) {
        setFormState(data.formUpdate);
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please configure your AI provider in Settings > LLM Configuration."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveForm = async () => {
    if (!formState) return;

    try {
      const response = await fetch("/api/agents/forma/save-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formState),
      });

      if (response.ok) {
        toast({
          title: "Form saved",
          description: "Your form has been saved successfully."
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save form.",
        variant: "destructive"
      });
    }
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case "email": return Mail;
      case "number": return Hash;
      case "date": return Calendar;
      case "checkbox": return CheckSquare;
      case "phone": return Phone;
      default: return Type;
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full gap-4">
      {/* Left Panel - Chat Interface */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
              <FormInput className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Forma
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Conversational form builder
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
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex-shrink-0">
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
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex-shrink-0">
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
                      <span className="text-sm text-muted-foreground">Building form...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                placeholder="Describe your form or add fields..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage()}
                disabled={isLoading}
                data-testid="input-forma-message"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isLoading || !input.trim()}
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

      {/* Right Panel - Live Form Preview */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FormInput className="h-5 w-5 text-primary" />
              Form Preview
            </CardTitle>
            {formState && formState.status === "complete" && (
              <Button 
                onClick={saveForm}
                size="sm"
                data-testid="button-save-form"
              >
                Save Form
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          {!formState ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FormInput className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No Form Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start chatting with Forma to build your form. I'll create fields as we talk!
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Form Header */}
                <div className="space-y-2 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-2xl" data-testid="text-form-title">
                      {formState.name}
                    </h3>
                    {formState.status === "building" ? (
                      <Badge variant="secondary" className="animate-pulse">
                        Building...
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        Complete
                      </Badge>
                    )}
                  </div>
                  {formState.description && (
                    <p className="text-sm text-muted-foreground">{formState.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formState.fields.length} {formState.fields.length === 1 ? 'field' : 'fields'}
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  {formState.fields.sort((a, b) => a.order - b.order).map((field) => {
                    const FieldIcon = getFieldIcon(field.type);
                    return (
                      <div
                        key={field.id}
                        className="p-4 rounded-lg border bg-card hover-elevate transition-base"
                        data-testid={`field-${field.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
                            <FieldIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="font-medium text-sm">
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </label>
                              <Badge variant="outline" className="text-xs">{field.type}</Badge>
                            </div>
                            
                            {/* Field Preview */}
                            {field.type === "textarea" ? (
                              <textarea
                                className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                                placeholder={field.placeholder || field.label}
                                rows={3}
                                disabled
                              />
                            ) : field.type === "select" ? (
                              <select
                                className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                                disabled
                              >
                                <option>{field.placeholder || "Select an option"}</option>
                                {field.options?.map((opt, i) => (
                                  <option key={i}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === "checkbox" ? (
                              <div className="flex items-center gap-2">
                                <input type="checkbox" disabled className="rounded" />
                                <span className="text-sm text-muted-foreground">{field.placeholder}</span>
                              </div>
                            ) : (
                              <input
                                type={field.type}
                                className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                                placeholder={field.placeholder || field.label}
                                disabled
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {formState.fields.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No fields yet. Keep chatting to add fields!
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
