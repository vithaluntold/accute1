import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Calendar,
  User,
  Building2,
  Workflow,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id: string;
  name: string;
  description: string | null;
  workflowId: string;
  clientId: string;
  assignedTo: string | null;
  status: string;
  priority: string;
  progress: number;
  completedStages: number;
  totalStages: number;
  dueDate: string | null;
  createdAt: string;
  client?: { companyName: string };
  workflow?: { name: string };
  assignee?: { name: string };
}

export default function Assignments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    workflowId: "",
    clientId: "",
    name: "",
    description: "",
    assignedTo: "",
    dueDate: "",
    priority: "medium",
  });
  const { toast } = useToast();

  // Fetch assignments
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments'],
  });

  // Fetch workflows for dropdown
  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ['/api/workflows'],
  });

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: typeof newAssignment) => {
      return apiRequest('POST', '/api/assignments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: 'Success',
        description: 'Assignment created successfully',
      });
      setCreateDialogOpen(false);
      setNewAssignment({
        workflowId: "",
        clientId: "",
        name: "",
        description: "",
        assignedTo: "",
        dueDate: "",
        priority: "medium",
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create assignment',
        variant: 'destructive',
      });
    },
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: 'Success',
        description: 'Assignment deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete assignment',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string, assignmentId: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      not_started: { variant: "secondary", icon: Clock, label: "Not Started" },
      in_progress: { variant: "default", icon: Loader2, label: "In Progress" },
      waiting_client: { variant: "outline", icon: AlertCircle, label: "Waiting on Client" },
      review: { variant: "outline", icon: AlertCircle, label: "In Review" },
      completed: { variant: "default", icon: CheckCircle2, label: "Completed" },
      cancelled: { variant: "destructive", icon: AlertCircle, label: "Cancelled" },
    };
    const config = variants[status] || variants.not_started;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1" data-testid={`assignment-status-${assignmentId}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string, assignmentId: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      low: { variant: "secondary", label: "Low" },
      medium: { variant: "outline", label: "Medium" },
      high: { variant: "default", label: "High" },
      urgent: { variant: "destructive", label: "Urgent" },
    };
    const config = variants[priority] || variants.medium;
    return (
      <Badge variant={config.variant} data-testid={`assignment-priority-${assignmentId}`}>
        {config.label}
      </Badge>
    );
  };

  const handleCreateAssignment = () => {
    if (!newAssignment.workflowId || !newAssignment.clientId || !newAssignment.name) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    createAssignmentMutation.mutate(newAssignment);
  };

  const handleDeleteAssignment = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteAssignmentMutation.mutate(id);
    }
  };

  const filteredAssignments = assignments
    .filter((assignment) => {
      const matchesSearch =
        searchQuery === '' ||
        assignment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.client?.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.workflow?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || assignment.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      // Sort by priority first, then by due date
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Assignments</h1>
          <p className="text-muted-foreground">
            Manage client workflow assignments and track progress
          </p>
        </div>
        <Button
          onClick={() => {
            if (clients.length === 0) {
              toast({
                title: 'No clients available',
                description: 'Please create a client first before creating an assignment.',
                variant: 'destructive',
              });
              return;
            }
            if (workflows.length === 0) {
              toast({
                title: 'No workflows available',
                description: 'Please create a workflow first before creating an assignment.',
                variant: 'destructive',
              });
              return;
            }
            setCreateDialogOpen(true);
          }}
          data-testid="button-create-assignment"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Assignment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-assignments"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="waiting_client">Waiting on Client</SelectItem>
            <SelectItem value="review">In Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-priority-filter">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignments Grid */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-12">
          <Workflow className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No assignments match your filters'
              : 'No assignments yet. Create one to get started.'}
          </p>
          {!searchQuery && statusFilter === 'all' && priorityFilter === 'all' && (
            <Button
              onClick={() => {
                if (clients.length === 0) {
                  toast({
                    title: 'No clients available',
                    description: 'Please create a client first before creating an assignment.',
                    variant: 'destructive',
                  });
                  return;
                }
                if (workflows.length === 0) {
                  toast({
                    title: 'No workflows available',
                    description: 'Please create a workflow first before creating an assignment.',
                    variant: 'destructive',
                  });
                  return;
                }
                setCreateDialogOpen(true);
              }}
              data-testid="button-create-first-assignment"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Assignment
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAssignments.map((assignment) => (
            <Card key={assignment.id} className="hover-elevate" data-testid={`assignment-card-${assignment.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/assignments/${assignment.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CardTitle className="text-lg truncate cursor-pointer hover:underline" data-testid={`assignment-name-${assignment.id}`}>
                        {assignment.name}
                      </CardTitle>
                      {getStatusBadge(assignment.status, assignment.id)}
                      {getPriorityBadge(assignment.priority, assignment.id)}
                    </div>
                    {assignment.description && (
                      <CardDescription className="line-clamp-2" data-testid={`assignment-description-${assignment.id}`}>
                        {assignment.description}
                      </CardDescription>
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAssignment(assignment.id, assignment.name)}
                    data-testid={`button-delete-assignment-${assignment.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium" data-testid={`assignment-progress-${assignment.id}`}>
                      {assignment.progress}%
                    </span>
                  </div>
                  <Progress value={assignment.progress} />
                  <div className="text-xs text-muted-foreground" data-testid={`assignment-stages-${assignment.id}`}>
                    {assignment.completedStages} of {assignment.totalStages} stages completed
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div className="truncate">
                      <div className="text-xs text-muted-foreground">Client</div>
                      <div className="font-medium truncate" data-testid={`assignment-client-${assignment.id}`}>
                        {assignment.client?.companyName || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-muted-foreground" />
                    <div className="truncate">
                      <div className="text-xs text-muted-foreground">Workflow</div>
                      <div className="font-medium truncate" data-testid={`assignment-workflow-${assignment.id}`}>
                        {assignment.workflow?.name || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="truncate">
                      <div className="text-xs text-muted-foreground">Assigned To</div>
                      <div className="font-medium truncate" data-testid={`assignment-assignee-${assignment.id}`}>
                        {assignment.assignee?.name || 'Unassigned'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="truncate">
                      <div className="text-xs text-muted-foreground">Due Date</div>
                      <div className="font-medium truncate" data-testid={`assignment-due-date-${assignment.id}`}>
                        {assignment.dueDate ? format(new Date(assignment.dueDate), 'MMM d, yyyy') : 'No due date'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-assignment">
          <DialogHeader>
            <DialogTitle>Create New Assignment</DialogTitle>
            <DialogDescription>
              Assign a workflow to a client to track their progress
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="assignment-name">Name *</Label>
              <Input
                id="assignment-name"
                placeholder="e.g., Acme Corp - 1120 Filing 2024"
                value={newAssignment.name}
                onChange={(e) => setNewAssignment({ ...newAssignment, name: e.target.value })}
                data-testid="input-assignment-name"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="assignment-description">Description</Label>
              <Textarea
                id="assignment-description"
                placeholder="Optional description"
                value={newAssignment.description}
                onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                data-testid="textarea-assignment-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-client">Client *</Label>
              {clients.length === 0 ? (
                <Input
                  id="assignment-client"
                  value="No clients available"
                  disabled
                  data-testid="select-assignment-client"
                  className="cursor-not-allowed"
                />
              ) : (
                <Select
                  value={newAssignment.clientId}
                  onValueChange={(value) => setNewAssignment({ ...newAssignment, clientId: value })}
                >
                  <SelectTrigger id="assignment-client" data-testid="select-assignment-client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.companyName || client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-workflow">Workflow *</Label>
              {workflows.length === 0 ? (
                <Input
                  id="assignment-workflow"
                  value="No workflows available"
                  disabled
                  data-testid="select-assignment-workflow"
                  className="cursor-not-allowed"
                />
              ) : (
                <Select
                  value={newAssignment.workflowId}
                  onValueChange={(value) => setNewAssignment({ ...newAssignment, workflowId: value })}
                >
                  <SelectTrigger id="assignment-workflow" data-testid="select-assignment-workflow">
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
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-assignee">Assign To</Label>
              <Select
                value={newAssignment.assignedTo}
                onValueChange={(value) => setNewAssignment({ ...newAssignment, assignedTo: value })}
              >
                <SelectTrigger id="assignment-assignee" data-testid="select-assignment-assignee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignment-priority">Priority</Label>
              <Select
                value={newAssignment.priority}
                onValueChange={(value) => setNewAssignment({ ...newAssignment, priority: value })}
              >
                <SelectTrigger id="assignment-priority" data-testid="select-assignment-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="assignment-due-date">Due Date</Label>
              <Input
                id="assignment-due-date"
                type="date"
                value={newAssignment.dueDate}
                onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                data-testid="input-assignment-due-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              data-testid="button-cancel-assignment"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAssignment}
              disabled={createAssignmentMutation.isPending}
              data-testid="button-submit-assignment"
            >
              {createAssignmentMutation.isPending ? 'Creating...' : 'Create Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
