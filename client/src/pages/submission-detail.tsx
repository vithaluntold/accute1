import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Download, FileText, Send, Calendar, User, Clock, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import type { FormField } from "@shared/schema";

interface FormSubmission {
  id: string;
  formTemplateId: string;
  formVersion: number;
  organizationId: string;
  submittedBy: string | null;
  clientId: string | null;
  data: Record<string, any>;
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
  formName?: string;
  fields?: FormField[];
}

interface StaffNote {
  id: string;
  submissionId: string;
  userId: string;
  note: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface RevisionRequest {
  id: string;
  submissionId: string;
  requestedBy: string;
  fieldsToRevise: Array<{ fieldId: string; fieldLabel: string; notes: string }>;
  status: string;
  completedAt: string | null;
  createdAt: string;
  requestedByUser: {
    id: string;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface OrgUser {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "secondary",
  pending: "secondary",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
  revision_requested: "destructive",
  needs_clarification: "outline",
  draft: "outline",
};

const priorityColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewPriority, setReviewPriority] = useState<string>("medium");
  const [assignedReviewer, setAssignedReviewer] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [newNote, setNewNote] = useState("");
  const [selectedFieldsForRevision, setSelectedFieldsForRevision] = useState<Set<string>>(new Set());
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: submission, isLoading } = useQuery<FormSubmission>({
    queryKey: ["/api/form-submissions", params.id],
    enabled: !!params.id,
  });

  const { data: staffNotes = [] } = useQuery<StaffNote[]>({
    queryKey: ["/api/form-submissions", params.id, "notes"],
    enabled: !!params.id,
  });

  const { data: revisionRequests = [] } = useQuery<RevisionRequest[]>({
    queryKey: ["/api/form-submissions", params.id, "revision-requests"],
    enabled: !!params.id,
  });

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ["/api/users/organization"],
    enabled: !!params.id,
  });

  const updateReviewMutation = useMutation({
    mutationFn: (data: { status: string; reviewNotes: string }) =>
      apiRequest("PUT", `/api/form-submissions/${params.id}/review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-submissions", params.id] });
      toast({ title: "Review status updated successfully" });
      setReviewNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update review status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (note: string) =>
      apiRequest("POST", `/api/form-submissions/${params.id}/notes`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-submissions", params.id, "notes"] });
      toast({ title: "Note added successfully" });
      setNewNote("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add note",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createRevisionRequestMutation = useMutation({
    mutationFn: (fieldsToRevise: Array<{ fieldId: string; fieldLabel: string; notes: string }>) =>
      apiRequest("POST", `/api/form-submissions/${params.id}/revision-request`, { fieldsToRevise }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-submissions", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/form-submissions", params.id, "revision-requests"] });
      toast({ title: "Revision request sent successfully" });
      setSelectedFieldsForRevision(new Set());
      setRevisionNotes({});
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send revision request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignReviewerMutation = useMutation({
    mutationFn: (reviewerId: string) =>
      apiRequest("PUT", `/api/form-submissions/${params.id}/assign`, { reviewerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-submissions", params.id] });
      toast({ title: "Reviewer assigned successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign reviewer",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateReview = () => {
    if (!reviewStatus) {
      toast({
        title: "Please select a status",
        variant: "destructive",
      });
      return;
    }
    updateReviewMutation.mutate({
      status: reviewStatus,
      reviewNotes,
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast({
        title: "Please enter a note",
        variant: "destructive",
      });
      return;
    }
    addNoteMutation.mutate(newNote);
  };

  const handleSendRevisionRequest = () => {
    if (selectedFieldsForRevision.size === 0) {
      toast({
        title: "Please select at least one field to revise",
        variant: "destructive",
      });
      return;
    }

    const fieldsToRevise = Array.from(selectedFieldsForRevision).map(fieldId => {
      const field = submission?.fields?.find(f => f.id === fieldId);
      return {
        fieldId,
        fieldLabel: field?.label || fieldId,
        notes: revisionNotes[fieldId] || "",
      };
    });

    createRevisionRequestMutation.mutate(fieldsToRevise);
  };

  const toggleFieldForRevision = (fieldId: string) => {
    const newSet = new Set(selectedFieldsForRevision);
    if (newSet.has(fieldId)) {
      newSet.delete(fieldId);
      const newNotes = { ...revisionNotes };
      delete newNotes[fieldId];
      setRevisionNotes(newNotes);
    } else {
      newSet.add(fieldId);
    }
    setSelectedFieldsForRevision(newSet);
  };

  const getUserInitials = (user: { firstName: string | null; lastName: string | null; username: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  };

  const getUserDisplayName = (user: { firstName: string | null; lastName: string | null; username: string }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username;
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderFieldValue = (field: FormField, value: any) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">No answer</span>;
    }

    switch (field.type) {
      case "name":
        if (typeof value === "object") {
          const parts = [
            value.title,
            value.firstName,
            value.middleName,
            value.lastName,
          ].filter(Boolean);
          return parts.join(" ") || <span className="text-muted-foreground">No answer</span>;
        }
        return value;

      case "address":
        if (typeof value === "object") {
          const parts = [
            value.street,
            value.line2,
            value.city,
            value.state,
            value.zipCode,
            value.country,
          ].filter(Boolean);
          return (
            <div className="space-y-1">
              {parts.map((part, i) => (
                <div key={i}>{part}</div>
              ))}
            </div>
          );
        }
        return value;

      case "file_upload":
        if (Array.isArray(value)) {
          return (
            <div className="space-y-2">
              {value.map((file, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <a
                    href={file.url || file.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {file.name || `File ${i + 1}`}
                  </a>
                  <Download className="w-4 h-4" />
                </div>
              ))}
            </div>
          );
        }
        return value;

      case "signature":
        if (typeof value === "string" && value.startsWith("data:image")) {
          return (
            <div className="border rounded-md p-2 inline-block">
              <img src={value} alt="Signature" className="max-w-xs h-auto" />
            </div>
          );
        }
        return value;

      case "image_choice":
      case "camera":
        if (typeof value === "string" && (value.startsWith("data:image") || value.startsWith("http"))) {
          return (
            <div className="border rounded-md p-2 inline-block">
              <img src={value} alt="Uploaded image" className="max-w-sm h-auto" />
            </div>
          );
        }
        return value;

      case "audio":
        if (typeof value === "string" && value.startsWith("data:audio")) {
          return <audio src={value} controls className="max-w-sm" />;
        }
        return value;

      case "video":
        if (typeof value === "string" && value.startsWith("data:video")) {
          return <video src={value} controls className="max-w-sm" />;
        }
        return value;

      case "select":
      case "radio":
        return value;

      case "multi_select":
      case "checkbox":
        if (Array.isArray(value)) {
          return (
            <div className="space-y-1">
              {value.map((item, i) => (
                <div key={i}>• {item}</div>
              ))}
            </div>
          );
        }
        return value;

      case "matrix_choice":
        if (typeof value === "object") {
          return (
            <div className="space-y-2">
              {Object.entries(value).map(([key, val]) => (
                <div key={key}>
                  <strong>{key}:</strong> {String(val)}
                </div>
              ))}
            </div>
          );
        }
        return value;

      case "currency":
      case "decimal":
      case "percentage":
        return (
          <span className="font-mono">
            {field.type === "currency" && "$"}
            {value}
            {field.type === "percentage" && "%"}
          </span>
        );

      case "rating":
        return `${value} / ${field.validation?.max || 5}`;

      case "date":
        try {
          return format(new Date(value), "MMMM d, yyyy");
        } catch {
          return value;
        }

      case "datetime":
        try {
          return format(new Date(value), "MMMM d, yyyy 'at' h:mm a");
        } catch {
          return value;
        }

      case "time":
        return value;

      default:
        if (typeof value === "object") {
          return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
        }
        return String(value);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Submission not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/forms/${submission.formTemplateId}/submissions`)}
          data-testid="button-back-to-submissions"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-display">Submission Details</h1>
          <p className="text-muted-foreground mt-1">
            {submission.formName || "Form Submission"}
          </p>
        </div>
        <Badge variant={statusColors[submission.status] || "outline"} data-testid={`badge-status-${submission.status}`}>
          {getStatusLabel(submission.status)}
        </Badge>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList data-testid="tabs-submission-detail">
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
          <TabsTrigger value="staff-notes" data-testid="tab-staff-notes">
            Staff Notes {staffNotes.length > 0 && <Badge variant="secondary" className="ml-2">{staffNotes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="revision-history" data-testid="tab-revision-history">
            Revision History {revisionRequests.length > 0 && <Badge variant="secondary" className="ml-2">{revisionRequests.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submission Information</CardTitle>
              <CardDescription>
                Submitted on {format(new Date(submission.submittedAt), "MMMM d, yyyy 'at' h:mm a")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Submission ID</Label>
                  <p className="font-mono text-sm mt-1" data-testid="text-submission-id">{submission.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge variant={statusColors[submission.status] || "outline"}>
                      {getStatusLabel(submission.status)}
                    </Badge>
                  </div>
                </div>
                {submission.submitterName && (
                  <div>
                    <Label className="text-muted-foreground">Submitted By</Label>
                    <p className="mt-1" data-testid="text-submitter-name">{submission.submitterName}</p>
                    {submission.submitterEmail && (
                      <p className="text-sm text-muted-foreground">{submission.submitterEmail}</p>
                    )}
                  </div>
                )}
                {submission.reviewedAt && (
                  <div>
                    <Label className="text-muted-foreground">Reviewed At</Label>
                    <p className="mt-1">
                      {format(new Date(submission.reviewedAt), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submitted Data</CardTitle>
              <CardDescription>Form field responses</CardDescription>
            </CardHeader>
            <CardContent>
              {submission.fields && submission.fields.length > 0 ? (
                <div className="space-y-6">
                  {submission.fields.map((field) => (
                    <div key={field.id} data-testid={`field-${field.id}`}>
                      <Label className="text-base font-medium">{field.label}</Label>
                      {field.description && (
                        <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                      )}
                      <div className="mt-2">
                        {renderFieldValue(field, submission.data[field.id])}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(submission.data).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-base font-medium">
                        {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Label>
                      <div className="mt-2">
                        {typeof value === "object" ? (
                          <pre className="text-xs bg-muted p-2 rounded">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          String(value)
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review Submission</CardTitle>
              <CardDescription>Update the status, assign reviewer, and manage review workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="review-status">Status</Label>
                  <Select
                    value={reviewStatus || submission.status}
                    onValueChange={setReviewStatus}
                  >
                    <SelectTrigger id="review-status" data-testid="select-review-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="revision_requested">Revision Requested</SelectItem>
                      <SelectItem value="needs_clarification">Needs Clarification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review-priority">Priority</Label>
                  <Select
                    value={reviewPriority}
                    onValueChange={setReviewPriority}
                  >
                    <SelectTrigger id="review-priority" data-testid="select-review-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned-reviewer">Assign Reviewer</Label>
                  <Select
                    value={assignedReviewer || submission.reviewedBy || ""}
                    onValueChange={(value) => {
                      setAssignedReviewer(value);
                      assignReviewerMutation.mutate(value);
                    }}
                  >
                    <SelectTrigger id="assigned-reviewer" data-testid="select-assigned-reviewer">
                      <SelectValue placeholder="Select reviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {getUserDisplayName(user)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <input
                    id="due-date"
                    type="date"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    data-testid="input-due-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-notes">Review Notes</Label>
                <Textarea
                  id="review-notes"
                  placeholder="Add notes about this submission..."
                  value={reviewNotes || submission.reviewNotes || ""}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-review-notes"
                />
              </div>

              {submission.reviewNotes && !reviewNotes && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Previous Review Notes</Label>
                  <p className="text-sm">{submission.reviewNotes}</p>
                </div>
              )}

              <Separator />

              <Button
                onClick={handleUpdateReview}
                disabled={updateReviewMutation.isPending}
                data-testid="button-update-status"
              >
                {updateReviewMutation.isPending ? "Updating..." : "Update Review"}
              </Button>
            </CardContent>
          </Card>

          {submission.fields && submission.fields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Request Revisions</CardTitle>
                <CardDescription>Select fields that need to be revised by the client</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {submission.fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-2 border rounded-md p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`field-${field.id}`}
                          checked={selectedFieldsForRevision.has(field.id)}
                          onCheckedChange={() => toggleFieldForRevision(field.id)}
                          data-testid={`checkbox-field-${field.id}`}
                        />
                        <div className="flex-1">
                          <Label htmlFor={`field-${field.id}`} className="font-medium cursor-pointer">
                            {field.label}
                          </Label>
                          {field.description && (
                            <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                          )}
                        </div>
                      </div>
                      {selectedFieldsForRevision.has(field.id) && (
                        <Textarea
                          placeholder="Add notes about what needs to be revised..."
                          value={revisionNotes[field.id] || ""}
                          onChange={(e) => setRevisionNotes({ ...revisionNotes, [field.id]: e.target.value })}
                          rows={2}
                          data-testid={`textarea-revision-notes-${field.id}`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <Separator />

                <Button
                  onClick={handleSendRevisionRequest}
                  disabled={createRevisionRequestMutation.isPending || selectedFieldsForRevision.size === 0}
                  data-testid="button-send-revision-request"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {createRevisionRequestMutation.isPending ? "Sending..." : "Send Revision Request"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="staff-notes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Staff Note</CardTitle>
              <CardDescription>Private notes only visible to staff members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Add a private note about this submission..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
                data-testid="textarea-new-note"
              />
              <Button
                onClick={handleAddNote}
                disabled={addNoteMutation.isPending || !newNote.trim()}
                data-testid="button-add-note"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {addNoteMutation.isPending ? "Adding..." : "Add Note"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes Timeline</CardTitle>
              <CardDescription>All staff notes for this submission</CardDescription>
            </CardHeader>
            <CardContent>
              {staffNotes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No notes yet</p>
              ) : (
                <div className="space-y-4">
                  {staffNotes.map((note) => (
                    <div key={note.id} className="flex gap-4" data-testid={`note-${note.id}`}>
                      <Avatar>
                        <AvatarFallback>{getUserInitials(note.user)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium" data-testid={`note-author-${note.id}`}>
                            {getUserDisplayName(note.user)}
                          </span>
                          <span className="text-sm text-muted-foreground" data-testid={`note-time-${note.id}`}>
                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm" data-testid={`note-content-${note.id}`}>{note.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revision-history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revision Requests</CardTitle>
              <CardDescription>History of all revision requests for this submission</CardDescription>
            </CardHeader>
            <CardContent>
              {revisionRequests.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No revision requests yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {revisionRequests.map((request) => (
                    <div key={request.id} className="border rounded-md p-4 space-y-4" data-testid={`revision-request-${request.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getUserInitials(request.requestedByUser)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{getUserDisplayName(request.requestedByUser)}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={request.status === "completed" ? "default" : "secondary"}>
                          {getStatusLabel(request.status)}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium">Fields Requested for Revision:</p>
                        {request.fieldsToRevise.map((field, idx) => (
                          <div key={idx} className="bg-muted rounded-md p-3 space-y-1">
                            <p className="font-medium text-sm">{field.fieldLabel}</p>
                            {field.notes && (
                              <p className="text-sm text-muted-foreground">{field.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {request.completedAt && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          Completed on {format(new Date(request.completedAt), "MMMM d, yyyy 'at' h:mm a")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
