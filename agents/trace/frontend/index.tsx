/**
 * Trace AI Agent - Frontend Interface
 * 
 * Resume analysis and skills extraction interface
 */

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText, Sparkles, Copy, Check, Briefcase, GraduationCap, Award, Languages } from "lucide-react";
import { useAgentSSE } from "@/hooks/use-agent-sse";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

export default function TraceAgentPage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const {
    sessionId,
    messages,
    isStreaming,
    sendMessage: sendAgentMessage,
  } = useAgentSSE({
    agentSlug: "trace",
    userId: currentUser?.id,
    organizationId: currentUser?.organizationId,
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "text/plain"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, DOC, or TXT file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    // For text files, read directly
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setResumeText(text);
        toast({
          title: "Resume uploaded",
          description: "Resume text loaded successfully",
        });
      };
      reader.readAsText(file);
    } else {
      // For PDF/DOCX, we would need server-side parsing
      toast({
        title: "File uploaded",
        description: `${file.name} selected. Click "Analyze Resume" to extract skills.`,
      });
      // In production, upload to server for parsing
    }
  };

  const handleAnalyzeResume = async () => {
    if (!resumeText && !message) {
      toast({
        title: "No resume provided",
        description: "Please upload a resume or paste the resume text",
        variant: "destructive",
      });
      return;
    }

    const analysisPrompt = resumeText
      ? `Please analyze this resume and extract all skills, experience, education, and other relevant information:\n\n${resumeText}`
      : message;

    await sendAgentMessage(analysisPrompt, {
      resumeText,
    });

    // Try to parse the response as JSON for structured display
    setTimeout(() => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant") {
        try {
          const parsed = JSON.parse(lastMessage.content);
          setExtractedData(parsed);
        } catch (e) {
          // Response is not JSON, that's fine - it's a conversational response
        }
      }
    }, 1000);
  };

  const handleCopySkills = () => {
    if (!extractedData) return;
    
    const allSkills = [
      ...(extractedData.technicalSkills || []),
      ...(extractedData.softSkills || []),
    ];
    
    navigator.clipboard.writeText(allSkills.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Skills copied",
      description: "All skills copied to clipboard",
    });
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Trace AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resume Analysis & Skills Extraction Specialist
            </p>
          </div>
          
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-resume-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-resume"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Resume
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-2 gap-6 p-6">
        {/* Left Panel - Chat Interface */}
        <div className="flex flex-col gap-4">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Resume Analysis Chat</CardTitle>
              <CardDescription>
                Upload a resume or paste the text below to extract skills and experience
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              {/* Messages */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertDescription>
                        Upload a resume or paste resume text to begin analysis
                      </AlertDescription>
                    </Alert>
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
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  
                  {isStreaming && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <div className="animate-pulse">●</div>
                          <span className="text-sm">Analyzing resume...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="space-y-2">
                <Textarea
                  value={resumeText || message}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (resumeText) {
                      setResumeText(val);
                    } else {
                      setMessage(val);
                    }
                  }}
                  placeholder="Paste resume text here or ask a question about resume analysis..."
                  className="min-h-[100px] resize-none"
                  data-testid="textarea-resume-input"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleAnalyzeResume}
                    disabled={isStreaming || (!resumeText && !message)}
                    className="flex-1"
                    data-testid="button-analyze-resume"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze Resume
                  </Button>
                  {(resumeText || message) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResumeText("");
                        setMessage("");
                        setExtractedData(null);
                      }}
                      data-testid="button-clear"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Extracted Data */}
        <div className="flex flex-col gap-4 overflow-auto">
          {extractedData ? (
            <>
              {/* Summary */}
              {extractedData.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Professional Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {extractedData.summary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Skills */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Extracted Skills</CardTitle>
                    <CardDescription>
                      {(extractedData.technicalSkills?.length || 0) + (extractedData.softSkills?.length || 0)} skills found
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySkills}
                    data-testid="button-copy-skills"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {extractedData.technicalSkills?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Technical Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {extractedData.technicalSkills.map((skill: string, idx: number) => (
                          <Badge key={idx} variant="default" data-testid={`badge-tech-skill-${idx}`}>
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {extractedData.softSkills?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Soft Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {extractedData.softSkills.map((skill: string, idx: number) => (
                          <Badge key={idx} variant="secondary" data-testid={`badge-soft-skill-${idx}`}>
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Experience */}
              {extractedData.experience?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Work Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {extractedData.experience.map((exp: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{exp.role}</h4>
                              <p className="text-sm text-muted-foreground">{exp.company}</p>
                            </div>
                            <Badge variant="outline">{exp.duration}</Badge>
                          </div>
                          {exp.responsibilities?.length > 0 && (
                            <ul className="text-sm text-muted-foreground list-disc list-inside ml-4">
                              {exp.responsibilities.slice(0, 3).map((resp: string, ridx: number) => (
                                <li key={ridx}>{resp}</li>
                              ))}
                            </ul>
                          )}
                          {idx < extractedData.experience.length - 1 && <Separator className="mt-4" />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Education */}
              {extractedData.education?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {extractedData.education.map((edu: any, idx: number) => (
                        <div key={idx}>
                          <h4 className="font-semibold">{edu.degree}</h4>
                          <p className="text-sm text-muted-foreground">{edu.institution}</p>
                          <Badge variant="outline" className="mt-1">{edu.year}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Certifications & Languages */}
              <div className="grid grid-cols-2 gap-4">
                {extractedData.certifications?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Certifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {extractedData.certifications.map((cert: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {extractedData.languages?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Languages className="h-4 w-4" />
                        Languages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {extractedData.languages.map((lang: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : (
            <Card className="flex items-center justify-center h-full">
              <CardContent className="text-center p-12">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No resume analyzed yet</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a resume or paste resume text to see extracted skills and experience
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
