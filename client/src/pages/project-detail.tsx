import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  DollarSign, 
  User, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Trash2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Project = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  ownerId: string | null;
  budget: string | null;
  actualCost: string | null;
};

type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  position: number;
  dueDate: string | null;
  completedAt: string | null;
  estimatedHours: string | null;
  actualHours: string | null;
};

type User = {
  id: string;
  username: string;
};

type Client = {
  id: string;
  name: string;
};

function TaskCard({ task, users }: { task: ProjectTask; users: User[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return "Unassigned";
    const user = users.find(u => u.id === assigneeId);
    return user?.username || "Unknown";
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card rounded-md border p-3 cursor-grab active:cursor-grabbing hover-elevate"
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm flex-1">{task.title}</h4>
        <Badge variant={getPriorityColor(task.priority)} className="text-xs">
          {task.priority}
        </Badge>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{getAssigneeName(task.assigneeId)}</span>
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(task.dueDate), 'MMM d')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ 
  title, 
  status, 
  tasks, 
  users, 
  icon: Icon 
}: { 
  title: string; 
  status: string; 
  tasks: ProjectTask[]; 
  users: User[];
  icon: any;
}) {
  const columnTasks = tasks.filter(t => t.status === status);

  return (
    <div className="flex-1 min-w-[280px]">
      <div className="bg-muted/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="secondary" className="ml-auto">{columnTasks.length}</Badge>
        </div>
        <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[200px]">
            {columnTasks.map(task => (
              <TaskCard key={task.id} task={task} users={users} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const [, params] = useRoute("/projects/:id");
  const [, navigate] = useLocation();
  const projectId = params?.id;
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      return response.json();
    },
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ProjectTask[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/tasks`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
    enabled: !!projectId,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
      setTaskDialogOpen(false);
      toast({ title: "Task created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "tasks"] });
    },
  });

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // Determine the new status based on which column the task was dropped in
    const overTask = tasks.find(t => t.id === over.id);
    if (overTask && overTask.status !== activeTask.status) {
      updateTaskMutation.mutate({
        id: activeTask.id,
        status: overTask.status,
      });
      toast({ title: `Task moved to ${overTask.status.replace('_', ' ')}` });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      title: formData.get("title") as string,
      description: formData.get("description") as string || null,
      status: formData.get("status") as string,
      priority: formData.get("priority") as string,
      assigneeId: formData.get("assigneeId") as string || null,
      dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string).toISOString() : null,
      estimatedHours: formData.get("estimatedHours") as string || null,
    };

    createTaskMutation.mutate(data);
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

  const calculateBudgetProgress = () => {
    if (!project?.budget || !project?.actualCost) return 0;
    const budget = parseFloat(project.budget);
    const actual = parseFloat(project.actualCost);
    return Math.min((actual / budget) * 100, 100);
  };

  const calculateTaskProgress = () => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === "completed").length;
    return (completed / tasks.length) * 100;
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">Project not found</p>
        <Button onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-display">{project.name}</h1>
          <p className="text-muted-foreground mt-1">{getClientName(project.clientId)}</p>
        </div>
        <Button onClick={() => setTaskDialogOpen(true)} data-testid="button-new-task">
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {project.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{project.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Project Owner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{getOwnerName(project.ownerId)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {project.startDate && (
                <p className="text-sm">Start: {format(new Date(project.startDate), 'MMM d, yyyy')}</p>
              )}
              {project.dueDate && (
                <p className="text-sm">Due: {format(new Date(project.dueDate), 'MMM d, yyyy')}</p>
              )}
              {!project.startDate && !project.dueDate && (
                <p className="text-muted-foreground text-sm">No dates set</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold">
                  ${project.budget ? parseFloat(project.budget).toLocaleString() : '0'}
                </p>
              </div>
              {project.actualCost && (
                <>
                  <Progress value={calculateBudgetProgress()} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    ${parseFloat(project.actualCost).toLocaleString()} spent
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-semibold">{Math.round(calculateTaskProgress())}%</p>
              <Progress value={calculateTaskProgress()} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {tasks.filter(t => t.status === "completed").length} of {tasks.length} tasks
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Tasks</h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            <KanbanColumn
              title="To Do"
              status="todo"
              tasks={tasks}
              users={users}
              icon={AlertCircle}
            />
            <KanbanColumn
              title="In Progress"
              status="in_progress"
              tasks={tasks}
              users={users}
              icon={Clock}
            />
            <KanbanColumn
              title="Review"
              status="review"
              tasks={tasks}
              users={users}
              icon={Edit}
            />
            <KanbanColumn
              title="Completed"
              status="completed"
              tasks={tasks}
              users={users}
              icon={CheckCircle2}
            />
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="bg-card rounded-md border p-3 shadow-lg opacity-90">
                {tasks.find(t => t.id === activeId)?.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task to this project</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input 
                id="title"
                name="title" 
                placeholder="Task title" 
                required 
                data-testid="input-task-title" 
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description"
                name="description" 
                placeholder="Task description" 
                rows={3}
                data-testid="input-task-description" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select name="status" defaultValue="todo">
                  <SelectTrigger id="status" data-testid="select-task-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority *</Label>
                <Select name="priority" defaultValue="medium">
                  <SelectTrigger id="priority" data-testid="select-task-priority">
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
                <Label htmlFor="assigneeId">Assignee</Label>
                <Select name="assigneeId">
                  <SelectTrigger id="assigneeId" data-testid="select-task-assignee">
                    <SelectValue placeholder="Select assignee" />
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
                <Label htmlFor="dueDate">Due Date</Label>
                <Input 
                  id="dueDate"
                  name="dueDate" 
                  type="date" 
                  data-testid="input-task-due-date" 
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input 
                  id="estimatedHours"
                  name="estimatedHours" 
                  type="number" 
                  step="0.5"
                  placeholder="0.0" 
                  data-testid="input-task-estimated-hours" 
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setTaskDialogOpen(false)}
                data-testid="button-cancel-task"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTaskMutation.isPending}
                data-testid="button-create-task"
              >
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
