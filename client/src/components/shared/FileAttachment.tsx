import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, File, X, Loader2, FileText, FileSpreadsheet, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileAttachmentProps {
  onFileProcessed: (result: { text: string; filename: string; metadata?: any }) => void;
  uploadEndpoint: string;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
}

export function FileAttachment({
  onFileProcessed,
  uploadEndpoint,
  accept = ".pdf,.docx,.xlsx,.xls,.csv,.txt",
  maxSizeMB = 10,
  className = "",
  disabled = false
}: FileAttachmentProps) {
  const [uploading, setUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (ext === 'docx') return <FileText className="h-4 w-4 text-blue-500" />;
    if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    if (ext === 'csv') return <FileCode className="h-4 w-4 text-purple-500" />;
    return <File className="h-4 w-4" />;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: `Maximum file size is ${maxSizeMB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
      });
      return;
    }

    // Validate file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = accept.split(',').map(a => a.trim().replace('.', ''));
    if (ext && !allowedExtensions.includes(ext)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: `Allowed types: ${allowedExtensions.join(', ').toUpperCase()}`
      });
      return;
    }

    setCurrentFile(file);
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      toast({
        title: "File uploaded successfully",
        description: `Extracted text from ${file.name}`
      });

      onFileProcessed({
        text: result.extractedText || result.text || '',
        filename: file.name,
        metadata: result.metadata
      });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setCurrentFile(null);

    } catch (error: any) {
      console.error('File upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || 'Failed to process file'
      });
      setCurrentFile(null);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setCurrentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
        data-testid="input-file-upload"
      />

      {!currentFile && !uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-full"
          data-testid="button-attach-file"
        >
          <Upload className="h-4 w-4 mr-2" />
          Attach File
          <span className="ml-2 text-xs text-muted-foreground">
            (PDF, DOCX, XLSX, CSV, TXT)
          </span>
        </Button>
      )}

      {uploading && (
        <Card className="p-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                Processing {currentFile?.name}...
              </p>
              <p className="text-xs text-muted-foreground">
                Extracting text from document
              </p>
            </div>
          </div>
        </Card>
      )}

      {currentFile && !uploading && (
        <Card className="p-3">
          <div className="flex items-center gap-3">
            {getFileIcon(currentFile.name)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-attached-filename">
                {currentFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(currentFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={removeFile}
              data-testid="button-remove-file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
