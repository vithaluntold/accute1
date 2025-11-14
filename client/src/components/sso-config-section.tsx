import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Edit, Loader2, Shield, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// SSO Configuration schema
const ssoConfigSchema = z.object({
  provider: z.enum(["okta", "azure", "onelogin", "google", "custom"]),
  entityId: z.string().min(1, "Entity ID (Issuer) is required"),
  ssoUrl: z.string().url("Must be a valid URL"),
  certificate: z.string().min(1, "IdP certificate is required"),
  logoutUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  signatureAlgorithm: z.enum(["sha1", "sha256", "sha512"]).default("sha256"),
  wantAssertionsSigned: z.boolean().default(true),
  wantAuthnResponseSigned: z.boolean().default(false),
  autoProvision: z.boolean().default(false),
  defaultRoleId: z.string().optional(),
});

type SsoConfigFormData = z.infer<typeof ssoConfigSchema>;

interface SsoConnection {
  id: string;
  provider: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  logoutUrl?: string;
  signatureAlgorithm?: string;
  wantAssertionsSigned?: boolean;
  wantAuthnResponseSigned?: boolean;
  autoProvision?: boolean;
  defaultRoleId?: string;
  isEnabled: boolean;
  createdAt: string;
}

export function SsoConfigSection() {
  const { toast } = useToast();
  const [showSsoForm, setShowSsoForm] = useState(false);
  const [editingSso, setEditingSso] = useState<SsoConnection | null>(null);
  const [deleteSsoTarget, setDeleteSsoTarget] = useState<string | null>(null);

  // Check if user has permission to manage SSO
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const hasPermission = (currentUser as any)?.role?.name === "Admin" || 
                        (currentUser as any)?.role?.name === "Super Admin";

  // Get roles for auto-provision default role selector
  const { data: roles = [] } = useQuery<any[]>({
    queryKey: ["/api/roles"],
    enabled: hasPermission,
  });

  // Get current SSO connection
  const { data: ssoConnection, isLoading: ssoLoading } = useQuery<SsoConnection | null>({
    queryKey: ["/api/sso/connections"],
    enabled: hasPermission,
  });

  // SSO form
  const ssoForm = useForm<SsoConfigFormData>({
    resolver: zodResolver(ssoConfigSchema),
    defaultValues: {
      provider: "custom",
      entityId: "",
      ssoUrl: "",
      certificate: "",
      logoutUrl: "",
      signatureAlgorithm: "sha256",
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      autoProvision: false,
      defaultRoleId: "",
    },
  });

  const selectedProvider = ssoForm.watch("provider");
  const autoProvision = ssoForm.watch("autoProvision");

  // Create/Update SSO connection mutation
  const saveSsoMutation = useMutation({
    mutationFn: async (data: SsoConfigFormData) => {
      const method = editingSso ? "PUT" : "POST";
      const url = editingSso 
        ? `/api/sso/connections/${editingSso.id}` 
        : "/api/sso/connections";
      
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso/connections"] });
      setShowSsoForm(false);
      setEditingSso(null);
      ssoForm.reset();
      toast({
        title: editingSso ? "SSO updated" : "SSO configured",
        description: `SAML authentication ${editingSso ? "updated" : "configured"} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save SSO configuration",
        variant: "destructive",
      });
    },
  });

  // Delete SSO connection mutation
  const deleteSsoMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sso/connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso/connections"] });
      setDeleteSsoTarget(null);
      toast({
        title: "SSO removed",
        description: "SAML authentication has been disabled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove SSO configuration",
        variant: "destructive",
      });
    },
  });

  const onSsoSubmit = (data: SsoConfigFormData) => {
    saveSsoMutation.mutate(data);
  };

  const handleEdit = (connection: SsoConnection) => {
    setEditingSso(connection);
    ssoForm.reset({
      provider: connection.provider as any,
      entityId: connection.entityId,
      ssoUrl: connection.ssoUrl,
      certificate: connection.certificate === "***REDACTED***" ? "" : connection.certificate,
      logoutUrl: connection.logoutUrl || "",
      signatureAlgorithm: connection.signatureAlgorithm as any || "sha256",
      wantAssertionsSigned: connection.wantAssertionsSigned ?? true,
      wantAuthnResponseSigned: connection.wantAuthnResponseSigned ?? false,
      autoProvision: connection.autoProvision ?? false,
      defaultRoleId: connection.defaultRoleId || "",
    });
    setShowSsoForm(true);
  };

  const getMetadataUrl = () => {
    const orgSlug = (currentUser as any)?.organization?.slug;
    if (!orgSlug) return "";
    return `${window.location.origin}/auth/saml/${orgSlug}/metadata`;
  };

  const getLoginUrl = () => {
    const orgSlug = (currentUser as any)?.organization?.slug;
    if (!orgSlug) return "";
    return `${window.location.origin}/auth/saml/${orgSlug}/login`;
  };

  if (!hasPermission) {
    return null; // Don't render for users without permission
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SSO/SAML Configuration
          </CardTitle>
          <CardDescription className="mt-1">
            Configure enterprise Single Sign-On with SAML 2.0 authentication
          </CardDescription>
        </div>
        {!showSsoForm && !ssoConnection && (
          <Button onClick={() => setShowSsoForm(true)} data-testid="button-add-sso-config">
            <Plus className="h-4 w-4 mr-2" />
            Configure SSO
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* SP Metadata Alert */}
        {ssoConnection && (
          <Alert data-testid="alert-sso-metadata">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Service Provider Metadata</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">Provide these URLs to your Identity Provider (IdP):</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted p-1 rounded flex-1">{getMetadataUrl()}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getMetadataUrl());
                      toast({ title: "Metadata URL copied" });
                    }}
                    data-testid="button-copy-metadata-url"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted p-1 rounded flex-1">{getLoginUrl()}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(getLoginUrl());
                      toast({ title: "Login URL copied" });
                    }}
                    data-testid="button-copy-login-url"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* SSO Form */}
        {showSsoForm && (
          <div className="border rounded-md p-4 bg-muted/30">
            <Form {...ssoForm}>
              <form onSubmit={ssoForm.handleSubmit(onSsoSubmit)} className="space-y-4">
                <FormField
                  control={ssoForm.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identity Provider</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-sso-provider">
                            <SelectValue placeholder="Select IdP" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="okta">Okta</SelectItem>
                          <SelectItem value="azure">Azure AD / Microsoft Entra ID</SelectItem>
                          <SelectItem value="onelogin">OneLogin</SelectItem>
                          <SelectItem value="google">Google Workspace</SelectItem>
                          <SelectItem value="custom">Custom SAML 2.0 Provider</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={ssoForm.control}
                  name="entityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity ID (SP Issuer)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://yourdomain.com/saml" data-testid="input-sso-entity-id" {...field} />
                      </FormControl>
                      <FormDescription>
                        Unique identifier for your service provider (usually your domain)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={ssoForm.control}
                  name="ssoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSO URL (IdP Login Endpoint)</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://idp.example.com/sso/saml" data-testid="input-sso-url" {...field} />
                      </FormControl>
                      <FormDescription>
                        {selectedProvider === "okta" && "Found in Okta app settings as 'Single Sign On URL'"}
                        {selectedProvider === "azure" && "Found in Azure AD as 'Login URL'"}
                        {selectedProvider === "onelogin" && "Found in OneLogin app as 'SAML 2.0 Endpoint (HTTP)'"}
                        {selectedProvider === "google" && "Found in Google Workspace SAML settings"}
                        {selectedProvider === "custom" && "The SAML 2.0 authentication endpoint from your IdP"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={ssoForm.control}
                  name="certificate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IdP X.509 Certificate</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="-----BEGIN CERTIFICATE-----&#10;MIIC...&#10;-----END CERTIFICATE-----" 
                          className="font-mono text-xs min-h-32"
                          data-testid="textarea-sso-certificate" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Public certificate from your IdP (include header/footer or just the base64 content)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={ssoForm.control}
                  name="logoutUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logout URL (Optional)</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://idp.example.com/logout" data-testid="input-sso-logout-url" {...field} />
                      </FormControl>
                      <FormDescription>
                        IdP logout endpoint for Single Logout (SLO)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={ssoForm.control}
                  name="autoProvision"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <input 
                          type="checkbox" 
                          checked={field.value} 
                          onChange={field.onChange} 
                          data-testid="checkbox-sso-auto-provision"
                          className="h-4 w-4"
                        />
                      </FormControl>
                      <div className="space-y-0">
                        <FormLabel className="font-normal">Auto-provision new users</FormLabel>
                        <FormDescription>
                          Automatically create user accounts on first SSO login
                        </FormDescription>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {autoProvision && (
                  <FormField
                    control={ssoForm.control}
                    name="defaultRoleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Role for New Users</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-sso-default-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map((role: any) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Role assigned to auto-provisioned users
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button 
                    type="submit" 
                    disabled={saveSsoMutation.isPending}
                    data-testid="button-save-sso"
                  >
                    {saveSsoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingSso ? "Update Configuration" : "Save Configuration"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowSsoForm(false);
                      setEditingSso(null);
                      ssoForm.reset();
                    }}
                    data-testid="button-cancel-sso"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {/* Current SSO Configuration */}
        {!showSsoForm && ssoConnection && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 border rounded-md hover-elevate" data-testid="sso-connection-card">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{ssoConnection.provider.charAt(0).toUpperCase() + ssoConnection.provider.slice(1)} SAML</span>
                  {ssoConnection.isEnabled && (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  Entity ID: {ssoConnection.entityId}
                </span>
                {ssoConnection.autoProvision && (
                  <span className="text-xs text-muted-foreground">
                    Auto-provisioning enabled
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleEdit(ssoConnection)}
                  data-testid="button-edit-sso"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setDeleteSsoTarget(ssoConnection.id)}
                  data-testid="button-delete-sso"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {!ssoLoading && !ssoConnection && !showSsoForm && (
          <div className="text-center p-8 border rounded-md bg-muted/20">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No SSO configuration
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Configure enterprise Single Sign-On for your organization
            </p>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSsoTarget} onOpenChange={() => setDeleteSsoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove SSO Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove SSO authentication? Users will need to use email/password login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-sso">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSsoTarget && deleteSsoMutation.mutate(deleteSsoTarget)}
              data-testid="button-confirm-delete-sso"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSsoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove SSO"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
