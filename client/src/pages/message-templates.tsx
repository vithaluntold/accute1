import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { MessageSquare, Plus, Edit, Trash2, Loader2, Sparkles, Eye } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { GradientHero } from "@/components/gradient-hero";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { formatDistance } from "date-fns";

type MessageTemplate = {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[] | null;
  isActive: boolean;
  isDefault: boolean;
  scope: 'global' | 'organization';
  organizationId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type TemplateFormData = {
  name: string;
  category: string;
  content: string;
  isActive: boolean;
};

export default function MessageTemplatesPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<MessageTemplate | null>(null);

  const { data: installedAgents = [] } = useQuery<any[]>({
    queryKey: ["/api/ai-agents/installed"],
  });

  const hasEcho = installedAgents.some(agent => agent.agent?.name === "Echo");

  // Check for marketplace template ID and metadata in URL
  const params = new URLSearchParams(location.split('?')[1]);
  const marketplaceTemplateId = params.get('marketplaceTemplateId');
  const marketplaceName = params.get('name');
  const marketplaceDescription = params.get('description');
  const marketplaceCategory = params.get('category');

  const form = useForm<TemplateFormData>({
    defaultValues: {
      name: "",
      category: "",
      content: "",
      isActive: true,
    },
  });

  // Open dialog if coming from marketplace (only once)
  useEffect(() => {
    if (marketplaceTemplateId && !dialogOpen) {
      setDialogOpen(true);
      // Pre-fill with marketplace metadata
      form.reset({
        name: marketplaceName || "",
        category: marketplaceCategory || "",
        content: marketplaceDescription || "",
        isActive: true,
      });
      // Clear query param immediately to prevent reopening (replace history to avoid Back button loop)
      setLocation('/message-templates', { replace: true });
    }
  }, [marketplaceTemplateId, dialogOpen, marketplaceName, marketplaceDescription, marketplaceCategory, form, setLocation]);

  const { data: templates, isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/message-templates", data);
      return res.json();
    },
    onSuccess: async (createdTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      
      // Link to marketplace template if ID provided
      if (marketplaceTemplateId) {
        try {
          await apiRequest("PATCH", `/api/marketplace/items/${marketplaceTemplateId}`, {
            sourceId: createdTemplate.id
          });
          toast({ 
            title: "Success", 
            description: "Message template created and linked to marketplace" 
          });
        } catch (error: any) {
          toast({ 
            title: "Warning", 
            description: "Template created but failed to link to marketplace",
            variant: "destructive"
          });
        }
      } else {
        toast({ title: "Message template created successfully" });
      }
      
      setDialogOpen(false);
      form.reset();
      setSelectedTemplate(null);
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
      apiRequest("PATCH", `/api/message-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      setDialogOpen(false);
      form.reset();
      setSelectedTemplate(null);
      toast({ title: "Message template updated successfully" });
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
    mutationFn: (id: string) => apiRequest("DELETE", `/api/message-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      setDeleteConfirmTemplate(null);
      toast({ title: "Message template deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete template", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const handleEdit = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    form.reset({
      name: template.name,
      category: template.category,
      content: template.content,
      isActive: template.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (data: TemplateFormData) => {
    if (selectedTemplate) {
      updateTemplateMutation.mutate({
        id: selectedTemplate.id,
        data,
      });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedTemplate(null);
    form.reset();
  };

  const columns: ColumnDef<MessageTemplate>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: (template) => (
        <div className="font-medium">{template.name}</div>
      ),
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      cell: (template) => (
        <Badge variant="outline">{template.category}</Badge>
      ),
      width: "150px",
    },
    {
      id: "preview",
      header: "Preview",
      accessorKey: "content",
      cell: (template) => (
        <div className="text-sm text-muted-foreground truncate max-w-md">
          {template.content}
        </div>
      ),
      sortable: false,
    },
    {
      id: "status",
      header: "Status",
      cell: (template) => (
        <div className="flex gap-1 flex-wrap">
          {template.isDefault && (
            <Badge variant="secondary" className="text-xs">
              Default
            </Badge>
          )}
          {!template.isActive && (
            <Badge variant="destructive" className="text-xs">
              Inactive
            </Badge>
          )}
          {template.scope === 'global' && (
            <Badge variant="secondary" className="text-xs">
              Global
            </Badge>
          )}
        </div>
      ),
      width: "150px",
      sortable: false,
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      cell: (template) => (
        <div className="text-sm text-muted-foreground">
          {formatDistance(new Date(template.createdAt), new Date(), { addSuffix: true })}
        </div>
      ),
      width: "150px",
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={MessageSquare}
        title="Message Templates"
        description="Create and manage reusable message templates"
        actions={
          <div className="flex gap-2">
            {hasEcho ? (
              <Button 
                onClick={() => setLocation('/ai-agents/echo')} 
                className="bg-white text-primary"
                data-testid="button-create-with-echo"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create with Echo AI
              </Button>
            ) : (
              <Button 
                onClick={() => setLocation('/ai-agents')} 
                variant="outline"
                className="bg-white/10 text-white border-white/20"
                data-testid="button-install-echo"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Install Echo AI
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)} variant="outline" className="bg-white/10 text-white border-white/20" data-testid="button-create">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Main List */}
          <div className={previewTemplate ? "flex-1" : "w-full"}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DataTable
                data={templates || []}
                columns={columns}
                searchPlaceholder="Search templates..."
                searchKeys={["name", "category", "content"]}
                onRowClick={setPreviewTemplate}
                selectedRow={previewTemplate}
                actions={(template) => (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPreviewTemplate(template)}
                      data-testid={`button-preview-${template.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
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
                emptyState={
                  <div className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-1">No templates found</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {templates?.length === 0 
                        ? "Create your first message template to get started"
                        : "Try adjusting your search"}
                    </p>
                    {templates?.length === 0 && (
                      <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Template
                      </Button>
                    )}
                  </div>
                }
              />
            )}
          </div>

          {/* Preview Panel */}
          {previewTemplate && (
            <Card className="w-96 h-fit sticky top-6">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{previewTemplate.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewTemplate(null)}
                    data-testid="button-close-preview"
                  >
                    <span className="sr-only">Close</span>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{previewTemplate.category}</Badge>
                  {previewTemplate.isDefault && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                  {!previewTemplate.isActive && (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                  {previewTemplate.scope === 'global' && (
                    <Badge variant="secondary">Global</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Message Content</p>
                  <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                    {previewTemplate.content}
                  </div>
                </div>
                {previewTemplate.variables && previewTemplate.variables.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Variables</p>
                    <div className="flex flex-wrap gap-2">
                      {previewTemplate.variables.map((variable) => (
                        <Badge key={variable} variant="secondary" className="font-mono text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Created {formatDistance(new Date(previewTemplate.createdAt), new Date(), { addSuffix: true })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit Message Template" : "Create Message Template"}
            </DialogTitle>
            <DialogDescription>
              {marketplaceTemplateId 
                ? "Create template content for your marketplace listing"
                : "Create a reusable message template with variables"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                {...form.register("name", { required: true })}
                placeholder="e.g., Welcome Message"
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                {...form.register("category", { required: true })}
                placeholder="e.g., welcome, notification, reminder"
                data-testid="input-category"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Message Content *</Label>
              <Textarea
                id="content"
                {...form.register("content", { required: true })}
                rows={8}
                placeholder="Enter your message content. Use {{variable_name}} for dynamic content."
                data-testid="textarea-content"
              />
              <p className="text-sm text-muted-foreground">
                Use double curly braces for variables: {`{{client_name}}, {{firm_name}}, etc.`}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                {...form.register("isActive")}
                data-testid="switch-active"
              />
              <Label htmlFor="is-active">Template is active</Label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                data-testid="button-save"
              >
                {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  selectedTemplate ? "Update Template" : "Create Template"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDialogClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmTemplate} onOpenChange={() => setDeleteConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmTemplate && deleteTemplateMutation.mutate(deleteConfirmTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplateMutation.isPending ? (
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
