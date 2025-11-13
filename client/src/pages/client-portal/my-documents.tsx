import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Search, Download, Eye, Upload } from "lucide-react";
import { DragDropUpload } from "@/components/drag-drop-upload";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ClientDocument {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
  sharedBy: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  status: string;
}

export default function ClientMyDocuments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useQuery<ClientDocument[]>({
    queryKey: ["/api/client-portal/documents"],
  });

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/client-portal/documents"] });
    toast({
      title: "Success",
      description: "Files uploaded successfully",
    });
    setShowUpload(false);
  };

  const handleUploadError = (error: Error) => {
    toast({
      title: "Upload failed",
      description: error.message,
      variant: "destructive",
    });
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={FileText}
        title="My Documents"
        description="Access documents shared with you by your team"
        testId="client-documents"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Upload Section */}
        {showUpload && (
          <DragDropUpload
            onComplete={handleUploadComplete}
            onError={handleUploadError}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
            maxSize={10 * 1024 * 1024}
            maxFiles={5}
          />
        )}

        <Card data-testid="card-documents-list">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Shared Documents</CardTitle>
                <CardDescription>
                  {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} available
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-documents"
                  />
                </div>
                <Button
                  onClick={() => setShowUpload(!showUpload)}
                  data-testid="button-toggle-upload"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {showUpload ? "Hide Upload" : "Upload Files"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading documents...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-documents">
                {searchQuery ? "No documents match your search" : "No documents available"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Shared By</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground">{doc.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.sharedBy.firstName && doc.sharedBy.lastName
                          ? `${doc.sharedBy.firstName} ${doc.sharedBy.lastName}`
                          : doc.sharedBy.email}
                      </TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell>{new Date(doc.uploadedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-status-${doc.id}`}>
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewDoc(doc)}
                            data-testid={`button-view-${doc.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = doc.fileUrl;
                              link.download = doc.name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            data-testid={`button-download-${doc.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* File Preview Dialog */}
      {previewDoc && (
        <FilePreviewDialog
          open={!!previewDoc}
          onOpenChange={(open) => !open && setPreviewDoc(null)}
          fileName={previewDoc.name}
          fileUrl={previewDoc.fileUrl}
        />
      )}
    </div>
  );
}
