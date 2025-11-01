import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Sparkles, Download, Copy, CheckCircle2, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

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
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("engagement_letter");
  const [templateDescription, setTemplateDescription] = useState("");
  const [editableContent, setEditableContent] = useState("");
  const { toast} = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      
      // Check if the response contains an error
      if (data.error) {
        console.error("API Error:", data.error, data.details);
        const errorMessage: Message = {
          role: "assistant",
          content: `Sorry, I encountered an error: ${data.error}${data.details ? ` (${data.details})` : ''}`
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
      
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response || "No response received",
        document: data.document
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update document if provided
      if (data.document) {
        setCurrentDocument(data.document);
      }
    } catch (error) {
      console.error("Network/Parse Error:", error);
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

  const openSaveDialog = () => {
    if (currentDocument) {
      setTemplateName(currentDocument.title);
      setTemplateCategory(
        currentDocument.type.toLowerCase().includes("engagement") ? "engagement_letter" :
        currentDocument.type.toLowerCase().includes("agreement") ? "service_agreement" :
        currentDocument.type.toLowerCase().includes("contract") ? "contract" :
        "engagement_letter"
      );
      setTemplateDescription(`Generated ${currentDocument.type}`);
      setEditableContent(currentDocument.content);
      setShowSaveDialog(true);
    }
  };

  const saveAsTemplate = async () => {
    try {
      const response = await fetch("/api/agents/parity/save-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: templateName,
          category: templateCategory,
          description: templateDescription,
          content: editableContent
        }),
      });

      if (response.ok) {
        toast({
          title: "Template saved",
          description: "Your document has been saved as a reusable template."
        });
        setShowSaveDialog(false);
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to save template.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left Panel - Chat Interface */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full mr-2">
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
        
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
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
              
              <div ref={messagesEndRef} />
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
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Panel - Document Preview */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <Card className="flex flex-col h-full ml-2">
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
                <Button 
                  size="sm"
                  onClick={openSaveDialog}
                  data-testid="button-save-template"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save as Template
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
      </ResizablePanel>
    </ResizablePanelGroup>

    {/* Save as Template Dialog */}
    <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Edit and save this document as a reusable template for future use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard CPA Engagement Letter"
              data-testid="input-template-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">Category</Label>
            <Select value={templateCategory} onValueChange={setTemplateCategory}>
              <SelectTrigger id="template-category" data-testid="select-template-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engagement_letter">Engagement Letter</SelectItem>
                <SelectItem value="service_agreement">Service Agreement</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="compliance_form">Compliance Form</SelectItem>
                <SelectItem value="legal_notice">Legal Notice</SelectItem>
                <SelectItem value="tax_form">Tax Form</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Input
              id="template-description"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Brief description of this template"
              data-testid="input-template-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-content">Content (Editable)</Label>
            <Textarea
              id="template-content"
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
              placeholder="Document content..."
              data-testid="textarea-template-content"
            />
            <p className="text-xs text-muted-foreground">
              You can edit the content before saving as a template
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSaveDialog(false)}
            data-testid="button-cancel-save"
          >
            Cancel
          </Button>
          <Button
            onClick={saveAsTemplate}
            disabled={!templateName.trim() || !editableContent.trim()}
            data-testid="button-confirm-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
