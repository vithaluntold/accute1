/**
 * Onboard AI Agent - Frontend Interface
 * 
 * Jurisdiction-aware employee onboarding assistant interface
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Globe, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Upload,
  MessageSquare,
  Send,
  Loader2,
  FileCheck,
  Shield
} from "lucide-react";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Jurisdiction {
  id: string;
  code: string;
  name: string;
  region: string;
  isActive: boolean;
}

interface DocumentRequirement {
  id: string;
  documentTypeId: string;
  documentType: {
    id: string;
    code: string;
    name: string;
    category: string;
    description: string;
  };
  isRequired: boolean;
  priority: number;
  validationRules: any;
  displayOrder: number;
  employeeTypes: string[];
}

interface EmployeeDocument {
  id: string;
  documentTypeId: string;
  documentType: {
    id: string;
    code: string;
    name: string;
    category: string;
  };
  status: string;
  fileName: string;
  uploadedAt: string;
}

export default function OnboardAgentPage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("");

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: jurisdictions = [] } = useQuery<Jurisdiction[]>({
    queryKey: ["/api/jurisdictions"],
  });

  const { data: requirements = [] } = useQuery<DocumentRequirement[]>({
    queryKey: ["/api/jurisdictions", selectedJurisdiction, "requirements"],
    enabled: !!selectedJurisdiction,
  });

  const { data: submittedDocuments = [] } = useQuery<EmployeeDocument[]>({
    queryKey: ["/api/employee-documents"],
  });

  const { data: onboardingProgress } = useQuery<any>({
    queryKey: ["/api/employee-onboarding/progress"],
  });

  const {
    sessionId,
    messages,
    isStreaming,
    sendMessage: sendAgentMessage,
  } = useAgentSSE({
    agentSlug: "onboard",
    userId: currentUser?.id,
    organizationId: currentUser?.organizationId,
  });

  const calculateProgress = () => {
    if (!requirements.length) return 0;
    const requiredDocs = requirements.filter(r => r.isRequired);
    if (!requiredDocs.length) return 100;
    
    const submittedDocIds = new Set(submittedDocuments.map(d => d.documentTypeId));
    const completedRequired = requiredDocs.filter(r => submittedDocIds.has(r.documentTypeId));
    
    return Math.round((completedRequired.length / requiredDocs.length) * 100);
  };

  const progress = calculateProgress();

  const getDocumentStatus = (documentTypeId: string) => {
    const submitted = submittedDocuments.find(d => d.documentTypeId === documentTypeId);
    if (!submitted) return "pending";
    return submitted.status;
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const context = {
      jurisdiction: selectedJurisdiction ? {
        code: selectedJurisdiction,
        name: jurisdictions.find(j => j.code === selectedJurisdiction)?.name || "",
        requirements: requirements.map(r => ({
          documentTypeName: r.documentType.name,
          documentTypeCode: r.documentType.code,
          isRequired: r.isRequired,
          priority: r.priority,
          description: r.documentType.description,
        })),
      } : undefined,
      submittedDocuments: submittedDocuments.map(d => d.documentType.name),
      pendingDocuments: requirements
        .filter(r => r.isRequired && !submittedDocuments.find(s => s.documentTypeId === r.documentTypeId))
        .map(r => r.documentType.name),
      progressPercent: progress,
    };

    await sendAgentMessage(message, context);
    setMessage("");
  };

  const renderDocumentStatus = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Upload</Badge>;
      case "submitted":
        return <Badge variant="outline"><FileCheck className="h-3 w-3 mr-1" />Under Review</Badge>;
      case "rejected":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Shield className="h-6 w-6 text-primary" />
              Onboard AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Jurisdiction-Aware Employee Onboarding Assistant
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={selectedJurisdiction} 
                onValueChange={setSelectedJurisdiction}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-jurisdiction">
                  <SelectValue placeholder="Select Jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.id} value={j.code} data-testid={`option-jurisdiction-${j.code}`}>
                      {j.name} ({j.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedJurisdiction && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <div className="w-[120px]">
                  <Progress value={progress} className="h-2" data-testid="progress-onboarding" />
                </div>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-3 gap-6 p-6">
        {/* Left Panel - Document Requirements */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Checklist
              </CardTitle>
              <CardDescription>
                {selectedJurisdiction 
                  ? `Documents required for ${jurisdictions.find(j => j.code === selectedJurisdiction)?.name || selectedJurisdiction}`
                  : "Select a jurisdiction to see required documents"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {selectedJurisdiction ? (
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-3">
                    {requirements.length === 0 ? (
                      <Alert>
                        <AlertDescription>
                          Loading document requirements...
                        </AlertDescription>
                      </Alert>
                    ) : (
                      requirements.sort((a, b) => a.priority - b.priority).map((req, idx) => (
                        <div 
                          key={req.id} 
                          className="flex items-start justify-between p-3 rounded-lg border hover-elevate"
                          data-testid={`card-document-req-${idx}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{req.documentType.name}</span>
                              {req.isRequired && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {req.documentType.description || `Category: ${req.documentType.category}`}
                            </p>
                          </div>
                          <div className="ml-4">
                            {renderDocumentStatus(getDocumentStatus(req.documentTypeId))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Select Your Jurisdiction</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose your country/region to see the specific documents required for your onboarding
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {selectedJurisdiction && requirements.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {requirements.filter(r => r.isRequired).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Required</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-500">
                      {submittedDocuments.filter(d => d.status === 'verified').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Verified</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-500">
                      {requirements.filter(r => r.isRequired).length - submittedDocuments.filter(d => 
                        requirements.find(r => r.isRequired && r.documentTypeId === d.documentTypeId)
                      ).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Pending</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Center Panel - AI Chat */}
        <div className="col-span-2 flex flex-col gap-4 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Ask Onboard AI
              </CardTitle>
              <CardDescription>
                I can help you understand document requirements, track your progress, and answer compliance questions
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* Messages */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="space-y-4">
                      <Alert>
                        <Sparkles className="h-4 w-4" />
                        <AlertDescription>
                          Hi! I'm Onboard, your AI onboarding assistant. I can help you:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Understand which documents you need based on your jurisdiction</li>
                            <li>Explain document requirements and compliance rules</li>
                            <li>Track your onboarding progress</li>
                            <li>Answer questions about the process</li>
                          </ul>
                        </AlertDescription>
                      </Alert>
                      
                      {/* Quick Questions */}
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setMessage("What documents do I need to submit?")}
                          data-testid="button-quick-docs"
                        >
                          What documents do I need?
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setMessage("How do I get my tax identification number?")}
                          data-testid="button-quick-tax"
                        >
                          Tax ID guidance
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setMessage("What's my current onboarding status?")}
                          data-testid="button-quick-status"
                        >
                          Check my status
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`rounded-lg p-3 max-w-[80%] ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                        data-testid={`chat-message-${idx}`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  
                  {isStreaming && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about document requirements, compliance, or your onboarding status..."
                  className="min-h-[60px] resize-none flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  data-testid="textarea-chat-input"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isStreaming || !message.trim()}
                  className="px-4"
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
