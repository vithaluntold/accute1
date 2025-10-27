import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload, FileText, CheckCircle, Clock, AlertCircle, Eye, Download, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { getUser } from "@/lib/auth";

// Types
interface DocumentRequest {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  createdAt: Date;
}

interface RequiredDocument {
  id: string;
  requestId: string;
  name: string;
  description: string | null;
  category: string | null;
  isRequired: boolean;
  expectedQuantity: number;
  status: string;
  createdAt: Date;
}

interface DocumentSubmission {
  id: string;
  requiredDocumentId: string;
  documentId: string;
  submittedBy: string;
  status: string;
  reviewNotes: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}

interface Document {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export default function MyDocumentRequestsPage() {
  const { toast } = useToast();
  const user = getUser();
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [selectedRequiredDoc, setSelectedRequiredDoc] = useState<RequiredDocument | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch user's client ID
  const { data: userClient } = useQuery<{ clientId: string }>({
    queryKey: ["/api/me/client"],
    enabled: !!user,
  });

  // Fetch document requests for the user's client
  const { data: requests = [], isLoading: requestsLoading } = useQuery<DocumentRequest[]>({
    queryKey: ["/api/my/document-requests"],
    enabled: !!userClient?.clientId,
  });

  // Fetch required documents for all requests (for progress calculation)
  const { data: allRequiredDocs = {} } = useQuery<Record<string, RequiredDocument[]>>({
    queryKey: ["/api/my/all-required-documents"],
    enabled: requests.length > 0,
    queryFn: async () => {
      const docs: Record<string, RequiredDocument[]> = {};
      for (const request of requests) {
        const response = await fetch(`/api/my/document-requests/${request.id}/required-documents`, {
          credentials: "include",
        });
        if (response.ok) {
          docs[request.id] = await response.json();
        }
      }
      return docs;
    },
  });

  // Fetch required documents for selected request
  const { data: requiredDocs = [] } = useQuery<RequiredDocument[]>({
    queryKey: ["/api/my/document-requests", selectedRequest?.id, "required-documents"],
    enabled: !!selectedRequest,
  });

  // Fetch submissions for each required document
  const { data: allSubmissions = {} } = useQuery<Record<string, DocumentSubmission[]>>({
    queryKey: ["/api/my-document-submissions", selectedRequest?.id],
    enabled: !!selectedRequest && requiredDocs.length > 0,
    queryFn: async () => {
      if (!requiredDocs.length) return {};
      const submissions: Record<string, DocumentSubmission[]> = {};
      
      for (const doc of requiredDocs) {
        const response = await fetch(`/api/my/required-documents/${doc.id}/submissions`, {
          credentials: "include",
        });
        if (response.ok) {
          submissions[doc.id] = await response.json();
        }
      }
      return submissions;
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "Client Documents");
      formData.append("clientId", userClient!.clientId);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Submit the document for the required document
      submitDocumentMutation.mutate(data.id);
    },
    onError: (error: any) => {
      setUploading(false);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  // Submit document mutation
  const submitDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!selectedRequiredDoc) return;
      
      const response = await apiRequest("POST", `/api/my/required-documents/${selectedRequiredDoc.id}/submit`, {
        documentId,
      });
      return response;
    },
    onSuccess: () => {
      setUploading(false);
      setUploadDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/my-document-submissions", selectedRequest?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/document-requests", selectedRequest?.id, "required-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/all-required-documents"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    },
    onError: (error: any) => {
      setUploading(false);
      toast({
        title: "Submission Error",
        description: error.message || "Failed to submit document",
        variant: "destructive",
      });
    },
  });

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    uploadDocumentMutation.mutate(file);
  };

  // Calculate progress for a request
  const calculateProgress = (requestId: string) => {
    const docs = allRequiredDocs[requestId] || [];
    if (docs.length === 0) return 0;

    const completed = docs.filter((d) => 
      d.status === "approved" || d.status === "submitted"
    ).length;

    return Math.round((completed / docs.length) * 100);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      submitted: { variant: "default", icon: AlertCircle },
      approved: { variant: "secondary", icon: CheckCircle },
      rejected: { variant: "destructive", icon: X },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">My Document Requests</h1>
          <p className="text-muted-foreground">Upload and track your document submissions</p>
        </div>
      </div>

      {/* Requests List */}
      {requestsLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No document requests assigned to you</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((request) => {
            const progress = calculateProgress(request.id);
            return (
              <Card key={request.id} className="hover-elevate" data-testid={`card-request-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">{request.title}</CardTitle>
                    {request.priority === "urgent" && (
                      <Badge variant="destructive" data-testid={`badge-priority-${request.priority}`}>
                        Urgent
                      </Badge>
                    )}
                  </div>
                  {request.description && (
                    <CardDescription className="line-clamp-2">{request.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {request.dueDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Due:</span>
                      <span className="font-medium">{format(new Date(request.dueDate), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" data-testid={`progress-${request.id}`} />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => setSelectedRequest(request)}
                    data-testid={`button-view-${request.id}`}
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Request Details Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-request-details">
            <DialogHeader>
              <DialogTitle>{selectedRequest.title}</DialogTitle>
              {selectedRequest.description && (
                <DialogDescription>{selectedRequest.description}</DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-6">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm font-medium">{calculateProgress(selectedRequest.id)}%</span>
                </div>
                <Progress value={calculateProgress(selectedRequest.id)} />
              </div>

              {/* Required Documents */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Required Documents</h3>
                {requiredDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No documents required
                  </p>
                ) : (
                  <div className="space-y-3">
                    {requiredDocs.map((doc) => {
                      const submissions = allSubmissions[doc.id] || [];
                      const hasSubmission = submissions.length > 0;
                      const latestSubmission = submissions[0];

                      return (
                        <Card key={doc.id} data-testid={`card-required-doc-${doc.id}`}>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <CardTitle className="text-base flex items-center gap-2">
                                  {doc.name}
                                  {doc.isRequired && (
                                    <Badge variant="outline" className="text-xs">Required</Badge>
                                  )}
                                </CardTitle>
                                {doc.description && (
                                  <CardDescription className="mt-1">{doc.description}</CardDescription>
                                )}
                              </div>
                              {getStatusBadge(doc.status)}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {doc.category && (
                              <Badge variant="outline">{doc.category}</Badge>
                            )}
                            {doc.expectedQuantity > 1 && (
                              <p className="text-sm text-muted-foreground">
                                Expected quantity: {doc.expectedQuantity}
                              </p>
                            )}
                            
                            {/* Show submission status */}
                            {hasSubmission && latestSubmission && (
                              <div className="p-3 bg-muted rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">Submission Status</span>
                                  {getStatusBadge(latestSubmission.status)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Submitted: {format(new Date(latestSubmission.submittedAt), "PPp")}
                                </p>
                                {latestSubmission.reviewNotes && (
                                  <div className="pt-2 border-t">
                                    <p className="text-xs font-medium">Review Notes:</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {latestSubmission.reviewNotes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                          <CardFooter>
                            <Button
                              className="w-full"
                              onClick={() => {
                                setSelectedRequiredDoc(doc);
                                setUploadDialogOpen(true);
                              }}
                              disabled={doc.status === "approved"}
                              data-testid={`button-upload-${doc.id}`}
                            >
                              <Upload className="h-4 w-4" />
                              {hasSubmission ? "Upload New Version" : "Upload Document"}
                            </Button>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent data-testid="dialog-upload">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            {selectedRequiredDoc && (
              <DialogDescription>
                Upload file for: {selectedRequiredDoc.name}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
                data-testid="input-file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {uploading ? "Uploading..." : "Click to select a file"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX, JPG, PNG
                </p>
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
