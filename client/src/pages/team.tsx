import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserPlus, Mail, Phone, Copy, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { formatDistance } from "date-fns";

const inviteSchema = z.object({
  type: z.enum(["email", "sms"]),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  roleId: z.string().min(1, "Role is required"),
  expiresInDays: z.number().min(1).max(30).default(7),
}).refine((data) => {
  if (data.type === "email") return !!data.email;
  if (data.type === "sms") return !!data.phone;
  return false;
}, {
  message: "Email is required for email invites, phone is required for SMS invites",
  path: ["email"],
});

type InviteForm = z.infer<typeof inviteSchema>;

export default function Team() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<any[]>({
    queryKey: ["/api/invitations"],
  });

  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ["/api/roles"],
  });

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      type: "email",
      email: "",
      phone: "",
      roleId: "",
      expiresInDays: 7,
    },
  });

  const invitationType = form.watch("type");

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteForm) => {
      const res = await apiRequest("POST", "/api/invitations", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invitation created!",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create invitation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invitations/${id}/revoke`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation revoked",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to revoke invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyInviteUrl = (token: string) => {
    const url = `${window.location.origin}/register?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast({
      title: "Invite link copied!",
      description: "Share this link with your team member",
    });
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const onSubmit = (data: InviteForm) => {
    inviteMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "accepted":
        return <Badge variant="outline" className="gap-1 text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3" />Accepted</Badge>;
      case "expired":
        return <Badge variant="outline" className="gap-1 text-orange-600 border-orange-600"><AlertCircle className="h-3 w-3" />Expired</Badge>;
      case "revoked":
        return <Badge variant="outline" className="gap-1 text-red-600 border-red-600"><XCircle className="h-3 w-3" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const employeeClientRoles = roles.filter((r: any) => 
    r.name === "Employee" || r.name === "Client"
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="heading-team">Team Management</h1>
          <p className="text-muted-foreground">Manage your team members and invitations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-member">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-invite">Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to add a new team member to your organization
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invitation Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-invite-type">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email" data-testid="option-email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                          </SelectItem>
                          <SelectItem value="sms" data-testid="option-sms">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              SMS (requires Twilio setup)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {invitationType === "email" && (
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="member@company.com"
                            data-testid="input-invite-email"
                            disabled={inviteMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {invitationType === "sms" && (
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            placeholder="+1 (555) 123-4567"
                            data-testid="input-invite-phone"
                            disabled={inviteMutation.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          Include country code
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-invite-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employeeClientRoles.map((role: any) => (
                            <SelectItem key={role.id} value={role.id} data-testid={`option-role-${role.name.toLowerCase()}`}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select Employee or Client role
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiresInDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expires In (days)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={30}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-invite-expiry"
                          disabled={inviteMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        Invitation will expire after this many days
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-invite"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={inviteMutation.isPending}
                    data-testid="button-send-invite"
                  >
                    {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Invitation
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" data-testid="tab-members">
            Team Members ({users.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" data-testid="tab-invitations">
            Invitations ({invitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Team Members</CardTitle>
              <CardDescription>
                All users who have joined your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <Alert>
                  <AlertDescription data-testid="text-no-members">
                    No team members yet. Send an invitation to add your first member!
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="table-header-name">Name</TableHead>
                      <TableHead data-testid="table-header-email">Email</TableHead>
                      <TableHead data-testid="table-header-username">Username</TableHead>
                      <TableHead data-testid="table-header-role">Role</TableHead>
                      <TableHead data-testid="table-header-status">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium" data-testid={`cell-name-${user.id}`}>
                          {user.firstName || user.lastName 
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                            : '-'}
                        </TableCell>
                        <TableCell data-testid={`cell-email-${user.id}`}>{user.email}</TableCell>
                        <TableCell data-testid={`cell-username-${user.id}`}>{user.username}</TableCell>
                        <TableCell data-testid={`cell-role-${user.id}`}>
                          <Badge variant="secondary">{user.roleId}</Badge>
                        </TableCell>
                        <TableCell data-testid={`cell-status-${user.id}`}>
                          {user.isActive ? (
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                              <CheckCircle2 className="h-3 w-3" />Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-gray-600 border-gray-600">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending & Past Invitations</CardTitle>
              <CardDescription>
                Track all invitations sent to join your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : invitations.length === 0 ? (
                <Alert>
                  <AlertDescription data-testid="text-no-invitations">
                    No invitations sent yet. Click "Invite Member" to send your first invitation!
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="table-header-contact">Contact</TableHead>
                      <TableHead data-testid="table-header-method">Method</TableHead>
                      <TableHead data-testid="table-header-inv-role">Role</TableHead>
                      <TableHead data-testid="table-header-inv-status">Status</TableHead>
                      <TableHead data-testid="table-header-created">Created</TableHead>
                      <TableHead data-testid="table-header-expires">Expires</TableHead>
                      <TableHead data-testid="table-header-actions">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv: any) => (
                      <TableRow key={inv.id} data-testid={`row-invitation-${inv.id}`}>
                        <TableCell className="font-medium" data-testid={`cell-contact-${inv.id}`}>
                          {inv.email || inv.phone || '-'}
                        </TableCell>
                        <TableCell data-testid={`cell-method-${inv.id}`}>
                          {inv.type === 'email' ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              SMS
                            </div>
                          )}
                        </TableCell>
                        <TableCell data-testid={`cell-inv-role-${inv.id}`}>
                          <Badge variant="secondary">{inv.roleId}</Badge>
                        </TableCell>
                        <TableCell data-testid={`cell-inv-status-${inv.id}`}>
                          {getStatusBadge(inv.status)}
                        </TableCell>
                        <TableCell data-testid={`cell-created-${inv.id}`}>
                          {formatDistance(new Date(inv.createdAt), new Date(), { addSuffix: true })}
                        </TableCell>
                        <TableCell data-testid={`cell-expires-${inv.id}`}>
                          {formatDistance(new Date(inv.expiresAt), new Date(), { addSuffix: true })}
                        </TableCell>
                        <TableCell data-testid={`cell-actions-${inv.id}`}>
                          {inv.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyInviteUrl(inv.token || inv.id)}
                                data-testid={`button-copy-${inv.id}`}
                              >
                                {copiedToken === (inv.token || inv.id) ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokeMutation.mutate(inv.id)}
                                disabled={revokeMutation.isPending}
                                data-testid={`button-revoke-${inv.id}`}
                              >
                                {revokeMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
