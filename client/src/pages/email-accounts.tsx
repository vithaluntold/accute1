import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Plus, Trash2, RefreshCw, Settings, CheckCircle, AlertCircle } from "lucide-react";
import type { EmailAccount } from "@shared/schema";
import { GradientHero } from "@/components/gradient-hero";

const emailAccountSchema = z.object({
  provider: z.enum(["gmail", "outlook", "imap", "exchange"]),
  email: z.string().email("Invalid email address"),
  displayName: z.string().optional(),
  authType: z.enum(["oauth", "password"]),
  encryptedCredentials: z.string().min(1, "Credentials are required"),
  imapHost: z.string().optional(),
  imapPort: z.coerce.number().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  useSsl: z.boolean().default(true),
  autoCreateTasks: z.boolean().default(false),
  defaultWorkflowId: z.string().optional(),
});

type EmailAccountFormData = z.infer<typeof emailAccountSchema>;

function SyncButton({ accountId }: { accountId: string }) {
  const { toast } = useToast();
  
  const syncMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/email-accounts/${accountId}/sync`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-messages"] });
      toast({
        title: "Sync Complete",
        description: data.message || "Emails synced successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync emails",
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex-1"
      onClick={() => syncMutation.mutate()}
      disabled={syncMutation.isPending}
      data-testid={`button-sync-${accountId}`}
    >
      <RefreshCw className={`w-3 h-3 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
      {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
    </Button>
  );
}

function OAuthButton({ provider }: { provider: 'gmail' | 'outlook' }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleOAuth = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/email-accounts/oauth/${provider}/start`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
        
        toast({
          title: "Authorization Window Opened",
          description: `Complete the ${provider === 'gmail' ? 'Gmail' : 'Outlook'} authorization in the new window`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to start ${provider} OAuth flow`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleOAuth}
      disabled={loading}
      variant="outline"
      className="w-full justify-start text-left h-auto py-4"
      data-testid={`button-oauth-${provider}`}
    >
      <div className="flex items-center gap-3">
        <Mail className="w-5 h-5" />
        <div>
          <div className="font-semibold">
            {provider === 'gmail' ? 'Connect Gmail' : 'Connect Outlook'}
          </div>
          <div className="text-xs text-muted-foreground">
            {provider === 'gmail' ? 'Google Workspace or personal Gmail' : 'Microsoft 365 or Outlook.com'}
          </div>
        </div>
      </div>
    </Button>
  );
}

const imapFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  imapHost: z.string().min(1, "IMAP host is required"),
  imapPort: z.coerce.number().min(1).max(65535),
  useSsl: z.boolean().default(true)
});

function ImapForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof imapFormSchema>>({
    resolver: zodResolver(imapFormSchema),
    defaultValues: {
      email: "",
      password: "",
      imapHost: "",
      imapPort: 993,
      useSsl: true
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof imapFormSchema>) => {
      const { ImapEmailService } = await import('@/lib/imap-helpers');
      const encrypted = ImapEmailService.encryptPassword(data.password, data.email);
      
      return await apiRequest("POST", "/api/email-accounts", {
        provider: "imap",
        email: data.email,
        authType: "password",
        encryptedCredentials: encrypted,
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        useSsl: data.useSsl
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({
        title: "Success",
        description: "Email account connected successfully"
      });
      onSuccess();
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to connect email account",
        variant: "destructive"
      });
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input {...field} placeholder="you@company.com" data-testid="input-imap-email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input {...field} type="password" placeholder="Enter password" data-testid="input-imap-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="imapHost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IMAP Host</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="imap.example.com" data-testid="input-imap-host-field" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="imapPort"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IMAP Port</FormLabel>
                <FormControl>
                  <Input {...field} type="number" placeholder="993" data-testid="input-imap-port-field" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="useSsl"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Use SSL/TLS</FormLabel>
                <FormDescription>Enable secure connection</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-imap-ssl"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            data-testid="button-imap-submit"
          >
            {createMutation.isPending ? "Connecting..." : "Connect IMAP Account"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export default function EmailAccounts() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: accounts = [], isLoading } = useQuery<EmailAccount[]>({
    queryKey: ["/api/email-accounts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/email-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({
        title: "Success",
        description: "Email account disconnected",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect email account",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Accounts</h1>
          <p className="text-muted-foreground">
            Connect email accounts to receive and process messages automatically
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          data-testid="button-add-email-account"
        >
          <Plus className="w-4 h-4 mr-2" />
          Connect Account
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Email Accounts Connected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect your email account to enable inbox integration and AI-powered task creation
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              data-testid="button-connect-first-account"
            >
              <Plus className="w-4 h-4 mr-2" />
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} data-testid={`card-email-account-${account.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    <div>
                      <CardTitle className="text-base">{account.displayName || account.email}</CardTitle>
                      {account.displayName && (
                        <CardDescription>{account.email}</CardDescription>
                      )}
                    </div>
                  </div>
                  {account.status === "active" ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {account.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Provider</div>
                    <div className="font-medium capitalize">{account.provider}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Auth Type</div>
                    <div className="font-medium capitalize">{account.authType}</div>
                  </div>
                </div>

                {account.lastSyncAt && (
                  <div className="text-sm">
                    <div className="text-muted-foreground">Last Synced</div>
                    <div className="font-medium">
                      {new Date(account.lastSyncAt).toLocaleString()}
                    </div>
                  </div>
                )}

                {account.autoCreateTasks && (
                  <Badge variant="secondary" data-testid={`badge-auto-tasks-${account.id}`}>
                    <Settings className="w-3 h-3 mr-1" />
                    AI Task Creation Enabled
                  </Badge>
                )}

                <div className="flex gap-2 pt-2">
                  <SyncButton accountId={account.id} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to disconnect this email account?")) {
                        deleteMutation.mutate(account.id);
                      }
                    }}
                    data-testid={`button-delete-${account.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-email-account">
          <DialogHeader>
            <DialogTitle>Connect Email Account</DialogTitle>
            <DialogDescription>
              Choose your email provider to get started
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="oauth" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="oauth">Gmail / Outlook</TabsTrigger>
              <TabsTrigger value="imap">IMAP / Exchange</TabsTrigger>
            </TabsList>

            <TabsContent value="oauth" className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Connect your Gmail or Outlook account with secure OAuth authentication
              </p>
              <div className="grid gap-3">
                <OAuthButton provider="gmail" />
                <OAuthButton provider="outlook" />
              </div>
            </TabsContent>

            <TabsContent value="imap" className="py-4">
              <ImapForm onSuccess={() => setDialogOpen(false)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
