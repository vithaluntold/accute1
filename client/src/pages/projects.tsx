import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, Edit, Trash2, Calendar, DollarSign, User, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";

type Project = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  clientId: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  ownerId: string | null;
  budget: string | null;
  actualCost: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Client = {
  id: string;
  name: string;
};

type User = {
  id: string;
  username: string;
  email: string;
};

export default function ProjectsPage() {
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialogOpen(false);
      setEditingProject(null);
      toast({ title: "Project created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create project", variant: "destructive" });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialogOpen(false);
      setEditingProject(null);
      toast({ title: "Project updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDeletingProject(null);
      toast({ title: "Project deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete project", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      clientId: formData.get("clientId") as string || null,
      status: formData.get("status") as string,
      priority: formData.get("priority") as string,
      startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string).toISOString() : null,
      dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string).toISOString() : null,
      ownerId: formData.get("ownerId") as string || null,
      budget: formData.get("budget") as string || null,
    };

    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, ...data });
    } else {
      createProjectMutation.mutate(data);
    }
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProject(null);
    setDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "on_hold": return "secondary";
      case "completed": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "No Client";
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Unknown Client";
  };

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return "Unassigned";
    const user = users.find(u => u.id === ownerId);
    return user?.username || "Unknown User";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage client engagements and track deliverables
          </p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-new-project">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading projects...</p>
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Briefcase className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-muted-foreground">No projects yet. Create one to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((project) => (
            <Card 
              key={project.id} 
              className="cursor-pointer hover-elevate" 
              onClick={() => navigate(`/projects/${project.id}`)}
              data-testid={`card-project-${project.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate">{project.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {getClientName(project.clientId)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(project.status)} data-testid={`badge-status-${project.id}`}>
                      {project.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant={getPriorityColor(project.priority)}>
                      {project.priority}
                    </Badge>
                  </div>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                    {project.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>{getOwnerName(project.ownerId)}</span>
                  </div>
                  {project.budget && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>${parseFloat(project.budget).toLocaleString()}</span>
                    </div>
                  )}
                  {project.dueDate && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Due {format(new Date(project.dueDate), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {project.actualCost && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs">Actual: ${parseFloat(project.actualCost).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(project);
                    }}
                    data-testid={`button-edit-${project.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingProject(project);
                    }}
                    data-testid={`button-delete-${project.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${project.id}`);
                    }}
                    data-testid={`button-view-${project.id}`}
                  >
                    View
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {editingProject 
                ? "Update project details and settings" 
                : "Create a new client engagement or project"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input 
                  id="name"
                  name="name" 
                  placeholder="Q4 2025 Tax Filing" 
                  defaultValue={editingProject?.name}
                  required 
                  data-testid="input-project-name" 
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description"
                  name="description" 
                  placeholder="Project description and objectives" 
                  defaultValue={editingProject?.description || ""}
                  rows={3}
                  data-testid="input-project-description" 
                />
              </div>

              <div>
                <Label htmlFor="clientId">Client</Label>
                <Select name="clientId" defaultValue={editingProject?.clientId || ""}>
                  <SelectTrigger id="clientId" data-testid="select-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ownerId">Project Owner</Label>
                <Select name="ownerId" defaultValue={editingProject?.ownerId || ""}>
                  <SelectTrigger id="ownerId" data-testid="select-owner">
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select name="status" defaultValue={editingProject?.status || "active"}>
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority *</Label>
                <Select name="priority" defaultValue={editingProject?.priority || "medium"}>
                  <SelectTrigger id="priority" data-testid="select-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input 
                  id="startDate"
                  name="startDate" 
                  type="date" 
                  defaultValue={editingProject?.startDate ? format(new Date(editingProject.startDate), 'yyyy-MM-dd') : ""}
                  data-testid="input-start-date" 
                />
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input 
                  id="dueDate"
                  name="dueDate" 
                  type="date" 
                  defaultValue={editingProject?.dueDate ? format(new Date(editingProject.dueDate), 'yyyy-MM-dd') : ""}
                  data-testid="input-due-date" 
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input 
                  id="budget"
                  name="budget" 
                  type="number" 
                  step="0.01"
                  placeholder="0.00" 
                  defaultValue={editingProject?.budget || ""}
                  data-testid="input-budget" 
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
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
                disabled={createProjectMutation.isPending || updateProjectMutation.isPending}
                data-testid="button-save-project"
              >
                {createProjectMutation.isPending || updateProjectMutation.isPending 
                  ? "Saving..." 
                  : editingProject ? "Update Project" : "Create Project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProject} onOpenChange={() => setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProject?.name}"? This will also delete all associated tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProject && deleteProjectMutation.mutate(deletingProject.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
