import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Search, FileText, Upload, Download, Trash2, Eye, Loader2, File, Calendar } from "lucide-react";
import { formatDistance } from "date-fns";
import { TagSelector } from "@/components/tag-selector";

export default function Documents() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents"],
  });

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

      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
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

  const filteredDocuments = documents.filter((doc: any) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-2">
            <FileText className="h-8 w-8 text-[#e5a660]" />
            Documents
          </h1>
          <p className="text-muted-foreground">
            Manage and organize your client documents securely
          </p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-document">
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
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-documents"
          />
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-documents">
              {documents.length === 0 ? "No documents yet" : "No matching documents"}
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
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
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc: any) => (
            <Card key={doc.id} className="hover-elevate" data-testid={`document-card-${doc.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.type)}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate" data-testid={`document-name-${doc.id}`}>
                        {doc.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-xs mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistance(new Date(doc.createdAt), new Date(), { addSuffix: true })}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Size:</span>
                  <span data-testid={`document-size-${doc.id}`}>{formatFileSize(doc.size)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={doc.status === "pending" ? "outline" : "default"} data-testid={`document-status-${doc.id}`}>
                    {doc.status}
                  </Badge>
                </div>
                <TagSelector resourceType="document" resourceId={doc.id} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
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
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(doc.id)}
                    data-testid={`button-delete-${doc.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
