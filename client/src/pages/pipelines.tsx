import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ChevronDown, ChevronRight, CheckCircle2, Circle, Users, Bot, UserPlus, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Pipeline, PipelineStage, PipelineStep, PipelineTask, TaskSubtask, TaskChecklist, User } from "@shared/schema";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Pipelines() {
  const { toast } = useToast();
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(new Set());
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPipeline, setNewPipeline] = useState({ name: "", description: "", category: "custom" });

  const { data: pipelines, isLoading } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createPipeline = useMutation({
    mutationFn: (data: typeof newPipeline) => apiRequest("POST", "/api/pipelines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      setCreateDialogOpen(false);
      setNewPipeline({ name: "", description: "", category: "custom" });
      toast({ title: "Pipeline created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create pipeline", variant: "destructive" });
    },
  });

  const toggleExpand = (id: string, type: 'pipeline' | 'stage' | 'step' | 'task') => {
    const setters = {
      pipeline: setExpandedPipelines,
      stage: setExpandedStages,
      step: setExpandedSteps,
      task: setExpandedTasks,
    };
    
    setters[type]((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground" data-testid="text-loading">Loading pipelines...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Pipelines</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Manage hierarchical project workflows with stages, steps, and tasks
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-pipeline">
              <Plus className="mr-2 h-4 w-4" />
              Create Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-pipeline">
            <DialogHeader>
              <DialogTitle>Create New Pipeline</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  data-testid="input-pipeline-name"
                  value={newPipeline.name}
                  onChange={(e) => setNewPipeline({ ...newPipeline, name: e.target.value })}
                  placeholder="Tax Return Pipeline"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-pipeline-description"
                  value={newPipeline.description || ""}
                  onChange={(e) => setNewPipeline({ ...newPipeline, description: e.target.value })}
                  placeholder="Comprehensive workflow for processing tax returns"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={newPipeline.category} onValueChange={(value) => setNewPipeline({ ...newPipeline, category: value })}>
                  <SelectTrigger id="category" data-testid="select-pipeline-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tax">Tax</SelectItem>
                    <SelectItem value="audit">Audit</SelectItem>
                    <SelectItem value="bookkeeping">Bookkeeping</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-pipeline">
                Cancel
              </Button>
              <Button 
                onClick={() => createPipeline.mutate(newPipeline)} 
                disabled={!newPipeline.name || createPipeline.isPending}
                data-testid="button-submit-pipeline"
              >
                {createPipeline.isPending ? "Creating..." : "Create Pipeline"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pipelines && pipelines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4" data-testid="text-no-pipelines">No pipelines yet. Create your first one to get started!</p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-pipeline">
              <Plus className="mr-2 h-4 w-4" />
              Create Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pipelines?.map((pipeline) => (
            <PipelineItem
              key={pipeline.id}
              pipeline={pipeline}
              expanded={expandedPipelines.has(pipeline.id)}
              onToggle={() => toggleExpand(pipeline.id, 'pipeline')}
              expandedStages={expandedStages}
              expandedSteps={expandedSteps}
              expandedTasks={expandedTasks}
              onToggleStage={(id) => toggleExpand(id, 'stage')}
              onToggleStep={(id) => toggleExpand(id, 'step')}
              onToggleTask={(id) => toggleExpand(id, 'task')}
              users={users}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineItem({ 
  pipeline, 
  expanded, 
  onToggle,
  expandedStages,
  expandedSteps,
  expandedTasks,
  onToggleStage,
  onToggleStep,
  onToggleTask,
  users,
}: { 
  pipeline: Pipeline; 
  expanded: boolean; 
  onToggle: () => void;
  expandedStages: Set<string>;
  expandedSteps: Set<string>;
  expandedTasks: Set<string>;
  onToggleStage: (id: string) => void;
  onToggleStep: (id: string) => void;
  onToggleTask: (id: string) => void;
  users?: User[];
}) {
  const { toast } = useToast();
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [newStage, setNewStage] = useState({ name: "", description: "", order: 0 });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipelines", pipeline.id, "stages"],
    enabled: expanded,
  });

  const createStage = useMutation({
    mutationFn: (data: typeof newStage) => 
      apiRequest("POST", "/api/stages", { ...data, pipelineId: pipeline.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines", pipeline.id, "stages"] });
      setStageDialogOpen(false);
      setNewStage({ name: "", description: "", order: (stages?.length || 0) + 1 });
      toast({ title: "Stage created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create stage", variant: "destructive" });
    },
  });

  return (
    <Card data-testid={`card-pipeline-${pipeline.id}`}>
      <CardHeader className="cursor-pointer hover-elevate active-elevate-2" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div>
              <CardTitle data-testid={`text-pipeline-name-${pipeline.id}`}>{pipeline.name}</CardTitle>
              <CardDescription data-testid={`text-pipeline-description-${pipeline.id}`}>{pipeline.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid={`badge-pipeline-category-${pipeline.id}`}>{pipeline.category}</Badge>
            <Badge variant={pipeline.status === 'active' ? 'default' : 'secondary'} data-testid={`badge-pipeline-status-${pipeline.id}`}>
              {pipeline.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Stages</h3>
            <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-add-stage-${pipeline.id}`}>
                  <Plus className="mr-2 h-3 w-3" />
                  Add Stage
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Stage to {pipeline.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="stage-name">Name</Label>
                    <Input
                      id="stage-name"
                      data-testid="input-stage-name"
                      value={newStage.name}
                      onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                      placeholder="Planning"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stage-description">Description</Label>
                    <Textarea
                      id="stage-description"
                      data-testid="input-stage-description"
                      value={newStage.description || ""}
                      onChange={(e) => setNewStage({ ...newStage, description: e.target.value })}
                      placeholder="Initial planning and requirements gathering"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStageDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createStage.mutate(newStage)} 
                    disabled={!newStage.name || createStage.isPending}
                    data-testid="button-submit-stage"
                  >
                    {createStage.isPending ? "Creating..." : "Create Stage"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {stages && stages.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-stages">No stages yet. Add your first stage to get started!</p>
          ) : (
            <div className="space-y-3">
              {stages?.map((stage) => (
                <StageItem
                  key={stage.id}
                  stage={stage}
                  expanded={expandedStages.has(stage.id)}
                  onToggle={() => onToggleStage(stage.id)}
                  expandedSteps={expandedSteps}
                  expandedTasks={expandedTasks}
                  onToggleStep={onToggleStep}
                  onToggleTask={onToggleTask}
                  users={users}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function StageItem({ 
  stage, 
  expanded, 
  onToggle,
  expandedSteps,
  expandedTasks,
  onToggleStep,
  onToggleTask,
  users,
}: { 
  stage: PipelineStage; 
  expanded: boolean; 
  onToggle: () => void;
  expandedSteps: Set<string>;
  expandedTasks: Set<string>;
  onToggleStep: (id: string) => void;
  onToggleTask: (id: string) => void;
  users?: User[];
}) {
  const { toast } = useToast();
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [newStep, setNewStep] = useState({ name: "", description: "", order: 0 });

  const { data: steps } = useQuery<PipelineStep[]>({
    queryKey: ["/api/stages", stage.id, "steps"],
    enabled: expanded,
  });

  const createStep = useMutation({
    mutationFn: (data: typeof newStep) => 
      apiRequest("POST", "/api/steps", { ...data, stageId: stage.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stage.id, "steps"] });
      setStepDialogOpen(false);
      setNewStep({ name: "", description: "", order: (steps?.length || 0) + 1 });
      toast({ title: "Step created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create step", variant: "destructive" });
    },
  });

  const getStatusIcon = (status: string) => {
    return status === 'completed' ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" />
    );
  };

  return (
    <Card className="ml-8" data-testid={`card-stage-${stage.id}`}>
      <CardHeader className="cursor-pointer hover-elevate active-elevate-2 py-3" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button variant="ghost" size="icon" className="h-5 w-5">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
            {getStatusIcon(stage.status)}
            <div>
              <CardTitle className="text-base" data-testid={`text-stage-name-${stage.id}`}>{stage.name}</CardTitle>
              {stage.description && (
                <CardDescription className="text-xs" data-testid={`text-stage-description-${stage.id}`}>{stage.description}</CardDescription>
              )}
            </div>
          </div>
          <Badge variant={stage.status === 'completed' ? 'default' : 'secondary'} data-testid={`badge-stage-status-${stage.id}`}>
            {stage.status}
          </Badge>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Steps</h4>
            <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-add-step-${stage.id}`}>
                  <Plus className="mr-2 h-3 w-3" />
                  Add Step
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Step to {stage.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="step-name">Name</Label>
                    <Input
                      id="step-name"
                      data-testid="input-step-name"
                      value={newStep.name}
                      onChange={(e) => setNewStep({ ...newStep, name: e.target.value })}
                      placeholder="Gather Documents"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="step-description">Description</Label>
                    <Textarea
                      id="step-description"
                      data-testid="input-step-description"
                      value={newStep.description || ""}
                      onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                      placeholder="Collect all necessary documents from client"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStepDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createStep.mutate(newStep)} 
                    disabled={!newStep.name || createStep.isPending}
                    data-testid="button-submit-step"
                  >
                    {createStep.isPending ? "Creating..." : "Create Step"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {steps && steps.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="text-no-steps">No steps yet. Add your first step!</p>
          ) : (
            <div className="space-y-2">
              {steps?.map((step) => (
                <StepItem
                  key={step.id}
                  step={step}
                  expanded={expandedSteps.has(step.id)}
                  onToggle={() => onToggleStep(step.id)}
                  expandedTasks={expandedTasks}
                  onToggleTask={onToggleTask}
                  users={users}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function StepItem({ 
  step, 
  expanded, 
  onToggle,
  expandedTasks,
  onToggleTask,
  users,
}: { 
  step: PipelineStep; 
  expanded: boolean; 
  onToggle: () => void;
  expandedTasks: Set<string>;
  onToggleTask: (id: string) => void;
  users?: User[];
}) {
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({ 
    name: "", 
    description: "", 
    type: "manual" as "manual" | "automated",
    priority: "medium",
    order: 0 
  });

  const { data: tasks } = useQuery<PipelineTask[]>({
    queryKey: ["/api/steps", step.id, "tasks"],
    enabled: expanded,
  });

  const createTask = useMutation({
    mutationFn: (data: typeof newTask) => 
      apiRequest("POST", "/api/tasks", { ...data, stepId: step.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steps", step.id, "tasks"] });
      setTaskDialogOpen(false);
      setNewTask({ name: "", description: "", type: "manual", priority: "medium", order: (tasks?.length || 0) + 1 });
      toast({ title: "Task created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const getStatusIcon = (status: string) => {
    return status === 'completed' ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" />
    );
  };

  return (
    <Card className="ml-8" data-testid={`card-step-${step.id}`}>
      <CardHeader className="cursor-pointer hover-elevate active-elevate-2 py-2" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button variant="ghost" size="icon" className="h-4 w-4">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
            {getStatusIcon(step.status)}
            <div className="flex-1">
              <CardTitle className="text-sm" data-testid={`text-step-name-${step.id}`}>{step.name}</CardTitle>
              {step.description && (
                <CardDescription className="text-xs" data-testid={`text-step-description-${step.id}`}>{step.description}</CardDescription>
              )}
            </div>
          </div>
          <Badge variant={step.status === 'completed' ? 'default' : 'secondary'} className="text-xs" data-testid={`badge-step-status-${step.id}`}>
            {step.status}
          </Badge>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold">Tasks</h5>
            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-add-task-${step.id}`}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Task to {step.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-name">Name</Label>
                    <Input
                      id="task-name"
                      data-testid="input-task-name"
                      value={newTask.name}
                      onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                      placeholder="Review financial statements"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea
                      id="task-description"
                      data-testid="input-task-description"
                      value={newTask.description || ""}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Carefully review all financial statements for accuracy"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-type">Type</Label>
                      <Select value={newTask.type} onValueChange={(value: "manual" | "automated") => setNewTask({ ...newTask, type: value })}>
                        <SelectTrigger id="task-type" data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="automated">Automated (AI)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-priority">Priority</Label>
                      <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                        <SelectTrigger id="task-priority" data-testid="select-task-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createTask.mutate(newTask)} 
                    disabled={!newTask.name || createTask.isPending}
                    data-testid="button-submit-task"
                  >
                    {createTask.isPending ? "Creating..." : "Create Task"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {tasks && tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="text-no-tasks">No tasks yet. Add your first task!</p>
          ) : (
            <div className="space-y-2">
              {tasks?.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  expanded={expandedTasks.has(task.id)}
                  onToggle={() => onToggleTask(task.id)}
                  users={users}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function TaskItem({ task, expanded, onToggle, users }: { task: PipelineTask; expanded: boolean; onToggle: () => void; users?: User[] }) {
  const { toast } = useToast();
  const [subtaskDialogOpen, setSubtaskDialogOpen] = useState(false);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState({ name: "", description: "", priority: "medium", order: 0 });
  const [newChecklistItem, setNewChecklistItem] = useState({ item: "", order: 0 });
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  
  const { data: subtasks } = useQuery<TaskSubtask[]>({
    queryKey: ["/api/tasks", task.id, "subtasks"],
    enabled: expanded,
  });

  const { data: checklists } = useQuery<TaskChecklist[]>({
    queryKey: ["/api/tasks", task.id, "checklists"],
    enabled: expanded,
  });

  const assignedUser = users?.find(u => u.id === task.assignedTo);

  const createSubtask = useMutation({
    mutationFn: (data: typeof newSubtask) =>
      apiRequest("POST", "/api/subtasks", { ...data, taskId: task.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "subtasks"] });
      setSubtaskDialogOpen(false);
      setNewSubtask({ name: "", description: "", priority: "medium", order: (subtasks?.length || 0) + 1 });
      toast({ title: "Subtask created successfully!" });
    },
  });

  const createChecklistItem = useMutation({
    mutationFn: (data: typeof newChecklistItem) =>
      apiRequest("POST", "/api/checklists", { ...data, taskId: task.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "checklists"] });
      setChecklistDialogOpen(false);
      setNewChecklistItem({ item: "", order: (checklists?.length || 0) + 1 });
      toast({ title: "Checklist item created successfully!" });
    },
  });

  const assignTask = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("POST", `/api/tasks/${task.id}/assign`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steps", task.stepId, "tasks"] });
      setAssignDialogOpen(false);
      toast({ title: "Task assigned successfully!" });
    },
  });

  const completeTask = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steps", task.stepId, "tasks"] });
      toast({ title: "Task completed!" });
    },
  });

  const executeAI = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tasks/${task.id}/execute-ai`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/steps", task.stepId, "tasks"] });
      toast({ title: "AI agent started executing task..." });
      // Poll for task completion
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/steps", task.stepId, "tasks"] });
      }, 3000);
    },
  });

  const completeSubtask = useMutation({
    mutationFn: (subtaskId: string) => apiRequest("POST", `/api/subtasks/${subtaskId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "subtasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/steps", task.stepId, "tasks"] });
    },
  });

  const toggleChecklist = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/checklists/${id}/toggle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task.id, "checklists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/steps", task.stepId, "tasks"] });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "medium": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "low": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    return status === 'completed' ? (
      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
    ) : (
      <Circle className="h-3 w-3 text-muted-foreground" />
    );
  };

  return (
    <Card className="ml-8" data-testid={`card-task-${task.id}`}>
      <CardHeader className="cursor-pointer hover-elevate active-elevate-2 py-2" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Button variant="ghost" size="icon" className="h-4 w-4">
              {expanded ? <ChevronDown className="h-2 w-2" /> : <ChevronRight className="h-2 w-2" />}
            </Button>
            {getStatusIcon(task.status)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" data-testid={`text-task-name-${task.id}`}>{task.name}</span>
                {task.type === 'automated' && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Bot className="h-2 w-2" />
                    AI
                  </Badge>
                )}
                {task.assignedTo && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Users className="h-2 w-2" />
                    Assigned
                  </Badge>
                )}
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground" data-testid={`text-task-description-${task.id}`}>{task.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${getPriorityColor(task.priority)}`} data-testid={`badge-task-priority-${task.id}`}>
              {task.priority}
            </Badge>
            <Badge variant={task.status === 'completed' ? 'default' : 'secondary'} className="text-xs" data-testid={`badge-task-status-${task.id}`}>
              {task.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {assignedUser && (
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">
                    {assignedUser.fullName?.split(' ').map(n => n[0]).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{assignedUser.fullName || assignedUser.email}</span>
              </div>
            )}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-assign-task-${task.id}`}>
                  <UserPlus className="mr-1 h-3 w-3" />
                  {assignedUser ? 'Reassign' : 'Assign'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger data-testid="select-user-assign">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => assignTask.mutate(selectedUserId)} 
                    disabled={!selectedUserId || assignTask.isPending}
                    data-testid="button-submit-assign"
                  >
                    {assignTask.isPending ? "Assigning..." : "Assign"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {task.type === 'automated' && task.status !== 'completed' && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => executeAI.mutate()}
                disabled={executeAI.isPending || task.status === 'in_progress'}
                data-testid={`button-execute-ai-${task.id}`}
              >
                <Bot className="mr-1 h-3 w-3" />
                {task.status === 'in_progress' ? 'Running...' : 'Run AI Agent'}
              </Button>
            )}
            {task.type === 'manual' && task.status !== 'completed' && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => completeTask.mutate()}
                disabled={completeTask.isPending}
                data-testid={`button-complete-task-${task.id}`}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Complete
              </Button>
            )}
            <Dialog open={subtaskDialogOpen} onOpenChange={setSubtaskDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-add-subtask-${task.id}`}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Subtask
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Subtask</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="subtask-name">Name</Label>
                    <Input
                      id="subtask-name"
                      data-testid="input-subtask-name"
                      value={newSubtask.name}
                      onChange={(e) => setNewSubtask({ ...newSubtask, name: e.target.value })}
                      placeholder="Subtask name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtask-description">Description</Label>
                    <Textarea
                      id="subtask-description"
                      data-testid="input-subtask-description"
                      value={newSubtask.description || ""}
                      onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSubtaskDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => createSubtask.mutate(newSubtask)}
                    disabled={!newSubtask.name || createSubtask.isPending}
                    data-testid="button-submit-subtask"
                  >
                    {createSubtask.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-add-checklist-${task.id}`}>
                  <ListChecks className="mr-1 h-3 w-3" />
                  Add Checklist Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Checklist Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="checklist-item">Item</Label>
                    <Input
                      id="checklist-item"
                      data-testid="input-checklist-item"
                      value={newChecklistItem.item}
                      onChange={(e) => setNewChecklistItem({ ...newChecklistItem, item: e.target.value })}
                      placeholder="Checklist item"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setChecklistDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => createChecklistItem.mutate(newChecklistItem)}
                    disabled={!newChecklistItem.item || createChecklistItem.isPending}
                    data-testid="button-submit-checklist"
                  >
                    {createChecklistItem.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          {subtasks && subtasks.length > 0 && (
            <div>
              <h6 className="text-xs font-semibold mb-2">Subtasks</h6>
              <div className="space-y-1">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center justify-between gap-2 text-xs" data-testid={`subtask-${subtask.id}`}>
                    <div className="flex items-center gap-2 flex-1">
                      {getStatusIcon(subtask.status)}
                      <span>{subtask.name}</span>
                    </div>
                    {subtask.status !== 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => completeSubtask.mutate(subtask.id)}
                        disabled={completeSubtask.isPending}
                        data-testid={`button-complete-subtask-${subtask.id}`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {checklists && checklists.length > 0 && (
            <div>
              <h6 className="text-xs font-semibold mb-2">Checklist</h6>
              <div className="space-y-1">
                {checklists.map((item) => (
                  <div key={item.id} className="flex items-center gap-2" data-testid={`checklist-${item.id}`}>
                    <Checkbox 
                      checked={item.isChecked} 
                      onCheckedChange={() => toggleChecklist.mutate(item.id)}
                      data-testid={`checkbox-checklist-${item.id}`}
                    />
                    <span className={`text-xs ${item.isChecked ? 'line-through text-muted-foreground' : ''}`}>
                      {item.item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
