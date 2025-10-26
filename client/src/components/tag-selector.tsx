import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
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

      {availableTags.length > 0 && (
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
              <CommandEmpty>No tags found.</CommandEmpty>
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
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {resourceTags.length === 0 && availableTags.length === 0 && (
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Tag className="h-3 w-3" />
          No tags available
        </span>
      )}
    </div>
  );
}
