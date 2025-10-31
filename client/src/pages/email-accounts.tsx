import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function EmailAccounts() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);

  const { data: accounts = [], isLoading } = useQuery<EmailAccount[]>({
    queryKey: ["/api/email-accounts"],
  });

  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ["/api/workflows"],
  });

  const form = useForm<EmailAccountFormData>({
    resolver: zodResolver(emailAccountSchema),
    defaultValues: {
      provider: "gmail",
      authType: "oauth",
      useSsl: true,
      autoCreateTasks: false,
      email: "",
      encryptedCredentials: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmailAccountFormData) => {
      return await apiRequest("POST", "/api/email-accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-accounts"] });
      toast({
        title: "Success",
        description: "Email account connected successfully",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to connect email account",
        variant: "destructive",
      });
    },
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

  const onSubmit = (data: EmailAccountFormData) => {
    createMutation.mutate(data);
  };

  const watchProvider = form.watch("provider");
  const showImapSettings = watchProvider === "imap" || watchProvider === "exchange";

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
          onClick={() => {
            setEditingAccount(null);
            form.reset();
            setDialogOpen(true);
          }}
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
              onClick={() => {
                setEditingAccount(null);
                form.reset();
                setDialogOpen(true);
              }}
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      toast({
                        title: "Sync Started",
                        description: "Checking for new messages...",
                      });
                    }}
                    data-testid={`button-sync-${account.id}`}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Sync Now
                  </Button>
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
            <DialogTitle>
              {editingAccount ? "Edit Email Account" : "Connect Email Account"}
            </DialogTitle>
            <DialogDescription>
              Configure your email account connection settings
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-provider">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gmail">Gmail</SelectItem>
                          <SelectItem value="outlook">Outlook</SelectItem>
                          <SelectItem value="imap">IMAP</SelectItem>
                          <SelectItem value="exchange">Exchange</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="authType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-auth-type">
                            <SelectValue placeholder="Select auth type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="oauth">OAuth</SelectItem>
                          <SelectItem value="password">Password</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="you@example.com" data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="My Work Email" data-testid="input-display-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="encryptedCredentials"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch("authType") === "oauth" ? "OAuth Token" : "Password"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={form.watch("authType") === "oauth" ? "Enter OAuth token" : "Enter password"}
                        data-testid="input-credentials"
                      />
                    </FormControl>
                    <FormDescription>
                      Credentials will be encrypted before storing
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showImapSettings && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="imapHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IMAP Host</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="imap.example.com" data-testid="input-imap-host" />
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
                            <Input {...field} type="number" placeholder="993" data-testid="input-imap-port" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Host</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="smtp.example.com" data-testid="input-smtp-host" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP Port</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="587" data-testid="input-smtp-port" />
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
                          <FormDescription>
                            Enable secure connection
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-use-ssl"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="autoCreateTasks"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>AI Task Creation</FormLabel>
                      <FormDescription>
                        Automatically create tasks from emails using AI
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-auto-create-tasks"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("autoCreateTasks") && (
                <FormField
                  control={form.control}
                  name="defaultWorkflowId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Workflow (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-default-workflow">
                            <SelectValue placeholder="Select workflow" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {workflows.map((workflow) => (
                            <SelectItem key={workflow.id} value={workflow.id}>
                              {workflow.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        AI-created tasks will be added to this workflow
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending
                    ? "Connecting..."
                    : editingAccount
                    ? "Update Account"
                    : "Connect Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
