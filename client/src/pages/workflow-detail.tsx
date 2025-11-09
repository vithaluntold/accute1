import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  GripVertical,
  Settings,
  ListTodo,
  CheckSquare
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
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  automationConfig?: any;
  subtasks?: Array<{
    id: string;
    taskId: string;
    name: string;
    order: number;
    status: string;
  }>;
  checklists?: Array<{
    id: string;
    taskId: string;
    item: string;
    order: number;
    isChecked: boolean;
  }>;
}

export default function WorkflowDetail() {
  const [, params] = useRoute("/workflows/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const workflowId = params?.id;

  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<WorkflowStage | undefined>();
  const [activeTask, setActiveTask] = useState<WorkflowTask | null>(null);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    
    // Find the task being dragged
    for (const stage of stages) {
      for (const step of stage.steps || []) {
        const task = step.tasks?.find(t => t.id === taskId);
        if (task) {
          setActiveTask(task);
          break;
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStepId = over.id as string;

    // Find current task
    let currentTask: WorkflowTask | null = null;
    for (const stage of stages) {
      for (const step of stage.steps || []) {
        const task = step.tasks?.find(t => t.id === taskId);
        if (task) {
          currentTask = task;
          break;
        }
      }
    }

    if (!currentTask || currentTask.stepId === newStepId) return;

    // Update task's step
    apiRequest("PATCH", `/api/workflows/tasks/${taskId}`, {
      stepId: newStepId
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages"] });
      toast({ title: "Task moved successfully" });
    }).catch(() => {
      toast({ title: "Failed to move task", variant: "destructive" });
    });
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
    <div className="container mx-auto p-6 max-w-full h-full flex flex-col">
      {/* Workflow Header */}
      <div className="mb-4 flex-shrink-0">
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
          <CardHeader className="pb-4">
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
                  onClick={() => setLocation(`/workflow-builder/${workflowId}`)}
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

      {/* Horizontal Kanban Board: Stages Side-by-Side */}
      <div className="flex-1 overflow-hidden">
        {stages.length === 0 ? (
          <Card className="border-dashed h-full">
            <CardContent className="flex flex-col items-center justify-center h-full py-16">
              <ChevronRight className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2" data-testid="text-no-stages">
                No stages yet
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Break down your workflow into stages. Each stage contains steps, and each step contains tasks with powerful automation.
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Horizontal Scroll Container */}
            <div className="flex gap-4 h-full overflow-x-auto pb-4" data-testid="stages-kanban">
              {stages
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <StageColumn
                    key={stage.id}
                    stage={stage}
                    workflowId={workflowId!}
                    setEditingStage={setEditingStage}
                    setStageDialogOpen={setStageDialogOpen}
                  />
                ))}
              
              {/* Add Stage Column */}
              <div className="min-w-[400px] max-w-[400px] flex-shrink-0">
                <Card 
                  className="h-full border-dashed hover-elevate cursor-pointer"
                  onClick={() => {
                    setEditingStage(undefined);
                    setStageDialogOpen(true);
                  }}
                  data-testid="button-add-stage-column"
                >
                  <CardContent className="flex flex-col items-center justify-center h-full py-12">
                    <Plus className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Add Stage</p>
                  </CardContent>
                </Card>
              </div>
            </div>
            <DragOverlay>
              {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
            </DragOverlay>
          </DndContext>
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

// Stage Column - Vertical column containing steps and tasks
function StageColumn({
  stage,
  workflowId,
  setEditingStage,
  setStageDialogOpen,
}: {
  stage: WorkflowStage;
  workflowId: string;
  setEditingStage: (stage: WorkflowStage | undefined) => void;
  setStageDialogOpen: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | undefined>();
  
  const steps = stage.steps || [];

  // Delete stage mutation
  const deleteStage = useMutation({
    mutationFn: (stageId: string) => apiRequest("DELETE", `/api/stages/${stageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages"] });
      toast({ title: "Stage deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete stage", variant: "destructive" });
    },
  });

  return (
    <div className="min-w-[400px] max-w-[400px] flex-shrink-0 flex flex-col h-full" data-testid={`stage-${stage.id}`}>
      <Card className="flex flex-col h-full">
        {/* Stage Header */}
        <CardHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                  {stage.order}
                </div>
                <CardTitle className="text-base truncate" data-testid={`stage-name-${stage.id}`}>
                  {stage.name}
                </CardTitle>
              </div>
              {stage.description && (
                <CardDescription className="text-xs line-clamp-1" data-testid={`stage-description-${stage.id}`}>
                  {stage.description}
                </CardDescription>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs" data-testid={`stage-steps-count-${stage.id}`}>
                  {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                </Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid={`stage-menu-${stage.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  data-testid={`stage-edit-${stage.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingStage(stage);
                    setStageDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Stage
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  data-testid={`stage-delete-${stage.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteStage.mutate(stage.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Stage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        {/* Steps and Tasks Container */}
        <CardContent className="flex-1 overflow-y-auto pt-3 pb-3">
          <div className="space-y-3">
            {steps.length === 0 ? (
              <div className="text-center py-8 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">No steps yet</p>
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
              <>
                {steps
                  .sort((a, b) => a.order - b.order)
                  .map((step) => (
                    <StepSection
                      key={step.id}
                      step={step}
                      stageId={stage.id}
                      workflowId={workflowId}
                      setEditingStep={setEditingStep}
                      setStepDialogOpen={setStepDialogOpen}
                    />
                  ))}
                
                {/* Add Step Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full hover-elevate"
                  onClick={() => {
                    setEditingStep(undefined);
                    setStepDialogOpen(true);
                  }}
                  data-testid={`button-add-step-${stage.id}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </>
            )}
          </div>
        </CardContent>

        {/* Step Dialog */}
        <StepDialog
          open={stepDialogOpen}
          onOpenChange={setStepDialogOpen}
          workflowId={workflowId}
          stageId={stage.id}
          step={editingStep}
          stepsCount={steps.length}
        />
      </Card>
    </div>
  );
}

// Step Section - Shows a step with its tasks
function StepSection({
  step,
  stageId,
  workflowId,
  setEditingStep,
  setStepDialogOpen,
}: {
  step: WorkflowStep;
  stageId: string;
  workflowId: string;
  setEditingStep: (step: WorkflowStep | undefined) => void;
  setStepDialogOpen: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkflowTask | undefined>();
  
  const tasks = step.tasks || [];
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;

  // Delete step mutation
  const deleteStep = useMutation({
    mutationFn: (stepId: string) => apiRequest("DELETE", `/api/steps/${stepId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages"] });
      toast({ title: "Step deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete step", variant: "destructive" });
    },
  });

  const { setNodeRef } = useSortable({
    id: step.id,
    data: {
      type: 'step',
      step,
    },
  });

  return (
    <div className="space-y-2" data-testid={`step-${step.id}`}>
      {/* Step Header */}
      <div className="flex items-start justify-between gap-2 p-2 bg-muted/30 rounded-lg">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold truncate" data-testid={`step-name-${step.id}`}>
              {step.name}
            </p>
          </div>
          {step.description && (
            <p className="text-xs text-muted-foreground line-clamp-1" data-testid={`step-description-${step.id}`}>
              {step.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground" data-testid={`step-progress-${step.id}`}>
              {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
              {totalTasks > 0 && ` • ${completedTasks} done`}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`step-menu-${step.id}`}>
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              data-testid={`step-edit-${step.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setEditingStep(step);
                setStepDialogOpen(true);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Step
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              data-testid={`step-delete-${step.id}`}
              onClick={(e) => {
                e.stopPropagation();
                deleteStep.mutate(step.id);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Step
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tasks */}
      <div className="space-y-2" ref={setNodeRef}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks
            .sort((a, b) => a.order - b.order)
            .map((task) => (
              <DraggableTaskCard key={task.id} task={task} setEditingTask={setEditingTask} setTaskDialogOpen={setTaskDialogOpen} />
            ))}
        </SortableContext>
        
        <Button
          size="sm"
          variant="ghost"
          className="w-full hover-elevate text-xs h-8"
          onClick={() => {
            setEditingTask(undefined);
            setTaskDialogOpen(true);
          }}
          data-testid={`button-add-task-${step.id}`}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Task
        </Button>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        stepId={step.id}
        workflowId={workflowId}
        task={editingTask}
        tasksCount={tasks.length}
      />
    </div>
  );
}

// Draggable Task Card
function DraggableTaskCard({
  task,
  setEditingTask,
  setTaskDialogOpen,
}: {
  task: WorkflowTask;
  setEditingTask: (task: WorkflowTask | undefined) => void;
  setTaskDialogOpen: (open: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} setEditingTask={setEditingTask} setTaskDialogOpen={setTaskDialogOpen} />
    </div>
  );
}

// Task Card Component
function TaskCard({ 
  task, 
  isDragging = false,
  setEditingTask,
  setTaskDialogOpen,
}: { 
  task: WorkflowTask; 
  isDragging?: boolean;
  setEditingTask?: (task: WorkflowTask | undefined) => void;
  setTaskDialogOpen?: (open: boolean) => void;
}) {
  const isAiPowered = task.type === 'automated' && task.aiAgentId;
  const hasAutomation = task.automationConfig;

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
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
      case 'in_progress':
        return <Circle className="h-3.5 w-3.5 text-blue-600 fill-current" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Card
      className={`group cursor-grab active:cursor-grabbing hover-elevate ${isDragging ? 'rotate-3 shadow-lg' : ''}`}
      data-testid={`task-${task.id}`}
      onClick={() => {
        if (setEditingTask && setTaskDialogOpen) {
          setEditingTask(task);
          setTaskDialogOpen(true);
        }
      }}
    >
      <CardContent className="p-2.5">
        <div className="flex items-start gap-2">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 mb-1">
              {getStatusIcon(task.status)}
              <p className="text-sm font-medium flex-1 line-clamp-2" data-testid={`task-name-${task.id}`}>
                {task.name}
              </p>
            </div>
            
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 ml-5" data-testid={`task-description-${task.id}`}>
                {task.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-5">
              {(isAiPowered || hasAutomation) && (
                <Badge variant="secondary" className="text-xs gap-1 h-5">
                  {isAiPowered ? (
                    <>
                      <Sparkles className="h-3 w-3" />
                      AI
                    </>
                  ) : (
                    <>
                      <Settings className="h-3 w-3" />
                      Auto
                    </>
                  )}
                </Badge>
              )}
              {task.priority && (
                <Badge variant={getPriorityColor(task.priority)} className="text-xs gap-1 h-5">
                  <Flag className="h-3 w-3" />
                  {task.priority}
                </Badge>
              )}
              {task.dueDate && (
                <Badge variant="outline" className="text-xs gap-1 h-5">
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Badge>
              )}
              {task.assignedTo && (
                <Badge variant="outline" className="text-xs gap-1 h-5">
                  <User className="h-3 w-3" />
                  Assigned
                </Badge>
              )}
            </div>

            {/* Subtasks Display */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="mt-2 ml-5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListTodo className="h-3 w-3" />
                  <span className="font-medium">Subtasks ({task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length})</span>
                </div>
                {task.subtasks.slice(0, 2).map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-1.5 text-xs text-muted-foreground ml-4">
                    {subtask.status === 'completed' ? (
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
                    ) : (
                      <Circle className="h-2.5 w-2.5" />
                    )}
                    <span className={subtask.status === 'completed' ? 'line-through' : ''}>
                      {subtask.name}
                    </span>
                  </div>
                ))}
                {task.subtasks.length > 2 && (
                  <div className="text-xs text-muted-foreground ml-4">
                    +{task.subtasks.length - 2} more
                  </div>
                )}
              </div>
            )}

            {/* Checklists Display */}
            {task.checklists && task.checklists.length > 0 && (
              <div className="mt-2 ml-5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckSquare className="h-3 w-3" />
                  <span className="font-medium">Checklist ({task.checklists.filter(c => c.isChecked).length}/{task.checklists.length})</span>
                </div>
                {task.checklists.slice(0, 2).map((checklist) => (
                  <div key={checklist.id} className="flex items-center gap-1.5 text-xs text-muted-foreground ml-4">
                    {checklist.isChecked ? (
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />
                    ) : (
                      <Circle className="h-2.5 w-2.5" />
                    )}
                    <span className={checklist.isChecked ? 'line-through' : ''}>
                      {checklist.item}
                    </span>
                  </div>
                ))}
                {task.checklists.length > 2 && (
                  <div className="text-xs text-muted-foreground ml-4">
                    +{task.checklists.length - 2} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
