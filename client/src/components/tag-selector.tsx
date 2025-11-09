import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tag, X, Plus } from "lucide-react";
import type { Tag as TagType } from "@shared/schema";

interface TagSelectorProps {
  resourceType: string;
  resourceId: string;
  className?: string;
}

export function TagSelector({ resourceType, resourceId, className }: TagSelectorProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6b7280");

  const { data: allTags = [] } = useQuery<TagType[]>({
    queryKey: ["/api/tags"],
  });

  const { data: resourceTags = [] } = useQuery<TagType[]>({
    queryKey: ["/api/resources", resourceType, resourceId, "tags"],
  });

  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return apiRequest("/api/taggables", "POST", {
        tagId,
        taggableType: resourceType,
        taggableId: resourceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources", resourceType, resourceId, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Success",
        description: "Tag added successfully",
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add tag",
        variant: "destructive",
      });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return apiRequest("/api/taggables", "DELETE", {
        tagId,
        taggableType: resourceType,
        taggableId: resourceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources", resourceType, resourceId, "tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Success",
        description: "Tag removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove tag",
        variant: "destructive",
      });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return apiRequest("/api/tags", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Success",
        description: "Tag created successfully",
      });
      setCreateDialogOpen(false);
      setNewTagName("");
      setNewTagColor("#6b7280");
      setOpen(true); // Re-open the tag selector
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const handleCreateTag = () => {
    if (!newTagName.trim()) {
      toast({
        title: "Error",
        description: "Tag name is required",
        variant: "destructive",
      });
      return;
    }
    createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor });
  };

  const appliedTagIds = new Set(resourceTags.map((tag) => tag.id));
  const availableTags = allTags.filter((tag) => !appliedTagIds.has(tag.id));

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      {resourceTags.map((tag) => (
        <Badge
          key={tag.id}
          style={{
            backgroundColor: tag.color,
            color: '#fff',
          }}
          className="flex items-center gap-1"
          data-testid={`badge-tag-${tag.id}`}
        >
          {tag.name}
          <button
            type="button"
            onClick={() => removeTagMutation.mutate(tag.id)}
            className="ml-1 rounded-sm hover:bg-white/20"
            data-testid={`button-remove-tag-${tag.id}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2"
            data-testid="button-add-tag"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandEmpty>
              <div className="p-2">
                <p className="text-sm text-muted-foreground mb-2">No tags found.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    setCreateDialogOpen(true);
                  }}
                  data-testid="button-create-tag-from-empty"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Tag
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {availableTags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  onSelect={() => addTagMutation.mutate(tag.id)}
                  data-testid={`option-tag-${tag.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                  </div>
                </CommandItem>
              ))}
              {availableTags.length > 0 && (
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setCreateDialogOpen(true);
                  }}
                  data-testid="option-create-new-tag"
                  className="border-t"
                >
                  <Plus className="h-3 w-3 mr-2" />
                  <span>Create new tag</span>
                </CommandItem>
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>
              Create a new tag to organize your resources
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tag-name">Tag Name *</Label>
              <Input
                id="tag-name"
                placeholder="e.g., High Priority"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                data-testid="input-tag-name"
              />
            </div>
            <div>
              <Label htmlFor="tag-color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="tag-color"
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-20 h-10"
                  data-testid="input-tag-color"
                />
                <Input
                  type="text"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  placeholder="#6b7280"
                  className="flex-1"
                  data-testid="input-tag-color-text"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                data-testid="button-cancel-create-tag"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTag}
                disabled={createTagMutation.isPending}
                data-testid="button-submit-create-tag"
              >
                Create Tag
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
