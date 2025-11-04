import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { User, SupervisorRelationship } from "@shared/schema";

const supervisionSchema = z.object({
  supervisorId: z.string().min(1, "Please select a supervisor"),
  reporteeIds: z.array(z.string()).min(1, "Please select at least one reportee"),
  level: z.coerce.number().min(1).max(5).default(1),
});

type SupervisionFormValues = z.infer<typeof supervisionSchema>;

export default function TeamHierarchyPage() {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingRelationship, setDeletingRelationship] = useState<{ supervisor: User; reportee: User } | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: allSupervisors = [] } = useQuery<{ user: User; reportees: User[] }[]>({
    queryKey: ["/api/supervision/all"],
    queryFn: async () => {
      const supervisors = await Promise.all(
        users.map(async (user) => {
          const res = await fetch(`/api/users/${user.id}/reportees`, {
            credentials: "include",
          });
          const reportees = res.ok ? await res.json() : [];
          return { user, reportees };
        })
      );
      return supervisors.filter((s) => s.reportees.length > 0);
    },
    enabled: users.length > 0,
  });

  const addForm = useForm<SupervisionFormValues>({
    resolver: zodResolver(supervisionSchema),
    defaultValues: {
      supervisorId: "",
      reporteeIds: [],
      level: 1,
    },
  });

  const selectedSupervisorId = addForm.watch("supervisorId");

  const addMutation = useMutation({
    mutationFn: async (data: SupervisionFormValues) => {
      // Create supervision relationships for each selected reportee
      const promises = data.reporteeIds.map((reporteeId) =>
        apiRequest("POST", "/api/supervision", {
          supervisorId: data.supervisorId,
          reporteeId: reporteeId,
          level: data.level,
        }).then((result) => ({ status: 'fulfilled', value: result }))
          .catch((error) => ({ status: 'rejected', reason: error }))
      );
      const results = await Promise.all(promises);
      
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');
      
      return { successes, failures, total: data.reporteeIds.length };
    },
    onSuccess: (results, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervision/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddOpen(false);
      addForm.reset();
      
      const successCount = results.successes.length;
      const failureCount = results.failures.length;
      
      if (failureCount === 0) {
        toast({
          title: "Relationships added",
          description: `${successCount} supervision relationship${successCount > 1 ? 's' : ''} created successfully`,
        });
      } else if (successCount > 0) {
        toast({
          title: "Partial success",
          description: `${successCount} relationship${successCount > 1 ? 's' : ''} created, ${failureCount} already existed or failed`,
        });
      } else {
        toast({
          title: "No relationships created",
          description: "All selected reportees may already have this supervisor",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create supervision relationships",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ supervisorId, reporteeId }: { supervisorId: string; reporteeId: string }) => {
      return await apiRequest("DELETE", `/api/supervision/${supervisorId}/${reporteeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supervision/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeletingRelationship(null);
      toast({
        title: "Relationship removed",
        description: "Supervision relationship has been removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove supervision relationship",
        variant: "destructive",
      });
    },
  });

  const handleAdd = (data: SupervisionFormValues) => {
    if (data.reporteeIds.includes(data.supervisorId)) {
      toast({
        title: "Invalid relationship",
        description: "A user cannot supervise themselves",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate(data);
  };

  const handleDelete = () => {
    if (deletingRelationship) {
      deleteMutation.mutate({
        supervisorId: deletingRelationship.supervisor.id,
        reporteeId: deletingRelationship.reportee.id,
      });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Get existing reportees for the selected supervisor
  const existingReporteeIds = selectedSupervisorId
    ? allSupervisors.find((s) => s.user.id === selectedSupervisorId)?.reportees.map((r) => r.id) || []
    : [];

  // Filter out the supervisor themselves AND users already assigned to this supervisor
  const availableReportees = users.filter(
    (user) => user.id !== selectedSupervisorId && !existingReporteeIds.includes(user.id)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Team Hierarchy</h1>
          <p className="text-muted-foreground">
            Manage supervisor-reportee relationships across teams
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-supervision">
              <Plus className="h-4 w-4 mr-2" />
              Add Relationship
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-supervision">
            <DialogHeader>
              <DialogTitle>Add Supervision Relationship</DialogTitle>
              <DialogDescription>
                Create a new supervisor-reportee relationship
              </DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="supervisorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supervisor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-supervisor">
                            <SelectValue placeholder="Select a supervisor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
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
                  control={addForm.control}
                  name="reporteeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reportees</FormLabel>
                      <FormDescription>
                        Select one or more employees who report to the supervisor
                      </FormDescription>
                      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-4">
                        {availableReportees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No available employees to select
                          </p>
                        ) : (
                          availableReportees.map((user) => (
                            <FormItem
                              key={user.id}
                              className="flex items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  data-testid={`checkbox-reportee-${user.id}`}
                                  checked={field.value?.includes(user.id)}
                                  onCheckedChange={(checked) => {
                                    const currentValue = field.value || [];
                                    const newValue = checked
                                      ? [...currentValue, user.id]
                                      : currentValue.filter((id) => id !== user.id);
                                    field.onChange(newValue);
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {user.firstName} {user.lastName} ({user.email})
                              </FormLabel>
                            </FormItem>
                          ))
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-level">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Level 1 (Direct)</SelectItem>
                          <SelectItem value="2">Level 2</SelectItem>
                          <SelectItem value="3">Level 3</SelectItem>
                          <SelectItem value="4">Level 4</SelectItem>
                          <SelectItem value="5">Level 5</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Supervision depth in the hierarchy
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                    data-testid="button-cancel-add"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addMutation.isPending}
                    data-testid="button-submit-add"
                  >
                    {addMutation.isPending ? "Adding..." : "Add Relationship"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {allSupervisors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Network className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No supervision relationships</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first supervisor-reportee relationship
            </p>
            <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-first-supervision">
              <Plus className="h-4 w-4 mr-2" />
              Add First Relationship
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allSupervisors.map(({ user: supervisor, reportees }) => (
            <Card key={supervisor.id} data-testid={`card-supervisor-${supervisor.id}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(supervisor.firstName, supervisor.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>
                      {supervisor.firstName} {supervisor.lastName}
                    </CardTitle>
                    <CardDescription>{supervisor.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="font-semibold mb-3">Reportees ({reportees.length})</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportees.map((reportee) => (
                      <TableRow key={reportee.id} data-testid={`row-reportee-${reportee.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(reportee.firstName, reportee.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {reportee.firstName} {reportee.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{reportee.email}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeletingRelationship({ supervisor, reportee })
                            }
                            data-testid={`button-remove-${reportee.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deletingRelationship}
        onOpenChange={() => setDeletingRelationship(null)}
      >
        <AlertDialogContent data-testid="dialog-remove-supervision">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Supervision Relationship</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the supervision relationship between{" "}
              {deletingRelationship?.supervisor.firstName}{" "}
              {deletingRelationship?.supervisor.lastName} and{" "}
              {deletingRelationship?.reportee.firstName}{" "}
              {deletingRelationship?.reportee.lastName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
