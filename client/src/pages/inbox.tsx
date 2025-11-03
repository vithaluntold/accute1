import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail,
  Search,
  Star,
  Trash2,
  RefreshCw,
  Inbox as InboxIcon,
  Archive,
  Clock,
  User,
  Sparkles,
  Zap,
} from "lucide-react";
import type { EmailMessage, EmailAccount } from "@shared/schema";
import { GradientHero } from "@/components/gradient-hero";

export default function Inbox() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: accounts = [] } = useQuery<EmailAccount[]>({
    queryKey: ["/api/email-accounts"],
  });

  const { data: messages = [], isLoading } = useQuery<EmailMessage[]>({
    queryKey: ["/api/email-messages"],
  });

  const { data: installedAgents = [] } = useQuery<any[]>({
    queryKey: ["/api/ai-agents/installed"],
  });

  const hasRelay = installedAgents.some(agent => agent.agent?.name === "Relay");

  // Derive selectedMessage from messages query to keep it fresh
  const selectedMessage = messages.find(m => m.id === selectedMessageId) || null;

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EmailMessage> }) => {
      return await apiRequest("PATCH", `/api/email-messages/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/email-messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
      setSelectedMessageId(null);
      toast({
        title: "Success",
        description: "Message deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  const processWithAiMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/email-messages/${id}/process-with-ai`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
      
      toast({
        title: "AI Processing Complete",
        description: data.taskCreated 
          ? `Task created successfully! ID: ${data.taskId}`
          : "Email analyzed by AI. No task created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "AI Processing Failed",
        description: error.message || "Failed to process email with AI",
        variant: "destructive",
      });
    },
  });

  const batchProcessMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/email-messages/batch-process-with-ai", {
        limit: 10,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
      toast({
        title: "Batch Processing Complete",
        description: `Processed ${data.processed} of ${data.total} emails`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Batch Processing Failed",
        description: error.message || "Failed to batch process emails",
        variant: "destructive",
      });
    },
  });

  const filteredMessages = messages.filter((msg) => {
    if (selectedAccount !== "all" && msg.emailAccountId !== selectedAccount) return false;
    if (searchQuery && !msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !msg.from.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const markAsRead = (message: EmailMessage) => {
    if (!message.isRead) {
      updateMutation.mutate({ id: message.id, updates: { isRead: true } });
    }
    setSelectedMessageId(message.id);
  };

  const toggleStar = (message: EmailMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({
      id: message.id,
      updates: { isStarred: !message.isStarred },
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">
            View and manage your email messages
          </p>
        </div>
        <div className="flex gap-2">
          {hasRelay ? (
            <Button
              variant="default"
              onClick={() => setLocation('/ai-agents/relay')}
              data-testid="button-open-relay"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Open Relay AI
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setLocation('/marketplace?category=ai-agents')}
              data-testid="button-install-relay"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Install Relay AI
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => batchProcessMutation.mutate()}
            disabled={batchProcessMutation.isPending || messages.filter(m => !m.aiProcessed).length === 0}
            data-testid="button-batch-process"
          >
            <Zap className="w-4 h-4 mr-2" />
            {batchProcessMutation.isPending ? "Processing..." : "Process All with AI"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              toast({
                title: "Syncing",
                description: "Checking for new messages...",
              });
              queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
            }}
            data-testid="button-sync-inbox"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Account</label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger data-testid="select-account-filter">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.displayName || account.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-messages"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unread</span>
                <span className="font-medium">{messages.filter(m => !m.isRead).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Starred</span>
                <span className="font-medium">{messages.filter(m => m.isStarred).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unprocessed</span>
                <span className="font-medium">{messages.filter(m => !m.aiProcessed).length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message List */}
        <div className="col-span-5 space-y-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {filteredMessages.length} Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-12">
                  <InboxIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No messages found</p>
                </div>
              ) : (
                filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    onClick={() => markAsRead(message)}
                    className={`p-4 border-b cursor-pointer hover-elevate ${
                      selectedMessage?.id === message.id ? "bg-accent" : ""
                    } ${!message.isRead ? "font-semibold" : ""}`}
                    data-testid={`message-item-${message.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{message.from}</span>
                        </div>
                        <h3 className="text-sm truncate">{message.subject}</h3>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {message.body.substring(0, 100)}...
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={(e) => toggleStar(message, e)}
                          className="text-muted-foreground hover:text-foreground"
                          data-testid={`button-star-${message.id}`}
                        >
                          <Star
                            className={`w-4 h-4 ${message.isStarred ? "fill-yellow-400 text-yellow-400" : ""}`}
                          />
                        </button>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(message.sentAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {!message.isRead && (
                        <Badge variant="secondary" className="text-xs">New</Badge>
                      )}
                      {message.aiProcessed && (
                        <Badge variant="default" className="text-xs">AI Processed</Badge>
                      )}
                      {message.hasAttachments && (
                        <Badge variant="outline" className="text-xs">Attachments</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Message Detail */}
        <div className="col-span-4">
          {selectedMessage ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{selectedMessage.subject}</CardTitle>
                    <CardDescription className="mt-1">
                      From: {selectedMessage.from}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!selectedMessage.aiProcessed && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => processWithAiMutation.mutate(selectedMessage.id)}
                        disabled={processWithAiMutation.isPending}
                        data-testid="button-process-ai"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {processWithAiMutation.isPending ? "Processing..." : "Process with AI"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => toggleStar(selectedMessage, e)}
                      data-testid="button-star-detail"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          selectedMessage.isStarred ? "fill-yellow-400 text-yellow-400" : ""
                        }`}
                      />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this message?")) {
                          deleteMutation.mutate(selectedMessage.id);
                        }
                      }}
                      data-testid="button-delete-detail"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm pb-4 border-b">
                  <div>
                    <div className="text-muted-foreground">To</div>
                    <div className="font-medium">{selectedMessage.to.join(", ")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Date</div>
                    <div className="font-medium">
                      {new Date(selectedMessage.sentAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Message</h4>
                  <div className="prose prose-sm max-w-none">
                    {selectedMessage.bodyHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans">{selectedMessage.body}</pre>
                    )}
                  </div>
                </div>

                {selectedMessage.aiProcessed && selectedMessage.aiExtractedData && typeof selectedMessage.aiExtractedData === 'object' ? (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Archive className="w-4 h-4" />
                      AI Extracted Data
                    </h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                      {JSON.stringify(selectedMessage.aiExtractedData, null, 2)}
                    </pre>
                  </div>
                ) : null}

                {selectedMessage.createdTaskId && (
                  <div className="pt-4 border-t">
                    <Badge variant="default" className="gap-1">
                      <Clock className="w-3 h-3" />
                      Task Created: {selectedMessage.createdTaskId}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a message to view</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
