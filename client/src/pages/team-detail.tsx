import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { Team, TeamMember, User } from "@shared/schema";

const addMemberSchema = z.object({
  userId: z.string().min(1, "Please select a user"),
  role: z.enum(["manager", "member"]),
});

type AddMemberFormValues = z.infer<typeof addMemberSchema>;

type TeamMemberWithUser = TeamMember & { user: User };

export default function TeamDetailPage() {
  const [, params] = useRoute("/teams/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const teamId = params?.id;

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<TeamMemberWithUser | null>(null);

  const { data: team } = useQuery<Team>({
    queryKey: ["/api/teams", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
    enabled: !!teamId,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMemberWithUser[]>({
    queryKey: ["/api/teams", teamId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!teamId,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const addMemberForm = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      userId: "",
      role: "member",
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: AddMemberFormValues) => {
      return await apiRequest("POST", `/api/teams/${teamId}/members`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "members"] });
      setIsAddMemberOpen(false);
      addMemberForm.reset();
      toast({
        title: "Member added",
        description: "Team member has been added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add team member",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      return await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "members"] });
      setRemovingMember(null);
      toast({
        title: "Member removed",
        description: "Team member has been removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: string; userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/teams/${teamId}/members/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "members"] });
      toast({
        title: "Role updated",
        description: "Member role has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    },
  });

  const handleAddMember = (data: AddMemberFormValues) => {
    addMemberMutation.mutate(data);
  };

  const handleRemoveMember = () => {
    if (removingMember && teamId) {
      removeMemberMutation.mutate({ teamId, userId: removingMember.userId });
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    if (teamId) {
      updateRoleMutation.mutate({ teamId, userId, role: newRole });
    }
  };

  const availableUsers = allUsers.filter(
    (user) => !members.some((member) => member.userId === user.id)
  );

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (!team) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/teams")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{team.name}</h1>
          {team.description && (
            <p className="text-muted-foreground">{team.description}</p>
          )}
        </div>
        <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-member">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-member">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add a new member to this team
              </DialogDescription>
            </DialogHeader>
            <Form {...addMemberForm}>
              <form onSubmit={addMemberForm.handleSubmit(handleAddMember)} className="space-y-4">
                <FormField
                  control={addMemberForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user">
                            <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addMemberForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
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
                    onClick={() => setIsAddMemberOpen(false)}
                    data-testid="button-cancel-add"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addMemberMutation.isPending}
                    data-testid="button-submit-add"
                  >
                    {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? "member" : "members"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <p className="text-muted-foreground text-center py-4">Loading members...</p>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No members in this team yet</p>
              <Button onClick={() => setIsAddMemberOpen(true)} data-testid="button-add-first-member">
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Member
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} data-testid={`row-member-${member.userId}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(member.user.firstName, member.user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {member.user.firstName} {member.user.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.userId, value)}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-member-role-${member.userId}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">
                            <Badge variant="secondary">Member</Badge>
                          </SelectItem>
                          <SelectItem value="manager">
                            <Badge>Manager</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRemovingMember(member)}
                        data-testid={`button-remove-${member.userId}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent data-testid="dialog-remove-member">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {removingMember?.user.firstName} {removingMember?.user.lastName} from this team?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
