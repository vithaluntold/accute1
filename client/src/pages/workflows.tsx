import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Play, Edit, Trash2, Copy, Workflow, Sparkles } from "lucide-react";
import type { InstalledAgentView } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GradientHero } from "@/components/gradient-hero";

export default function Workflows() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    category: "tax_preparation",
  });
  
  // Check for marketplace template ID and metadata in URL
  const params = new URLSearchParams(location.split('?')[1]);
  const marketplaceTemplateId = params.get('marketplaceTemplateId');
  const marketplaceName = params.get('name');
  const marketplaceDescription = params.get('description');
  const marketplaceCategory = params.get('category');
  
  // Open create dialog if coming from marketplace (only once)
  useEffect(() => {
    if (marketplaceTemplateId && !createDialogOpen) {
      setCreateDialogOpen(true);
      // Pre-fill with marketplace metadata
      setNewWorkflow({
        name: marketplaceName || "",
        description: marketplaceDescription || "",
        category: marketplaceCategory || "tax_preparation",
      });
      // Clear query param immediately to prevent reopening (replace history to avoid Back button loop)
      setLocation('/workflows', { replace: true });
    }
  }, [marketplaceTemplateId, createDialogOpen, marketplaceName, marketplaceDescription, marketplaceCategory, setLocation]);
  
  const { data: workflows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/workflows"],
  });

  // Check if Cadence copilot is installed
  const { data: installedAgents = [] } = useQuery<InstalledAgentView[]>({
    queryKey: ['/api/ai-agents/installed'],
  });

  const hasCadence = installedAgents.some((agent) => agent.agent?.name === 'Cadence');

  // Create workflow mutation
  const createWorkflow = useMutation({
    mutationFn: async (data: { name: string; description: string; category: string }) => {
      const res = await apiRequest('POST', '/api/workflows', data);
      return res.json();
    },
    onSuccess: async (createdWorkflow: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      
      // Link to marketplace template if ID provided
      if (marketplaceTemplateId) {
        try {
          await apiRequest("PATCH", `/api/marketplace/items/${marketplaceTemplateId}`, {
            sourceId: createdWorkflow.id
          });
          toast({
            title: 'Success',
            description: 'Workflow created and linked to marketplace',
          });
        } catch (error: any) {
          toast({
            title: 'Warning',
            description: 'Workflow created but failed to link to marketplace',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Success',
          description: 'Workflow created successfully',
        });
      }
      
      setCreateDialogOpen(false);
      setNewWorkflow({ name: "", description: "", category: "tax_preparation" });
      // Navigate to the workflow builder for the newly created workflow if ID exists
      if (createdWorkflow && createdWorkflow.id) {
        setLocation(`/workflows/${createdWorkflow.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create workflow',
        variant: 'destructive',
      });
    },
  });

  // Delete workflow mutation
  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/workflows/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      await queryClient.refetchQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Success',
        description: 'Workflow deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete workflow',
        variant: 'destructive',
      });
    },
  });

  // Copy workflow mutation
  const copyWorkflow = useMutation({
    mutationFn: async (workflow: any) => {
      return apiRequest('POST', '/api/workflows', {
        name: `${workflow.name} (Copy)`,
        description: workflow.description,
        category: workflow.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Success',
        description: 'Workflow copied successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to copy workflow',
        variant: 'destructive',
      });
    },
  });

  const handleCreateWorkflow = () => {
    if (!newWorkflow.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a workflow name',
        variant: 'destructive',
      });
      return;
    }
    createWorkflow.mutate(newWorkflow);
  };

  const handleDeleteWorkflow = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteWorkflow.mutate(id);
    }
  };

  const handleCopyWorkflow = (workflow: any, e: React.MouseEvent) => {
    e.stopPropagation();
    copyWorkflow.mutate(workflow);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={Workflow}
        title={
          <>
            Workflows
            {hasCadence && (
              <Badge variant="secondary" className="gap-1 bg-white/20 border-white/30 text-white backdrop-blur-sm ml-3" data-testid="badge-cadence-copilot">
                <Sparkles className="h-4 w-4" />
                Cadence AI
              </Badge>
            )}
          </>
        }
        description="Automate your accounting processes with AI-powered workflows"
        actions={
          <>
            {hasCadence && (
              <Button 
                variant="outline" 
                className="bg-white/20 border-white/30 text-white backdrop-blur-sm" 
                data-testid="button-cadence-chat"
                onClick={() => setLocation('/ai-agents/cadence')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Ask Cadence AI
              </Button>
            )}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-primary" data-testid="button-create-workflow">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-workflow">
              <DialogHeader>
                <DialogTitle>Create New Workflow</DialogTitle>
                <DialogDescription>
                  Create a new workflow to automate your accounting processes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Client Onboarding"
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                    data-testid="input-workflow-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this workflow"
                    value={newWorkflow.description}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                    data-testid="textarea-workflow-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newWorkflow.category}
                    onValueChange={(value) => setNewWorkflow({ ...newWorkflow, category: value })}
                  >
                    <SelectTrigger data-testid="select-workflow-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tax_preparation">Tax Preparation</SelectItem>
                      <SelectItem value="bookkeeping">Bookkeeping</SelectItem>
                      <SelectItem value="client_onboarding">Client Onboarding</SelectItem>
                      <SelectItem value="audit">Audit</SelectItem>
                      <SelectItem value="payroll">Payroll</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWorkflow}
                  disabled={createWorkflow.isPending}
                  data-testid="button-submit-create"
                >
                  {createWorkflow.isPending ? 'Creating...' : 'Create Workflow'}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            className="pl-9"
            data-testid="input-search-workflows"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" data-testid="button-filter-all">
            All
          </Button>
          <Button variant="outline" size="sm" data-testid="button-filter-active">
            Active
          </Button>
          <Button variant="outline" size="sm" data-testid="button-filter-draft">
            Draft
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Workflow className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-workflows">
              No workflows yet
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create your first workflow to automate client onboarding, tax preparation,
              bookkeeping, and more
            </p>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-first-workflow">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Workflow
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-workflow">
                <DialogHeader>
                  <DialogTitle>Create New Workflow</DialogTitle>
                  <DialogDescription>
                    Create a new workflow to automate your accounting processes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-empty">Name</Label>
                    <Input
                      id="name-empty"
                      placeholder="e.g., Client Onboarding"
                      value={newWorkflow.name}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                      data-testid="input-workflow-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description-empty">Description</Label>
                    <Textarea
                      id="description-empty"
                      placeholder="Brief description of this workflow"
                      value={newWorkflow.description}
                      onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                      data-testid="textarea-workflow-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category-empty">Category</Label>
                    <Select
                      value={newWorkflow.category}
                      onValueChange={(value) => setNewWorkflow({ ...newWorkflow, category: value })}
                    >
                      <SelectTrigger data-testid="select-workflow-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tax_preparation">Tax Preparation</SelectItem>
                        <SelectItem value="bookkeeping">Bookkeeping</SelectItem>
                        <SelectItem value="client_onboarding">Client Onboarding</SelectItem>
                        <SelectItem value="audit">Audit</SelectItem>
                        <SelectItem value="payroll">Payroll</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateWorkflow}
                    disabled={createWorkflow.isPending}
                    data-testid="button-submit-create"
                  >
                    {createWorkflow.isPending ? 'Creating...' : 'Create Workflow'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow: any) => (
            <Card key={workflow.id} className="hover-elevate" data-testid={`workflow-card-${workflow.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl" data-testid={`workflow-name-${workflow.id}`}>
                        {workflow.name}
                      </CardTitle>
                      {workflow.scope === 'global' && (
                        <Badge variant="secondary" className="text-xs" data-testid={`workflow-scope-${workflow.id}`}>
                          Global
                        </Badge>
                      )}
                      <Badge
                        variant={workflow.isActive ? "default" : "outline"}
                        data-testid={`workflow-status-${workflow.id}`}
                      >
                        {workflow.isActive ? "Active" : "Draft"}
                      </Badge>
                    </div>
                    <CardDescription data-testid={`workflow-description-${workflow.id}`}>
                      {workflow.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setLocation(`/workflows/${workflow.id}`)}
                      data-testid={`button-view-workflow-${workflow.id}`}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toast({ title: 'Coming soon', description: 'Workflow execution will be available soon' })}
                      data-testid={`button-run-workflow-${workflow.id}`}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLocation(`/workflows/${workflow.id}`)}
                      data-testid={`button-edit-workflow-${workflow.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleCopyWorkflow(workflow, e)}
                      disabled={copyWorkflow.isPending}
                      data-testid={`button-copy-workflow-${workflow.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteWorkflow(workflow.id, workflow.name, e)}
                      disabled={deleteWorkflow.isPending}
                      data-testid={`button-delete-workflow-${workflow.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Version:</span> {workflow.version || 1}
                  </div>
                  <div>
                    <span className="font-medium">Trigger:</span>{" "}
                    {workflow.trigger || "Manual"}
                  </div>
                  <div>
                    <span className="font-medium">Last updated:</span>{" "}
                    {workflow.updatedAt
                      ? new Date(workflow.updatedAt).toLocaleDateString()
                      : "Never"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
