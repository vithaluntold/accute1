import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreateEventDialog } from "@/components/create-event-dialog";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: "task" | "project" | "meeting" | "deadline" | "workflow-task" | "assignment" | "pto" | "block_time" | "reminder" | "event";
  originalType?: string; // For events from events table, stores the actual type
  status?: string;
  assignedTo?: string;
  project?: string;
  color?: string;
}

export default function CalendarView() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<string>("all");
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<any>(undefined);

  // Fetch calendar events from new API
  const { data: calendarEvents, isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ["/api/events"],
  });

  // Fetch workflow tasks
  const { data: workflowTasks, isLoading: workflowLoading } = useQuery<any[]>({
    queryKey: ["/api/workflow-tasks"],
  });

  // Fetch project tasks
  const { data: projectTasks, isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
  });

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["/api/assignments"],
  });

  // Update dates on drag-drop - route to correct endpoint based on type
  const updateDatesMutation = useMutation({
    mutationFn: async ({ id, start, end, type }: { id: string; start: Date; end: Date; type: string }) => {
      // Convert dates to ISO strings for proper serialization
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      if (type === 'workflow-task') {
        // Workflow tasks have their own endpoint - only dueDate field
        await apiRequest(`/api/workflow-tasks/${id}`, {
          method: 'PATCH',
          body: { dueDate: endISO },
        });
      } else if (type === 'task') {
        // Project tasks - use startDate and dueDate fields
        await apiRequest(`/api/tasks/${id}`, {
          method: 'PATCH',
          body: { startDate: startISO, dueDate: endISO },
        });
      } else if (type === 'deadline') {
        // Deadlines are project entities - only update deadline field
        await apiRequest(`/api/projects/${id}`, {
          method: 'PATCH',
          body: { deadline: endISO },
        });
      } else if (type === 'project') {
        // Projects use startDate and dueDate (not deadline) when rescheduling
        await apiRequest(`/api/projects/${id}`, {
          method: 'PATCH',
          body: { startDate: startISO, dueDate: endISO },
        });
      } else if (type === 'assignment') {
        // Workflow assignments - use startDate and dueDate fields
        await apiRequest(`/api/assignments/${id}`, {
          method: 'PATCH',
          body: { startDate: startISO, dueDate: endISO },
        });
      } else if (type === 'event') {
        // Calendar events from events table
        await apiRequest(`/api/events/${id}`, {
          method: 'PATCH',
          body: { startTime: startISO, endTime: endISO },
        });
      }
    },
    onSuccess: (_data, variables) => {
      // Invalidate only the relevant query based on type
      if (variables.type === 'workflow-task') {
        queryClient.invalidateQueries({ queryKey: ["/api/workflow-tasks"] });
      } else if (variables.type === 'task') {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      } else if (variables.type === 'project' || variables.type === 'deadline') {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      } else if (variables.type === 'assignment') {
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      } else if (variables.type === 'event') {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      }
      toast({ title: "Date updated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update date",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  // Transform data into calendar events
  const events: CalendarEvent[] = [
    // NEW: Calendar events from events table - mark them for correct routing
    ...(calendarEvents?.map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      type: 'event' as const, // Use 'event' type for all events from events table
      originalType: event.type, // Store original type for display/filtering
      color: event.color,
    })) || []),
    
    // Workflow tasks - preserve "workflow-task" type for correct routing
    ...(workflowTasks?.filter(t => t.dueDate).map(task => ({
      id: task.id,
      title: task.name,
      start: new Date(task.dueDate),
      end: new Date(task.dueDate),
      type: "workflow-task" as const,
      status: task.status,
      assignedTo: task.assignedTo,
    })) || []),
    
    // Project tasks
    ...(projectTasks?.filter(t => t.startDate || t.dueDate).map(task => ({
      id: task.id,
      title: task.title,
      start: task.startDate ? new Date(task.startDate) : new Date(task.dueDate!),
      end: task.dueDate ? new Date(task.dueDate) : new Date(task.startDate!),
      type: "task" as const,
      status: task.status,
      project: task.projectId,
    })) || []),

    // Projects (deadlines)
    ...(projects?.filter(p => p.deadline).map(project => ({
      id: project.id,
      title: `${project.name} - Deadline`,
      start: new Date(project.deadline!),
      end: new Date(project.deadline!),
      type: "deadline" as const,
      status: project.status,
    })) || []),

    // Assignments - preserve "assignment" type for correct routing
    ...(assignments?.filter(a => a.dueDate).map(assignment => ({
      id: assignment.id,
      title: assignment.workflowName || 'Assignment',
      start: assignment.startDate ? new Date(assignment.startDate) : new Date(assignment.dueDate),
      end: new Date(assignment.dueDate),
      type: "assignment" as const,
      status: assignment.status,
      assignedTo: assignment.assignedToName,
    })) || []),
  ];

  const isLoading = eventsLoading || workflowLoading || tasksLoading || projectsLoading || assignmentsLoading;

  // Filter events - check originalType for events from events table
  const filteredEvents = filterType === "all" 
    ? events 
    : events.filter(e => {
        const typeToCheck = e.originalType || e.type;
        return typeToCheck === filterType;
      });

  // Event styling
  const eventStyleGetter = (event: CalendarEvent) => {
    // Use custom color if provided
    if (event.color) {
      return {
        style: {
          backgroundColor: event.color,
          borderRadius: "4px",
          opacity: 0.9,
          color: "white",
          border: "none",
          display: "block",
        },
      };
    }
    
    let backgroundColor = "hsl(var(--primary))";
    
    // Check originalType for events from events table
    const typeToCheck = event.originalType || event.type;
    
    switch (typeToCheck) {
      case "meeting":
        backgroundColor = "hsl(220 70% 55%)";
        break;
      case "task":
        backgroundColor = event.status === "completed" 
          ? "hsl(var(--success))" 
          : "hsl(var(--primary))";
        break;
      case "pto":
        backgroundColor = "hsl(280 60% 60%)";
        break;
      case "block_time":
        backgroundColor = "hsl(30 80% 55%)";
        break;
      case "reminder":
        backgroundColor = "hsl(160 60% 50%)";
        break;
      case "project":
        backgroundColor = "hsl(var(--accent))";
        break;
      case "deadline":
        backgroundColor = "hsl(var(--destructive))";
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
      },
    };
  };

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  // Handle drag-drop event rescheduling
  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) => {
      updateDatesMutation.mutate({
        id: event.id,
        start,
        end,
        type: event.type, // Now correctly uses 'event' for events from events table
      });
    },
    [updateDatesMutation]
  );

  // Handle selecting a time slot to create new event
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    setSelectedDate(start);
    setSelectedEvent(undefined);
    setCreateEventDialogOpen(true);
  }, []);

  // Handle clicking an event to edit it
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    // Only allow editing calendar events from events table (type === 'event')
    if (event.type === 'event') {
      // Need to fetch full event with attendees
      fetch(`/api/events/${event.id}`, {
        credentials: 'include',
      })
        .then(res => res.json())
        .then(fullEvent => {
          setSelectedEvent(fullEvent);
          setSelectedDate(undefined);
          setCreateEventDialogOpen(true);
        })
        .catch(err => {
          console.error('Failed to fetch event:', err);
          toast({
            title: "Error",
            description: "Failed to load event details",
            variant: "destructive",
          });
        });
    }
  }, [toast]);

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Calendar View"
        description="Visualize tasks, projects, and deadlines across your organization"
        icon={CalendarIcon}
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {format(currentDate, "MMMM yyyy")}
              </CardTitle>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => {
                    setSelectedDate(new Date());
                    setSelectedEvent(undefined);
                    setCreateEventDialogOpen(true);
                  }}
                  data-testid="button-create-event"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Event
                </Button>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
                    <SelectValue placeholder="Filter events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="meeting">Meetings</SelectItem>
                    <SelectItem value="task">Tasks</SelectItem>
                    <SelectItem value="pto">Time Off</SelectItem>
                    <SelectItem value="block_time">Block Time</SelectItem>
                    <SelectItem value="deadline">Deadlines</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1 border rounded-md">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavigate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavigate(new Date())}
                    data-testid="button-today"
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavigate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                    data-testid="button-next-month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1 border rounded-md">
                  <Button
                    variant={view === "month" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewChange("month")}
                    data-testid="button-view-month"
                  >
                    Month
                  </Button>
                  <Button
                    variant={view === "week" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewChange("week")}
                    data-testid="button-view-week"
                  >
                    Week
                  </Button>
                  <Button
                    variant={view === "day" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewChange("day")}
                    data-testid="button-view-day"
                  >
                    Day
                  </Button>
                  <Button
                    variant={view === "agenda" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewChange("agenda")}
                    data-testid="button-view-agenda"
                  >
                    Agenda
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge style={{ backgroundColor: 'hsl(220 70% 55%)' }}>Meeting</Badge>
                <Badge className="bg-primary">Task</Badge>
                <Badge style={{ backgroundColor: 'hsl(280 60% 60%)' }}>PTO</Badge>
                <Badge style={{ backgroundColor: 'hsl(30 80% 55%)' }}>Block Time</Badge>
                <Badge className="bg-destructive">Deadline</Badge>
                <Badge className="bg-success">Completed</Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {filteredEvents.length} events
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden pt-6">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <div className="h-full calendar-container">
                <Calendar
                  localizer={localizer}
                  events={filteredEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: "100%" }}
                  view={view}
                  onView={handleViewChange}
                  date={currentDate}
                  onNavigate={handleNavigate}
                  eventPropGetter={eventStyleGetter}
                  views={["month", "week", "day", "agenda"]}
                  popup
                  selectable
                  draggableAccessor={() => true}
                  resizable
                  onEventDrop={handleEventDrop}
                  onEventResize={handleEventDrop}
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  data-testid="calendar-component"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateEventDialog
        open={createEventDialogOpen}
        onOpenChange={setCreateEventDialogOpen}
        defaultDate={selectedDate}
        event={selectedEvent}
      />

      <style>{`
        .calendar-container .rbc-calendar {
          font-family: inherit;
        }
        
        .calendar-container .rbc-header {
          padding: 12px 6px;
          font-weight: 600;
          border-color: hsl(var(--border));
        }
        
        .calendar-container .rbc-today {
          background-color: hsl(var(--accent) / 0.1);
        }
        
        .calendar-container .rbc-off-range-bg {
          background-color: hsl(var(--muted) / 0.3);
        }
        
        .calendar-container .rbc-event {
          padding: 2px 5px;
          font-size: 0.875rem;
        }
        
        .calendar-container .rbc-event-label {
          font-size: 0.75rem;
        }
        
        .calendar-container .rbc-toolbar button {
          color: hsl(var(--foreground));
          border-color: hsl(var(--border));
        }
        
        .calendar-container .rbc-toolbar button:hover {
          background-color: hsl(var(--accent));
        }
        
        .calendar-container .rbc-toolbar button.rbc-active {
          background-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }

        .calendar-container .rbc-month-view,
        .calendar-container .rbc-time-view,
        .calendar-container .rbc-agenda-view {
          border-color: hsl(var(--border));
        }

        .calendar-container .rbc-day-bg,
        .calendar-container .rbc-month-row {
          border-color: hsl(var(--border));
        }

        .calendar-container .rbc-time-slot {
          border-color: hsl(var(--border));
        }
      `}</style>
    </div>
  );
}
