import { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePlus, X, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SignatureEditorProps {
  value: string;
  onChange: (signature: string) => void;
  className?: string;
}

export function SignatureEditor({ value, onChange, className = "" }: SignatureEditorProps) {
  const [previewHtml, setPreviewHtml] = useState(value || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB for signatures)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Image must be smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64 for embedding
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      
      // Insert image HTML at cursor or end of signature
      const imageHtml = `<img src="${base64}" alt="Signature image" style="max-width: 200px; height: auto; margin: 10px 0;" />`;
      const newSignature = previewHtml + (previewHtml ? "<br/>" : "") + imageHtml;
      
      setPreviewHtml(newSignature);
      onChange(newSignature);
      
      toast({
        title: "Image added",
        description: "Image has been embedded in your signature",
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleTextChange = (text: string) => {
    setPreviewHtml(text);
    onChange(text);
  };

  const insertTemplate = () => {
    const template = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
  <strong>{{employee_name}}</strong><br/>
  <span>{{employee_title}}</span><br/>
  <span style="color: #666;">{{firm_name}}</span><br/>
  <br/>
  📧 {{employee_email}}<br/>
  📞 {{employee_phone}}<br/>
  🌐 <a href="{{firm_website}}" style="color: #0066cc;">{{firm_website}}</a>
</div>`;
    
    setPreviewHtml(template);
    onChange(template);
    
    toast({
      title: "Template inserted",
      description: "Professional signature template added with merge fields",
    });
  };

  const clearSignature = () => {
    setPreviewHtml("");
    onChange("");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Email Signature</Label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={insertTemplate}
            data-testid="button-insert-signature-template"
          >
            <Upload className="h-3 w-3 mr-1" />
            Insert Template
          </Button>
          {previewHtml && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSignature}
              data-testid="button-clear-signature"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* HTML Editor */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">
          Signature HTML (supports merge fields like {"{{employee_name}}"})
        </Label>
        <Textarea
          value={previewHtml}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Enter HTML for your email signature..."
          className="font-mono text-sm min-h-[120px]"
          data-testid="input-signature-html"
        />
      </div>

      {/* Image Upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          data-testid="button-add-signature-image"
        >
          <ImagePlus className="h-4 w-4 mr-2" />
          Add Image
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Add logos, profile pictures, or other images (max 2MB)
        </p>
      </div>

      {/* Preview */}
      {previewHtml && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
            <CardDescription>How your signature will appear in emails</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="p-4 border border-border rounded-md bg-background"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              data-testid="signature-preview"
            />
          </CardContent>
        </Card>
      )}

      {/* Merge Fields Reference */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Available Merge Fields</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <div className="grid grid-cols-2 gap-2">
            <code className="px-2 py-1 bg-background rounded">{"{{employee_name}}"}</code>
            <code className="px-2 py-1 bg-background rounded">{"{{employee_title}}"}</code>
            <code className="px-2 py-1 bg-background rounded">{"{{employee_email}}"}</code>
            <code className="px-2 py-1 bg-background rounded">{"{{employee_phone}}"}</code>
            <code className="px-2 py-1 bg-background rounded">{"{{firm_name}}"}</code>
            <code className="px-2 py-1 bg-background rounded">{"{{firm_website}}"}</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
