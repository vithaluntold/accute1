import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus, Edit, Trash2, Eye, FileText, Calendar, User, AlertCircle,
  CheckCircle, Clock, XCircle, Filter, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Types
interface DocumentRequest {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  dueDate: Date | null;
  notes: string | null;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

interface RequiredDocument {
  id: string;
  requestId: string;
  name: string;
  description: string | null;
  category: string | null;
  isRequired: boolean;
  expectedQuantity: number;
  sortOrder: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Client {
  id: string;
  name: string;
  type: string;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

// Form schemas
const requestFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignedTo: z.string().optional(),
  dueDate: z.date().optional(),
  notes: z.string().optional(),
});

type RequestFormValues = z.infer<typeof requestFormSchema>;

const requiredDocFormSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  isRequired: z.boolean().default(true),
  expectedQuantity: z.coerce.number().min(1).default(1),
});

type RequiredDocFormValues = z.infer<typeof requiredDocFormSchema>;

export default function DocumentRequestsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isRequiredDocDialogOpen, setIsRequiredDocDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<DocumentRequest | null>(null);

  // Fetch document requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery<DocumentRequest[]>({
    queryKey: ["/api/document-requests"],
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch required documents for selected request
  const { data: requiredDocs = [] } = useQuery<RequiredDocument[]>({
    queryKey: ["/api/document-requests", selectedRequest?.id, "required-documents"],
    enabled: !!selectedRequest,
  });

  // Request form
  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      clientId: "",
      title: "",
      description: "",
      priority: "medium",
      assignedTo: "",
      notes: "",
    },
  });

  // Required document form
  const requiredDocForm = useForm<RequiredDocFormValues>({
    resolver: zodResolver(requiredDocFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      isRequired: true,
      expectedQuantity: 1,
    },
  });

  // Create request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (data: RequestFormValues) => {
      const response = await apiRequest("POST", "/api/document-requests", {
        ...data,
        dueDate: data.dueDate?.toISOString(),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-requests"] });
      setIsRequestDialogOpen(false);
      requestForm.reset();
      toast({
        title: "Success",
        description: "Document request created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create document request",
        variant: "destructive",
      });
    },
  });

  // Update request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RequestFormValues> }) => {
      const response = await apiRequest("PUT", `/api/document-requests/${id}`, {
        ...data,
        dueDate: data.dueDate?.toISOString(),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-requests"] });
      setEditingRequest(null);
      setIsRequestDialogOpen(false);
      toast({
        title: "Success",
        description: "Document request updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document request",
        variant: "destructive",
      });
    },
  });

  // Delete request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/document-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-requests"] });
      toast({
        title: "Success",
        description: "Document request deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document request",
        variant: "destructive",
      });
    },
  });

  // Add required document mutation
  const addRequiredDocMutation = useMutation({
    mutationFn: async (data: RequiredDocFormValues) => {
      if (!selectedRequest) return;
      const response = await apiRequest("POST", `/api/document-requests/${selectedRequest.id}/required-documents`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-requests", selectedRequest?.id, "required-documents"] });
      setIsRequiredDocDialogOpen(false);
      requiredDocForm.reset();
      toast({
        title: "Success",
        description: "Required document added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add required document",
        variant: "destructive",
      });
    },
  });

  // Delete required document mutation
  const deleteRequiredDocMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/required-documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-requests", selectedRequest?.id, "required-documents"] });
      toast({
        title: "Success",
        description: "Required document removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove required document",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleCreateRequest = (data: RequestFormValues) => {
    createRequestMutation.mutate(data);
  };

  const handleUpdateRequest = (data: RequestFormValues) => {
    if (!editingRequest) return;
    updateRequestMutation.mutate({ id: editingRequest.id, data });
  };

  const handleEditRequest = (request: DocumentRequest) => {
    setEditingRequest(request);
    requestForm.reset({
      clientId: request.clientId,
      title: request.title,
      description: request.description || "",
      priority: request.priority as "low" | "medium" | "high" | "urgent",
      assignedTo: request.assignedTo || "",
      dueDate: request.dueDate ? new Date(request.dueDate) : undefined,
      notes: request.notes || "",
    });
    setIsRequestDialogOpen(true);
  };

  const handleAddRequiredDoc = (data: RequiredDocFormValues) => {
    addRequiredDocMutation.mutate(data);
  };

  const handleViewDetails = (request: DocumentRequest) => {
    setSelectedRequest(request);
  };

  // Filter requests
  const filteredRequests = requests.filter((request) => {
    const matchesSearch = request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      in_progress: { variant: "default", icon: AlertCircle },
      completed: { variant: "secondary", icon: CheckCircle },
      cancelled: { variant: "destructive", icon: XCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  // Priority badge
  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "default",
      urgent: "destructive",
    };
    return (
      <Badge variant={colors[priority] || "outline"} data-testid={`badge-priority-${priority}`}>
        {priority}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Document Requests</h1>
          <p className="text-muted-foreground">Manage client document collection requests</p>
        </div>
        <Button onClick={() => {
          setEditingRequest(null);
          requestForm.reset();
          setIsRequestDialogOpen(true);
        }} data-testid="button-create-request">
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-requests"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-priority-filter">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Requests Grid */}
      {requestsLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No document requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((request) => {
            const client = clients.find((c) => c.id === request.clientId);
            return (
              <Card key={request.id} className="hover-elevate" data-testid={`card-request-${request.id}`}>
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">{request.title}</CardTitle>
                    <div className="flex gap-1">
                      {getStatusBadge(request.status)}
                    </div>
                  </div>
                  {request.description && (
                    <CardDescription className="line-clamp-2">{request.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Client:</span>
                    <span className="font-medium">{client?.name || "Unknown"}</span>
                  </div>
                  {request.dueDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Due:</span>
                      <span className="font-medium">{format(new Date(request.dueDate), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(request.priority)}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(request)}
                    data-testid={`button-view-${request.id}`}
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditRequest(request)}
                    data-testid={`button-edit-${request.id}`}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this request?")) {
                        deleteRequestMutation.mutate(request.id);
                      }
                    }}
                    data-testid={`button-delete-${request.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-request-form">
          <DialogHeader>
            <DialogTitle>{editingRequest ? "Edit" : "Create"} Document Request</DialogTitle>
            <DialogDescription>
              {editingRequest ? "Update" : "Create a new"} document request for a client
            </DialogDescription>
          </DialogHeader>
          <Form {...requestForm}>
            <form onSubmit={requestForm.handleSubmit(editingRequest ? handleUpdateRequest : handleCreateRequest)} className="space-y-4">
              <FormField
                control={requestForm.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-client">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={requestForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2024 Tax Documents" {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={requestForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the documents needed..."
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={requestForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={requestForm.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-assigned-to">
                            <SelectValue placeholder="Select team member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Unassigned</SelectItem>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.firstName && member.lastName
                                ? `${member.firstName} ${member.lastName}`
                                : member.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={requestForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-due-date"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={requestForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes..."
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRequestDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRequestMutation.isPending || updateRequestMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingRequest ? "Update" : "Create"} Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-request-details">
            <DialogHeader>
              <DialogTitle>{selectedRequest.title}</DialogTitle>
              <DialogDescription>
                {clients.find((c) => c.id === selectedRequest.clientId)?.name || "Unknown Client"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Request Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Priority</label>
                    <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                  </div>
                  {selectedRequest.dueDate && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                      <div className="mt-1">{format(new Date(selectedRequest.dueDate), "PPP")}</div>
                    </div>
                  )}
                </div>
                {selectedRequest.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="mt-1 text-sm">{selectedRequest.description}</p>
                  </div>
                )}
                {selectedRequest.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                    <p className="mt-1 text-sm">{selectedRequest.notes}</p>
                  </div>
                )}
              </div>

              {/* Required Documents */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Required Documents</h3>
                  <Button
                    size="sm"
                    onClick={() => setIsRequiredDocDialogOpen(true)}
                    data-testid="button-add-required-doc"
                  >
                    <Plus className="h-4 w-4" />
                    Add Document
                  </Button>
                </div>
                {requiredDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No required documents added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {requiredDocs.map((doc) => (
                      <Card key={doc.id} data-testid={`card-required-doc-${doc.id}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base">{doc.name}</CardTitle>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm("Remove this required document?")) {
                                  deleteRequiredDocMutation.mutate(doc.id);
                                }
                              }}
                              data-testid={`button-delete-required-doc-${doc.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          {doc.description && (
                            <CardDescription>{doc.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                          {doc.category && <Badge variant="outline">{doc.category}</Badge>}
                          {doc.isRequired && <Badge variant="default">Required</Badge>}
                          <Badge variant="secondary">Qty: {doc.expectedQuantity}</Badge>
                          {getStatusBadge(doc.status)}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Required Document Dialog */}
      <Dialog open={isRequiredDocDialogOpen} onOpenChange={setIsRequiredDocDialogOpen}>
        <DialogContent data-testid="dialog-required-doc-form">
          <DialogHeader>
            <DialogTitle>Add Required Document</DialogTitle>
            <DialogDescription>
              Add a document to this request
            </DialogDescription>
          </DialogHeader>
          <Form {...requiredDocForm}>
            <form onSubmit={requiredDocForm.handleSubmit(handleAddRequiredDoc)} className="space-y-4">
              <FormField
                control={requiredDocForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., W-2 Forms" {...field} data-testid="input-doc-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={requiredDocForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional details..."
                        {...field}
                        data-testid="input-doc-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={requiredDocForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Tax Forms" {...field} data-testid="input-doc-category" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={requiredDocForm.control}
                  name="expectedQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          data-testid="input-doc-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={requiredDocForm.control}
                name="isRequired"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Required</FormLabel>
                      <FormDescription>
                        Mark this document as mandatory
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                        data-testid="checkbox-doc-required"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRequiredDocDialogOpen(false)}
                  data-testid="button-cancel-doc"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addRequiredDocMutation.isPending}
                  data-testid="button-submit-doc"
                >
                  Add Document
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
