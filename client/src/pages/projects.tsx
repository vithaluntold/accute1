import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Kanban, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

export default function ProjectsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["/api/projects"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDialogOpen(false);
      toast({ title: "Project created successfully" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: ({ projectId, ...data }: any) =>
      apiRequest("POST", `/api/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      if (selectedProject) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject.id] });
      }
      setTaskDialogOpen(false);
      toast({ title: "Task created successfully" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/tasks/${id}`, data),
    onSuccess: () => {
      if (selectedProject) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject.id] });
      }
    },
  });

  const handleDragEnd = (event: DragEndEvent, status: string) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      updateTaskMutation.mutate({
        id: active.id,
        status,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo": return "secondary";
      case "in_progress": return "default";
      case "review": return "outline";
      case "completed": return "default";
      default: return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">Projects</h1>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-new-project">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {projects?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <Kanban className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-muted-foreground">No projects yet. Create one to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {projects?.map((project: any) => (
            <Card key={project.id} className="cursor-pointer hover-elevate" onClick={() => setSelectedProject(project)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{project.name}</CardTitle>
                  <Badge variant={getStatusColor(project.status)}>{project.status}</Badge>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createProjectMutation.mutate({
                name: formData.get("name"),
                description: formData.get("description"),
                clientId: formData.get("clientId") || null,
                status: "active",
                priority: "medium",
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label>Project Name</Label>
              <Input name="name" placeholder="Project name" required data-testid="input-project-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea name="description" placeholder="Project description" data-testid="input-project-description" />
            </div>
            <div>
              <Label>Client (Optional)</Label>
              <Select name="clientId">
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Client</SelectItem>
                  {clients?.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" data-testid="button-create-project">
              Create Project
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
