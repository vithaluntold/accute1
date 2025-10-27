import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Download, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
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

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "secondary",
  pending: "secondary",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
  draft: "outline",
};

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const { toast } = useToast();

  const { data: submission, isLoading } = useQuery<FormSubmission>({
    queryKey: ["/api/form-submissions", params.id],
    enabled: !!params.id,
  });

  const updateReviewMutation = useMutation({
    mutationFn: (data: { status: string; reviewNotes: string }) =>
      apiRequest("PUT", `/api/form-submissions/${params.id}/review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-submissions", params.id] });
      toast({ title: "Review status updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update review status",
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
        <Badge variant={statusColors[submission.status] || "outline"}>
          {getStatusLabel(submission.status)}
        </Badge>
      </div>

      <div className="grid gap-6">
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
                <p className="font-mono text-sm mt-1">{submission.id}</p>
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
                  <p className="mt-1">{submission.submitterName}</p>
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
                  <div key={field.id}>
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
            <CardDescription>Update the status and add review notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                </SelectContent>
              </Select>
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
              {updateReviewMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
