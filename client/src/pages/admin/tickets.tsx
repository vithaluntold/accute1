import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, HelpCircle, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function AdminTicketsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tickets, isLoading } = useQuery<Array<{
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
    } | null;
    createdAt: string;
    resolvedAt: string | null;
  }>>({
    queryKey: ["/api/admin/tickets"],
  });

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
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-semibold mb-2" data-testid="heading-support-tickets">Support Tickets</h1>
          <p className="text-muted-foreground">Manage platform support tickets across all organizations</p>
        </div>

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
                          <Button size="sm" variant="outline" data-testid={`button-view-ticket-${ticket.id}`}>
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
    </div>
  );
}
