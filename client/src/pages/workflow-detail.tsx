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
  Play,
  GripVertical
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
    <div className="container mx-auto p-6 max-w-full">
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

      {/* Kanban Board View: Stages → Steps as Columns → Tasks as Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" data-testid="heading-hierarchy">
            Workflow Board
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <Accordion type="multiple" className="space-y-6" data-testid="stages-accordion">
              {stages
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <StageKanbanCard key={stage.id} stage={stage} workflowId={workflowId!} />
                ))}
            </Accordion>
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

// Stage Kanban Card - Shows steps as horizontal columns
function StageKanbanCard({ stage, workflowId }: { stage: WorkflowStage; workflowId: string }) {
  const { toast } = useToast();
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | undefined>();
  
  const steps = stage.steps || [];

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
        
        <AccordionContent className="px-6 pb-6">
          {steps.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
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
            <div className="space-y-4">
              {/* Horizontal Scrollable Kanban Board */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {steps
                  .sort((a, b) => a.order - b.order)
                  .map((step) => (
                    <StepColumn key={step.id} step={step} stageId={stage.id} workflowId={workflowId} />
                  ))}
                
                {/* Add Step Column */}
                <div className="min-w-[320px] flex-shrink-0">
                  <Card className="h-full border-dashed hover-elevate cursor-pointer" onClick={() => {
                    setEditingStep(undefined);
                    setStepDialogOpen(true);
                  }}>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">Add Step</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
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

// Step Column - Kanban column for tasks
function StepColumn({ step, stageId, workflowId }: { step: WorkflowStep; stageId: string; workflowId: string }) {
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkflowTask | undefined>();
  
  const tasks = step.tasks || [];
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;

  const { setNodeRef } = useSortable({
    id: step.id,
    data: {
      type: 'step',
      step,
    },
  });

  return (
    <div className="min-w-[320px] flex-shrink-0" data-testid={`step-${step.id}`}>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-sm font-semibold truncate" data-testid={`step-name-${step.id}`}>
                  {step.name}
                </CardTitle>
              </div>
              {step.description && (
                <CardDescription className="text-xs line-clamp-2" data-testid={`step-description-${step.id}`}>
                  {step.description}
                </CardDescription>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs" data-testid={`step-progress-${step.id}`}>
                  {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
                </Badge>
                {totalTasks > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {completedTasks} done
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`step-menu-${step.id}`}>
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
        
        <CardContent className="flex-1 pt-3 pb-3 min-h-[200px]" ref={setNodeRef}>
          <div className="space-y-2">
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks
                .sort((a, b) => a.order - b.order)
                .map((task) => (
                  <DraggableTaskCard key={task.id} task={task} />
                ))}
            </SortableContext>
            
            <Button
              size="sm"
              variant="ghost"
              className="w-full hover-elevate"
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
      </Card>
    </div>
  );
}

// Draggable Task Card
function DraggableTaskCard({ task }: { task: WorkflowTask }) {
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
      <TaskCard task={task} />
    </div>
  );
}

// Task Card Component
function TaskCard({ task, isDragging = false }: { task: WorkflowTask; isDragging?: boolean }) {
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

  return (
    <Card
      className={`group cursor-grab active:cursor-grabbing hover-elevate ${isDragging ? 'rotate-3 shadow-lg' : ''}`}
      data-testid={`task-${task.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1">
              {getStatusIcon(task.status)}
              <p className="text-sm font-medium flex-1 line-clamp-2" data-testid={`task-name-${task.id}`}>
                {task.name}
              </p>
            </div>
            
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 ml-6" data-testid={`task-description-${task.id}`}>
                {task.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-6">
              {isAiPowered && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI
                </Badge>
              )}
              {task.priority && (
                <Badge variant={getPriorityColor(task.priority)} className="text-xs gap-1">
                  <Flag className="h-3 w-3" />
                  {task.priority}
                </Badge>
              )}
              {task.dueDate && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </Badge>
              )}
              {task.assignedTo && (
                <Badge variant="outline" className="text-xs gap-1">
                  <User className="h-3 w-3" />
                  Assigned
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
