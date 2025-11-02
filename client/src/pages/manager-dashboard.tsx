import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "@/lib/auth";
import { Calendar, CheckCircle2, Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { User, Task } from "@shared/schema";

export default function ManagerDashboardPage() {
  const user = getUser();
  const [selectedReportee, setSelectedReportee] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const { data: reportees = [] } = useQuery<User[]>({
    queryKey: ["/api/users", user?.id, "reportees"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user?.id}/reportees`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const reporteeTasks = allTasks.filter((task) => {
    if (selectedReportee !== "all" && task.assignedTo !== selectedReportee) {
      return false;
    }
    if (selectedReportee === "all") {
      const reporteeIds = reportees.map((r) => r.id);
      if (!reporteeIds.includes(task.assignedTo || "")) {
        return false;
      }
    }
    if (selectedStatus !== "all" && task.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const stats = {
    total: reporteeTasks.length,
    pending: reporteeTasks.filter((t) => t.status === "pending").length,
    inProgress: reporteeTasks.filter((t) => t.status === "in_progress").length,
    completed: reporteeTasks.filter((t) => t.status === "completed").length,
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "pending":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getAssigneeName = (assignedTo: string | null) => {
    if (!assignedTo) return "Unassigned";
    const reportee = reportees.find((r) => r.id === assignedTo);
    if (reportee) {
      return `${reportee.firstName} ${reportee.lastName}`;
    }
    return "Unknown";
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        <p className="text-muted-foreground">
          View and monitor tasks assigned to your reportees
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-in-progress">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-completed">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Reportee Tasks</CardTitle>
              <CardDescription>
                {reportees.length} {reportees.length === 1 ? "reportee" : "reportees"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedReportee} onValueChange={setSelectedReportee}>
                <SelectTrigger className="w-48" data-testid="select-reportee">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reportees</SelectItem>
                  {reportees.map((reportee) => (
                    <SelectItem key={reportee.id} value={reportee.id}>
                      {reportee.firstName} {reportee.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reportees.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">You don't have any reportees yet</p>
            </div>
          ) : reporteeTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tasks found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reporteeTasks.map((task) => {
                  const reportee = reportees.find((r) => r.id === task.assignedTo);
                  return (
                    <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        {reportee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getInitials(reportee.firstName, reportee.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {reportee.firstName} {reportee.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(task.status)}>
                          {task.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityColor(task.priority || "low")}>
                          {task.priority || "low"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.dueDate
                          ? format(new Date(task.dueDate), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
