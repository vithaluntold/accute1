import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, X, File, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface DragDropUploadProps {
  onComplete?: () => void; // Callback when upload completes successfully
  onError?: (error: Error) => void; // Callback when upload fails
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

export function DragDropUpload({
  onComplete,
  onError,
  accept = "*/*",
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 5,
  className,
  disabled = false,
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [disabled, maxSize, maxFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);
    }
  }, [maxSize, maxFiles]);

  const processFiles = async (files: File[]) => {
    // Validate file count
    if (uploadFiles.length + files.length > maxFiles) {
      const error = new Error(`Maximum ${maxFiles} files allowed`);
      onError?.(error);
      return;
    }

    // Validate file sizes and create upload file objects
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newFiles: UploadFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: "pending" as const,
    }));

    setUploadFiles((prev) => [...prev, ...newFiles]);

    // Upload all files in a single batch with real progress via XHR
    try {
      await uploadWithProgress(validFiles);
      // Notify parent of successful completion (no duplicate upload)
      onComplete?.();
    } catch (error) {
      // Error handling is done in uploadWithProgress
      console.error("Upload failed:", error);
      onError?.(error instanceof Error ? error : new Error("Upload failed"));
    }
  };

  const uploadWithProgress = async (files: File[]) => {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      // Use XMLHttpRequest for progress tracking
      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            // Update progress for all files being uploaded
            setUploadFiles((prev) =>
              prev.map((f) => 
                files.some(file => file.name === f.file.name)
                  ? { ...f, progress, status: "uploading" }
                  : f
              )
            );
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Mark all uploaded files as successful
            setUploadFiles((prev) =>
              prev.map((f) =>
                files.some(file => file.name === f.file.name)
                  ? { ...f, status: "success", progress: 100 }
                  : f
              )
            );

            // Remove successful uploads after 2 seconds
            setTimeout(() => {
              setUploadFiles((prev) =>
                prev.filter((f) => !files.some(file => file.name === f.file.name))
              );
            }, 2000);

            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.open("POST", "/api/client-portal/documents/upload");
        xhr.send(formData);
      });
    } catch (error) {
      // Mark files as failed
      setUploadFiles((prev) =>
        prev.map((f) =>
          files.some(file => file.name === f.file.name)
            ? {
                ...f,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      );
      throw error;
    }
  };

  const removeFile = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragging && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-testid="dropzone-upload"
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className={cn(
              "rounded-full p-4",
              isDragging ? "bg-primary/10" : "bg-muted"
            )}>
              <Upload className={cn(
                "h-8 w-8",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">
                {isDragging ? "Drop files here" : "Drag & drop files here"}
              </h3>
              <p className="text-sm text-muted-foreground">
                or click the button below to select files
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum {maxFiles} files, up to {formatFileSize(maxSize)} each
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              data-testid="button-select-files"
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {uploadFiles.length > 0 && (
        <div className="space-y-2">
          {uploadFiles.map((uploadFile) => (
            <Card key={uploadFile.id} data-testid={`upload-item-${uploadFile.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {uploadFile.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : uploadFile.status === "error" ? (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <File className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {uploadFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadFile.file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            uploadFile.status === "success"
                              ? "default"
                              : uploadFile.status === "error"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {uploadFile.status === "uploading"
                            ? `${uploadFile.progress}%`
                            : uploadFile.status}
                        </Badge>
                        {uploadFile.status !== "uploading" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeFile(uploadFile.id)}
                            className="h-6 w-6"
                            data-testid={`button-remove-${uploadFile.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {uploadFile.status === "uploading" && (
                      <Progress value={uploadFile.progress} className="h-1" />
                    )}
                    {uploadFile.error && (
                      <p className="text-xs text-destructive">{uploadFile.error}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
