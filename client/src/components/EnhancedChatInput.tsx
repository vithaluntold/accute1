import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AttachedFile {
  file: File;
  preview?: string;
}

interface EnhancedChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string, files?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  supportsAttachments?: boolean;
  maxLines?: number;
  className?: string;
  testIdPrefix?: string;
}

export function EnhancedChatInput({
  value,
  onChange,
  onSend,
  placeholder = "Type your message...",
  disabled = false,
  supportsAttachments = true,
  maxLines = 10,
  className = "",
  testIdPrefix = "chat",
}: EnhancedChatInputProps) {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-expand textarea based on content (max 10 lines)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate new height
    textarea.style.height = "auto";
    
    // Calculate line height
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight || "24");
    const maxHeight = lineHeight * maxLines;
    
    // Set new height
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value, maxLines]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter = new line (default textarea behavior)
    // Enter alone = send message
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!value.trim() && attachedFiles.length === 0) return;
    if (disabled) return;

    const files = attachedFiles.map(af => af.file);
    onSend(value, files.length > 0 ? files : undefined);
    
    // Clear input and attachments
    onChange("");
    setAttachedFiles([]);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
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

    // Create previews for image files
    const newAttachments: AttachedFile[] = files.map(file => {
      const attachment: AttachedFile = { file };
      
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string;
          setAttachedFiles(prev => [...prev]);
        };
        reader.readAsDataURL(file);
      }
      
      return attachment;
    });

    setAttachedFiles(prev => [...prev, ...newAttachments]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border border-border rounded-md bg-muted/30">
          {attachedFiles.map((attachment, index) => (
            <div
              key={index}
              className="relative group flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-md hover-elevate"
              data-testid={`${testIdPrefix}-attachment-${index}`}
            >
              {attachment.preview && (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="w-8 h-8 object-cover rounded"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate max-w-[150px]">
                  {attachment.file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {(attachment.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeAttachment(index)}
                data-testid={`${testIdPrefix}-remove-attachment-${index}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="resize-none min-h-[44px] pr-12"
            data-testid={`${testIdPrefix}-input`}
          />
          
          {/* Attachment Button (inside textarea) */}
          {supportsAttachments && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="absolute bottom-2 right-2 h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                data-testid={`${testIdPrefix}-attach-button`}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
            </>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={disabled || (!value.trim() && attachedFiles.length === 0)}
          className="h-11"
          data-testid={`${testIdPrefix}-send-button`}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground px-1">
        Press <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">Shift</kbd> + <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-xs">Enter</kbd> for new line
      </p>
    </div>
  );
}
