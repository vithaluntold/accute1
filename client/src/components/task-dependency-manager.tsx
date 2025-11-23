import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, GitBranch, Clock } from "lucide-react";

const dependencyFormSchema = z.object({
  taskId: z.string().min(1, "Task is required"),
  dependsOnTaskId: z.string().min(1, "Depends on task is required"),
  dependencyType: z.enum(["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"]),
  lagDays: z.number().min(0).default(0),
  isBlocking: z.boolean().default(true),
});

type DependencyFormValues = z.infer<typeof dependencyFormSchema>;

interface TaskDependencyProps {
  workflowId: string;
  tasks: Array<{ id: string; name: string; status: string }>;
}

export function TaskDependencyManager({ workflowId, tasks }: TaskDependencyProps) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: dependencies = [], isLoading } = useQuery({
    queryKey: ["/api/workflows/task-dependencies", workflowId],
  });

  const form = useForm<DependencyFormValues>({
    resolver: zodResolver(dependencyFormSchema),
    defaultValues: {
      taskId: "",
      dependsOnTaskId: "",
      dependencyType: "finish_to_start",
      lagDays: 0,
      isBlocking: true,
    },
  });

  const createDependency = useMutation({
    mutationFn: async (data: DependencyFormValues) => {
      const res = await apiRequest("POST", "/api/workflows/task-dependencies", {
        ...data,
        workflowId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/task-dependencies", workflowId] });
      toast({ title: "Success", description: "Dependency created successfully" });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create dependency",
        variant: "destructive",
      });
    },
  });

  const deleteDependency = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/workflows/task-dependencies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/task-dependencies", workflowId] });
      toast({ title: "Success", description: "Dependency deleted" });
    },
  });

  const onSubmit = (data: DependencyFormValues) => {
    createDependency.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="heading-task-dependencies">
            <GitBranch className="h-5 w-5" />
            Task Dependencies
          </h3>
          <p className="text-sm text-muted-foreground">
            Define which tasks must complete before others can start
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-dependency">
              <Plus className="h-4 w-4 mr-2" />
              Add Dependency
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Task Dependency</DialogTitle>
              <DialogDescription>
                Configure a dependency relationship between two tasks
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="taskId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dependent Task</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-dependent-task">
                            <SelectValue placeholder="Select task" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tasks.map((task) => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dependsOnTaskId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depends On Task</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-dependency-task">
                            <SelectValue placeholder="Select task" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tasks.map((task) => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dependencyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dependency Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-dependency-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="finish_to_start">Finish to Start</SelectItem>
                          <SelectItem value="start_to_start">Start to Start</SelectItem>
                          <SelectItem value="finish_to_finish">Finish to Finish</SelectItem>
                          <SelectItem value="start_to_finish">Start to Finish</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lagDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lag (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-lag-days"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={createDependency.isPending} data-testid="button-save-dependency">
                    {createDependency.isPending ? "Creating..." : "Create Dependency"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Loading dependencies...</CardContent></Card>
      ) : dependencies.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">No task dependencies configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add dependencies to control task execution order
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {dependencies.map((dep: any) => (
            <Card key={dep.id} className="hover-elevate" data-testid={`dependency-card-${dep.id}`}>
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-sm font-medium mb-1" data-testid={`dependency-name-${dep.id}`}>
                      {dep.task?.name} → {dep.dependsOn?.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{dep.dependencyType.replace("_", " ")}</Badge>
                      {dep.lagDays > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {dep.lagDays}d lag
                        </Badge>
                      )}
                      <Badge variant={dep.isBlocking ? "default" : "outline"} className="text-xs">
                        {dep.isBlocking ? "Blocking" : "Non-blocking"}
                      </Badge>
                      {dep.isSatisfied && (
                        <Badge variant="secondary" className="text-xs">Satisfied</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteDependency.mutate(dep.id)}
                    data-testid={`button-delete-dependency-${dep.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
