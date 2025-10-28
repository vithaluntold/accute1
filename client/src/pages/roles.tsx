import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Shield, Check, X, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const roleSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  organizationId: string | null;
}

// Group permissions by module/resource
const groupPermissionsByResource = (permissions: Permission[]) => {
  const grouped: Record<string, Permission[]> = {};
  permissions.forEach(perm => {
    if (!grouped[perm.resource]) {
      grouped[perm.resource] = [];
    }
    grouped[perm.resource].push(perm);
  });
  return grouped;
};

// Get user-friendly module names
const getModuleName = (resource: string): string => {
  const names: Record<string, string> = {
    users: "User Management",
    roles: "Roles & Permissions",
    workflows: "Workflows",
    pipelines: "Pipelines",
    ai_agents: "AI Agents",
    documents: "Documents",
    forms: "Forms",
    documentRequests: "Document Requests",
    clients: "Clients",
    contacts: "Contacts",
    tags: "Tags",
    organizations: "Organizations",
    analytics: "Analytics",
    settings: "Settings",
    templates: "Email Templates",
    conversations: "Messages",
    timeEntries: "Time Tracking",
    invoices: "Invoices",
    payments: "Payments",
    signatures: "Signature Requests",
    chat: "Team Chat",
    appointments: "Calendar/Appointments",
    super_admin: "Super Admin",
    expenses: "Expenses",
  };
  return names[resource] || resource;
};

// Get action label with color coding
const getActionBadge = (action: string) => {
  const variants: Record<string, { label: string; variant: any }> = {
    view: { label: "View", variant: "outline" },
    create: { label: "Create", variant: "default" },
    edit: { label: "Edit", variant: "default" },
    update: { label: "Update", variant: "default" },
    delete: { label: "Delete", variant: "destructive" },
    upload: { label: "Upload", variant: "default" },
    download: { label: "Download", variant: "outline" },
    manage: { label: "Manage", variant: "default" },
    configure: { label: "Configure", variant: "default" },
    install: { label: "Install", variant: "default" },
    execute: { label: "Execute", variant: "default" },
    publish: { label: "Publish", variant: "default" },
    share: { label: "Share", variant: "outline" },
    submit: { label: "Submit", variant: "default" },
    invite: { label: "Invite", variant: "default" },
    annotate: { label: "Annotate", variant: "default" },
    review: { label: "Review", variant: "default" },
    sign: { label: "Sign", variant: "default" },
    send: { label: "Send", variant: "default" },
  };
  
  const config = variants[action] || { label: action, variant: "outline" };
  return <Badge variant={config.variant as any} className="text-xs">{config.label}</Badge>;
};

export default function Roles() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
  });

  const { data: rolePermissions = [], refetch: refetchRolePermissions } = useQuery<Permission[]>({
    queryKey: selectedRole ? ["/api/roles", selectedRole, "permissions"] : [],
    enabled: !!selectedRole,
  });

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      const res = await apiRequest("POST", "/api/roles", data);
      return res.json();
    },
    onSuccess: (newRole) => {
      toast({
        title: "Role created!",
        description: `${newRole.name} has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsCreateDialogOpen(false);
      setSelectedRole(newRole.id);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/roles/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Role deleted",
        description: "The role has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      if (selectedRole === deleteTarget) {
        setSelectedRole(null);
      }
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignPermissionMutation = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: string; permissionId: string }) => {
      const res = await apiRequest("POST", `/api/roles/${roleId}/permissions/${permissionId}`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchRolePermissions();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign permission",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removePermissionMutation = useMutation({
    mutationFn: async ({ roleId, permissionId }: { roleId: string; permissionId: string }) => {
      const res = await apiRequest("DELETE", `/api/roles/${roleId}/permissions/${permissionId}`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchRolePermissions();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove permission",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RoleFormData) => {
    createRoleMutation.mutate(data);
  };

  const handlePermissionToggle = (permissionId: string, isChecked: boolean) => {
    if (!selectedRole) return;

    if (isChecked) {
      assignPermissionMutation.mutate({ roleId: selectedRole, permissionId });
    } else {
      removePermissionMutation.mutate({ roleId: selectedRole, permissionId });
    }
  };

  const hasPermission = (permissionId: string): boolean => {
    return rolePermissions.some(p => p.id === permissionId);
  };

  const groupedPermissions = groupPermissionsByResource(permissions);
  const sortedModules = Object.keys(groupedPermissions).sort((a, b) => 
    getModuleName(a).localeCompare(getModuleName(b))
  );

  const currentRole = roles.find(r => r.id === selectedRole);
  const customRoles = roles.filter(r => !r.isSystemRole);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="heading-roles">
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground">
            Create custom roles and assign granular permissions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-role">
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-create-role">Create New Role</DialogTitle>
              <DialogDescription>
                Define a new role with custom permissions for your organization
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  data-testid="input-role-name"
                  placeholder="e.g., Manager, Accountant, Reviewer"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-role-description"
                  placeholder="Describe the responsibilities of this role"
                  {...form.register("description")}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRoleMutation.isPending}
                  data-testid="button-submit-create-role"
                >
                  {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rolesLoading || permissionsLoading ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center text-muted-foreground">Loading roles and permissions...</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Roles List */}
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Roles</CardTitle>
                <CardDescription>Select a role to manage permissions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-1 p-4 pt-0">
                    {roles.map((role) => (
                      <div
                        key={role.id}
                        className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                          selectedRole === role.id
                            ? "bg-accent"
                            : "hover-elevate"
                        }`}
                        onClick={() => setSelectedRole(role.id)}
                        data-testid={`role-item-${role.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{role.name}</div>
                            {role.isSystemRole && (
                              <Badge variant="outline" className="text-xs mt-1">System</Badge>
                            )}
                          </div>
                        </div>
                        {!role.isSystemRole && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(role.id);
                            }}
                            data-testid={`button-delete-role-${role.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Permission Matrix */}
          <div className="col-span-9">
            {!selectedRole ? (
              <Card>
                <CardContent className="p-12">
                  <div className="text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a role to view and manage permissions</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {currentRole?.name} Permissions
                      </CardTitle>
                      <CardDescription>
                        {currentRole?.description || "Configure permissions for this role"}
                      </CardDescription>
                    </div>
                    {currentRole?.isSystemRole && (
                      <Badge variant="outline">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        System Role (View Only)
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-6">
                      {sortedModules.map((module) => {
                        const modulePerms = groupedPermissions[module];
                        const sortedPerms = modulePerms.sort((a, b) => {
                          const order = ["view", "create", "edit", "update", "delete", "manage"];
                          const aIndex = order.indexOf(a.action);
                          const bIndex = order.indexOf(b.action);
                          if (aIndex === -1) return 1;
                          if (bIndex === -1) return -1;
                          return aIndex - bIndex;
                        });

                        return (
                          <div key={module} className="border rounded-md p-4">
                            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                              {getModuleName(module)}
                              <Badge variant="outline" className="text-xs">
                                {modulePerms.length} permissions
                              </Badge>
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                              {sortedPerms.map((perm) => (
                                <div
                                  key={perm.id}
                                  className="flex items-start space-x-3 p-2 rounded-md hover-elevate"
                                  data-testid={`permission-item-${perm.id}`}
                                >
                                  <Checkbox
                                    id={perm.id}
                                    checked={hasPermission(perm.id)}
                                    disabled={currentRole?.isSystemRole}
                                    onCheckedChange={(checked) =>
                                      handlePermissionToggle(perm.id, checked as boolean)
                                    }
                                    data-testid={`checkbox-permission-${perm.id}`}
                                  />
                                  <div className="flex-1">
                                    <Label
                                      htmlFor={perm.id}
                                      className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                                    >
                                      {getActionBadge(perm.action)}
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {perm.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? Users assigned to this role will need to be reassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteRoleMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
