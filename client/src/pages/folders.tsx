import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Home,
  FileText,
  Workflow,
  Users,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Palette,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFolderSchema, type Folder as FolderType, type InsertFolder } from "@shared/schema";
import { z } from "zod";

const folderFormSchema = insertFolderSchema
  .omit({ organizationId: true, createdBy: true })
  .extend({
    name: z.string().min(1, "Folder name is required"),
    contentType: z.enum(["documents", "forms", "workflows", "clients", "mixed"]),
    color: z.string().optional(),
    icon: z.string().optional(),
  });

const contentTypeIcons = {
  documents: FileText,
  forms: FileText,
  workflows: Workflow,
  clients: Users,
  mixed: Folder,
};

const colorPresets = [
  { name: "Default", value: "#64748b" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#f59e0b" },
  { name: "Green", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
];

interface FolderTreeItemProps {
  folder: FolderType;
  level: number;
  onEdit: (folder: FolderType) => void;
  onDelete: (id: string) => void;
  onArchive: (folder: FolderType) => void;
  onNavigate: (folderId: string | null) => void;
  expandedFolders: Set<string>;
  onToggleExpand: (folderId: string) => void;
  children?: FolderType[];
}

function FolderTreeItem({
  folder,
  level,
  onEdit,
  onDelete,
  onArchive,
  onNavigate,
  expandedFolders,
  onToggleExpand,
  children = [],
}: FolderTreeItemProps) {
  const isExpanded = expandedFolders.has(folder.id);
  const hasChildren = children.length > 0;
  const Icon = contentTypeIcons[folder.contentType as keyof typeof contentTypeIcons] || Folder;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-md hover-elevate cursor-pointer"
        style={{ paddingLeft: `${level * 1.5}rem` }}
      >
        {hasChildren && (
          <button
            onClick={() => onToggleExpand(folder.id)}
            className="p-0.5 hover-elevate rounded"
            data-testid={`button-toggle-folder-${folder.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-5" />}
        
        <button
          onClick={() => onNavigate(folder.id)}
          className="flex items-center gap-2 flex-1 min-w-0"
          data-testid={`button-navigate-folder-${folder.id}`}
        >
          <Icon
            className="h-4 w-4 flex-shrink-0"
            style={{ color: folder.color || undefined }}
          />
          <span className="truncate">{folder.name}</span>
        </button>

        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs" data-testid={`badge-content-type-${folder.id}`}>
            {folder.contentType}
          </Badge>
          
          {folder.isArchived && (
            <Badge variant="secondary" className="text-xs">
              Archived
            </Badge>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEdit(folder)}
            data-testid={`button-edit-folder-${folder.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onArchive(folder)}
            data-testid={`button-archive-folder-${folder.id}`}
          >
            {folder.isArchived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(folder.id)}
            data-testid={`button-delete-folder-${folder.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              onNavigate={onNavigate}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              children={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Folders() {
  const { toast } = useToast();
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const { data: allFolders = [], isLoading } = useQuery<FolderType[]>({
    queryKey: ["/api/folders"],
  });

  const form = useForm<z.infer<typeof folderFormSchema>>({
    resolver: zodResolver(folderFormSchema),
    defaultValues: {
      name: "",
      contentType: "mixed",
      color: colorPresets[0].value,
      icon: "",
      parentId: currentParentId,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsertFolder, "organizationId" | "createdBy">) => {
      return apiRequest("POST", "/api/folders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Success",
        description: "Folder created successfully",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertFolder> }) => {
      return apiRequest("PATCH", `/api/folders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Success",
        description: "Folder updated successfully",
      });
      setDialogOpen(false);
      setEditingFolder(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update folder",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Success",
        description: "Folder deleted successfully",
      });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete folder",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: string; isArchived: boolean }) => {
      return apiRequest("PATCH", `/api/folders/${id}`, { isArchived });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Success",
        description: variables.isArchived ? "Folder archived successfully" : "Folder restored successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update folder",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof folderFormSchema>) => {
    if (editingFolder) {
      updateMutation.mutate({ id: editingFolder.id, data });
    } else {
      createMutation.mutate({ ...data, parentId: currentParentId });
    }
  };

  const openCreateDialog = () => {
    setEditingFolder(null);
    form.reset({
      name: "",
      contentType: "mixed",
      color: colorPresets[0].value,
      icon: "",
      parentId: currentParentId,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (folder: FolderType) => {
    setEditingFolder(folder);
    form.reset({
      name: folder.name,
      contentType: folder.contentType as any,
      color: folder.color || colorPresets[0].value,
      icon: folder.icon || "",
      parentId: folder.parentId,
    });
    setDialogOpen(true);
  };

  const handleArchive = (folder: FolderType) => {
    archiveMutation.mutate({ id: folder.id, isArchived: !folder.isArchived });
  };

  const handleToggleExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Build folder hierarchy
  const buildHierarchy = (parentId: string | null): FolderType[] => {
    return allFolders
      .filter((f) => f.parentId === parentId)
      .filter((f) => showArchived || !f.isArchived)
      .filter((f) => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const rootFolders = buildHierarchy(null);
  
  // Build breadcrumbs
  const getBreadcrumbs = (): FolderType[] => {
    if (!currentParentId) return [];
    const breadcrumbs: FolderType[] = [];
    let current = allFolders.find((f) => f.id === currentParentId);
    while (current) {
      breadcrumbs.unshift(current);
      current = current.parentId ? allFolders.find((f) => f.id === current!.parentId) : undefined;
    }
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Folders</h1>
          <p className="text-muted-foreground">Organize your documents, forms, workflows, and clients</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-folder">
          <FolderPlus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-folders"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Folder className="h-4 w-4" />
          </div>
        </div>

        <Button
          variant={showArchived ? "default" : "outline"}
          onClick={() => setShowArchived(!showArchived)}
          data-testid="button-toggle-archived"
        >
          <Archive className="h-4 w-4 mr-2" />
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCurrentParentId(null)}
            className="flex items-center gap-1 hover-elevate px-2 py-1 rounded"
            data-testid="button-breadcrumb-home"
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </button>
          {breadcrumbs.map((folder) => (
            <div key={folder.id} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => setCurrentParentId(folder.id)}
                className="hover-elevate px-2 py-1 rounded"
                data-testid={`button-breadcrumb-${folder.id}`}
              >
                {folder.name}
              </button>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {currentParentId
              ? `Folders in ${allFolders.find((f) => f.id === currentParentId)?.name || "Unknown"}`
              : "Root Folders"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading folders...</div>
          ) : rootFolders.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No folders match your search"
                  : "No folders yet. Create one to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {rootFolders.map((folder) => {
                const children = buildHierarchy(folder.id);
                return (
                  <FolderTreeItem
                    key={folder.id}
                    folder={folder}
                    level={0}
                    onEdit={openEditDialog}
                    onDelete={(id) => setDeleteTarget(id)}
                    onArchive={handleArchive}
                    onNavigate={setCurrentParentId}
                    expandedFolders={expandedFolders}
                    onToggleExpand={handleToggleExpand}
                    children={children}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-folder-form">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Edit Folder" : "Create Folder"}</DialogTitle>
            <DialogDescription>
              {editingFolder
                ? "Update folder details"
                : "Create a new folder to organize your content"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Folder name"
                        data-testid="input-folder-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      data-testid="select-content-type"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="documents">Documents</SelectItem>
                        <SelectItem value="forms">Forms</SelectItem>
                        <SelectItem value="workflows">Workflows</SelectItem>
                        <SelectItem value="clients">Clients</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <div className="flex gap-2 flex-wrap">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => field.onChange(preset.value)}
                          className={`w-8 h-8 rounded border-2 ${
                            field.value === preset.value ? "border-primary" : "border-transparent"
                          }`}
                          style={{ backgroundColor: preset.value }}
                          title={preset.name}
                          data-testid={`button-color-${preset.name.toLowerCase()}`}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel-folder"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-folder"
                >
                  {editingFolder ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="dialog-delete-folder">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this folder? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
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
