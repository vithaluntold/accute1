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
import { MessageSquare, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

type MessageTemplate = {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[] | null;
  isActive: boolean;
  isDefault: boolean;
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
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<MessageTemplate | null>(null);

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

  return (
    <div>
      {/* Gradient Hero Section */}
      <div className="relative mb-8">
        <div className="absolute inset-0 gradient-hero opacity-90"></div>
        <div className="relative container mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="h-10 w-10 text-white" />
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white">Message Templates</h1>
              </div>
              <p className="text-white/90 text-lg">Create and manage reusable message templates</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="bg-white text-primary" data-testid="button-create">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates?.map((template) => (
            <Card key={template.id} data-testid={`card-template-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      {template.isDefault && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Default
                        </Badge>
                      )}
                      {!template.isActive && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          Inactive
                        </Badge>
                      )}
                      {template.organizationId === null && (
                        <Badge className="ml-2 text-xs bg-gradient-to-r from-blue-600 to-pink-600">
                          Platform
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {template.content}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                    data-testid={`button-edit-${template.id}`}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirmTemplate(template)}
                    data-testid={`button-delete-${template.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}
