import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Sparkles, Download, Copy, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  document?: GeneratedDocument;
}

interface GeneratedDocument {
  title: string;
  type: string;
  content: string;
  status: "generating" | "complete";
}

export default function ParityAgent() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi! I'm Parity, your intelligent document generator and compliance assistant. I can help you create:\n\n• Engagement Letters\n• Service Agreements\n• Financial Reports\n• Compliance Documents\n• Tax Forms\n• Client Contracts\n\nWhat document would you like to create today?"
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<GeneratedDocument | null>(null);
  const { toast } = useToast();

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agents/parity/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          message: input, 
          history: messages,
          currentDocument: currentDocument 
        }),
      });

      const data = await response.json();
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response,
        document: data.document
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update document if provided
      if (data.document) {
        setCurrentDocument(data.document);
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please ensure you have configured your AI provider credentials in Settings > LLM Configuration."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (currentDocument?.content) {
      navigator.clipboard.writeText(currentDocument.content);
      toast({
        title: "Copied to clipboard",
        description: "Document content has been copied to your clipboard."
      });
    }
  };

  const downloadDocument = () => {
    if (currentDocument?.content) {
      const blob = new Blob([currentDocument.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDocument.title || 'document'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: "Your document is being downloaded."
      });
    }
  };

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Panel - Chat Interface */}
      <Card className="flex flex-col h-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                Parity
                <Badge variant="secondary" className="text-xs">AI</Badge>
              </div>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Document generator & compliance assistant
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
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0">
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
                    
                    {msg.document && msg.document.status === "complete" && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span>Document generated: {msg.document.title}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0">
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
                      <span className="text-sm text-muted-foreground">Generating...</span>
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
                placeholder="Describe the document you need..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage()}
                disabled={isLoading}
                data-testid="input-parity-message"
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

      {/* Right Panel - Document Preview */}
      <Card className="flex flex-col h-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Document Preview
            </div>
            {currentDocument && currentDocument.status === "complete" && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={copyToClipboard}
                  data-testid="button-copy-document"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadDocument}
                  data-testid="button-download-document"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          {!currentDocument ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No Document Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Start a conversation with Parity to generate professional documents, contracts, and compliance materials.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                {/* Document Header */}
                <div className="space-y-2 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-xl" data-testid="text-document-title">
                      {currentDocument.title}
                    </h3>
                    {currentDocument.status === "generating" ? (
                      <Badge variant="secondary" className="animate-pulse">
                        Generating...
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Type: {currentDocument.type}
                  </p>
                </div>

                {/* Document Content */}
                <div className="prose prose-sm max-w-none">
                  <div 
                    className="whitespace-pre-wrap font-mono text-sm bg-muted/50 p-4 rounded-md"
                    data-testid="text-document-content"
                  >
                    {currentDocument.content}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
