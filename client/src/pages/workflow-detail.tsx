import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  Circle,
  Calendar,
  User,
  Flag,
  MoreVertical,
  Sparkles,
  Play
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StageDialog } from "@/components/stage-dialog";
import { StepDialog } from "@/components/step-dialog";
import { TaskDialog } from "@/components/task-dialog";

interface WorkflowStage {
  id: string;
  workflowId: string;
  name: string;
  description?: string;
  order: number;
  steps?: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  stageId: string;
  name: string;
  description?: string;
  order: number;
  tasks?: WorkflowTask[];
}

interface WorkflowTask {
  id: string;
  stepId: string;
  name: string;
  description?: string;
  assignedTo?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  order: number;
  type?: string;
  aiAgentId?: string;
  automationInput?: string;
  automationOutput?: any;
}

export default function WorkflowDetail() {
  const [, params] = useRoute("/workflows/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const workflowId = params?.id;

  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<WorkflowStage | undefined>();

  // Fetch workflow
  const { data: workflow, isLoading: workflowLoading } = useQuery<any>({
    queryKey: ["/api/workflows", workflowId],
    enabled: !!workflowId,
  });

  // Fetch stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<WorkflowStage[]>({
    queryKey: ["/api/workflows", workflowId, "stages"],
    enabled: !!workflowId,
  });

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Circle className="h-4 w-4 text-blue-600 fill-current" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (workflowLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">Workflow not found</p>
            <Button onClick={() => setLocation("/workflows")} className="mt-4" data-testid="button-back-to-workflows">
              Back to Workflows
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Workflow Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/workflows")}
            data-testid="button-back"
          >
            ← Back
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-2xl" data-testid="workflow-name">
                    {workflow.name}
                  </CardTitle>
                  <Badge
                    variant={workflow.isActive ? "default" : "outline"}
                    data-testid="workflow-status"
                  >
                    {workflow.isActive ? "Active" : "Draft"}
                  </Badge>
                </div>
                <CardDescription data-testid="workflow-description">
                  {workflow.description || "No description provided"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/workflow-builder?id=${workflowId}`)}
                  data-testid="button-edit-automation"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Automation
                </Button>
                <Button
                  onClick={() => {
                    setEditingStage(undefined);
                    setStageDialogOpen(true);
                  }}
                  data-testid="button-add-stage"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Hierarchical View: Stages → Steps → Tasks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" data-testid="heading-hierarchy">
            Workflow Hierarchy
          </h2>
          <p className="text-sm text-muted-foreground">
            {stages.length} {stages.length === 1 ? 'stage' : 'stages'}
          </p>
        </div>

        {stages.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ChevronRight className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2" data-testid="text-no-stages">
                No stages yet
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Break down your workflow into stages. Each stage contains steps, and each step contains tasks.
              </p>
              <Button
                onClick={() => {
                  setEditingStage(undefined);
                  setStageDialogOpen(true);
                }}
                data-testid="button-create-first-stage"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Stage
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-4" data-testid="stages-accordion">
            {stages
              .sort((a, b) => a.order - b.order)
              .map((stage) => (
                <StageCard key={stage.id} stage={stage} workflowId={workflowId!} />
              ))}
          </Accordion>
        )}
      </div>

      {/* Stage Dialog */}
      <StageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        workflowId={workflowId!}
        stage={editingStage}
        stagesCount={stages.length}
      />
    </div>
  );
}

// Stage Card Component with Steps
function StageCard({ stage, workflowId }: { stage: WorkflowStage; workflowId: string }) {
  const { toast } = useToast();
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | undefined>();
  
  // Use steps from the stage object (already fetched from parent query)
  const steps = stage.steps || [];
  const stepsLoading = false;

  return (
    <AccordionItem value={stage.id} className="border rounded-lg overflow-hidden" data-testid={`stage-${stage.id}`}>
      <Card className="border-0">
        <AccordionTrigger className="hover:no-underline px-6 py-4" data-testid={`stage-trigger-${stage.id}`}>
          <div className="flex items-center justify-between flex-1 mr-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                {stage.order}
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-lg" data-testid={`stage-name-${stage.id}`}>
                  {stage.name}
                </h3>
                {stage.description && (
                  <p className="text-sm text-muted-foreground" data-testid={`stage-description-${stage.id}`}>
                    {stage.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" data-testid={`stage-steps-count-${stage.id}`}>
                {steps.length} {steps.length === 1 ? 'step' : 'steps'}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" data-testid={`stage-menu-${stage.id}`}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem data-testid={`stage-edit-${stage.id}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Stage
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" data-testid={`stage-delete-${stage.id}`}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Stage
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-6 pb-4">
          {stepsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading steps...</div>
          ) : steps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No steps in this stage yet</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingStep(undefined);
                  setStepDialogOpen(true);
                }}
                data-testid={`button-add-step-${stage.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>
          ) : (
            <div className="space-y-3 ml-11">
              {steps
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <StepCard key={step.id} step={step} stageId={stage.id} workflowId={workflowId} />
                ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEditingStep(undefined);
                  setStepDialogOpen(true);
                }}
                data-testid={`button-add-step-${stage.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>
          )}

          {/* Step Dialog */}
          <StepDialog
            open={stepDialogOpen}
            onOpenChange={setStepDialogOpen}
            workflowId={workflowId}
            stageId={stage.id}
            step={editingStep}
            stepsCount={steps.length}
          />
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}

// Step Card Component with Tasks
function StepCard({ step, stageId, workflowId }: { step: WorkflowStep; stageId: string; workflowId: string }) {
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkflowTask | undefined>();
  
  // Use tasks from the step object (already fetched from parent query)
  const tasks = step.tasks || [];
  const tasksLoading = false;

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;

  return (
    <Card className="border-l-4 border-l-primary" data-testid={`step-${step.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base" data-testid={`step-name-${step.id}`}>
                {step.name}
              </CardTitle>
              {totalTasks > 0 && (
                <Badge variant="secondary" className="text-xs" data-testid={`step-progress-${step.id}`}>
                  {completedTasks}/{totalTasks}
                </Badge>
              )}
            </div>
            {step.description && (
              <CardDescription className="text-sm" data-testid={`step-description-${step.id}`}>
                {step.description}
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`step-menu-${step.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid={`step-edit-${step.id}`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Step
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" data-testid={`step-delete-${step.id}`}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Step
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      {tasksLoading ? (
        <CardContent className="pt-0">
          <div className="text-center py-4 text-sm text-muted-foreground">Loading tasks...</div>
        </CardContent>
      ) : (
        <CardContent className="pt-0">
          {tasks.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">No tasks in this step yet</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingTask(undefined);
                  setTaskDialogOpen(true);
                }}
                data-testid={`button-add-task-${step.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks
                .sort((a, b) => a.order - b.order)
                .map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setEditingTask(undefined);
                  setTaskDialogOpen(true);
                }}
                data-testid={`button-add-task-${step.id}`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          )}

          {/* Task Dialog */}
          <TaskDialog
            open={taskDialogOpen}
            onOpenChange={setTaskDialogOpen}
            stepId={step.id}
            workflowId={workflowId}
            task={editingTask}
            tasksCount={tasks.length}
          />
        </CardContent>
      )}
    </Card>
  );
}

// Task Card Component
function TaskCard({ task }: { task: WorkflowTask }) {
  const { toast } = useToast();
  const isAiPowered = task.type === 'automated' && task.aiAgentId;

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Circle className="h-4 w-4 text-blue-600 fill-current" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Execute AI agent mutation
  const executeAiMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/tasks/${task.id}/execute-ai`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/steps"] });
      toast({
        title: 'Success',
        description: 'AI agent executed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to execute AI agent',
        variant: 'destructive',
      });
    },
  });

  const handleExecuteAi = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.aiAgentId) {
      toast({
        title: 'Error',
        description: 'No AI agent configured for this task',
        variant: 'destructive',
      });
      return;
    }
    executeAiMutation.mutate();
  };

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
      data-testid={`task-${task.id}`}
    >
      <div className="flex items-center gap-3 flex-1">
        {getStatusIcon(task.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate" data-testid={`task-name-${task.id}`}>
              {task.name}
            </p>
            {isAiPowered && (
              <Badge variant="secondary" className="text-xs gap-1" data-testid={`task-ai-badge-${task.id}`}>
                <Sparkles className="h-3 w-3" />
                AI
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground truncate" data-testid={`task-description-${task.id}`}>
              {task.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 ml-4">
        {task.priority && (
          <Badge variant={getPriorityColor(task.priority)} className="text-xs" data-testid={`task-priority-${task.id}`}>
            <Flag className="h-3 w-3 mr-1" />
            {task.priority}
          </Badge>
        )}
        {task.dueDate && (
          <Badge variant="outline" className="text-xs" data-testid={`task-due-date-${task.id}`}>
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(task.dueDate).toLocaleDateString()}
          </Badge>
        )}
        {task.assignedTo && (
          <Badge variant="outline" className="text-xs" data-testid={`task-assignee-${task.id}`}>
            <User className="h-3 w-3 mr-1" />
            Assigned
          </Badge>
        )}
        {isAiPowered && task.status !== 'completed' && (
          <Button
            variant="default"
            size="sm"
            onClick={handleExecuteAi}
            disabled={executeAiMutation.isPending}
            data-testid={`button-execute-ai-${task.id}`}
          >
            <Play className="h-3 w-3 mr-1" />
            {executeAiMutation.isPending ? 'Running...' : 'Run AI'}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`task-menu-${task.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid={`task-edit-${task.id}`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Task
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" data-testid={`task-delete-${task.id}`}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
