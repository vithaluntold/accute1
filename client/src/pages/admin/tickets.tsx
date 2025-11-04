import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, HelpCircle, AlertCircle, CheckCircle, Clock, MessageSquare, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { GradientHero } from "@/components/gradient-hero";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  assignedTo: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
  resolvedAt: string | null;
  resolvedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  resolution?: string | null;
};

type Comment = {
  id: string;
  ticketId: string;
  content: string;
  createdBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  isInternal: boolean;
  createdAt: string;
};

export default function AdminTicketsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");
  const { toast } = useToast();

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/admin/tickets"],
  });

  const { data: selectedTicket, isLoading: isLoadingTicket } = useQuery<Ticket>({
    queryKey: [`/api/admin/tickets/${selectedTicketId}`],
    enabled: !!selectedTicketId && isDialogOpen,
  });

  const { data: comments, isLoading: isLoadingComments } = useQuery<Comment[]>({
    queryKey: [`/api/admin/tickets/${selectedTicketId}/comments`],
    enabled: !!selectedTicketId && isDialogOpen,
  });

  const updateTicketMutation = useMutation({
    mutationFn: async (data: { status?: string }) => {
      return await apiRequest(`/api/admin/tickets/${selectedTicketId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tickets"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tickets/${selectedTicketId}`] });
      toast({
        title: "Ticket updated",
        description: "The ticket status has been updated successfully.",
      });
      setUpdateStatus("");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ticket status.",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest(`/api/admin/tickets/${selectedTicketId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, isInternal: false }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/tickets/${selectedTicketId}/comments`] });
      setNewComment("");
      toast({
        title: "Comment added",
        description: "Your comment has been added to the ticket.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add comment.",
      });
    },
  });

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTicketId(null);
    setNewComment("");
    setUpdateStatus("");
  };

  const handleUpdateStatus = () => {
    if (updateStatus && updateStatus !== selectedTicket?.status) {
      updateTicketMutation.mutate({ status: updateStatus });
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment);
    }
  };

  const filteredTickets = tickets?.filter(ticket => {
    const searchLower = searchQuery.toLowerCase();
    return (
      ticket.subject.toLowerCase().includes(searchLower) ||
      ticket.organization.name.toLowerCase().includes(searchLower) ||
      ticket.status.toLowerCase().includes(searchLower)
    );
  }) || [];

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "open": return "default";
      case "in_progress": return "default";
      case "waiting_response": return "secondary";
      case "resolved": return "secondary";
      case "closed": return "secondary";
      default: return "secondary";
    }
  };

  const stats = {
    total: tickets?.length || 0,
    open: tickets?.filter(t => t.status === "open").length || 0,
    inProgress: tickets?.filter(t => t.status === "in_progress").length || 0,
    resolved: tickets?.filter(t => t.status === "resolved").length || 0,
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={HelpCircle}
        title="Support Tickets"
        description="Manage platform support tickets across all organizations"
        testId="heading-support-tickets"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-total-tickets">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-open-tickets">{stats.open}</div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-in-progress-tickets">{stats.inProgress}</div>
              <p className="text-xs text-muted-foreground">Being worked on</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold" data-testid="text-resolved-tickets">{stats.resolved}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Support Tickets</CardTitle>
                <CardDescription>View and manage tickets from all organizations</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-tickets"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-tickets">Loading tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-tickets">
                No tickets found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => {
                    const creatorName = `${ticket.createdBy.firstName || ""} ${ticket.createdBy.lastName || ""}`.trim() || ticket.createdBy.email;
                    return (
                      <TableRow key={ticket.id} data-testid={`row-ticket-${ticket.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-ticket-subject-${ticket.id}`}>{ticket.subject}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-md">{ticket.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{ticket.organization.name}</div>
                            <div className="text-xs text-muted-foreground">@{ticket.organization.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityVariant(ticket.priority)} data-testid={`badge-priority-${ticket.id}`}>
                            {ticket.priority.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(ticket.status)} data-testid={`badge-status-${ticket.id}`}>
                            {ticket.status.replace("_", " ").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{creatorName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(ticket.createdAt), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleOpenTicket(ticket.id)}
                            data-testid={`button-view-ticket-${ticket.id}`}
                          >
                            View
                          </Button>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-ticket-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Ticket Details
            </DialogTitle>
            <DialogDescription>
              View and manage support ticket
            </DialogDescription>
          </DialogHeader>

          {isLoadingTicket ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading ticket details...</div>
            </div>
          ) : selectedTicket ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold" data-testid="text-ticket-detail-subject">
                      {selectedTicket.subject}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant={getPriorityVariant(selectedTicket.priority)} data-testid="badge-ticket-detail-priority">
                        {selectedTicket.priority.toUpperCase()}
                      </Badge>
                      <Badge variant={getStatusVariant(selectedTicket.status)} data-testid="badge-ticket-detail-status">
                        {selectedTicket.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      <Badge variant="outline" data-testid="badge-ticket-detail-category">
                        {selectedTicket.category.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Organization</Label>
                      <div className="font-medium mt-1" data-testid="text-ticket-detail-org">
                        {selectedTicket.organization.name}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created By</Label>
                      <div className="font-medium mt-1 flex items-center gap-1" data-testid="text-ticket-detail-creator">
                        <User className="h-3 w-3" />
                        {`${selectedTicket.createdBy.firstName || ""} ${selectedTicket.createdBy.lastName || ""}`.trim() || selectedTicket.createdBy.email}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <div className="font-medium mt-1 flex items-center gap-1" data-testid="text-ticket-detail-created">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(selectedTicket.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                    {selectedTicket.assignedTo && (
                      <div>
                        <Label className="text-muted-foreground">Assigned To</Label>
                        <div className="font-medium mt-1 flex items-center gap-1" data-testid="text-ticket-detail-assigned">
                          <User className="h-3 w-3" />
                          {`${selectedTicket.assignedTo.firstName || ""} ${selectedTicket.assignedTo.lastName || ""}`.trim() || "Unassigned"}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap" data-testid="text-ticket-detail-description">
                      {selectedTicket.description}
                    </div>
                  </div>

                  {selectedTicket.resolution && (
                    <div>
                      <Label className="text-muted-foreground">Resolution</Label>
                      <div className="mt-1 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md whitespace-pre-wrap" data-testid="text-ticket-detail-resolution">
                        {selectedTicket.resolution}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Label>Update Status</Label>
                  <div className="flex gap-2 mt-2">
                    <Select 
                      value={updateStatus || selectedTicket.status} 
                      onValueChange={setUpdateStatus}
                    >
                      <SelectTrigger className="w-[200px]" data-testid="select-update-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting_response">Waiting Response</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleUpdateStatus}
                      disabled={!updateStatus || updateStatus === selectedTicket.status || updateTicketMutation.isPending}
                      data-testid="button-update-status"
                    >
                      {updateTicketMutation.isPending ? "Updating..." : "Update Status"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="h-4 w-4" />
                    <Label className="text-base font-semibold">Comments ({comments?.length || 0})</Label>
                  </div>

                  {isLoadingComments ? (
                    <div className="text-center py-4 text-muted-foreground">Loading comments...</div>
                  ) : comments && comments.length > 0 ? (
                    <div className="space-y-3 mb-4">
                      {comments.map((comment) => {
                        const commentorName = `${comment.createdBy.firstName || ""} ${comment.createdBy.lastName || ""}`.trim() || comment.createdBy.email;
                        return (
                          <div key={comment.id} className="p-3 bg-muted rounded-md" data-testid={`comment-${comment.id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                <span className="font-medium text-sm">{commentorName}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{comment.content}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">No comments yet</div>
                  )}

                  <div className="space-y-2">
                    <Label>Add Comment</Label>
                    <Textarea
                      placeholder="Type your comment here..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      data-testid="textarea-new-comment"
                    />
                    <Button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      data-testid="button-add-comment"
                    >
                      {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
