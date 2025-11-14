import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Building2,
  User,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Play,
  Check,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { SkillBasedAssigneeSelector } from "@/components/skill-based-assignee-selector";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

interface Task {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

interface Step {
  id: string;
  name: string;
  description: string | null;
  status: string;
  order: number;
  tasks: Task[];
}

interface Stage {
  id: string;
  name: string;
  description: string | null;
  status: string;
  order: number;
  steps: Step[];
}

interface AssignmentDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  completedStages: number;
  totalStages: number;
  dueDate: string | null;
  createdAt: string;
  client: {
    id: string;
    companyName: string;
  };
  workflow: {
    id: string;
    name: string;
  };
  assignee: {
    id: string;
    name: string;
  } | null;
  stages: Stage[];
}

export default function AssignmentDetail() {
  const params = useParams<{ id: string }>();
  const assignmentId = params.id;
  const { toast } = useToast();
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>("unassigned");

  const { data: assignment, isLoading } = useQuery<AssignmentDetail>({
    queryKey: [`/api/assignments/${assignmentId}`],
    enabled: !!assignmentId,
  });

  //  Fetch users for assignment
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}`] });
      toast({
        title: "Success",
        description: "Task status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const assignTaskMutation = useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string | null }) => {
      return await apiRequest("PATCH", `/api/tasks/${id}`, { assignedTo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}`] });
      toast({
        title: "Success",
        description: "Task assigned successfully",
      });
      setReassignDialogOpen(false);
      setSelectedTask(null);
      setSelectedAssignee("unassigned");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign task",
        variant: "destructive",
      });
    },
  });

  const handleReassignTask = (task: Task) => {
    setSelectedTask(task);
    setSelectedAssignee(task.assignedTo || "unassigned");
    setReassignDialogOpen(true);
  };

  const handleAssignTask = () => {
    if (!selectedTask) return;
    const assignedTo = selectedAssignee === "unassigned" ? null : selectedAssignee;
    assignTaskMutation.mutate({ id: selectedTask.id, assignedTo });
  };

  const updateStepMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/steps/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}`] });
      toast({
        title: "Success",
        description: "Step status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update step",
        variant: "destructive",
      });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/stages/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}`] });
      toast({
        title: "Success",
        description: "Stage status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update stage",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "in_progress":
        return <Play className="w-4 h-4 text-blue-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      not_started: "outline",
      in_progress: "default",
      completed: "secondary",
      waiting_client: "outline",
      review: "outline",
      cancelled: "outline",
    };
    
    return (
      <Badge variant={variants[status] || "default"} data-testid={`badge-status-${status}`}>
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    
    return (
      <Badge className={colors[priority] || ""} data-testid={`badge-priority-${priority}`}>
        {priority}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Assignment not found</p>
        <Link href="/assignments">
          <Button variant="outline" data-testid="button-back-to-assignments">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Assignments
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/assignments">
            <Button variant="outline" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-assignment-name">{assignment.name}</h1>
            <p className="text-muted-foreground">{assignment.description}</p>
          </div>
        </div>
        {getStatusBadge(assignment.status)}
      </div>

      {/* Assignment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-client-name">{assignment.client.companyName}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Assigned To
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-assignee-name">
              {assignment.assignee?.name || "Unassigned"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Due Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-due-date">
              {assignment.dueDate ? format(new Date(assignment.dueDate), "MMM d, yyyy") : "No due date"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>
            {assignment.completedStages} of {assignment.totalStages} stages completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={assignment.progress} className="h-4" data-testid="progress-overall" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{assignment.progress}% Complete</span>
              <span className="flex items-center gap-1">
                {getPriorityBadge(assignment.priority)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow: {assignment.workflow.name}</CardTitle>
          <CardDescription>
            Track progress through each stage, step, and task
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {assignment.stages.map((stage) => (
              <AccordionItem key={stage.id} value={stage.id}>
                <AccordionTrigger className="hover:no-underline" data-testid={`accordion-stage-${stage.id}`}>
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(stage.status)}
                      <span className="font-semibold">{stage.name}</span>
                    </div>
                    {getStatusBadge(stage.status)}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-7 space-y-4">
                    {stage.description && (
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                    )}
                    
                    {/* Stage Actions */}
                    <div className="flex gap-2">
                      {stage.status !== "in_progress" && stage.status !== "completed" && (
                        <Button
                          size="sm"
                          onClick={() => updateStageMutation.mutate({ id: stage.id, status: "in_progress" })}
                          data-testid={`button-start-stage-${stage.id}`}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Start Stage
                        </Button>
                      )}
                      {stage.status === "in_progress" && (
                        <Button
                          size="sm"
                          onClick={() => updateStageMutation.mutate({ id: stage.id, status: "completed" })}
                          data-testid={`button-complete-stage-${stage.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Complete Stage
                        </Button>
                      )}
                    </div>

                    {/* Steps */}
                    <div className="space-y-3">
                      {stage.steps.map((step) => (
                        <div key={step.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(step.status)}
                              <div>
                                <h4 className="font-medium" data-testid={`text-step-name-${step.id}`}>{step.name}</h4>
                                {step.description && (
                                  <p className="text-sm text-muted-foreground">{step.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(step.status)}
                              {step.status !== "in_progress" && step.status !== "completed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStepMutation.mutate({ id: step.id, status: "in_progress" })}
                                  data-testid={`button-start-step-${step.id}`}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Start
                                </Button>
                              )}
                              {step.status === "in_progress" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStepMutation.mutate({ id: step.id, status: "completed" })}
                                  data-testid={`button-complete-step-${step.id}`}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Tasks */}
                          {step.tasks.length > 0 && (
                            <div className="pl-7 space-y-2">
                              {step.tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-3 border rounded hover-elevate"
                                  data-testid={`task-item-${task.id}`}
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {getStatusIcon(task.status)}
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{task.name}</p>
                                      {task.description && (
                                        <p className="text-xs text-muted-foreground">{task.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {task.assignedTo && (
                                      <Badge variant="secondary" className="text-xs">
                                        <User className="w-3 h-3 mr-1" />
                                        {users.find((u: any) => u.id === task.assignedTo)?.username || "Assigned"}
                                      </Badge>
                                    )}
                                    {task.dueDate && (
                                      <Badge variant="outline" className="text-xs">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {format(new Date(task.dueDate), "MMM d")}
                                      </Badge>
                                    )}
                                    {getPriorityBadge(task.priority)}
                                    {getStatusBadge(task.status)}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleReassignTask(task)}
                                      data-testid={`button-assign-task-${task.id}`}
                                      title={task.assignedTo ? "Reassign task" : "Assign task"}
                                    >
                                      <UserPlus className="w-4 h-4" />
                                    </Button>
                                    {task.status !== "in_progress" && task.status !== "completed" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateTaskMutation.mutate({ id: task.id, status: "in_progress" })}
                                        data-testid={`button-start-task-${task.id}`}
                                      >
                                        <Play className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {task.status === "in_progress" && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => updateTaskMutation.mutate({ id: task.id, status: "completed" })}
                                        data-testid={`button-complete-task-${task.id}`}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Task Reassignment Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent data-testid="dialog-reassign-task">
          <DialogHeader>
            <DialogTitle>
              {selectedTask?.assignedTo ? "Reassign Task" : "Assign Task"}
            </DialogTitle>
            <DialogDescription>
              {selectedTask && `Select an assignee for "${selectedTask.name}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTask && (
              <SkillBasedAssigneeSelector
                taskId={selectedTask.id}
                users={users}
                value={selectedAssignee}
                onValueChange={setSelectedAssignee}
                placeholder="Select assignee"
                dataTestId="select-task-assignee-dialog"
                initialMatches={(selectedTask as any).skillMatches || []}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReassignDialogOpen(false)}
              data-testid="button-cancel-reassign"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignTask}
              disabled={assignTaskMutation.isPending}
              data-testid="button-confirm-reassign"
            >
              {assignTaskMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
