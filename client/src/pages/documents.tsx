import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, FileText, Upload, Download, Trash2, Eye, Loader2, File, Calendar, Sparkles } from "lucide-react";
import { formatDistance } from "date-fns";
import { TagSelector } from "@/components/tag-selector";
import type { InstalledAgentView } from "@shared/schema";
import { GradientHero } from "@/components/gradient-hero";
import { DataTable, type ColumnDef } from "@/components/data-table";

export default function Documents() {
  const [location, setLocation] = useLocation();
  const { toast} = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);
  
  // Check for marketplace template ID in URL
  const params = new URLSearchParams(location.split('?')[1]);
  const marketplaceTemplateId = params.get('marketplaceTemplateId');
  
  // Open upload dialog if coming from marketplace (only once)
  useEffect(() => {
    if (marketplaceTemplateId && !uploadDialogOpen) {
      setUploadDialogOpen(true);
      // Clear query param immediately to prevent reopening (replace history to avoid Back button loop)
      setLocation('/documents', { replace: true });
    }
  }, [marketplaceTemplateId, uploadDialogOpen, setLocation]);

  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents"],
  });

  // Check if Parity copilot is installed
  const { data: installedAgents = [] } = useQuery<InstalledAgentView[]>({
    queryKey: ['/api/ai-agents/installed'],
  });

  const hasParity = installedAgents.some((agent) => agent.agent?.name === 'Parity');

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", selectedFile.name);
      formData.append("type", selectedFile.type || "application/octet-stream");
      formData.append("size", selectedFile.size.toString());

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const uploadedDocument = await response.json();
      
      // Link to marketplace template if ID provided
      if (marketplaceTemplateId) {
        try {
          await apiRequest("PATCH", `/api/marketplace/items/${marketplaceTemplateId}`, {
            sourceId: uploadedDocument.id
          });
          toast({
            title: "Success",
            description: "Document uploaded and linked to marketplace",
          });
        } catch (error: any) {
          toast({
            title: "Warning",
            description: "Document uploaded but failed to link to marketplace",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Document uploaded successfully",
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedFile(null);
      setUploadDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="h-8 w-8 text-red-500" />;
    if (type.includes("image")) return <Eye className="h-8 w-8 text-blue-500" />;
    if (type.includes("word") || type.includes("document")) return <FileText className="h-8 w-8 text-blue-600" />;
    if (type.includes("excel") || type.includes("sheet")) return <FileText className="h-8 w-8 text-green-600" />;
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const columns: ColumnDef<any>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: (doc) => (
        <div className="flex items-center gap-3">
          {getFileIcon(doc.type)}
          <div className="font-medium">{doc.name}</div>
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessorFn: (doc) => doc.type.split('/').pop() || doc.type,
      cell: (doc) => (
        <Badge variant="outline" className="text-xs">
          {doc.type.split('/').pop()?.toUpperCase() || 'FILE'}
        </Badge>
      ),
      width: "120px",
    },
    {
      id: "size",
      header: "Size",
      accessorKey: "size",
      cell: (doc) => (
        <div className="text-sm text-muted-foreground">
          {formatFileSize(doc.size)}
        </div>
      ),
      width: "100px",
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (doc) => (
        <Badge variant={doc.status === "pending" ? "outline" : "default"}>
          {doc.status}
        </Badge>
      ),
      width: "100px",
    },
    {
      id: "createdAt",
      header: "Uploaded",
      accessorKey: "createdAt",
      cell: (doc) => (
        <div className="text-sm text-muted-foreground">
          {formatDistance(new Date(doc.createdAt), new Date(), { addSuffix: true })}
        </div>
      ),
      width: "150px",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={FileText}
        title={
          <>
            Documents
            {hasParity && (
              <Badge variant="secondary" className="gap-1 bg-white/20 border-white/30 text-white backdrop-blur-sm ml-3" data-testid="badge-parity-copilot">
                <Sparkles className="h-4 w-4" />
                Parity AI
              </Badge>
            )}
          </>
        }
        description="Manage and organize your client documents securely"
        actions={
          <>
            {hasParity && (
              <Button 
                variant="outline" 
                className="bg-white/20 border-white/30 text-white backdrop-blur-sm" 
                data-testid="button-parity-chat"
                onClick={() => setLocation('/ai-agents/parity')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Ask Parity AI
              </Button>
            )}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-primary" data-testid="button-upload-document">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Upload a new document to your secure storage
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-md p-8 text-center">
                  <Input
                    type="file"
                    onChange={handleFileSelect}
                    data-testid="input-file-upload"
                    className="mb-4"
                  />
                  {selectedFile && (
                    <div className="mt-4 p-4 bg-muted rounded-md">
                      <p className="text-sm font-medium" data-testid="text-selected-file">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadDialogOpen(false);
                      setSelectedFile(null);
                    }}
                    data-testid="button-cancel-upload"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                    data-testid="button-confirm-upload"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Main List */}
          <div className={previewDocument ? "flex-1" : "w-full"}>
            <DataTable
              data={documents}
              columns={columns}
              searchPlaceholder="Search documents..."
              searchKeys={["name", "type"]}
              onRowClick={setPreviewDocument}
              selectedRow={previewDocument}
              actions={(doc) => (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewDocument(doc)}
                    data-testid={`button-preview-${doc.id}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/documents/${doc.id}/download`, {
                          credentials: "include",
                        });
                        if (!response.ok) throw new Error("Download failed");
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = doc.name;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to download document",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid={`button-download-${doc.id}`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(doc.id)}
                    data-testid={`button-delete-${doc.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              emptyState={
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-1" data-testid="text-no-documents">
                    {documents.length === 0 ? "No documents yet" : "No matching documents"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {documents.length === 0
                      ? "Upload your first document to get started"
                      : "Try adjusting your search"}
                  </p>
                  {documents.length === 0 && (
                    <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-first">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  )}
                </div>
              }
            />
          </div>

          {/* Preview Panel */}
          {previewDocument && (
            <Card className="w-96 h-fit sticky top-6">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getFileIcon(previewDocument.type)}
                    <CardTitle className="text-lg">{previewDocument.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewDocument(null)}
                    data-testid="button-close-preview"
                  >
                    <span className="sr-only">Close</span>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Type</p>
                    <Badge variant="outline">{previewDocument.type.split('/').pop()?.toUpperCase()}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Size</p>
                    <p className="font-medium" data-testid={`document-size-${previewDocument.id}`}>
                      {formatFileSize(previewDocument.size)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <Badge variant={previewDocument.status === "pending" ? "outline" : "default"} data-testid={`document-status-${previewDocument.id}`}>
                      {previewDocument.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Uploaded</p>
                    <p className="text-sm">
                      {formatDistance(new Date(previewDocument.createdAt), new Date(), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Tags</p>
                  <TagSelector resourceType="document" resourceId={previewDocument.id} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
