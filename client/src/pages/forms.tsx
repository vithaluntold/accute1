import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Search, Edit, Trash2, Eye, Clock, CheckCircle, FileText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFormTemplateSchema, type FormTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

// Only user-editable fields
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.enum(["custom", "tax", "audit", "onboarding"]).default("custom"),
});

type FormValues = z.infer<typeof formSchema>;

export default function FormsPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [deleteConfirmForm, setDeleteConfirmForm] = useState<FormTemplate | null>(null);
  const { toast } = useToast();

  const { data: forms = [], isLoading } = useQuery<FormTemplate[]>({
    queryKey: ["/api/forms"],
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest("POST", "/api/forms", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setCreateDialogOpen(false);
      toast({ title: "Form created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create form", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormValues> }) =>
      apiRequest("PUT", `/api/forms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setEditingForm(null);
      toast({ title: "Form updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update form", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/forms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      setDeleteConfirmForm(null);
      toast({ title: "Form deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete form", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/forms/${id}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Form published successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to publish form", description: error.message, variant: "destructive" });
    },
  });

  const filteredForms = forms.filter((form) =>
    form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (form.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display">Forms</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage form templates for clients and workflows
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-form">
          <Plus className="w-4 h-4 mr-2" />
          Create Form
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-forms"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredForms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "No forms found" : "No forms yet. Create your first form to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForms.map((form) => (
            <Card key={form.id} className="hover-elevate" data-testid={`card-form-${form.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate" data-testid={`text-form-name-${form.id}`}>
                      {form.name}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {form.description || "No description"}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={form.status === "published" ? "default" : "secondary"}
                    data-testid={`badge-status-${form.id}`}
                  >
                    {form.status === "published" ? (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    ) : (
                      <Clock className="w-3 h-3 mr-1" />
                    )}
                    {form.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Category:</span>
                    <Badge variant="outline">{form.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Submissions:</span>
                    <span className="font-medium">{form.submissionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Version:</span>
                    <span className="font-medium">v{form.version}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => setLocation(`/forms/${form.id}/builder`)}
                  data-testid={`button-build-form-${form.id}`}
                >
                  <Wrench className="w-3 h-3 mr-1" />
                  Build
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingForm(form)}
                  data-testid={`button-edit-form-${form.id}`}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                {form.status === "draft" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => publishMutation.mutate(form.id)}
                    disabled={publishMutation.isPending}
                    data-testid={`button-publish-form-${form.id}`}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Publish
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirmForm(form)}
                  data-testid={`button-delete-form-${form.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <FormDialog
        open={createDialogOpen || editingForm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingForm(null);
          }
        }}
        form={editingForm}
        onSubmit={(data) => {
          if (editingForm) {
            updateMutation.mutate({ id: editingForm.id, data });
          } else {
            // Create with default backend-managed fields
            createMutation.mutate({
              ...data,
              fields: [],
              sections: [],
              pages: [],
              conditionalRules: [],
              validationRules: [],
              calculatedFields: [],
              folderStructure: {},
              settings: {},
            });
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog open={deleteConfirmForm !== null} onOpenChange={(open) => !open && setDeleteConfirmForm(null)}>
        <DialogContent data-testid="dialog-delete-form">
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmForm?.name}"? This action cannot be undone and will
              also delete all submissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmForm(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmForm && deleteMutation.mutate(deleteConfirmForm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormTemplate | null;
  onSubmit: (data: FormValues) => void;
  isPending: boolean;
}

function FormDialog({ open, onOpenChange, form, onSubmit, isPending }: FormDialogProps) {
  const formHook = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "custom",
    },
  });

  // Reset form when dialog opens/closes or form data changes
  useEffect(() => {
    if (open) {
      formHook.reset({
        name: form?.name || "",
        description: form?.description || "",
        category: form?.category || "custom",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-form-editor">
        <DialogHeader>
          <DialogTitle>{form ? "Edit Form" : "Create Form"}</DialogTitle>
          <DialogDescription>
            {form ? "Update form details" : "Create a new form template"}
          </DialogDescription>
        </DialogHeader>
        <Form {...formHook}>
          <form onSubmit={formHook.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={formHook.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Tax Return Form 2024" {...field} data-testid="input-form-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={formHook.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this form is for..."
                      {...field}
                      value={field.value || ""}
                      data-testid="input-form-description"
                    />
                  </FormControl>
                  <FormDescription>
                    Help users understand when to use this form
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={formHook.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-form-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="custom">Custom</SelectItem>
                      <SelectItem value="tax">Tax</SelectItem>
                      <SelectItem value="audit">Audit</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-form"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-form">
                {form ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
