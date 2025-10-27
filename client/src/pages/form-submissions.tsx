import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Search, Eye, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface FormSubmission {
  id: string;
  formTemplateId: string;
  formVersion: number;
  organizationId: string;
  submittedBy: string | null;
  clientId: string | null;
  data: any;
  attachments: any[];
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  submittedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  submitterName?: string;
  submitterEmail?: string;
}

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
}

const SUBMISSIONS_PER_PAGE = 20;

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "secondary",
  pending: "secondary",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
  draft: "outline",
};

export default function FormSubmissionsPage() {
  const params = useParams<{ formId: string }>();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: formTemplate, isLoading: isLoadingForm } = useQuery<FormTemplate>({
    queryKey: ["/api/forms", params.formId],
    enabled: !!params.formId,
  });

  const { data: allSubmissions = [], isLoading: isLoadingSubmissions } = useQuery<FormSubmission[]>({
    queryKey: ["/api/form-submissions", { formTemplateId: params.formId }],
    enabled: !!params.formId,
  });

  const filteredSubmissions = allSubmissions.filter((submission) => {
    const matchesSearch =
      searchQuery === "" ||
      submission.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.submitterName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.submitterEmail?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || submission.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSubmissions.length / SUBMISSIONS_PER_PAGE);
  const startIndex = (currentPage - 1) * SUBMISSIONS_PER_PAGE;
  const endIndex = startIndex + SUBMISSIONS_PER_PAGE;
  const paginatedSubmissions = filteredSubmissions.slice(startIndex, endIndex);

  const getStatusBadgeVariant = (status: string) => {
    return statusColors[status] || "outline";
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoadingForm) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/forms")}
          data-testid="button-back-to-forms"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-display">Form Submissions</h1>
          <p className="text-muted-foreground mt-1">
            {formTemplate?.name || "Loading..."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>
            View and manage all submissions for this form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by submission ID, name, or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
                data-testid="input-search-submissions"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingSubmissions ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-submissions">
                {searchQuery || statusFilter !== "all"
                  ? "No submissions match your filters"
                  : "No submissions yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submission ID</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSubmissions.map((submission) => (
                      <TableRow key={submission.id} data-testid={`submission-row-${submission.id}`}>
                        <TableCell className="font-mono text-sm">
                          {submission.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {submission.submitterName || "Anonymous"}
                            </span>
                            {submission.submitterEmail && (
                              <span className="text-xs text-muted-foreground">
                                {submission.submitterEmail}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(submission.submittedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(submission.status)}
                            data-testid={`submission-status-${submission.id}`}
                          >
                            {getStatusLabel(submission.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/submissions/${submission.id}`)}
                            data-testid={`button-view-submission-${submission.id}`}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredSubmissions.length)} of{" "}
                    {filteredSubmissions.length} submissions
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-previous-page"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
