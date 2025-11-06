import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Paperclip, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface TemplateAttachment {
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

interface TemplateAttachmentsProps {
  attachments: TemplateAttachment[];
  onChange: (attachments: TemplateAttachment[]) => void;
  disabled?: boolean;
}

export function TemplateAttachments({
  attachments,
  onChange,
  disabled = false,
}: TemplateAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file sizes (max 10MB per file)
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast({
        title: "File too large",
        description: `Maximum file size is 10MB. ${oversizedFiles.length} file(s) exceeded this limit.`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload files to server
      const newAttachments: TemplateAttachment[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const data = await response.json();
        
        newAttachments.push({
          filename: file.name,
          url: data.url,
          size: file.size,
          mimeType: file.type,
        });
      }

      onChange([...attachments, ...newAttachments]);

      toast({
        title: "Files uploaded",
        description: `${newAttachments.length} file(s) added as default attachments`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (index: number) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Default Attachments</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          data-testid="button-add-attachment"
        >
          <Paperclip className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Add Files"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="*/*"
        />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30 hover-elevate group"
              data-testid={`attachment-${index}`}
            >
              <div className="flex-shrink-0">
                {getFileIcon(attachment.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeAttachment(index)}
                disabled={disabled}
                data-testid={`button-remove-attachment-${index}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
          No default attachments. Files added here will be included every time this template is used.
        </p>
      )}
    </div>
  );
}
