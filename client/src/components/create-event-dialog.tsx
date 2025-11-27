import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Video, Users, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["meeting", "task", "pto", "block_time", "reminder"]),
  startTime: z.string(),
  endTime: z.string(),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
  meetingUrl: z.string().url().optional().or(z.literal("")),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  assignedTo: z.string().optional(),
  reminderMinutes: z.array(z.number()).default([15]),
  color: z.string().optional(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  event?: any;
}

export function CreateEventDialog({ open, onOpenChange, defaultDate, event }: CreateEventDialogProps) {
  const { toast } = useToast();
  const [attendeesInput, setAttendeesInput] = useState("");
  const [attendees, setAttendees] = useState<Array<{ userId?: string; email?: string; name?: string; isOptional: boolean }>>([]);

  // Fetch users for assignee dropdown
  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Fetch clients for client dropdown
  const { data: clients } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch projects for project dropdown
  const { data: projects } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: event ? {
      title: event.title,
      description: event.description || "",
      type: event.type,
      startTime: format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm"),
      allDay: event.allDay || false,
      location: event.location || "",
      meetingUrl: event.meetingUrl || "",
      clientId: event.clientId || "",
      projectId: event.projectId || "",
      assignedTo: event.assignedTo || "",
      reminderMinutes: event.reminderMinutes || [15],
      color: event.color || "",
    } : {
      title: "",
      description: "",
      type: "meeting",
      startTime: defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endTime: defaultDate ? format(new Date(defaultDate.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm") : format(new Date(Date.now() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      allDay: false,
      location: "",
      meetingUrl: "",
      clientId: "",
      projectId: "",
      assignedTo: "",
      reminderMinutes: [15],
      color: "",
    },
  });

  // Sync attendees state when event prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (event?.attendees && Array.isArray(event.attendees)) {
        setAttendees(
          event.attendees.map((a: any) => ({
            userId: a.userId || undefined,
            email: a.email || undefined,
            name: a.name || undefined,
            isOptional: a.isOptional || false,
          }))
        );
      } else {
        setAttendees([]);
      }
    }
  }, [open, event]);

  // Reset form fields when event prop changes or dialog opens
  useEffect(() => {
    if (open) {
      if (event) {
        // Editing existing event - reset form with event data
        form.reset({
          title: event.title,
          description: event.description || "",
          type: event.type,
          startTime: format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm"),
          endTime: format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm"),
          allDay: event.allDay || false,
          location: event.location || "",
          meetingUrl: event.meetingUrl || "",
          clientId: event.clientId || "",
          projectId: event.projectId || "",
          assignedTo: event.assignedTo || "",
          reminderMinutes: event.reminderMinutes || [15],
          color: event.color || "",
        });
      } else {
        // Creating new event - reset form with defaults
        const defaultStart = defaultDate || new Date();
        const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);
        
        form.reset({
          title: "",
          description: "",
          type: "meeting",
          startTime: format(defaultStart, "yyyy-MM-dd'T'HH:mm"),
          endTime: format(defaultEnd, "yyyy-MM-dd'T'HH:mm"),
          allDay: false,
          location: "",
          meetingUrl: "",
          clientId: "",
          projectId: "",
          assignedTo: "",
          reminderMinutes: [15],
          color: "",
        });
      }
    }
  }, [open, event, defaultDate, form]);

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData & { attendees?: any[] }) => {
      if (event) {
        return await apiRequest(`/api/events/${event.id}`, {
          method: "PATCH",
          body: data,
        });
      } else {
        return await apiRequest("/api/events", {
          method: "POST",
          body: data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: event ? "Event updated" : "Event created",
        description: event ? "The event has been updated successfully" : "The event has been created successfully",
      });
      onOpenChange(false);
      form.reset();
      setAttendees([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || (event ? "Failed to update event" : "Failed to create event"),
        variant: "destructive",
      });
    },
  });

  const handleAddAttendee = () => {
    if (attendeesInput.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(attendeesInput)) {
        setAttendees([...attendees, { email: attendeesInput.trim(), isOptional: false }]);
        setAttendeesInput("");
      } else {
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
      }
    }
  };

  // Get display text for attendee (prefer email, fallback to userId lookup)
  const getAttendeeDisplay = (attendee: typeof attendees[0]) => {
    if (attendee.email) return attendee.email;
    if (attendee.userId && users) {
      const user = users.find(u => u.id === attendee.userId);
      return user?.fullName || user?.email || attendee.userId;
    }
    return 'Unknown';
  };

  const handleRemoveAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const onSubmit = (data: EventFormData) => {
    const attendeeData = attendees.map(a => ({
      userId: a.userId || undefined,
      email: a.email || undefined,
      name: a.name || undefined,
      isOptional: a.isOptional,
    }));
    createEventMutation.mutate({ ...data, attendees: attendeeData });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {event ? "Edit Event" : "Create New Event"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Event title"
              {...form.register("title")}
              data-testid="input-event-title"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Event description"
              {...form.register("description")}
              data-testid="textarea-event-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Event Type *</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) => form.setValue("type", value as any)}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="pto">Time Off (PTO)</SelectItem>
                  <SelectItem value="block_time">Block Time</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                {...form.register("color")}
                data-testid="input-event-color"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="datetime-local"
                {...form.register("startTime")}
                data-testid="input-event-start"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="datetime-local"
                {...form.register("endTime")}
                data-testid="input-event-end"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="allDay"
              checked={form.watch("allDay")}
              onCheckedChange={(checked) => form.setValue("allDay", checked)}
              data-testid="switch-all-day"
            />
            <Label htmlFor="allDay">All day event</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </Label>
            <Input
              id="location"
              placeholder="Event location"
              {...form.register("location")}
              data-testid="input-event-location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meetingUrl" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Meeting URL
            </Label>
            <Input
              id="meetingUrl"
              type="url"
              placeholder="https://zoom.us/j/..."
              {...form.register("meetingUrl")}
              data-testid="input-meeting-url"
            />
            {form.formState.errors.meetingUrl && (
              <p className="text-sm text-destructive">{form.formState.errors.meetingUrl.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client</Label>
              <Select
                value={form.watch("clientId")}
                onValueChange={(value) => form.setValue("clientId", value)}
              >
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <Select
                value={form.watch("projectId")}
                onValueChange={(value) => form.setValue("projectId", value)}
              >
                <SelectTrigger data-testid="select-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assigned To</Label>
            <Select
              value={form.watch("assignedTo")}
              onValueChange={(value) => form.setValue("assignedTo", value)}
            >
              <SelectTrigger data-testid="select-assigned-to">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendees
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter email address"
                value={attendeesInput}
                onChange={(e) => setAttendeesInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAttendee();
                  }
                }}
                data-testid="input-attendee-email"
              />
              <Button
                type="button"
                onClick={handleAddAttendee}
                variant="outline"
                data-testid="button-add-attendee"
              >
                Add
              </Button>
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attendees.map((attendee, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {getAttendeeDisplay(attendee)}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(index)}
                      className="ml-1"
                      data-testid={`button-remove-attendee-${index}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEventMutation.isPending}
              data-testid="button-save-event"
            >
              {createEventMutation.isPending ? "Saving..." : event ? "Update Event" : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
