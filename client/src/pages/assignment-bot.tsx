import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AssignmentBot() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const { toast } = useToast();

  const queryMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await fetch("/api/assignment-bot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: q })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process query");
      }
      return await response.json() as { answer: string; question: string };
    },
    onSuccess: (data: { answer: string; question: string }) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: data.question },
        { role: "assistant", content: data.answer }
      ]);
      setQuestion("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process query",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    queryMutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const exampleQuestions = [
    "How many assignments are currently overdue?",
    "Which team member has the most active assignments?",
    "What's the average completion time for our workflows?",
    "Show me assignments that need attention",
    "What are the current bottlenecks in our processes?"
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assignment Status Bot</h1>
        <p className="text-muted-foreground mt-2">
          Ask questions about your workflow assignments, progress, and team performance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Assistant
          </CardTitle>
          <CardDescription>
            Ask natural language questions about your assignments and workflows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              <div className="grid gap-2">
                {exampleQuestions.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="justify-start text-left h-auto p-3 hover-elevate"
                    onClick={() => setQuestion(q)}
                    data-testid={`button-example-${i}`}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${i}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={`rounded-lg px-4 py-3 max-w-[80%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about assignments, progress, or team performance..."
              className="min-h-[100px]"
              disabled={queryMutation.isPending}
              data-testid="input-question"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </p>
              <Button
                type="submit"
                disabled={!question.trim() || queryMutation.isPending}
                data-testid="button-send"
              >
                {queryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {messages.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setMessages([])}
            data-testid="button-clear"
          >
            Clear Conversation
          </Button>
        </div>
      )}
    </div>
  );
}
