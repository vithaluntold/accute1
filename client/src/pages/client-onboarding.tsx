import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bot, Send, Loader2, CheckCircle, UserPlus, Building2 } from "lucide-react";
import type { ClientOnboardingSession, OnboardingMessage } from "@shared/schema";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ClientOnboarding() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSensitiveForm, setShowSensitiveForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sensitive data collected via form (never sent to AI)
  const [sensitiveData, setSensitiveData] = useState({
    companyName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactPhone: "",
  });

  // Non-sensitive data that can be sent to AI
  const [collectedData, setCollectedData] = useState({
    country: "",
    clientType: "",
    industry: "",
    primaryTaxId: "",
    taxIds: {} as Record<string, string>,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start onboarding session
  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        "/api/client-onboarding/start",
        {}
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start onboarding session");
      }
      return await response.json() as { session: ClientOnboardingSession; messages: OnboardingMessage[] };
    },
    onSuccess: (data) => {
      setSessionId(data.session.id);
      setMessages(data.messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      })));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start onboarding session",
        variant: "destructive",
      });
    },
  });

  // Send message to AI
  const chatMutation = useMutation({
    mutationFn: async (params: {
      sessionId: string;
      message: string;
      sensitiveData?: Record<string, any>;
      collectedData?: Record<string, any>;
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/client-onboarding/chat",
        params
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }
      return await response.json() as { messages: OnboardingMessage[] };
    },
    onSuccess: (data) => {
      setMessages(data.messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      })));
      setIsLoading(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  // Complete onboarding
  const completeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiRequest(
        "POST",
        "/api/client-onboarding/complete",
        { sessionId }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to complete onboarding");
      }
      return await response.json() as { client: any; success: boolean };
    },
    onSuccess: (data) => {
      toast({
        title: "Client Created!",
        description: `Successfully created client: ${data.client.companyName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      // Reset state
      setSessionId(null);
      setMessages([]);
      setSensitiveData({
        companyName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        contactFirstName: "",
        contactLastName: "",
        contactEmail: "",
        contactPhone: "",
      });
      setCollectedData({
        country: "",
        clientType: "",
        industry: "",
        primaryTaxId: "",
        taxIds: {},
      });
      setShowSensitiveForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!question.trim() || !sessionId || isLoading) return;

    setIsLoading(true);
    setQuestion("");

    chatMutation.mutate({
      sessionId,
      message: question,
      collectedData,
    });
  };

  const handleSaveSensitiveData = () => {
    if (!sessionId) return;

    // Send sensitive data to backend (stored in session, never sent to AI)
    chatMutation.mutate({
      sessionId,
      message: "[User provided sensitive contact and company information]",
      sensitiveData,
    });

    setShowSensitiveForm(false);
    toast({
      title: "Information Saved",
      description: "Your sensitive information has been securely stored.",
    });
  };

  const handleCompleteOnboarding = () => {
    if (!sessionId) return;
    completeMutation.mutate(sessionId);
  };

  if (!sessionId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="h-8 w-8" />
            AI Client Onboarding
          </h1>
          <p className="text-muted-foreground mt-1">
            Let our AI assistant guide you through the client onboarding process
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Intelligent Onboarding Assistant
            </CardTitle>
            <CardDescription>
              Our AI will help collect the right information based on your client's country and type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">What makes this special?</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>Country-aware:</strong> Automatically asks for the correct tax IDs based on your client's country</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>Privacy-first:</strong> Sensitive data like names and emails are collected via secure forms, not AI chat</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>Smart validation:</strong> AI knows tax ID formats for 100+ countries and provides helpful feedback</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>Conversational:</strong> Natural chat experience that adapts to your responses</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-start-onboarding"
              >
                {startMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    Start AI Onboarding
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="h-8 w-8" />
          AI Client Onboarding
        </h1>
        <p className="text-muted-foreground mt-1">
          Follow the AI assistant's guidance to complete client setup
        </p>
      </div>

      <div className="grid gap-4">
        {/* Conversation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Messages */}
              <div className="border rounded-lg p-4 h-[400px] overflow-y-auto bg-muted/20">
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border"
                        }`}
                      >
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-card border rounded-lg p-3 max-w-[80%]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">AI is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your response..."
                  className="resize-none"
                  rows={2}
                  disabled={isLoading}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!question.trim() || isLoading}
                  size="icon"
                  className="shrink-0"
                  data-testid="button-send"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSensitiveForm(!showSensitiveForm)}
                  data-testid="button-toggle-form"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  {showSensitiveForm ? "Hide" : "Add"} Contact Information
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCompleteOnboarding}
                  disabled={completeMutation.isPending}
                  data-testid="button-complete"
                >
                  {completeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Onboarding
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sensitive Data Form */}
        {showSensitiveForm && (
          <Card>
            <CardHeader>
              <CardTitle>Contact & Company Information</CardTitle>
              <CardDescription>
                This information is securely stored and never sent to the AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={sensitiveData.companyName}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, companyName: e.target.value })}
                      placeholder="Acme Inc."
                      data-testid="input-company-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Company Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={sensitiveData.email}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, email: e.target.value })}
                      placeholder="contact@acme.com"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactFirstName">Contact First Name</Label>
                    <Input
                      id="contactFirstName"
                      value={sensitiveData.contactFirstName}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, contactFirstName: e.target.value })}
                      placeholder="John"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactLastName">Contact Last Name</Label>
                    <Input
                      id="contactLastName"
                      value={sensitiveData.contactLastName}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, contactLastName: e.target.value })}
                      placeholder="Doe"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={sensitiveData.contactEmail}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, contactEmail: e.target.value })}
                      placeholder="john@acme.com"
                      data-testid="input-contact-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={sensitiveData.contactPhone}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, contactPhone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      data-testid="input-contact-phone"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={sensitiveData.address}
                    onChange={(e) => setSensitiveData({ ...sensitiveData, address: e.target.value })}
                    placeholder="123 Main Street"
                    data-testid="input-address"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={sensitiveData.city}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, city: e.target.value })}
                      placeholder="New York"
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={sensitiveData.state}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, state: e.target.value })}
                      placeholder="NY"
                      data-testid="input-state"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={sensitiveData.zipCode}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, zipCode: e.target.value })}
                      placeholder="10001"
                      data-testid="input-zip"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveSensitiveData} data-testid="button-save-sensitive">
                  Save Information
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
