import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bot, Send, Loader2, CheckCircle, UserPlus, Building2, ShieldCheck } from "lucide-react";
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

  // Sensitive data collected via form (never sent to AI) - includes tax IDs now
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
    // Tax IDs - dynamically shown based on country
    pan: "", // India
    gstin: "", // India
    ein: "", // USA business
    ssn: "", // USA individual
    vat: "", // UK/EU
    utr: "", // UK
    trn: "", // UAE
    abn: "", // Australia
    gst: "", // Australia/New Zealand
    sin: "", // Canada individual
    bn: "", // Canada business
  });

  // Metadata from AI (determines which fields to show)
  const [aiContext, setAiContext] = useState<{
    country?: string;
    clientType?: string;
    industry?: string;
    gstRegistered?: boolean;
    vatRegistered?: boolean;
    requiredFields?: string[];
  }>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch session details to get AI metadata
  const { data: sessionData } = useQuery<ClientOnboardingSession>({
    queryKey: ["/api/client-onboarding/session", sessionId],
    enabled: !!sessionId,
    refetchInterval: 2000, // Poll for metadata updates from AI
  });

  // Update AI context when session data changes
  useEffect(() => {
    if (sessionData?.collectedData) {
      setAiContext(sessionData.collectedData as any);
    }
  }, [sessionData]);

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
        { sessionId, sensitiveData }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to complete onboarding");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success!",
        description: "Client onboarding completed successfully",
      });
      // Reset state
      setSessionId(null);
      setMessages([]);
      setSensitiveData({
        companyName: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "",
        contactFirstName: "", contactLastName: "", contactEmail: "", contactPhone: "",
        pan: "", gstin: "", ein: "", ssn: "", vat: "", utr: "", trn: "", abn: "", gst: "", sin: "", bn: "",
      });
      setAiContext({});
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
    });
  };

  const handleCompleteOnboarding = () => {
    if (!sessionId) return;
    
    // Validate required fields
    if (!sensitiveData.companyName && !sensitiveData.contactFirstName) {
      toast({
        title: "Missing Information",
        description: "Please fill out the contact information form before completing onboarding",
        variant: "destructive",
      });
      setShowSensitiveForm(true);
      return;
    }

    completeMutation.mutate(sessionId);
  };

  // Determine which fields to show based on AI context
  const shouldShowField = (fieldName: string): boolean => {
    const { country, clientType, gstRegistered, vatRegistered, requiredFields } = aiContext;
    
    // Essential contact/company fields are ALWAYS shown (never hidden by AI metadata)
    const essentialFields = [
      "companyName", "email", "phone", "address", "city", "state", "zipCode",
      "contactFirstName", "contactLastName", "contactEmail", "contactPhone"
    ];
    
    if (essentialFields.includes(fieldName)) {
      return true; // Always show contact fields
    }

    // Tax ID fields - use requiredFields if provided, otherwise use country-based logic
    if (requiredFields && requiredFields.length > 0) {
      // AI explicitly specified which tax fields are needed
      return requiredFields.includes(fieldName);
    }

    // Fallback: country-based logic if AI hasn't specified requiredFields
    if (!country) return false; // Don't show tax fields until we know the country

    const countryLower = country.toLowerCase();

    switch (fieldName) {
      case "pan":
        return countryLower === "india";
      case "gstin":
        return countryLower === "india" && (gstRegistered || clientType === "business");
      case "ein":
        return countryLower === "usa" && clientType === "business";
      case "ssn":
        return countryLower === "usa" && clientType === "individual";
      case "vat":
        return (countryLower === "uk" || countryLower.includes("united kingdom") || 
                countryLower.includes("europe")) && Boolean(vatRegistered);
      case "utr":
        return countryLower === "uk" || countryLower.includes("united kingdom");
      case "trn":
        return countryLower === "uae" || countryLower.includes("emirates");
      case "abn":
        return countryLower === "australia";
      case "gst":
        return countryLower === "australia" || countryLower === "new zealand";
      case "sin":
        return countryLower === "canada" && clientType === "individual";
      case "bn":
        return countryLower === "canada" && clientType === "business";
      default:
        return false; // Unknown tax field
    }
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
                <h3 className="font-semibold mb-2">Privacy-First Design</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>Zero AI Exposure:</strong> The AI NEVER sees sensitive data (names, emails, tax IDs)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>AI as Guide:</strong> Ask questions to determine requirements (country, business type)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>Dynamic Forms:</strong> Form fields appear based on AI's guidance (India → PAN/GST, USA → EIN/SSN)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                    <span><strong>Secure Collection:</strong> All sensitive information entered via encrypted forms</span>
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

        {/* Sensitive Data Form - Now includes tax fields */}
        {showSensitiveForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Contact & Company Information
              </CardTitle>
              <CardDescription>
                This information is securely stored and NEVER sent to the AI. Tax IDs are protected with encryption.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {/* Company Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={sensitiveData.companyName}
                      onChange={(e) => setSensitiveData({ ...sensitiveData, companyName: e.target.value })}
                      placeholder="Acme Inc."
                      data-testid="input-company-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Company Email *</Label>
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

                {/* Contact Person */}
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

                {/* Address */}
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

                {/* Tax IDs - Dynamically shown based on AI context */}
                {aiContext.country && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Tax Identification Numbers
                      <span className="text-xs text-muted-foreground font-normal">
                        (for {aiContext.country})
                      </span>
                    </h3>
                    
                    <div className="grid gap-4">
                      {/* India */}
                      {shouldShowField("pan") && (
                        <div>
                          <Label htmlFor="pan">PAN (Permanent Account Number) *</Label>
                          <Input
                            id="pan"
                            value={sensitiveData.pan}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, pan: e.target.value.toUpperCase() })}
                            placeholder="AAAPL1234C"
                            maxLength={10}
                            data-testid="input-pan"
                          />
                          <p className="text-xs text-muted-foreground mt-1">10 characters (e.g., AAAPL1234C)</p>
                        </div>
                      )}

                      {shouldShowField("gstin") && (
                        <div>
                          <Label htmlFor="gstin">GSTIN (GST Identification Number)</Label>
                          <Input
                            id="gstin"
                            value={sensitiveData.gstin}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, gstin: e.target.value.toUpperCase() })}
                            placeholder="22AAAAA0000A1Z5"
                            maxLength={15}
                            data-testid="input-gstin"
                          />
                          <p className="text-xs text-muted-foreground mt-1">15 characters</p>
                        </div>
                      )}

                      {/* USA */}
                      {shouldShowField("ein") && (
                        <div>
                          <Label htmlFor="ein">EIN (Employer Identification Number) *</Label>
                          <Input
                            id="ein"
                            value={sensitiveData.ein}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, ein: e.target.value })}
                            placeholder="12-3456789"
                            data-testid="input-ein"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Format: XX-XXXXXXX</p>
                        </div>
                      )}

                      {shouldShowField("ssn") && (
                        <div>
                          <Label htmlFor="ssn">SSN (Social Security Number) *</Label>
                          <Input
                            id="ssn"
                            type="password"
                            value={sensitiveData.ssn}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, ssn: e.target.value })}
                            placeholder="***-**-****"
                            data-testid="input-ssn"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Format: XXX-XX-XXXX</p>
                        </div>
                      )}

                      {/* UK */}
                      {shouldShowField("utr") && (
                        <div>
                          <Label htmlFor="utr">UTR (Unique Taxpayer Reference) *</Label>
                          <Input
                            id="utr"
                            value={sensitiveData.utr}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, utr: e.target.value })}
                            placeholder="1234567890"
                            maxLength={10}
                            data-testid="input-utr"
                          />
                          <p className="text-xs text-muted-foreground mt-1">10 digits</p>
                        </div>
                      )}

                      {shouldShowField("vat") && (
                        <div>
                          <Label htmlFor="vat">VAT Number</Label>
                          <Input
                            id="vat"
                            value={sensitiveData.vat}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, vat: e.target.value.toUpperCase() })}
                            placeholder="GB123456789"
                            data-testid="input-vat"
                          />
                          <p className="text-xs text-muted-foreground mt-1">If VAT registered</p>
                        </div>
                      )}

                      {/* UAE */}
                      {shouldShowField("trn") && (
                        <div>
                          <Label htmlFor="trn">TRN (Tax Registration Number) *</Label>
                          <Input
                            id="trn"
                            value={sensitiveData.trn}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, trn: e.target.value })}
                            placeholder="100123456700003"
                            maxLength={15}
                            data-testid="input-trn"
                          />
                          <p className="text-xs text-muted-foreground mt-1">15 digits</p>
                        </div>
                      )}

                      {/* Australia */}
                      {shouldShowField("abn") && (
                        <div>
                          <Label htmlFor="abn">ABN (Australian Business Number) *</Label>
                          <Input
                            id="abn"
                            value={sensitiveData.abn}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, abn: e.target.value })}
                            placeholder="12 345 678 901"
                            data-testid="input-abn"
                          />
                          <p className="text-xs text-muted-foreground mt-1">11 digits</p>
                        </div>
                      )}

                      {shouldShowField("gst") && (
                        <div>
                          <Label htmlFor="gst">GST Number (Australia/NZ)</Label>
                          <Input
                            id="gst"
                            value={sensitiveData.gst}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, gst: e.target.value })}
                            placeholder="GST Registration"
                            data-testid="input-gst"
                          />
                        </div>
                      )}

                      {/* Canada */}
                      {shouldShowField("sin") && (
                        <div>
                          <Label htmlFor="sin">SIN (Social Insurance Number) *</Label>
                          <Input
                            id="sin"
                            type="password"
                            value={sensitiveData.sin}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, sin: e.target.value })}
                            placeholder="***-***-***"
                            data-testid="input-sin"
                          />
                          <p className="text-xs text-muted-foreground mt-1">9 digits</p>
                        </div>
                      )}

                      {shouldShowField("bn") && (
                        <div>
                          <Label htmlFor="bn">BN (Business Number) *</Label>
                          <Input
                            id="bn"
                            value={sensitiveData.bn}
                            onChange={(e) => setSensitiveData({ ...sensitiveData, bn: e.target.value })}
                            placeholder="123456789"
                            maxLength={9}
                            data-testid="input-bn"
                          />
                          <p className="text-xs text-muted-foreground mt-1">9 digits</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!aiContext.country && (
                  <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
                    Continue the conversation with the AI to determine which tax identification numbers are needed for your client.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
