import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradientHero } from "@/components/gradient-hero";
import { Users, Plus, AlertTriangle, CheckCircle2, Edit2, Trash2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project } from "@db/schema";

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface ResourceAllocation {
  id: string;
  userId: string;
  projectId: string;
  allocationPercentage: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UtilizationSummary {
  userId: string;
  userName: string;
  totalAllocation: number;
  allocations: {
    id: string;
    projectId: string;
    projectName: string;
    percentAllocation: number;
    startDate: string | null;
    endDate: string | null;
  }[];
}

export default function ResourceAllocation() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<ResourceAllocation | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [percentAllocation, setPercentAllocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch utilization summary (now includes allocation IDs)
  const { data: summary = [], isLoading: summaryLoading } = useQuery<UtilizationSummary[]>({
    queryKey: ["/api/resource-allocations/utilization-summary"],
  });

  // Create allocation mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      projectId: string;
      allocationPercentage: number;
      startDate?: string;
      endDate?: string;
    }) => {
      return apiRequest("POST", "/api/resource-allocations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-allocations/utilization-summary"] });
      toast({
        title: "Success",
        description: "Resource allocation created successfully",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create allocation",
        variant: "destructive",
      });
    },
  });

  // Update allocation mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: {
      id: string;
      data: {
        allocationPercentage?: number;
        startDate?: string;
        endDate?: string;
      };
    }) => {
      return apiRequest("PATCH", `/api/resource-allocations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-allocations/utilization-summary"] });
      toast({
        title: "Success",
        description: "Resource allocation updated successfully",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update allocation",
        variant: "destructive",
      });
    },
  });

  // Delete allocation mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/resource-allocations/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-allocations/utilization-summary"] });
      toast({
        title: "Success",
        description: "Resource allocation deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete allocation",
        variant: "destructive",
      });
    },
  });

  // Helper to normalize dates to YYYY-MM-DD format
  const normalizeDateToYYYYMMDD = (dateValue: string | null): string => {
    if (!dateValue) return "";
    // Extract first 10 characters (YYYY-MM-DD) from ISO string or date string
    const normalized = dateValue.substring(0, 10);
    // Validate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      console.warn("Invalid date format:", dateValue);
      return "";
    }
    return normalized;
  };

  const handleOpenDialog = (allocation?: ResourceAllocation) => {
    if (allocation) {
      setEditingAllocation(allocation);
      setSelectedUserId(allocation.userId);
      setSelectedProjectId(allocation.projectId);
      setPercentAllocation(allocation.allocationPercentage.toString());
      // Normalize dates to YYYY-MM-DD format
      setStartDate(normalizeDateToYYYYMMDD(allocation.startDate));
      setEndDate(normalizeDateToYYYYMMDD(allocation.endDate));
    } else {
      setEditingAllocation(null);
      setSelectedUserId("");
      setSelectedProjectId("");
      setPercentAllocation("");
      setStartDate("");
      setEndDate("");
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAllocation(null);
    setSelectedUserId("");
    setSelectedProjectId("");
    setPercentAllocation("");
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = () => {
    const percent = parseFloat(percentAllocation);
    
    // Validate all required fields
    if (!selectedUserId || !selectedProjectId || isNaN(percent) || percent <= 0 || percent > 100) {
      toast({
        title: "Validation Error",
        description: "Please select user, project, and provide valid allocation (1-100%)",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Start date and end date are required",
        variant: "destructive",
      });
      return;
    }

    // Convert date strings to ISO format at midnight UTC (prevents timezone shifts)
    const startDateISO = `${startDate}T00:00:00.000Z`;
    const endDateISO = `${endDate}T23:59:59.999Z`;

    if (editingAllocation) {
      updateMutation.mutate({ 
        id: editingAllocation.id, 
        data: { 
          allocationPercentage: percent, 
          startDate: startDateISO, 
          endDate: endDateISO 
        } 
      });
    } else {
      const data = {
        userId: selectedUserId,
        projectId: selectedProjectId,
        allocationPercentage: percent,
        startDate: startDateISO,
        endDate: endDateISO,
      };
      createMutation.mutate(data);
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return "Unknown User";
    return user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.username;
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    return project?.name || "Unknown Project";
  };

  const getUtilizationStatus = (totalAllocation: number) => {
    if (totalAllocation > 100) {
      return { label: "Overallocated", variant: "destructive" as const, icon: AlertTriangle };
    }
    if (totalAllocation === 100) {
      return { label: "Fully Allocated", variant: "default" as const, icon: CheckCircle2 };
    }
    if (totalAllocation >= 80) {
      return { label: "Well Allocated", variant: "secondary" as const, icon: CheckCircle2 };
    }
    return { label: "Underallocated", variant: "outline" as const, icon: AlertTriangle };
  };

  if (usersLoading || projectsLoading || summaryLoading) {
    return (
      <div className="flex flex-col h-screen">
        <GradientHero
          title="Resource Allocation Planner"
          subtitle="Manage team capacity across projects"
          icon={Users}
        />
        <div className="flex-1 overflow-auto p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Resource Allocation Planner"
        subtitle="Manage team capacity across projects"
        icon={Users}
        actions={
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-allocation">
            <Plus className="w-4 h-4 mr-2" />
            Add Allocation
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{summary.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-projects">{projects.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overallocated Members</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-overallocated">
                {summary.filter((s) => s.totalAllocation > 100).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Allocation Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Team Capacity Overview</CardTitle>
            <CardDescription>
              Resource allocation percentages across active projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {summary.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No Allocations Yet</p>
                  <p className="text-sm">Start by adding resource allocations to your team members</p>
                </div>
              ) : (
                summary.map((userSummary) => {
                  const status = getUtilizationStatus(userSummary.totalAllocation);
                  const StatusIcon = status.icon;

                  return (
                    <div key={userSummary.userId} className="space-y-3" data-testid={`user-summary-${userSummary.userId}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="font-medium">{userSummary.userName}</div>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                        <div className="text-lg font-semibold" data-testid={`text-total-allocation-${userSummary.userId}`}>
                          {userSummary.totalAllocation}%
                        </div>
                      </div>

                      <div className="space-y-2">
                        {userSummary.allocations.map((allocation) => (
                          <div
                            key={allocation.id}
                            className="flex items-center gap-2 pl-4 border-l-2 border-muted"
                            data-testid={`allocation-${userSummary.userId}-${allocation.projectId}`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">{allocation.projectName}</div>
                              {(allocation.startDate || allocation.endDate) && (
                                <div className="text-xs text-muted-foreground">
                                  {allocation.startDate && allocation.startDate.substring(0, 10)} -{" "}
                                  {allocation.endDate ? allocation.endDate.substring(0, 10) : "Ongoing"}
                                </div>
                              )}
                            </div>
                            <div className="font-semibold text-sm" data-testid={`text-percent-${userSummary.userId}-${allocation.projectId}`}>
                              {allocation.percentAllocation}%
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  // Create minimal allocation object for editing
                                  const allocationToEdit: ResourceAllocation = {
                                    id: allocation.id,
                                    userId: userSummary.userId,
                                    projectId: allocation.projectId,
                                    allocationPercentage: allocation.percentAllocation,
                                    startDate: allocation.startDate,
                                    endDate: allocation.endDate,
                                    createdAt: new Date(), // Not used in edit dialog
                                    updatedAt: new Date(), // Not used in edit dialog
                                  };
                                  handleOpenDialog(allocationToEdit);
                                }}
                                data-testid={`button-edit-${userSummary.userId}-${allocation.projectId}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  deleteMutation.mutate(allocation.id);
                                }}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${userSummary.userId}-${allocation.projectId}`}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Allocation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent data-testid="dialog-allocation-form">
          <DialogHeader>
            <DialogTitle>
              {editingAllocation ? "Edit Resource Allocation" : "Add Resource Allocation"}
            </DialogTitle>
            <DialogDescription>
              Allocate team member capacity to projects. Start and end dates are required. Total allocation per user should not exceed 100%.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Team Member *</Label>
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                disabled={!!editingAllocation}
              >
                <SelectTrigger id="user" data-testid="select-user">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id} data-testid={`option-user-${user.id}`}>
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <Select
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                disabled={!!editingAllocation}
              >
                <SelectTrigger id="project" data-testid="select-project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} data-testid={`option-project-${project.id}`}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="percent">Allocation Percentage (1-100%) *</Label>
              <Input
                id="percent"
                type="number"
                min="1"
                max="100"
                step="1"
                value={percentAllocation}
                onChange={(e) => setPercentAllocation(e.target.value)}
                placeholder="e.g., 50"
                data-testid="input-percent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date *</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {editingAllocation ? "Update Allocation" : "Create Allocation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
