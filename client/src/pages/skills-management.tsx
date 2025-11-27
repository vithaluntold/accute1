import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Search, Filter } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUser } from "@/lib/auth";
import type { Skill } from "@shared/schema";
import { insertSkillSchema } from "@shared/schema";

interface SkillStats {
  totalSkills: number;
  categoryCounts: Record<string, number>;
  topCategories: Array<{ category: string; count: number }>;
}

// Form schema - use insert schema directly (category and description already optional)
// Pre-process with transforms to trim and convert empty strings to undefined
// Validate that name is not empty after trimming
const formSchema = insertSkillSchema.omit({ organizationId: true })
  .transform((data) => ({
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    category: data.category?.trim() || undefined,
  }))
  .pipe(z.object({
    name: z.string().min(1, "Skill name is required"),
    description: z.string().optional(),
    category: z.string().optional(),
  }));

type FormValues = z.input<typeof formSchema>; // Use input type before transform

export default function SkillsManagement() {
  const { toast } = useToast();
  const user = getUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Check if user has settings.manage permission (based on role or permissions array)
  const canManageSettings = user?.permissions?.includes("settings.manage") || 
                           user?.role === "Admin" || 
                           user?.role === "Super Admin";

  // React Hook Form with Zod validation
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
    },
  });

  // Fetch skills
  const { data: skills = [], isLoading: skillsLoading } = useQuery<Skill[]>({
    queryKey: ["/api/skills"],
  });

  // Fetch skill stats
  const { data: stats } = useQuery<SkillStats>({
    queryKey: ["/api/skills/stats"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: z.output<typeof formSchema>) =>
      apiRequest("POST", "/api/skills", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills/stats"] });
      toast({ title: "Skill created successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create skill",
        description: error.message || "An error occurred",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.output<typeof formSchema>> }) =>
      apiRequest("PATCH", `/api/skills/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills/stats"] });
      toast({ title: "Skill updated successfully" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update skill",
        description: error.message || "An error occurred",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/skills/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/skills/stats"] });
      toast({ title: "Skill deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete skill",
        description: error.message || "An error occurred",
      });
    },
  });

  const handleOpenDialog = (skill?: Skill) => {
    if (skill) {
      setEditingSkill(skill);
      form.reset({
        name: skill.name,
        description: skill.description || "",
        category: skill.category || "",
      });
    } else {
      setEditingSkill(null);
      form.reset({
        name: "",
        description: "",
        category: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSkill(null);
    form.reset();
  };

  const handleSubmit = (data: z.output<typeof formSchema>) => {
    // Data is already cleaned by schema transform (trimmed, empty strings converted to undefined)
    if (editingSkill) {
      updateMutation.mutate({ id: editingSkill.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Get unique categories from all skills (not just top categories)
  const categories = Array.from(
    new Set(skills.map((s) => s.category).filter(Boolean))
  ).sort() as string[];

  // Use stats entirely from API when available, otherwise compute all locally
  const totalSkills = stats?.totalSkills ?? skills.length;
  const totalCategories = stats?.categoryCounts 
    ? Object.keys(stats.categoryCounts).length
    : categories.length + (skills.some((s) => !s.category) ? 1 : 0);
  
  // Compute top category from API or local skills list
  const topCategory = stats?.topCategories?.[0] ?? (() => {
    if (skills.length === 0) return null;
    
    // Count skills per category from local data
    const categoryCounts: Record<string, number> = {};
    skills.forEach((skill) => {
      const cat = skill.category || "Uncategorized";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    
    // Find category with most skills
    const topEntry = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)[0];
    
    return topEntry ? { category: topEntry[0], count: topEntry[1] } : null;
  })();

  // Filter skills
  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (skill.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "uncategorized" && !skill.category) ||
      skill.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group skills by category
  const skillsByCategory = filteredSkills.reduce(
    (acc, skill) => {
      const cat = skill.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill);
      return acc;
    },
    {} as Record<string, Skill[]>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Skills Management</h1>
          <p className="text-muted-foreground">
            Manage your organization's skill taxonomy and categories
          </p>
        </div>
        <Button 
          onClick={() => handleOpenDialog()} 
          disabled={!canManageSettings}
          data-testid="button-create-skill"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Skill
        </Button>
      </div>

      {/* Stats Cards - Always visible, using API data with fallbacks */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-skills">
              {totalSkills}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-categories">
              {totalCategories}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Category</CardTitle>
          </CardHeader>
          <CardContent>
            {topCategory ? (
              <div className="space-y-1">
                <div className="text-sm font-medium" data-testid="text-top-category-name">
                  {topCategory.category}
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-top-category-count">
                  {topCategory.count} skills
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No skills yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Skill Library</CardTitle>
          <CardDescription>Browse and manage all organizational skills</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-skills"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-category-filter-trigger">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent data-testid="select-category-filter-content">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Skills List */}
          {skillsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading skills...</div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || categoryFilter !== "all" ? "No skills match your filters" : "No skills created yet"}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      {category}
                    </h3>
                    <Badge variant="secondary" data-testid={`badge-category-count-${category.toLowerCase().replace(/\s+/g, "-")}`}>
                      {categorySkills.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {categorySkills.map((skill) => (
                      <Card key={skill.id} className="hover-elevate" data-testid={`card-skill-${skill.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base truncate" data-testid={`text-skill-name-${skill.id}`}>
                                {skill.name}
                              </CardTitle>
                              {skill.description && (
                                <CardDescription className="line-clamp-2 text-xs mt-1">
                                  {skill.description}
                                </CardDescription>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenDialog(skill)}
                                disabled={!canManageSettings}
                                data-testid={`button-edit-skill-${skill.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Delete skill "${skill.name}"?`)) {
                                    deleteMutation.mutate(skill.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending || !canManageSettings}
                                data-testid={`button-delete-skill-${skill.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-skill-form">
          <DialogHeader>
            <DialogTitle>{editingSkill ? "Edit Skill" : "Create Skill"}</DialogTitle>
            <DialogDescription>
              {editingSkill
                ? "Update the skill details below"
                : "Add a new skill to your organization's taxonomy"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Financial Statement Analysis"
                        data-testid="input-skill-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Accounting, Technical, Soft Skills"
                        data-testid="input-skill-category"
                      />
                    </FormControl>
                    {categories.length > 0 && (
                      <FormDescription className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">Existing:</span>
                        {categories.map((cat) => (
                          <Badge
                            key={cat}
                            variant="outline"
                            className="cursor-pointer hover-elevate text-xs"
                            onClick={() => form.setValue("category", cat)}
                            data-testid={`badge-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {cat}
                          </Badge>
                        ))}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what this skill encompasses..."
                        rows={3}
                        data-testid="textarea-skill-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-cancel-skill"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-skill"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingSkill ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
