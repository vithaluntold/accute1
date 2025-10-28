import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Play, Sparkles, Plus, ChevronRight, ChevronDown, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast({ title: 'Coming soon', description: 'Add new stage' })}
                data-testid="button-add-stage"
              >
                <Plus className="h-3 w-3 mr-1" />
                Stage
              </Button>
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
                    onClick={() => toast({ title: 'Coming soon', description: 'Add your first stage' })}
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
                                </div>
                              )}
                            </div>
                          );
                        })}
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

                {/* Subtasks & Checklists */}
                {(subtasks.length > 0 || checklists.length > 0) && (
                  <div className="flex gap-4 text-sm">
                    {subtasks.length > 0 && (
                      <span className="text-muted-foreground">
                        {subtasks.filter((s: TaskSubtask) => s.status === 'completed').length}/{subtasks.length} subtasks
                      </span>
                    )}
                    {checklists.length > 0 && (
                      <span className="text-muted-foreground">
                        {checklists.filter((c: TaskChecklist) => c.isChecked).length}/{checklists.length} checklist items
                      </span>
                    )}
                  </div>
                )}
              </div>

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
    </div>
  );
}
