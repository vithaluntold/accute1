import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileUrl: string;
  fileType?: string;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  fileName,
  fileUrl,
  fileType,
}: FilePreviewDialogProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Reset zoom and rotation when dialog opens
  useEffect(() => {
    if (open) {
      setZoom(100);
      setRotation(0);
    }
  }, [open]);

  const getFileType = () => {
    if (fileType) return fileType;
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension || "")) {
      return "image";
    }
    if (extension === "pdf") {
      return "pdf";
    }
    return "unknown";
  };

  const type = getFileType();
  const isImage = type === "image";
  const isPDF = type === "pdf";

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col" data-testid="dialog-file-preview">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate">{fileName}</DialogTitle>
              <DialogDescription>File Preview</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {isImage && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                    data-testid="button-zoom-out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                    {zoom}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                    data-testid="button-zoom-in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRotate}
                    data-testid="button-rotate"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                data-testid="button-download-preview"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/30 rounded-md">
          {isImage && (
            <div className="flex items-center justify-center min-h-full p-8">
              <img
                src={fileUrl}
                alt={fileName}
                className={cn("max-w-full h-auto transition-transform")}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                }}
                data-testid="preview-image"
              />
            </div>
          )}

          {isPDF && (
            <div className="w-full h-full">
              <iframe
                src={`${fileUrl}#view=FitH`}
                className="w-full h-full border-0"
                title={fileName}
                data-testid="preview-pdf"
              />
            </div>
          )}

          {!isImage && !isPDF && (
            <div className="flex flex-col items-center justify-center min-h-full p-8 text-center">
              <div className="space-y-4">
                <div className="text-4xl">📄</div>
                <div>
                  <p className="font-medium">Preview not available</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This file type cannot be previewed in the browser.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click the download button to view it locally.
                  </p>
                </div>
                <Button onClick={handleDownload} data-testid="button-download-unsupported">
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
