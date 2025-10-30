import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Plus, Edit, Trash2, Eye, Image, Palette, Link2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

type EmailTemplate = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  variables: string[] | null;
  isActive: boolean;
  logoUrl: string | null;
  footerText: string | null;
  socialLinks: Record<string, string> | null;
  brandingColors: Record<string, string> | null;
  organizationId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export default function EmailTemplatesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<EmailTemplate | null>(null);
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/email-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setDialogOpen(false);
      setSelectedTemplate(null);
      setSelectedCategory("");
      toast({ title: "Email template created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create template", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/email-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setDialogOpen(false);
      setSelectedTemplate(null);
      setSelectedCategory("");
      toast({ title: "Email template updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update template", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/email-templates/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setDeleteConfirmTemplate(null);
      toast({ title: "Email template deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete template", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setSelectedTemplate(template);
      setSelectedCategory(template.category);
    } else {
      setSelectedTemplate(null);
      setSelectedCategory("");
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!selectedCategory) {
      toast({ title: "Please select a category", variant: "destructive" });
      return;
    }

    // Parse social links
    const socialLinks: Record<string, string> = {};
    const facebook = formData.get("facebook") as string;
    const twitter = formData.get("twitter") as string;
    const linkedin = formData.get("linkedin") as string;
    const instagram = formData.get("instagram") as string;
    
    if (facebook) socialLinks.facebook = facebook;
    if (twitter) socialLinks.twitter = twitter;
    if (linkedin) socialLinks.linkedin = linkedin;
    if (instagram) socialLinks.instagram = instagram;

    // Parse branding colors
    const brandingColors: Record<string, string> = {};
    const primaryColor = formData.get("primaryColor") as string;
    const secondaryColor = formData.get("secondaryColor") as string;
    const accentColor = formData.get("accentColor") as string;
    
    if (primaryColor) brandingColors.primary = primaryColor;
    if (secondaryColor) brandingColors.secondary = secondaryColor;
    if (accentColor) brandingColors.accent = accentColor;

    const templateData = {
      name: formData.get("name") as string,
      category: selectedCategory,
      subject: formData.get("subject") as string,
      body: formData.get("body") as string,
      logoUrl: (formData.get("logoUrl") as string) || null,
      footerText: (formData.get("footerText") as string) || null,
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      brandingColors: Object.keys(brandingColors).length > 0 ? brandingColors : null,
      isActive: formData.get("isActive") === "on",
    };

    if (selectedTemplate) {
      updateTemplateMutation.mutate({ id: selectedTemplate.id, data: templateData });
    } else {
      createTemplateMutation.mutate(templateData);
    }
  };

  const renderPreview = (template: EmailTemplate) => {
    let renderedBody = template.body;
    let renderedSubject = template.subject;

    // Replace common placeholders with example values
    const exampleData: Record<string, string> = {
      '{{client_name}}': 'John Doe',
      '{{contact_name}}': 'John Doe',
      '{{company_name}}': 'Acme Corporation',
      '{{portal_link}}': 'https://example.com/portal',
      '{{assignment_name}}': 'Q4 Tax Filing',
      '{{document_name}}': 'Tax Return 2024',
    };

    Object.entries(exampleData).forEach(([placeholder, value]) => {
      renderedBody = renderedBody.replace(new RegExp(placeholder, 'g'), value);
      renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), value);
    });

    // Apply branding colors to preview
    const primaryColor = template.brandingColors?.primary || '#2563eb';
    const secondaryColor = template.brandingColors?.secondary || '#10b981';

    return (
      <div className="border rounded-lg p-6 bg-background">
        <div className="mb-4">
          <p className="text-sm font-medium text-muted-foreground">Subject:</p>
          <p className="text-lg font-semibold">{renderedSubject}</p>
        </div>
        <Separator className="my-4" />
        <div className="space-y-4">
          {template.logoUrl && (
            <div className="flex justify-center mb-6">
              <div className="w-32 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                Logo Image
              </div>
            </div>
          )}
          <div 
            className="prose prose-sm max-w-none"
            style={{ 
              color: 'var(--foreground)',
            }}
          >
            {renderedBody.split('\n').map((line, i) => (
              <p key={i}>{line || '\u00A0'}</p>
            ))}
          </div>
          {template.footerText && (
            <>
              <Separator className="my-6" />
              <div className="text-center text-xs text-muted-foreground">
                <p>{template.footerText}</p>
              </div>
            </>
          )}
          {template.socialLinks && Object.keys(template.socialLinks).length > 0 && (
            <div className="flex justify-center gap-4 mt-4">
              {Object.entries(template.socialLinks).map(([platform, url]) => (
                <div key={platform} className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display">Email Templates</h1>
          <p className="text-muted-foreground mt-1">Customize email templates with branding and placeholders</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-new-template">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading templates...</p>
            </CardContent>
          </Card>
        ) : templates?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <Mail className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-muted-foreground">No email templates yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          templates?.map((template) => (
            <Card key={template.id} data-testid={`card-template-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle>{template.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="capitalize">{template.category}</Badge>
                        {template.organizationId === null && (
                          <Badge variant="secondary">System</Badge>
                        )}
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Subject: {template.subject}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewTemplate(template)}
                      data-testid={`button-preview-${template.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {template.organizationId !== null && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(template)}
                          data-testid={`button-edit-${template.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmTemplate(template)}
                          data-testid={`button-delete-${template.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Body Preview:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.body}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {template.logoUrl && (
                      <Badge variant="outline" className="gap-1">
                        <Image className="w-3 h-3" />
                        Logo
                      </Badge>
                    )}
                    {template.brandingColors && (
                      <Badge variant="outline" className="gap-1">
                        <Palette className="w-3 h-3" />
                        Custom Colors
                      </Badge>
                    )}
                    {template.socialLinks && Object.keys(template.socialLinks).length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Link2 className="w-3 h-3" />
                        Social Links
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit Email Template" : "Create Email Template"}
            </DialogTitle>
            <DialogDescription>
              Design email templates with custom branding and placeholder support
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4 mt-4">
                <div>
                  <Label>Template Name</Label>
                  <Input 
                    name="name" 
                    placeholder="Welcome Email" 
                    defaultValue={selectedTemplate?.name}
                    required 
                    data-testid="input-name" 
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Welcome</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="signature_request">Signature Request</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input 
                    name="subject" 
                    placeholder="Welcome to {{company_name}}" 
                    defaultValue={selectedTemplate?.subject}
                    required 
                    data-testid="input-subject" 
                  />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea
                    name="body"
                    placeholder="Dear {{contact_name}},&#10;&#10;Welcome to our platform!&#10;&#10;Access your portal here: {{portal_link}}"
                    className="min-h-64 font-mono text-sm"
                    defaultValue={selectedTemplate?.body}
                    required
                    data-testid="input-body"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Available placeholders: {'{{client_name}}'}, {'{{contact_name}}'}, {'{{company_name}}'}, {'{{portal_link}}'}, {'{{assignment_name}}'}, {'{{document_name}}'}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="branding" className="space-y-4 mt-4">
                <div>
                  <Label>Logo URL</Label>
                  <Input 
                    name="logoUrl" 
                    type="url"
                    placeholder="https://example.com/logo.png" 
                    defaultValue={selectedTemplate?.logoUrl || ""}
                    data-testid="input-logo-url" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter a publicly accessible URL for your logo
                  </p>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label>Brand Colors</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Primary</Label>
                      <Input 
                        name="primaryColor" 
                        type="color"
                        defaultValue={selectedTemplate?.brandingColors?.primary || "#2563eb"}
                        data-testid="input-primary-color" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Secondary</Label>
                      <Input 
                        name="secondaryColor" 
                        type="color"
                        defaultValue={selectedTemplate?.brandingColors?.secondary || "#10b981"}
                        data-testid="input-secondary-color" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Accent</Label>
                      <Input 
                        name="accentColor" 
                        type="color"
                        defaultValue={selectedTemplate?.brandingColors?.accent || "#f59e0b"}
                        data-testid="input-accent-color" 
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <Label>Footer Text</Label>
                  <Textarea
                    name="footerText"
                    placeholder="© 2025 Your Company. All rights reserved."
                    className="min-h-20"
                    defaultValue={selectedTemplate?.footerText || ""}
                    data-testid="input-footer-text"
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label>Social Media Links</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Facebook</Label>
                      <Input 
                        name="facebook" 
                        type="url"
                        placeholder="https://facebook.com/yourpage" 
                        defaultValue={selectedTemplate?.socialLinks?.facebook || ""}
                        data-testid="input-facebook" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Twitter</Label>
                      <Input 
                        name="twitter" 
                        type="url"
                        placeholder="https://twitter.com/yourhandle" 
                        defaultValue={selectedTemplate?.socialLinks?.twitter || ""}
                        data-testid="input-twitter" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                      <Input 
                        name="linkedin" 
                        type="url"
                        placeholder="https://linkedin.com/company/yourcompany" 
                        defaultValue={selectedTemplate?.socialLinks?.linkedin || ""}
                        data-testid="input-linkedin" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Instagram</Label>
                      <Input 
                        name="instagram" 
                        type="url"
                        placeholder="https://instagram.com/yourhandle" 
                        defaultValue={selectedTemplate?.socialLinks?.instagram || ""}
                        data-testid="input-instagram" 
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active Status</Label>
                    <p className="text-sm text-muted-foreground">
                      Only active templates can be used in automated emails
                    </p>
                  </div>
                  <Switch 
                    name="isActive" 
                    defaultChecked={selectedTemplate?.isActive ?? true}
                    data-testid="switch-is-active"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 mt-6">
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                data-testid="button-save-template"
              >
                {createTemplateMutation.isPending || updateTemplateMutation.isPending
                  ? "Saving..." 
                  : selectedTemplate ? "Update Template" : "Create Template"
                }
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Template Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Preview with example placeholder values
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && renderPreview(previewTemplate)}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmTemplate} onOpenChange={() => setDeleteConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmTemplate) {
                  deleteTemplateMutation.mutate(deleteConfirmTemplate.id);
                }
              }}
              disabled={deleteTemplateMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
