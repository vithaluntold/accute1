import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from "lucide-react";
import { format, addDays, startOfDay, endOfDay, differenceInDays, startOfMonth, endOfMonth, addMonths } from "date-fns";

interface Task {
  id: string;
  name: string;
  startDate: Date | null;
  dueDate: Date | null;
  estimatedHours: number | null;
  actualHours: number | null;
  status: string;
  assignedTo: string | null;
  workflowId: string;
}

interface Dependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  lag: number;
}

interface CriticalPathData {
  criticalPath: string[];
  criticalPathDuration: number;
  taskDetails: Record<string, any>;
}

export default function GanttView() {
  const { toast } = useToast();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [timelineStart, setTimelineStart] = useState(startOfMonth(new Date()));
  const [timelineEnd, setTimelineEnd] = useState(endOfMonth(addMonths(new Date(), 2)));
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [criticalPathData, setCriticalPathData] = useState<CriticalPathData | null>(null);
  const previousDataVersion = useRef<string>('');

  // Fetch workflows
  const { data: workflows = [] } = useQuery({
    queryKey: ['/api/workflows'],
  });

  // Fetch tasks for selected workflow
  const { data: tasks = [], isLoading: tasksLoading, dataUpdatedAt: tasksUpdatedAt } = useQuery({
    queryKey: ['/api/workflows', selectedWorkflow, 'tasks'],
    enabled: !!selectedWorkflow,
  });

  // Fetch dependencies for selected workflow
  const { data: dependencies = [], dataUpdatedAt: depsUpdatedAt } = useQuery<Dependency[]>({
    queryKey: ['/api/workflows', selectedWorkflow, 'dependencies'],
    enabled: !!selectedWorkflow,
  });

  // Calculate critical path
  const calculateCriticalPathMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const taskIds = tasks.map((t: Task) => t.id);
      return await apiRequest(`/api/workflows/${workflowId}/critical-path`, {
        method: 'POST',
        body: JSON.stringify({ taskIds }),
      });
    },
    onSuccess: (data) => {
      setCriticalPathData(data);
      setShowCriticalPath(true);
      toast({
        title: "Critical Path Calculated",
        description: `Duration: ${data.criticalPathDuration.toFixed(1)} hours`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Calculate Critical Path",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Reset critical path state when workflow changes
  useEffect(() => {
    setShowCriticalPath(false);
    setCriticalPathData(null);
    previousDataVersion.current = '';
  }, [selectedWorkflow]);

  // Reset critical path if task/dependency data changes (using React Query timestamps)
  useEffect(() => {
    const currentVersion = `${tasksUpdatedAt}-${depsUpdatedAt}`;
    
    if (showCriticalPath && previousDataVersion.current && currentVersion !== previousDataVersion.current) {
      // Data changed - clear critical path (requires recalculation)
      setShowCriticalPath(false);
      setCriticalPathData(null);
    }
    
    previousDataVersion.current = currentVersion;
  }, [tasksUpdatedAt, depsUpdatedAt, showCriticalPath]);

  // Process tasks to ensure dates
  const processedTasks = useMemo(() => {
    return tasks.map((task: any) => ({
      ...task,
      startDate: task.startDate ? new Date(task.startDate) : null,
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
    })).filter((task: Task) => task.startDate && task.dueDate);
  }, [tasks]);

  // Calculate timeline bounds from tasks
  useEffect(() => {
    if (processedTasks.length > 0) {
      const dates = processedTasks.flatMap((t: Task) => [t.startDate!, t.dueDate!]);
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      setTimelineStart(startOfDay(addDays(minDate, -7)));
      setTimelineEnd(endOfDay(addDays(maxDate, 7)));
    }
  }, [processedTasks]);

  // Generate timeline columns based on zoom level
  const timelineColumns = useMemo(() => {
    const columns: Date[] = [];
    let current = new Date(timelineStart);
    const end = new Date(timelineEnd);

    while (current <= end) {
      columns.push(new Date(current));
      if (zoom === 'day') {
        current = addDays(current, 1);
      } else if (zoom === 'week') {
        current = addDays(current, 7);
      } else {
        current = addMonths(current, 1);
      }
    }

    return columns;
  }, [timelineStart, timelineEnd, zoom]);

  // Calculate task position and width
  const getTaskPosition = (task: Task) => {
    if (!task.startDate || !task.dueDate) return null;

    const totalDays = differenceInDays(timelineEnd, timelineStart);
    const startDays = differenceInDays(task.startDate, timelineStart);
    const duration = differenceInDays(task.dueDate, task.startDate) + 1;

    const left = (startDays / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return { left: `${left}%`, width: `${Math.max(width, 1)}%` };
  };

  // Check if task is on critical path
  const isOnCriticalPath = (taskId: string) => {
    return showCriticalPath && criticalPathData?.criticalPath.includes(taskId);
  };

  const handleZoomIn = () => {
    if (zoom === 'month') setZoom('week');
    else if (zoom === 'week') setZoom('day');
  };

  const handleZoomOut = () => {
    if (zoom === 'day') setZoom('week');
    else if (zoom === 'week') setZoom('month');
  };

  const handlePanLeft = () => {
    const diff = differenceInDays(timelineEnd, timelineStart);
    setTimelineStart(addDays(timelineStart, -Math.floor(diff / 2)));
    setTimelineEnd(addDays(timelineEnd, -Math.floor(diff / 2)));
  };

  const handlePanRight = () => {
    const diff = differenceInDays(timelineEnd, timelineStart);
    setTimelineStart(addDays(timelineStart, Math.floor(diff / 2)));
    setTimelineEnd(addDays(timelineEnd, Math.floor(diff / 2)));
  };

  return (
    <div className="h-screen flex flex-col" data-testid="page-gantt-view">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-page-title">Gantt Chart</h1>
              <p className="text-sm text-muted-foreground">
                Visual timeline with task dependencies and critical path
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedWorkflow || ""} onValueChange={setSelectedWorkflow}>
              <SelectTrigger className="w-64" data-testid="select-workflow">
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedWorkflow && calculateCriticalPathMutation.mutate(selectedWorkflow)}
              disabled={!selectedWorkflow || processedTasks.length === 0}
              data-testid="button-calculate-critical-path"
            >
              Critical Path
            </Button>

            <Button variant="outline" size="icon" data-testid="button-download">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Timeline Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handlePanLeft} data-testid="button-pan-left">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-64 text-center" data-testid="text-timeline-range">
              {format(timelineStart, 'MMM d, yyyy')} - {format(timelineEnd, 'MMM d, yyyy')}
            </span>
            <Button variant="ghost" size="icon" onClick={handlePanRight} data-testid="button-pan-right">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={showCriticalPath ? "default" : "outline"} data-testid="badge-critical-path-status">
              {showCriticalPath ? `Critical Path: ${criticalPathData?.criticalPathDuration.toFixed(1)}h` : 'No Critical Path'}
            </Badge>
            
            <div className="flex items-center gap-1 border rounded-md">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom === 'month'} data-testid="button-zoom-out">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium px-2 min-w-16 text-center" data-testid="text-zoom-level">{zoom}</span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom === 'day'} data-testid="button-zoom-in">
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-hidden">
        {!selectedWorkflow ? (
          <div className="flex items-center justify-center h-full">
            <Card className="w-96">
              <CardHeader>
                <CardTitle>Select a Workflow</CardTitle>
                <CardDescription>Choose a workflow to view its Gantt chart</CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : tasksLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : processedTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="w-96">
              <CardHeader>
                <CardTitle>No Tasks with Dates</CardTitle>
                <CardDescription>
                  Add start and due dates to tasks to visualize them on the Gantt chart
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Task List Column */}
            <div className="w-80 border-r bg-muted/20">
              <div className="sticky top-0 bg-background border-b p-3 font-semibold text-sm">
                Task Name
              </div>
              <ScrollArea className="h-[calc(100%-3rem)]">
                {processedTasks.map((task: Task) => (
                  <div
                    key={task.id}
                    className={`p-3 border-b hover-elevate ${isOnCriticalPath(task.id) ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                    data-testid={`task-row-${task.id}`}
                  >
                    <div className="font-medium text-sm truncate">{task.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {task.estimatedHours || 0}h
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Timeline Column */}
            <div className="flex-1 overflow-auto">
              {/* Timeline Header */}
              <div className="sticky top-0 bg-background border-b flex z-10">
                {timelineColumns.map((date, index) => (
                  <div
                    key={index}
                    className="flex-1 min-w-24 p-2 text-center text-xs font-medium border-r"
                    data-testid={`timeline-column-${index}`}
                  >
                    {zoom === 'day' && format(date, 'MMM d')}
                    {zoom === 'week' && `Week ${format(date, 'w')}`}
                    {zoom === 'month' && format(date, 'MMM yyyy')}
                  </div>
                ))}
              </div>

              {/* Task Bars */}
              <div className="relative">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex">
                  {timelineColumns.map((_, index) => (
                    <div key={index} className="flex-1 min-w-24 border-r" />
                  ))}
                </div>

                {/* Tasks */}
                {processedTasks.map((task: Task) => {
                  const position = getTaskPosition(task);
                  if (!position) return null;

                  return (
                    <div
                      key={task.id}
                      className="relative h-14 border-b"
                      data-testid={`task-timeline-${task.id}`}
                    >
                      <div
                        className={`absolute top-3 h-8 rounded-md flex items-center px-2 text-xs font-medium text-white cursor-pointer hover-elevate transition-all ${
                          isOnCriticalPath(task.id)
                            ? 'bg-primary shadow-lg'
                            : 'bg-blue-500'
                        }`}
                        style={position}
                        data-testid={`task-bar-${task.id}`}
                      >
                        <span className="truncate">{task.name}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Dependency indicators */}
                {dependencies.length > 0 && (
                  <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
                    {dependencies.length} dependencies
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
