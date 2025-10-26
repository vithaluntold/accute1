import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, Plus, Tag, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTagSchema } from "@shared/schema";
import type { Tag as TagType, InsertTag } from "@shared/schema";
import { z } from "zod";

const tagFormSchema = insertTagSchema.extend({
  name: z.string().min(1, "Tag name is required"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color hex code"),
});

const colorPresets = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"
];

export default function Tags() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: tags = [], isLoading } = useQuery<TagType[]>({
    queryKey: ["/api/tags"],
  });

  const form = useForm<z.infer<typeof tagFormSchema>>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      color: colorPresets[0],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTag) => {
      return apiRequest("POST", "/api/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTag> }) => {
      return apiRequest("PATCH", `/api/tags/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Success",
        description: "Tag updated successfully",
      });
      setDialogOpen(false);
      setEditingTag(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tag",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    form.reset({
      name: tag.name,
      color: tag.color,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (data: z.infer<typeof tagFormSchema>) => {
    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTag(null);
      form.reset();
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
            <p className="text-muted-foreground">
              Organize your documents, clients, and workflows with tags
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-tag">
                <Plus className="mr-2 h-4 w-4" />
                Create Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTag ? "Edit Tag" : "Create Tag"}</DialogTitle>
                <DialogDescription>
                  {editingTag
                    ? "Update tag details"
                    : "Create a new tag to organize your resources"}
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tag Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Important, Tax Return, Q1 2024"
                            data-testid="input-tag-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <div className="space-y-4">
                            <div className="flex gap-2 flex-wrap">
                              {colorPresets.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  data-testid={`button-color-${color}`}
                                  className="h-10 w-10 rounded-md border-2 transition-all"
                                  style={{
                                    backgroundColor: color,
                                    borderColor: field.value === color ? '#000' : 'transparent',
                                  }}
                                  onClick={() => field.onChange(color)}
                                />
                              ))}
                            </div>
                            <Input
                              type="text"
                              placeholder="#000000"
                              data-testid="input-tag-color"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogClose(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-tag"
                    >
                      {editingTag ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-tags"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 w-24 bg-muted rounded" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : filteredTags.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Tag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tags found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Get started by creating your first tag"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTags.map((tag) => (
              <Card key={tag.id} data-testid={`card-tag-${tag.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="h-4 w-4 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <CardTitle className="text-base truncate" data-testid={`text-tag-name-${tag.id}`}>
                      {tag.name}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(tag)}
                      data-testid={`button-edit-tag-${tag.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(tag.id)}
                      data-testid={`button-delete-tag-${tag.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge
                    style={{
                      backgroundColor: tag.color,
                      color: '#fff',
                    }}
                    data-testid={`badge-tag-${tag.id}`}
                  >
                    {tag.name}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? This will remove it from all resources.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
