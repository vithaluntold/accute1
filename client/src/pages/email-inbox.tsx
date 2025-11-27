import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Inbox, Send, RefreshCw, Plus, Trash2, Reply, Forward, Archive, MailOpen, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  status: string;
  lastSyncAt: string | null;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export default function EmailInbox() {
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "" });

  // Fetch email accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery<EmailAccount[]>({
    queryKey: ["/api/email-accounts"],
  });

  // Fetch messages for selected account
  const { data: messages, isLoading: messagesLoading } = useQuery<EmailMessage[]>({
    queryKey: ["/api/email-messages", selectedAccount],
    enabled: !!selectedAccount,
  });

  // Sync email mutation
  const syncMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest(`/api/email-accounts/${accountId}/sync`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
      toast({ title: "Success", description: "Emails synced successfully" });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest("POST", `/api/email-messages/${messageId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
    },
  });

  // Connect Gmail
  const connectGmail = () => {
    window.location.href = "/api/email-accounts/oauth/gmail/start";
  };

  // Connect Outlook
  const connectOutlook = () => {
    window.location.href = "/api/email-accounts/oauth/outlook/start";
  };

  const handleSelectMessage = (message: EmailMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markAsReadMutation.mutate(message.id);
    }
  };

  const handleComposeSend = async () => {
    try {
      await apiRequest("POST", "/api/email-messages/send", {
        accountId: selectedAccount,
        ...composeData,
      });
      toast({ title: "Success", description: "Email sent successfully" });
      setShowCompose(false);
      setComposeData({ to: "", subject: "", body: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-inbox" />
      </div>
    );
  }

  const hasAccounts = accounts && accounts.length > 0;

  return (
    <div className="h-screen flex flex-col" data-testid="page-email-inbox">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6" />
          <h1 className="text-2xl font-bold" data-testid="text-inbox-title">Email Inbox</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasAccounts && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedAccount && syncMutation.mutate(selectedAccount)}
                disabled={!selectedAccount || syncMutation.isPending}
                data-testid="button-sync-email"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCompose(true)}
                data-testid="button-compose-email"
              >
                <Send className="h-4 w-4 mr-2" />
                Compose
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddAccount(true)}
            data-testid="button-add-account"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {!hasAccounts ? (
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-[400px]">
            <CardHeader>
              <CardTitle>No Email Accounts</CardTitle>
              <CardDescription>Connect your email account to get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={connectGmail} data-testid="button-connect-gmail">
                <Mail className="h-4 w-4 mr-2" />
                Connect Gmail
              </Button>
              <Button className="w-full" variant="outline" onClick={connectOutlook} data-testid="button-connect-outlook">
                <Mail className="h-4 w-4 mr-2" />
                Connect Outlook
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Accounts */}
          <div className="w-64 border-r flex flex-col">
            <div className="p-4 border-b">
              <Label className="text-sm font-medium">Email Accounts</Label>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {accounts.map((account) => (
                  <Button
                    key={account.id}
                    variant={selectedAccount === account.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedAccount(account.id)}
                    data-testid={`button-account-${account.email}`}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    <div className="flex-1 text-left truncate">
                      <div className="truncate">{account.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {account.provider}
                      </div>
                    </div>
                    {account.status === "active" && (
                      <Badge variant="outline" className="ml-2">Active</Badge>
                    )}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Message List */}
          <div className="w-96 border-r flex flex-col">
            <div className="p-4 border-b">
              <Input placeholder="Search messages..." data-testid="input-search-messages" />
            </div>
            <ScrollArea className="flex-1">
              {messagesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : messages && messages.length > 0 ? (
                <div className="divide-y">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 cursor-pointer hover-elevate ${
                        selectedMessage?.id === message.id ? "bg-accent" : ""
                      } ${!message.isRead ? "font-semibold" : ""}`}
                      onClick={() => handleSelectMessage(message)}
                      data-testid={`message-item-${message.id}`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm truncate flex-1">{message.from}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatDistanceToNow(new Date(message.receivedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-sm truncate mb-1">{message.subject}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {message.body?.substring(0, 100)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Inbox className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No messages</p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Message Content */}
          <div className="flex-1 flex flex-col">
            {selectedMessage ? (
              <>
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold mb-3" data-testid="text-message-subject">
                    {selectedMessage.subject}
                  </h2>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">From:</span> {selectedMessage.from}
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(selectedMessage.receivedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">To:</span> {selectedMessage.to}
                  </div>
                </div>
                <ScrollArea className="flex-1 p-6">
                  <div className="prose max-w-none" data-testid="text-message-body">
                    {selectedMessage.body}
                  </div>
                </ScrollArea>
                <div className="border-t p-4 flex items-center gap-2">
                  <Button size="sm" variant="outline" data-testid="button-reply">
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                  <Button size="sm" variant="outline" data-testid="button-forward">
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </Button>
                  <Button size="sm" variant="outline" data-testid="button-archive">
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                  <Button size="sm" variant="outline" data-testid="button-delete">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <MailOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a message to read</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Account Dialog */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent data-testid="dialog-add-account">
          <DialogHeader>
            <DialogTitle>Connect Email Account</DialogTitle>
            <DialogDescription>
              Choose your email provider to connect your account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button className="w-full" onClick={connectGmail} data-testid="button-dialog-gmail">
              <Mail className="h-4 w-4 mr-2" />
              Connect Gmail
            </Button>
            <Button className="w-full" variant="outline" onClick={connectOutlook} data-testid="button-dialog-outlook">
              <Mail className="h-4 w-4 mr-2" />
              Connect Outlook
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-2xl" data-testid="dialog-compose">
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="compose-to">To</Label>
              <Input
                id="compose-to"
                placeholder="recipient@example.com"
                value={composeData.to}
                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                data-testid="input-compose-to"
              />
            </div>
            <div>
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                placeholder="Email subject"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                data-testid="input-compose-subject"
              />
            </div>
            <div>
              <Label htmlFor="compose-body">Message</Label>
              <Textarea
                id="compose-body"
                placeholder="Type your message..."
                rows={10}
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                data-testid="textarea-compose-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)} data-testid="button-compose-cancel">
              Cancel
            </Button>
            <Button onClick={handleComposeSend} data-testid="button-compose-send">
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
