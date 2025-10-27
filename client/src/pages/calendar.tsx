import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

export default function CalendarPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();

  const { data: appointments } = useQuery({
    queryKey: ["/api/appointments"],
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const createAppointmentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/appointments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setDialogOpen(false);
      toast({ title: "Appointment created successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createAppointmentMutation.mutate({
      title: formData.get("title"),
      description: formData.get("description"),
      clientId: formData.get("clientId") || null,
      startTime: new Date(formData.get("startTime") as string),
      endTime: new Date(formData.get("endTime") as string),
      location: formData.get("location"),
      status: "scheduled",
    });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getAppointmentsForDay = (date: Date) => {
    return appointments?.filter((apt: any) =>
      isSameDay(new Date(apt.startTime), date)
    ) || [];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "secondary";
      case "confirmed": return "default";
      case "completed": return "default";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">Calendar</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-appointment">
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Appointment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input name="title" placeholder="Meeting title" required data-testid="input-title" />
              </div>
              <div>
                <Label>Client (Optional)</Label>
                <Select name="clientId">
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Client</SelectItem>
                    {clients?.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input name="startTime" type="datetime-local" required data-testid="input-start-time" />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input name="endTime" type="datetime-local" required data-testid="input-end-time" />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input name="location" placeholder="Office, Zoom, etc." data-testid="input-location" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea name="description" placeholder="Meeting details" data-testid="input-description" />
              </div>
              <Button type="submit" className="w-full" data-testid="button-create-appointment">
                Create Appointment
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{format(currentDate, "MMMM yyyy")}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                data-testid="button-prev-month"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                data-testid="button-next-month"
              >
                Next
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-medium text-sm p-2">
                {day}
              </div>
            ))}
            {daysInMonth.map((date) => {
              const dayAppointments = getAppointmentsForDay(date);
              const isToday = isSameDay(date, new Date());
              
              return (
                <Card
                  key={date.toISOString()}
                  className={`min-h-24 p-2 ${isToday ? "border-primary" : ""}`}
                >
                  <div className="text-sm font-medium mb-1">{format(date, "d")}</div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 2).map((apt: any) => (
                      <div
                        key={apt.id}
                        className="text-xs p-1 rounded bg-primary/10 truncate"
                        title={apt.title}
                      >
                        {format(new Date(apt.startTime), "h:mm a")} - {apt.title}
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayAppointments.length - 2} more
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {appointments
              ?.filter((apt: any) => new Date(apt.startTime) >= new Date())
              ?.slice(0, 5)
              ?.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h4 className="font-medium">{apt.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(apt.startTime), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <Badge variant={getStatusColor(apt.status)}>{apt.status}</Badge>
                </div>
              )) || <p className="text-muted-foreground">No upcoming appointments</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
