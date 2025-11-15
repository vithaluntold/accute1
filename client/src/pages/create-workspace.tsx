import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Building2, ArrowLeft } from "lucide-react";

export default function CreateWorkspace() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");

  const createWorkspaceMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      return apiRequest("POST", "/api/organizations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Workspace created",
        description: "Your new workspace has been created successfully. Switching to it now...",
      });
      // Redirect to login to refresh auth state with new workspace
      window.location.href = "/auth/login";
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace",
        variant: "destructive",
      });
    },
  });

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workspaceName.trim()) {
      toast({
        title: "Error",
        description: "Workspace name is required",
        variant: "destructive",
      });
      return;
    }
    
    createWorkspaceMutation.mutate({ 
      name: workspaceName.trim(), 
      slug: workspaceSlug.trim() || workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    });
  };

  const handleWorkspaceNameChange = (value: string) => {
    setWorkspaceName(value);
    // Auto-generate slug from name if slug is empty
    if (!workspaceSlug) {
      const generatedSlug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setWorkspaceSlug(generatedSlug);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/dashboard")}
        className="mb-6"
        data-testid="button-back-to-dashboard"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Create New Workspace</CardTitle>
              <CardDescription>
                Set up a new workspace to organize your team and clients
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateWorkspace} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name *</Label>
              <Input
                id="workspace-name"
                placeholder="e.g., Acme Corporation"
                value={workspaceName}
                onChange={(e) => handleWorkspaceNameChange(e.target.value)}
                disabled={createWorkspaceMutation.isPending}
                data-testid="input-workspace-name"
              />
              <p className="text-xs text-muted-foreground">
                A friendly name for your workspace
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-slug">Workspace URL Slug</Label>
              <Input
                id="workspace-slug"
                placeholder="e.g., acme-corp"
                value={workspaceSlug}
                onChange={(e) => setWorkspaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                disabled={createWorkspaceMutation.isPending}
                data-testid="input-workspace-slug"
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from name. Used in URLs.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={createWorkspaceMutation.isPending || !workspaceName.trim()}
                className="flex-1"
                data-testid="button-create-workspace"
              >
                {createWorkspaceMutation.isPending ? "Creating..." : "Create Workspace"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/dashboard")}
                disabled={createWorkspaceMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
