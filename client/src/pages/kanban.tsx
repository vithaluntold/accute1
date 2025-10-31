import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Calendar, User, Building2, LayoutGrid } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

type Assignment = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  currentStageId: string | null;
  currentStepId: string | null;
  client?: {
    id: string;
    companyName: string;
    name: string;
  };
  workflow?: {
    id: string;
    name: string;
    stages?: Stage[];
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
};

type Stage = {
  id: string;
  name: string;
  description: string | null;
  order: number;
};

type WorkflowWithStages = {
  id: string;
  name: string;
  stages: Stage[];
};

function SortableAssignmentCard({ assignment }: { assignment: Assignment }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assignment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="mb-3 cursor-move hover-elevate"
        data-testid={`kanban-card-${assignment.id}`}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium line-clamp-2" data-testid={`kanban-card-title-${assignment.id}`}>
              {assignment.name}
            </CardTitle>
            <Badge variant={getPriorityColor(assignment.priority)} className="text-xs shrink-0">
              {assignment.priority}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {assignment.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {assignment.description}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {assignment.client && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{assignment.client.companyName || assignment.client.name}</span>
              </div>
            )}
            {assignment.dueDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{format(new Date(assignment.dueDate), "MMM d, yyyy")}</span>
              </div>
            )}
            {assignment.assignedTo && (
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">
                    {assignment.assignedTo.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">
                  {assignment.assignedTo.name}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Kanban() {
  const { toast } = useToast();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: workflows = [] } = useQuery<WorkflowWithStages[]>({
    queryKey: ["/api/workflows"],
  });

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const updateAssignmentStageMutation = useMutation({
    mutationFn: async ({ assignmentId, stageId }: { assignmentId: string; stageId: string | null }) => {
      return await apiRequest("PATCH", `/api/assignments/${assignmentId}`, { currentStageId: stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast({
        title: "Success",
        description: "Assignment moved to new stage",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to move assignment",
        variant: "destructive",
      });
    },
  });

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);

  const filteredAssignments = selectedWorkflowId
    ? assignments.filter((a) => a.workflow?.id === selectedWorkflowId)
    : [];

  const getAssignmentsForStage = (stageId: string) => {
    return filteredAssignments.filter((a) => a.currentStageId === stageId);
  };

  const unassignedAssignments = filteredAssignments.filter((a) => !a.currentStageId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const assignmentId = active.id as string;
    
    let targetStageId: string | null = null;
    let shouldUpdate = false;
    
    if (over.id.toString().startsWith("stage-")) {
      const stageIdStr = over.id.toString().replace("stage-", "");
      if (stageIdStr === "unassigned") {
        targetStageId = null;
        shouldUpdate = true;
      } else {
        targetStageId = stageIdStr;
        shouldUpdate = true;
      }
    } else {
      const targetAssignment = assignments.find((a) => a.id === over.id);
      if (targetAssignment) {
        targetStageId = targetAssignment.currentStageId;
        shouldUpdate = true;
      } else if (over.data?.current?.sortable?.containerId) {
        const containerId = over.data.current.sortable.containerId as string;
        if (containerId.startsWith("stage-")) {
          const stageIdStr = containerId.replace("stage-", "");
          if (stageIdStr === "unassigned") {
            targetStageId = null;
            shouldUpdate = true;
          } else {
            targetStageId = stageIdStr;
            shouldUpdate = true;
          }
        }
      }
    }

    if (shouldUpdate) {
      updateAssignmentStageMutation.mutate({ assignmentId, stageId: targetStageId || null });
    }

    setActiveId(null);
  };

  const activeAssignment = activeId ? assignments.find((a) => a.id === activeId) : null;

  if (!workflows.length) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
          <h2 className="text-xl font-medium">No workflows available</h2>
          <p className="text-muted-foreground">Create a workflow first to use the kanban board</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={LayoutGrid}
        title="Kanban Board"
        description="Drag assignments between stages to track progress"
        testId="hero-kanban"
        actions={
          <div className="w-72">
            <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
              <SelectTrigger data-testid="select-workflow-kanban" className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                <SelectValue placeholder="Select a workflow" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      
      <div className="container mx-auto p-6 max-w-full">

      {!selectedWorkflowId ? (
        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
          <h2 className="text-xl font-medium">Select a workflow to view the board</h2>
          <p className="text-muted-foreground">Choose a workflow from the dropdown above</p>
        </div>
      ) : !selectedWorkflow?.stages?.length ? (
        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
          <h2 className="text-xl font-medium">No stages in this workflow</h2>
          <p className="text-muted-foreground">Add stages to the workflow to use the kanban board</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            <div className="flex-shrink-0 w-80">
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Unassigned</CardTitle>
                    <Badge variant="secondary">{unassignedAssignments.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  <SortableContext
                    id="stage-unassigned"
                    items={unassignedAssignments.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div data-stage-id="unassigned" className="min-h-[100px]">
                      {unassignedAssignments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          Drop assignments here to unassign them
                        </p>
                      ) : (
                        unassignedAssignments.map((assignment) => (
                          <SortableAssignmentCard key={assignment.id} assignment={assignment} />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            </div>

            {selectedWorkflow.stages
              .sort((a, b) => a.order - b.order)
              .map((stage) => {
                const stageAssignments = getAssignmentsForStage(stage.id);
                return (
                  <div
                    key={stage.id}
                    id={`stage-${stage.id}`}
                    className="flex-shrink-0 w-80"
                    data-testid={`kanban-column-${stage.id}`}
                  >
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{stage.name}</CardTitle>
                            {stage.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {stage.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {stageAssignments.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="max-h-[calc(100vh-300px)] overflow-y-auto">
                        <SortableContext
                          id={`stage-${stage.id}`}
                          items={stageAssignments.map((a) => a.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div data-stage-id={stage.id} className="min-h-[100px]">
                            {stageAssignments.map((assignment) => (
                              <SortableAssignmentCard key={assignment.id} assignment={assignment} />
                            ))}
                          </div>
                        </SortableContext>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
          </div>

          <DragOverlay>
            {activeAssignment ? (
              <Card className="w-80 cursor-move opacity-90">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-medium">{activeAssignment.name}</CardTitle>
                </CardHeader>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      </div>
    </div>
  );
}
