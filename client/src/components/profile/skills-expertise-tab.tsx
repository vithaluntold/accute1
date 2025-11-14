import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Edit2,
  Trash2,
  Award,
  Calendar,
  TrendingUp,
  Star,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUser } from "@/lib/auth";
import type { Skill, UserSkill } from "@shared/schema";
import { insertUserSkillSchema } from "@shared/schema";

// Extended user skill type with skill details
interface UserSkillWithDetails extends UserSkill {
  skill: Skill;
}

// Form schema for add/edit user skill
const formSchema = insertUserSkillSchema
  .omit({ userId: true })
  .extend({
    skillId: z.string().min(1, "Skill is required"),
    proficiencyLevel: z.enum(["beginner", "intermediate", "advanced", "expert"]),
    yearsExperience: z.number().min(0).max(50).default(0),
    certifications: z.string().optional(), // Comma-separated string
    lastUsedDate: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    certifications: data.certifications
      ? data.certifications.split(",").map((c) => c.trim()).filter(Boolean)
      : [],
    lastUsedDate: data.lastUsedDate ? new Date(data.lastUsedDate) : undefined,
  }));

type FormValues = z.input<typeof formSchema>;

const proficiencyConfig = {
  beginner: { label: "Beginner", color: "bg-gray-500" },
  intermediate: { label: "Intermediate", color: "bg-blue-500" },
  advanced: { label: "Advanced", color: "bg-purple-500" },
  expert: { label: "Expert", color: "bg-amber-500" },
};

export function SkillsExpertiseTab() {
  const { toast } = useToast();
  const user = getUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<UserSkillWithDetails | null>(null);

  // Fetch organization skills catalog
  const { data: skillsCatalog = [], isLoading: catalogLoading } = useQuery<Skill[]>({
    queryKey: ["/api/skills"],
  });

  // Fetch current user's skills (server resolves "me" to current user ID from session)
  const { data: userSkills = [], isLoading: skillsLoading } = useQuery<UserSkillWithDetails[]>({
    queryKey: ["/api/users/me/skills"],
  });

  // Form for add/edit skill
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      skillId: "",
      proficiencyLevel: "intermediate",
      yearsExperience: 0,
      certifications: "",
      lastUsedDate: "",
    },
  });

  // Add skill mutation
  const addSkillMutation = useMutation({
    mutationFn: async (data: z.output<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/users/me/skills", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/skills"] });
      toast({
        title: "Skill added",
        description: "Your skill has been added successfully.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add skill",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update skill mutation
  const updateSkillMutation = useMutation({
    mutationFn: async ({
      userSkillId,
      data,
    }: {
      userSkillId: string;
      data: z.output<typeof formSchema>;
    }) => {
      const { skillId, ...updates } = data;
      const res = await apiRequest("PATCH", `/api/users/me/skills/${userSkillId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/skills"] });
      toast({
        title: "Skill updated",
        description: "Your skill has been updated successfully.",
      });
      setDialogOpen(false);
      setEditingSkill(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update skill",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete skill mutation
  const deleteSkillMutation = useMutation({
    mutationFn: async (userSkillId: string) => {
      const res = await apiRequest("DELETE", `/api/users/me/skills/${userSkillId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/skills"] });
      toast({
        title: "Skill removed",
        description: "The skill has been removed from your profile.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove skill",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Endorse skill mutation (note: self-endorsement is illogical in this context)
  const endorseSkillMutation = useMutation({
    mutationFn: async (userSkillId: string) => {
      const res = await apiRequest("POST", `/api/users/me/skills/${userSkillId}/endorse`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/skills"] });
      toast({
        title: "Skill endorsed",
        description: "Thank you for endorsing this skill!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to endorse skill",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (skill?: UserSkillWithDetails) => {
    if (skill) {
      setEditingSkill(skill);
      form.reset({
        skillId: skill.skillId,
        proficiencyLevel: skill.proficiencyLevel as any,
        yearsExperience: skill.yearsExperience || 0,
        certifications: skill.certifications?.join(", ") || "",
        lastUsedDate: skill.lastUsedDate
          ? new Date(skill.lastUsedDate).toISOString().slice(0, 10)
          : "",
      });
    } else {
      setEditingSkill(null);
      form.reset({
        skillId: "",
        proficiencyLevel: "intermediate",
        yearsExperience: 0,
        certifications: "",
        lastUsedDate: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = (data: FormValues) => {
    if (editingSkill) {
      updateSkillMutation.mutate({
        userSkillId: editingSkill.id,
        data: data as any,
      });
    } else {
      addSkillMutation.mutate(data as any);
    }
  };

  // Group skills by proficiency level
  const skillsByProficiency = userSkills.reduce(
    (acc, userSkill) => {
      const level = userSkill.proficiencyLevel as keyof typeof proficiencyConfig;
      if (!acc[level]) acc[level] = [];
      acc[level].push(userSkill);
      return acc;
    },
    {} as Record<string, UserSkillWithDetails[]>
  );

  const totalSkills = userSkills.length;
  const avgYearsExperience =
    totalSkills > 0
      ? Math.round(userSkills.reduce((sum, s) => sum + (s.yearsExperience || 0), 0) / totalSkills)
      : 0;
  const totalEndorsements = userSkills.reduce((sum, s) => sum + (s.endorsements || 0), 0);

  if (catalogLoading || skillsLoading) {
    return <div className="p-6">Loading skills...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Skills & Expertise</h2>
          <p className="text-muted-foreground">
            Manage your professional skills and certifications
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-add-skill">
          <Plus className="h-4 w-4 mr-2" />
          Add Skill
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Skills</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-skills">
              {totalSkills}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Experience</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-experience">
              {avgYearsExperience} {avgYearsExperience === 1 ? "year" : "years"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Endorsements</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-endorsements">
              {totalEndorsements}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skills grouped by proficiency */}
      {totalSkills === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Award className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No skills yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first skill to showcase your expertise
            </p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-skill">
              <Plus className="h-4 w-4 mr-2" />
              Add Skill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(["expert", "advanced", "intermediate", "beginner"] as const).map((level) => {
            const skills = skillsByProficiency[level] || [];
            if (skills.length === 0) return null;

            return (
              <Card key={level}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${proficiencyConfig[level].color}`}
                    />
                    <CardTitle className="text-lg">
                      {proficiencyConfig[level].label} ({skills.length})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {skills.map((userSkill) => (
                      <Card key={userSkill.id} className="hover-elevate">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <CardTitle className="text-base">
                                {userSkill.skill.name}
                              </CardTitle>
                              {userSkill.skill.description && (
                                <CardDescription className="text-xs mt-1">
                                  {userSkill.skill.description}
                                </CardDescription>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenDialog(userSkill)}
                                data-testid={`button-edit-skill-${userSkill.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Remove skill "${userSkill.skill.name}"?`)) {
                                    deleteSkillMutation.mutate(userSkill.id);
                                  }
                                }}
                                disabled={deleteSkillMutation.isPending}
                                data-testid={`button-delete-skill-${userSkill.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2">
                          {userSkill.yearsExperience != null && userSkill.yearsExperience > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              <span>{userSkill.yearsExperience} years experience</span>
                            </div>
                          )}
                          {userSkill.certifications && userSkill.certifications.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {userSkill.certifications.map((cert, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {cert}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {userSkill.lastUsedDate && (
                            <div className="text-xs text-muted-foreground">
                              Last used:{" "}
                              {new Date(userSkill.lastUsedDate).toLocaleDateString()}
                            </div>
                          )}
                          {userSkill.endorsements != null && userSkill.endorsements > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              <span
                                className="text-xs text-muted-foreground"
                                data-testid={`text-endorsements-${userSkill.id}`}
                              >
                                {userSkill.endorsements} endorsement
                                {userSkill.endorsements !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Skill Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-skill-form">
          <DialogHeader>
            <DialogTitle>
              {editingSkill ? "Edit Skill" : "Add Skill"}
            </DialogTitle>
            <DialogDescription>
              {editingSkill
                ? "Update your skill details and proficiency level"
                : "Add a new skill to your professional profile"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Skill Selection (only for new skills) */}
              {!editingSkill && (
                <FormField
                  control={form.control}
                  name="skillId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-skill">
                            <SelectValue placeholder="Select a skill" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {skillsCatalog
                            .filter(
                              (skill) =>
                                !userSkills.some((us) => us.skillId === skill.id)
                            )
                            .map((skill) => (
                              <SelectItem key={skill.id} value={skill.id}>
                                {skill.name}
                                {skill.category && ` (${skill.category})`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Proficiency Level */}
              <FormField
                control={form.control}
                name="proficiencyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proficiency Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-proficiency">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Years Experience */}
              <FormField
                control={form.control}
                name="yearsExperience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Years of Experience</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-years-experience"
                      />
                    </FormControl>
                    <FormDescription>
                      How many years have you worked with this skill?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Certifications */}
              <FormField
                control={form.control}
                name="certifications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certifications (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., CPA, CMA, CIA (comma-separated)"
                        data-testid="input-certifications"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter certifications separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Last Used Date */}
              <FormField
                control={form.control}
                name="lastUsedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Used Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-last-used-date"
                      />
                    </FormControl>
                    <FormDescription>
                      When did you last use this skill professionally?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setEditingSkill(null);
                    form.reset();
                  }}
                  data-testid="button-cancel-skill"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addSkillMutation.isPending || updateSkillMutation.isPending}
                  data-testid="button-save-skill"
                >
                  {addSkillMutation.isPending || updateSkillMutation.isPending
                    ? "Saving..."
                    : editingSkill
                    ? "Update Skill"
                    : "Add Skill"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
