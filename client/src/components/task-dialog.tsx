import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";
import type { InstalledAgentView } from "@shared/schema";

const taskSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["manual", "automated"]),
  status: z.enum(["pending", "in_progress", "completed"]),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().optional(),
  order: z.number().int().min(0),
  aiAgentId: z.string().optional(),
  automationInput: z.string().optional(),
}).refine(
  (data) => {
    // If type is automated, aiAgentId and automationInput are required
    if (data.type === "automated") {
      return !!data.aiAgentId && !!data.automationInput;
    }
    return true;
  },
  {
    message: "AI agent and automation prompt are required for AI-powered tasks",
    path: ["aiAgentId"],
  }
);

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepId: string;
  task?: {
    id: string;
    name: string;
    description?: string;
    status: string;
    priority?: string;
    dueDate?: string;
    order: number;
  };
  tasksCount: number;
}

export function TaskDialog({ open, onOpenChange, stepId, task, tasksCount }: TaskDialogProps) {
  const { toast } = useToast();
  const isEditing = !!task;
  const [selectedTab, setSelectedTab] = useState<string>("manual");

  // Fetch installed AI agents
  const { data: installedAgents = [] } = useQuery<InstalledAgentView[]>({
    queryKey: ['/api/ai-agents/installed'],
  });

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "manual",
      status: "pending",
      priority: undefined,
      dueDate: "",
      order: tasksCount,
      aiAgentId: undefined,
      automationInput: "",
    },
  });

  // Reset form when dialog opens with data
  useEffect(() => {
    if (open && task) {
      const taskData = task as any;
      const taskType = taskData.type || (taskData.aiAgentId ? "automated" : "manual");
      setSelectedTab(taskType);
      form.reset({
        name: task.name,
        description: task.description || "",
        type: taskType,
        status: task.status as any,
        priority: task.priority as any,
        dueDate: task.dueDate || "",
        order: task.order,
        aiAgentId: taskData.aiAgentId || undefined,
        automationInput: taskData.automationInput || "",
      });
    } else if (open && !task) {
      setSelectedTab("manual");
      form.reset({
        name: "",
        description: "",
        type: "manual",
        status: "pending",
        priority: undefined,
        dueDate: "",
        order: tasksCount,
        aiAgentId: undefined,
        automationInput: "",
      });
    }
  }, [open, task, tasksCount, form]);

  // Update type when tab changes
  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    form.setValue("type", value as "manual" | "automated");
    if (value === "manual") {
      form.setValue("aiAgentId", undefined);
      form.setValue("automationInput", "");
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      return await apiRequest("POST", `/api/workflows/steps/${stepId}/tasks`, {
        ...data,
        stepId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/steps", stepId, "tasks"] });
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      return await apiRequest("PATCH", `/api/workflows/tasks/${task!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/steps", stepId, "tasks"] });
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TaskFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-task" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle data-testid="dialog-task-title">
            {isEditing ? "Edit Task" : "Create Task"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the task details below"
              : "Add a new task to this step"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Task Type Tabs */}
            <Tabs value={selectedTab} onValueChange={handleTabChange} data-testid="tabs-task-type">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual" data-testid="tab-manual">
                  Manual Task
                </TabsTrigger>
                <TabsTrigger value="automated" data-testid="tab-automated">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI-Powered
                </TabsTrigger>
              </TabsList>

              {/* Manual Task Content */}
              <TabsContent value="manual" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Review documents"
                          {...field}
                          data-testid="input-task-name"
                        />
                      </FormControl>
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
                          placeholder="Describe what needs to be done..."
                          {...field}
                          data-testid="input-task-description"
                        />
                      </FormControl>
                      <FormDescription>
                        Provide clear instructions for the person completing this task
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* AI-Powered Task Content */}
              <TabsContent value="automated" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Extract invoice data"
                          {...field}
                          data-testid="input-task-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aiAgentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Agent</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-ai-agent">
                            <SelectValue placeholder="Select an AI agent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {installedAgents.length === 0 ? (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                              No AI agents installed.
                              <br />
                              Visit the Marketplace to install agents.
                            </div>
                          ) : (
                            installedAgents.map((agent) => (
                              <SelectItem key={agent.agentId} value={agent.agentId}>
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4" />
                                  {agent.agent?.name}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose which AI agent will execute this task
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="automationInput"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Prompt / Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what you want the AI agent to do..."
                          rows={6}
                          {...field}
                          data-testid="input-automation-prompt"
                        />
                      </FormControl>
                      <FormDescription>
                        Provide detailed instructions for the AI agent. Be specific about what you want it to accomplish.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            {/* Common Fields */}
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-task-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-task-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          data-testid="input-task-due-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-task-order"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-task"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-task"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Task"
                  : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
