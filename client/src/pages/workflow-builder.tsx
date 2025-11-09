import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Play, Sparkles, Plus, ChevronRight, ChevronDown, CheckCircle2, Circle, Clock, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WorkflowCanvas } from '@/components/workflow-canvas';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { 
  Workflow, 
  WorkflowStage, 
  WorkflowStep, 
  WorkflowTask, 
  TaskSubtask, 
  TaskChecklist,
  WorkflowNode, 
  WorkflowEdge,
  WorkflowNodeType,
  InstalledAgentView 
} from '@shared/schema';
import type { Node, Edge } from '@xyflow/react';
import { cn } from '@/lib/utils';

export default function WorkflowBuilder() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [subtaskDialogOpen, setSubtaskDialogOpen] = useState(false);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [selectedStageForStep, setSelectedStageForStep] = useState<string | null>(null);
  const [selectedStepForTask, setSelectedStepForTask] = useState<string | null>(null);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [showChecklists, setShowChecklists] = useState(true);
  
  // Form states
  const [newStage, setNewStage] = useState({ name: '', description: '' });
  const [newStep, setNewStep] = useState({ name: '', description: '' });
  const [newTask, setNewTask] = useState({ name: '', description: '', type: 'manual' });
  const [newSubtask, setNewSubtask] = useState({ name: '' });
  const [newChecklist, setNewChecklist] = useState({ item: '' });

  const isEditMode = Boolean(id);

  // Fetch workflow
  const { data: workflow, isLoading } = useQuery<Workflow>({
    queryKey: ['/api/workflows', id],
    enabled: isEditMode,
  });

  // Fetch stages for this workflow
  const { data: stages = [] } = useQuery<WorkflowStage[]>({
    queryKey: ['/api/workflows', id, 'stages'],
    enabled: isEditMode,
  });

  // Fetch steps for this workflow
  const { data: steps = [] } = useQuery<WorkflowStep[]>({
    queryKey: ['/api/workflows', id, 'steps'],
    enabled: isEditMode,
  });

  // Fetch tasks for this workflow
  const { data: tasks = [] } = useQuery<WorkflowTask[]>({
    queryKey: ['/api/workflows', id, 'tasks'],
    enabled: isEditMode,
  });

  // Fetch subtasks for selected task
  const { data: subtasks = [] } = useQuery<TaskSubtask[]>({
    queryKey: ['/api/tasks', selectedTaskId, 'subtasks'],
    enabled: Boolean(selectedTaskId),
  });

  // Fetch checklists for selected task
  const { data: checklists = [] } = useQuery<TaskChecklist[]>({
    queryKey: ['/api/tasks', selectedTaskId, 'checklists'],
    enabled: Boolean(selectedTaskId),
  });

  // Check if Cadence copilot is installed
  const { data: installedAgents = [] } = useQuery<InstalledAgentView[]>({
    queryKey: ['/api/ai-agents/installed'],
  });

  const hasCadence = installedAgents.some((agent: InstalledAgentView) => agent.agent?.name === 'Cadence');

  const selectedTask = tasks.find((t: WorkflowTask) => t.id === selectedTaskId);

  // Toggle stage expansion
  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  // Toggle step expansion
  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Save task automation
  const saveTaskAutomation = useMutation({
    mutationFn: async (data: { taskId: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; viewport: { x: number; y: number; zoom: number } }) => {
      return apiRequest('PATCH', `/api/tasks/${data.taskId}/automation`, {
        nodes: data.nodes,
        edges: data.edges,
        viewport: data.viewport,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', id, 'tasks'] });
      toast({
        title: 'Success',
        description: 'Task automation saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save automation',
        variant: 'destructive',
      });
    },
  });

  // Create stage mutation
  const createStageMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiRequest('POST', '/api/workflow-stages', {
        name: data.name,
        description: data.description,
        workflowId: id,
        order: stages.length + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', id, 'stages'] });
      toast({ title: 'Success', description: 'Stage created successfully' });
      setStageDialogOpen(false);
      setNewStage({ name: '', description: '' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create stage', variant: 'destructive' });
    },
  });

  // Create step mutation
  const createStepMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; stageId: string }) => {
      const stageSteps = steps.filter(s => s.stageId === data.stageId);
      return apiRequest('POST', '/api/workflow-steps', {
        name: data.name,
        description: data.description,
        stageId: data.stageId,
        order: stageSteps.length + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', id, 'steps'] });
      toast({ title: 'Success', description: 'Step created successfully' });
      setStepDialogOpen(false);
      setNewStep({ name: '', description: '' });
      setSelectedStageForStep(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create step', variant: 'destructive' });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; type: string; stepId: string }) => {
      const stepTasks = tasks.filter(t => t.stepId === data.stepId);
      return apiRequest('POST', '/api/workflow-tasks', {
        name: data.name,
        description: data.description,
        type: data.type,
        stepId: data.stepId,
        order: stepTasks.length + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', id, 'tasks'] });
      toast({ title: 'Success', description: 'Task created successfully' });
      setTaskDialogOpen(false);
      setNewTask({ name: '', description: '', type: 'manual' });
      setSelectedStepForTask(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create task', variant: 'destructive' });
    },
  });

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      if (!selectedTaskId) throw new Error('No task selected');
      return apiRequest('POST', '/api/subtasks', {
        taskId: selectedTaskId,
        name: data.name,
        order: subtasks.length + 1,
        status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTaskId, 'subtasks'] });
      toast({ title: 'Success', description: 'Subtask created successfully' });
      setSubtaskDialogOpen(false);
      setNewSubtask({ name: '' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create subtask', variant: 'destructive' });
    },
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      return apiRequest('DELETE', `/api/subtasks/${subtaskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTaskId, 'subtasks'] });
      toast({ title: 'Success', description: 'Subtask deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete subtask', variant: 'destructive' });
    },
  });

  // Create checklist mutation
  const createChecklistMutation = useMutation({
    mutationFn: async (data: { item: string }) => {
      if (!selectedTaskId) throw new Error('No task selected');
      return apiRequest('POST', '/api/checklists', {
        taskId: selectedTaskId,
        item: data.item,
        order: checklists.length + 1,
        isChecked: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTaskId, 'checklists'] });
      toast({ title: 'Success', description: 'Checklist item created successfully' });
      setChecklistDialogOpen(false);
      setNewChecklist({ item: '' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to create checklist item', variant: 'destructive' });
    },
  });

  // Delete checklist mutation
  const deleteChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      return apiRequest('DELETE', `/api/checklists/${checklistId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTaskId, 'checklists'] });
      toast({ title: 'Success', description: 'Checklist item deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete checklist item', variant: 'destructive' });
    },
  });

  // Toggle checklist mutation
  const toggleChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      return apiRequest('POST', `/api/checklists/${checklistId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', selectedTaskId, 'checklists'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to toggle checklist item', variant: 'destructive' });
    },
  });

  const handleSaveAutomation = (updatedNodes: Node[], updatedEdges: Edge[], viewport: { x: number; y: number; zoom: number }) => {
    if (!selectedTaskId) return;

    const workflowNodes: WorkflowNode[] = updatedNodes.map((node) => ({
      id: node.id,
      type: node.data.type as WorkflowNodeType, // Get type from node.data.type (set by WorkflowNode component)
      position: node.position,
      data: node.data as any,
    }));

    const workflowEdges: WorkflowEdge[] = updatedEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
      label: edge.label as string | undefined,
    }));

    saveTaskAutomation.mutate({
      taskId: selectedTaskId,
      nodes: workflowNodes,
      edges: workflowEdges,
      viewport,
    });
  };

  if (isLoading && isEditMode) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!isEditMode) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Create New Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please create a workflow from the workflows list page first, then you can build its stages, steps, and tasks here.
            </p>
            <Button onClick={() => navigate('/workflows')} data-testid="button-go-workflows">
              Go to Workflows
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/workflows')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{workflow?.name}</h1>
                {hasCadence && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-cadence-copilot">
                    <Sparkles className="h-3 w-3" />
                    Cadence AI
                  </Badge>
                )}
                <Badge variant="outline" data-testid="badge-workflow-category">
                  {workflow?.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Build stages, steps, and configure task automation
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => toast({ title: 'Coming soon', description: 'Workflow-level settings' })}
              data-testid="button-workflow-settings"
            >
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Hierarchical Tree */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          <div className="p-4 border-b bg-background">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Workflow Structure</h2>
              <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="button-add-stage"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Stage
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-stage">
                  <DialogHeader>
                    <DialogTitle>Create New Stage</DialogTitle>
                    <DialogDescription>
                      Add a new stage to your workflow
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="stage-name">Name</Label>
                      <Input
                        id="stage-name"
                        placeholder="e.g., Client Onboarding"
                        value={newStage.name}
                        onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                        data-testid="input-stage-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stage-description">Description (Optional)</Label>
                      <Textarea
                        id="stage-description"
                        placeholder="Brief description"
                        value={newStage.description}
                        onChange={(e) => setNewStage({ ...newStage, description: e.target.value })}
                        data-testid="textarea-stage-description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setStageDialogOpen(false)}
                      data-testid="button-cancel-stage"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createStageMutation.mutate(newStage)}
                      disabled={!newStage.name.trim() || createStageMutation.isPending}
                      data-testid="button-submit-stage"
                    >
                      {createStageMutation.isPending ? 'Creating...' : 'Create Stage'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-xs text-muted-foreground">
              Select a task to configure its automation
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {stages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No stages yet</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setStageDialogOpen(true)}
                    data-testid="button-add-first-stage"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Stage
                  </Button>
                </div>
              )}

              {stages.map((stage: WorkflowStage) => {
                const stageSteps = steps.filter((s: WorkflowStep) => s.stageId === stage.id);
                const isExpanded = expandedStages.has(stage.id);

                return (
                  <div key={stage.id} className="space-y-1">
                    {/* Stage */}
                    <button
                      onClick={() => toggleStage(stage.id)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-md text-left hover-elevate active-elevate-2",
                        "bg-background"
                      )}
                      data-testid={`button-stage-${stage.id}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {getStatusIcon(stage.status)}
                      <span className="flex-1 font-medium text-sm">{stage.name}</span>
                      <Badge variant="secondary" className="text-xs">{stageSteps.length} steps</Badge>
                    </button>

                    {/* Steps under this stage */}
                    {isExpanded && (
                      <div className="ml-6 space-y-1">
                        {stageSteps.map((step: WorkflowStep) => {
                          const stepTasks = tasks.filter((t: WorkflowTask) => t.stepId === step.id);
                          const isStepExpanded = expandedSteps.has(step.id);

                          return (
                            <div key={step.id} className="space-y-1">
                              {/* Step */}
                              <button
                                onClick={() => toggleStep(step.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 p-2 rounded-md text-left hover-elevate active-elevate-2",
                                  "bg-background"
                                )}
                                data-testid={`button-step-${step.id}`}
                              >
                                {isStepExpanded ? (
                                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                )}
                                {getStatusIcon(step.status)}
                                <span className="flex-1 text-sm">{step.name}</span>
                                <Badge variant="outline" className="text-xs">{stepTasks.length} tasks</Badge>
                              </button>

                              {/* Tasks under this step */}
                              {isStepExpanded && (
                                <div className="ml-6 space-y-1">
                                  {stepTasks.map((task: WorkflowTask) => (
                                    <button
                                      key={task.id}
                                      onClick={() => setSelectedTaskId(task.id)}
                                      className={cn(
                                        "w-full flex items-center gap-2 p-2 rounded-md text-left hover-elevate active-elevate-2",
                                        selectedTaskId === task.id ? "bg-primary/10 border border-primary/20" : "bg-background"
                                      )}
                                      data-testid={`button-task-${task.id}`}
                                    >
                                      {getStatusIcon(task.status)}
                                      <span className="flex-1 text-sm">{task.name}</span>
                                      {task.type === 'automated' && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Sparkles className="h-2 w-2 mr-1" />
                                          AI
                                        </Badge>
                                      )}
                                    </button>
                                  ))}
                                  
                                  {/* Add Task Button - Always visible */}
                                  <div className="pt-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="w-full"
                                      onClick={() => {
                                        setSelectedStepForTask(step.id);
                                        setTaskDialogOpen(true);
                                      }}
                                      data-testid={`button-add-task-${step.id}`}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Task
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        
                        {/* Add Step Button - Always visible */}
                        <div className="pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full"
                            onClick={() => {
                              setSelectedStageForStep(stage.id);
                              setStepDialogOpen(true);
                            }}
                            data-testid={`button-add-step-${stage.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Step
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel: Task Details + Automation Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTask ? (
            <>
              {/* Task Metadata Header */}
              <div className="border-b p-4 bg-background">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      {selectedTask.name}
                      {selectedTask.type === 'automated' && (
                        <Badge variant="secondary">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Automated
                        </Badge>
                      )}
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedTask.description || 'No description'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{selectedTask.status}</Badge>
                    <Badge variant="outline">{selectedTask.priority}</Badge>
                  </div>
                </div>
              </div>

              {/* Scrollable Subtasks and Checklists Section */}
              <ScrollArea className="flex-1 overflow-y-auto">
              {/* Subtasks Section */}
              <div className="border-b p-4 bg-background">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowSubtasks(!showSubtasks)}
                    className="flex items-center gap-2 hover-elevate active-elevate-2 p-1 rounded"
                  >
                    {showSubtasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <h3 className="font-medium">Subtasks ({subtasks.length})</h3>
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSubtaskDialogOpen(true)}
                    data-testid="button-add-subtask"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Subtask
                  </Button>
                </div>
                {showSubtasks && (
                  <div className="space-y-1 mt-2">
                    {subtasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No subtasks yet</p>
                    )}
                    {subtasks.map((subtask: TaskSubtask) => (
                      <div
                        key={subtask.id}
                        className="flex items-center gap-2 p-2 rounded hover-elevate active-elevate-2"
                        data-testid={`subtask-${subtask.id}`}
                      >
                        {getStatusIcon(subtask.status)}
                        <span className="flex-1 text-sm">{subtask.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                          data-testid={`button-delete-subtask-${subtask.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklists Section */}
              <div className="border-b p-4 bg-background">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowChecklists(!showChecklists)}
                    className="flex items-center gap-2 hover-elevate active-elevate-2 p-1 rounded"
                  >
                    {showChecklists ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <h3 className="font-medium">Checklist ({checklists.length})</h3>
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChecklistDialogOpen(true)}
                    data-testid="button-add-checklist"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Item
                  </Button>
                </div>
                {showChecklists && (
                  <div className="space-y-1 mt-2">
                    {checklists.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">No checklist items yet</p>
                    )}
                    {checklists.map((item: TaskChecklist) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded hover-elevate active-elevate-2"
                        data-testid={`checklist-${item.id}`}
                      >
                        <input
                          type="checkbox"
                          checked={item.isChecked}
                          onChange={() => toggleChecklistMutation.mutate(item.id)}
                          className="h-4 w-4"
                          data-testid={`checkbox-${item.id}`}
                        />
                        <span className={cn("flex-1 text-sm", item.isChecked && "line-through text-muted-foreground")}>
                          {item.item}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteChecklistMutation.mutate(item.id)}
                          data-testid={`button-delete-checklist-${item.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </ScrollArea>

              {/* Automation Canvas - Key forces remount on task switch for proper state isolation */}
              <div className="flex-1 overflow-hidden">
                <WorkflowCanvas
                  key={selectedTask.id}
                  initialNodes={selectedTask.nodes as WorkflowNode[] || []}
                  initialEdges={selectedTask.edges as WorkflowEdge[] || []}
                  initialViewport={selectedTask.viewport as { x: number; y: number; zoom: number } || { x: 0, y: 0, zoom: 1 }}
                  onNodesChange={() => {}}
                  onEdgesChange={() => {}}
                  onSave={handleSaveAutomation}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md p-8">
                <div className="mb-4 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-2" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Select a Task</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a task from the left panel to configure its automation workflow using the visual canvas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step Creation Dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent data-testid="dialog-create-step">
          <DialogHeader>
            <DialogTitle>Create New Step</DialogTitle>
            <DialogDescription>
              Add a new step to this stage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="step-name">Name</Label>
              <Input
                id="step-name"
                placeholder="e.g., Collect Documents"
                value={newStep.name}
                onChange={(e) => setNewStep({ ...newStep, name: e.target.value })}
                data-testid="input-step-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-description">Description (Optional)</Label>
              <Textarea
                id="step-description"
                placeholder="Brief description"
                value={newStep.description}
                onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                data-testid="textarea-step-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStepDialogOpen(false);
                setSelectedStageForStep(null);
              }}
              data-testid="button-cancel-step"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedStageForStep) {
                  createStepMutation.mutate({ ...newStep, stageId: selectedStageForStep });
                }
              }}
              disabled={!newStep.name.trim() || !selectedStageForStep || createStepMutation.isPending}
              data-testid="button-submit-step"
            >
              {createStepMutation.isPending ? 'Creating...' : 'Create Step'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Creation Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent data-testid="dialog-create-task">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to this step
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Name</Label>
              <Input
                id="task-name"
                placeholder="e.g., Review Tax Documents"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                data-testid="input-task-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (Optional)</Label>
              <Textarea
                id="task-description"
                placeholder="Brief description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                data-testid="textarea-task-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-type">Task Type</Label>
              <Select
                value={newTask.type}
                onValueChange={(value) => setNewTask({ ...newTask, type: value })}
              >
                <SelectTrigger id="task-type" data-testid="select-task-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automated">Automated (AI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTaskDialogOpen(false);
                setSelectedStepForTask(null);
              }}
              data-testid="button-cancel-task"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedStepForTask) {
                  createTaskMutation.mutate({ ...newTask, stepId: selectedStepForTask });
                }
              }}
              disabled={!newTask.name.trim() || !selectedStepForTask || createTaskMutation.isPending}
              data-testid="button-submit-task"
            >
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subtask Creation Dialog */}
      <Dialog open={subtaskDialogOpen} onOpenChange={setSubtaskDialogOpen}>
        <DialogContent data-testid="dialog-create-subtask">
          <DialogHeader>
            <DialogTitle>Create New Subtask</DialogTitle>
            <DialogDescription>
              Add a subtask to {selectedTask?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subtask-name">Subtask Name</Label>
              <Input
                id="subtask-name"
                placeholder="e.g., Verify client signature"
                value={newSubtask.name}
                onChange={(e) => setNewSubtask({ name: e.target.value })}
                data-testid="input-subtask-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubtaskDialogOpen(false);
                setNewSubtask({ name: '' });
              }}
              data-testid="button-cancel-subtask"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createSubtaskMutation.mutate(newSubtask)}
              disabled={!newSubtask.name.trim() || createSubtaskMutation.isPending}
              data-testid="button-submit-subtask"
            >
              {createSubtaskMutation.isPending ? 'Creating...' : 'Create Subtask'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Creation Dialog */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent data-testid="dialog-create-checklist">
          <DialogHeader>
            <DialogTitle>Create Checklist Item</DialogTitle>
            <DialogDescription>
              Add a checklist item to {selectedTask?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="checklist-item">Checklist Item</Label>
              <Input
                id="checklist-item"
                placeholder="e.g., Upload ID proof"
                value={newChecklist.item}
                onChange={(e) => setNewChecklist({ item: e.target.value })}
                data-testid="input-checklist-item"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChecklistDialogOpen(false);
                setNewChecklist({ item: '' });
              }}
              data-testid="button-cancel-checklist"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createChecklistMutation.mutate(newChecklist)}
              disabled={!newChecklist.item.trim() || createChecklistMutation.isPending}
              data-testid="button-submit-checklist"
            >
              {createChecklistMutation.isPending ? 'Creating...' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
