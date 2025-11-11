import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronDown, Award, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";

interface StageWithMetrics {
  id: string;
  workflowId: string;
  name: string;
  description: string | null;
  order: number;
  status: string;
  autoProgress: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed metrics
  startDate: Date | null;
  dueDate: Date | null;
  percentComplete: number;
  isMilestone: boolean;
  isOverdue: boolean;
  totalSteps: number;
  completedSteps: number;
  totalTasks: number;
  completedTasks: number;
  
  // Optional nested steps
  steps?: StepWithMetrics[];
}

interface StepWithMetrics {
  id: string;
  stageId: string;
  name: string;
  description: string | null;
  order: number;
  status: string;
  completedAt: Date | null;
  
  // Computed
  startDate: Date | null;
  dueDate: Date | null;
  percentComplete: number;
  totalTasks: number;
  completedTasks: number;
}

export default function TimelineView() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  // Fetch workflows
  const { data: workflows = [] } = useQuery({
    queryKey: ['/api/workflows'],
  });

  // Fetch stages for selected workflow (with steps)
  const { data: stages = [], isLoading: stagesLoading } = useQuery<StageWithMetrics[]>({
    queryKey: ['/api/workflows', selectedWorkflow, 'stages'],
    enabled: !!selectedWorkflow,
    select: (data) => {
      // Transform dates from strings to Date objects
      return data.map(stage => ({
        ...stage,
        completedAt: stage.completedAt ? new Date(stage.completedAt) : null,
        createdAt: new Date(stage.createdAt),
        updatedAt: new Date(stage.updatedAt),
        startDate: stage.startDate ? new Date(stage.startDate) : null,
        dueDate: stage.dueDate ? new Date(stage.dueDate) : null,
        steps: stage.steps?.map(step => ({
          ...step,
          completedAt: step.completedAt ? new Date(step.completedAt) : null,
          startDate: step.startDate ? new Date(step.startDate) : null,
          dueDate: step.dueDate ? new Date(step.dueDate) : null,
        })),
      }));
    },
  });

  // Filter stages by status
  const filteredStages = useMemo(() => {
    if (statusFilter === 'all') return stages;
    return stages.filter(stage => stage.status === statusFilter);
  }, [stages, statusFilter]);

  // Auto-select first workflow if none selected
  useEffect(() => {
    if (!selectedWorkflow && workflows.length > 0) {
      setSelectedWorkflow(workflows[0].id);
    }
  }, [selectedWorkflow, workflows]);

  // Toggle stage expansion
  const toggleStageExpansion = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  // Get status color/icon
  const getStatusDisplay = (status: string, isOverdue: boolean) => {
    if (status === 'completed') {
      return { icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
    }
    if (isOverdue) {
      return { icon: <AlertCircle className="w-4 h-4" />, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
    }
    if (status === 'in_progress') {
      return { icon: <Circle className="w-4 h-4" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
    }
    return { icon: <Circle className="w-4 h-4" />, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timeline View</h1>
          <p className="text-muted-foreground mt-1">
            High-level workflow roadmap and milestone tracking
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-xs">
          <Select value={selectedWorkflow || undefined} onValueChange={setSelectedWorkflow}>
            <SelectTrigger data-testid="select-workflow">
              <SelectValue placeholder="Select workflow" />
            </SelectTrigger>
            <SelectContent>
              {workflows.map((workflow: any) => (
                <SelectItem key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 max-w-xs">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedWorkflow && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-total-stages">
              {filteredStages.length} Stage{filteredStages.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}
      </div>

      {/* Timeline Content */}
      <ScrollArea className="flex-1 rounded-lg border">
        <div className="p-6 space-y-6">
          {!selectedWorkflow ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Select a workflow to view its timeline</p>
            </div>
          ) : stagesLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading stages...</p>
            </div>
          ) : filteredStages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No stages found for this workflow</p>
            </div>
          ) : (
            filteredStages.map((stage, index) => {
              const statusDisplay = getStatusDisplay(stage.status, stage.isOverdue);
              const isExpanded = expandedStages.has(stage.id);
              const hasSteps = stage.steps && stage.steps.length > 0;

              return (
                <div key={stage.id} className="relative">
                  {/* Timeline connector line */}
                  {index < filteredStages.length - 1 && (
                    <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-border -z-10" />
                  )}

                  {/* Stage Card */}
                  <Card className="relative" data-testid={`card-stage-${stage.id}`}>
                    <CardHeader className="space-y-4">
                      {/* Stage Header */}
                      <div className="flex items-start gap-4">
                        {/* Timeline Marker */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${statusDisplay.color}`}>
                          {stage.isMilestone ? (
                            <Award className="w-6 h-6" data-testid={`icon-milestone-${stage.id}`} />
                          ) : (
                            statusDisplay.icon
                          )}
                        </div>

                        {/* Stage Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-xl" data-testid={`text-stage-name-${stage.id}`}>
                                  {stage.name}
                                </CardTitle>
                                {stage.isMilestone && (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                    Milestone
                                  </Badge>
                                )}
                                {stage.isOverdue && (
                                  <Badge variant="destructive">Overdue</Badge>
                                )}
                              </div>
                              {stage.description && (
                                <CardDescription className="mt-1">{stage.description}</CardDescription>
                              )}
                            </div>

                            {/* Expand/Collapse Button */}
                            {hasSteps && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleStageExpansion(stage.id)}
                                data-testid={`button-toggle-stage-${stage.id}`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Stage Metrics */}
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Progress</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={stage.percentComplete} className="flex-1 h-2" />
                                <span className="font-medium" data-testid={`text-progress-${stage.id}`}>
                                  {stage.percentComplete}%
                                </span>
                              </div>
                            </div>

                            {stage.startDate && (
                              <div>
                                <p className="text-muted-foreground">Start Date</p>
                                <p className="font-medium mt-1" data-testid={`text-start-date-${stage.id}`}>
                                  {format(stage.startDate, 'MMM d, yyyy')}
                                </p>
                              </div>
                            )}

                            {stage.dueDate && (
                              <div>
                                <p className="text-muted-foreground">Due Date</p>
                                <p className="font-medium mt-1" data-testid={`text-due-date-${stage.id}`}>
                                  {format(stage.dueDate, 'MMM d, yyyy')}
                                </p>
                              </div>
                            )}

                            <div>
                              <p className="text-muted-foreground">Tasks</p>
                              <p className="font-medium mt-1" data-testid={`text-tasks-${stage.id}`}>
                                {stage.completedTasks}/{stage.totalTasks}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Steps */}
                      {isExpanded && hasSteps && (
                        <div className="ml-16 mt-4 space-y-3 border-l-2 border-border pl-4">
                          {stage.steps!.map((step) => (
                            <div
                              key={step.id}
                              className="p-3 rounded-lg bg-muted/50"
                              data-testid={`card-step-${step.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium" data-testid={`text-step-name-${step.id}`}>
                                    {step.name}
                                  </p>
                                  {step.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {step.description}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant={step.status === 'completed' ? 'default' : 'secondary'}
                                  data-testid={`badge-step-status-${step.id}`}
                                >
                                  {step.status}
                                </Badge>
                              </div>

                              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Progress value={step.percentComplete} className="w-24 h-1.5" />
                                  <span>{step.percentComplete}%</span>
                                </div>
                                <span>{step.completedTasks}/{step.totalTasks} tasks</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
