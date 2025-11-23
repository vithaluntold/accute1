import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Zap, Power, PowerOff, Settings, Info, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Trigger events
const TRIGGER_EVENTS = [
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'invoice_paid', label: 'Invoice Paid' },
  { value: 'document_uploaded', label: 'Document Uploaded' },
  { value: 'organizer_submitted', label: 'Organizer Submitted' },
  { value: 'form_submitted', label: 'Form Submitted' },
  { value: 'proposal_accepted', label: 'Proposal Accepted' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'step_completed', label: 'Step Completed' },
  { value: 'stage_completed', label: 'Stage Completed' },
  { value: 'scheduled', label: 'Scheduled (Cron)' },
  { value: 'due_date', label: 'Due Date Trigger' },
];

// Action types
const ACTION_TYPES = [
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'assign_task', label: 'Assign Task' },
  { value: 'update_status', label: 'Update Status' },
  { value: 'create_document', label: 'Create Document' },
];

const triggerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  event: z.string().min(1, "Event is required"),
  workflowId: z.string().optional(),
  stageId: z.string().optional(),
  stepId: z.string().optional(),
  autoAdvanceEnabled: z.boolean().default(false),
  autoAdvanceTargetStageId: z.string().optional(),
  autoAdvanceTargetStepId: z.string().optional(),
  actions: z.array(z.object({
    type: z.string(),
    config: z.any(),
  })).optional(),
  // Time-based fields
  cronExpression: z.string().optional(),
  dueDateOffsetDays: z.number().optional(),
});

type TriggerFormValues = z.infer<typeof triggerFormSchema>;

interface AutomationTrigger {
  id: string;
  name: string;
  description?: string;
  event: string;
  isActive: boolean;
  workflowId?: string;
  stageId?: string;
  stepId?: string;
  autoAdvanceEnabled: boolean;
  autoAdvanceTargetStageId?: string;
  autoAdvanceTargetStepId?: string;
  actions?: any[];
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export default function Automation() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<AutomationTrigger | null>(null);

  // Fetch triggers
  const { data: triggers = [], isLoading } = useQuery<AutomationTrigger[]>({
    queryKey: ["/api/automation/triggers"],
  });

  // Fetch workflows for selection
  const { data: workflows = [] } = useQuery<any[]>({
    queryKey: ["/api/workflows"],
  });

  // Fetch workflow stages (when workflow selected)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | undefined>();
  const { data: stagesData = [] } = useQuery<any[]>({
    queryKey: [`/api/workflows/${selectedWorkflowId}/stages`],
    enabled: !!selectedWorkflowId,
  });

  const stages = stagesData;

  // Extract steps from selected stage (for scoped step selection)
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>();

  // Create trigger form
  const form = useForm<TriggerFormValues>({
    resolver: zodResolver(triggerFormSchema),
    defaultValues: {
      name: "",
      description: "",
      event: "",
      workflowId: "",
      stageId: "",
      stepId: "",
      autoAdvanceEnabled: false,
      autoAdvanceTargetStageId: "",
      autoAdvanceTargetStepId: "",
      actions: [],
      cronExpression: "",
      dueDateOffsetDays: 0,
    },
  });

  const selectedEvent = form.watch('event');

  // Derive step arrays (must be after form definition)
  const scopedSteps = selectedStageId 
    ? (stages.find((s: any) => s.id === selectedStageId)?.steps || [])
    : [];

  const targetStageId = form.watch('autoAdvanceTargetStageId');
  const targetSteps = targetStageId 
    ? (stages.find((s: any) => s.id === targetStageId)?.steps || [])
    : [];

  // Create trigger mutation
  const createTrigger = useMutation({
    mutationFn: async (data: TriggerFormValues) => {
      const res = await apiRequest('POST', '/api/automation/triggers', {
        ...data,
        workflowId: data.workflowId || null,
        stageId: data.stageId || null,
        stepId: data.stepId || null,
        autoAdvanceTargetStageId: data.autoAdvanceTargetStageId || null,
        autoAdvanceTargetStepId: data.autoAdvanceTargetStepId || null,
        actions: data.actions || [],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/triggers'] });
      toast({
        title: 'Success',
        description: 'Automation trigger created successfully',
      });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create trigger',
        variant: 'destructive',
      });
    },
  });

  // Update trigger mutation
  const updateTrigger = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TriggerFormValues> }) => {
      const res = await apiRequest('PUT', `/api/automation/triggers/${id}`, {
        ...data,
        workflowId: data.workflowId || null,
        stageId: data.stageId || null,
        stepId: data.stepId || null,
        autoAdvanceTargetStageId: data.autoAdvanceTargetStageId || null,
        autoAdvanceTargetStepId: data.autoAdvanceTargetStepId || null,
        actions: data.actions || [],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/triggers'] });
      toast({
        title: 'Success',
        description: 'Automation trigger updated successfully',
      });
      setEditingTrigger(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update trigger',
        variant: 'destructive',
      });
    },
  });

  // Delete trigger mutation
  const deleteTrigger = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/automation/triggers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/triggers'] });
      toast({
        title: 'Success',
        description: 'Automation trigger deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete trigger',
        variant: 'destructive',
      });
    },
  });

  // Toggle trigger mutation
  const toggleTrigger = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/automation/triggers/${id}/toggle`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation/triggers'] });
      toast({
        title: 'Success',
        description: 'Trigger status updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle trigger',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: TriggerFormValues) => {
    if (editingTrigger) {
      updateTrigger.mutate({ id: editingTrigger.id, data });
    } else {
      createTrigger.mutate(data);
    }
  };

  // Handle edit
  const handleEdit = (trigger: AutomationTrigger) => {
    setEditingTrigger(trigger);
    form.reset({
      name: trigger.name,
      description: trigger.description || "",
      event: trigger.event,
      workflowId: trigger.workflowId || "",
      stageId: trigger.stageId || "",
      stepId: trigger.stepId || "",
      autoAdvanceEnabled: trigger.autoAdvanceEnabled,
      autoAdvanceTargetStageId: trigger.autoAdvanceTargetStageId || "",
      autoAdvanceTargetStepId: trigger.autoAdvanceTargetStepId || "",
      actions: trigger.actions || [],
    });
    setSelectedWorkflowId(trigger.workflowId);
    setSelectedStageId(trigger.stageId);
  };

  // Handle delete
  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteTrigger.mutate(id);
    }
  };

  // Handle workflow selection
  const handleWorkflowChange = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    form.setValue('workflowId', workflowId);
    form.setValue('stageId', "");
    form.setValue('stepId', "");
    setSelectedStageId(undefined);
  };

  // Handle stage selection
  const handleStageChange = (stageId: string) => {
    setSelectedStageId(stageId);
    form.setValue('stageId', stageId);
    form.setValue('stepId', "");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-automation">
            <Zap className="h-8 w-8 text-primary" />
            Workflow Automation
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-automation-description">
            Configure event-driven triggers to automate your workflows
          </p>
        </div>
        <Dialog open={createDialogOpen || !!editingTrigger} onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingTrigger(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-trigger">
              <Plus className="h-4 w-4 mr-2" />
              Create Trigger
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-trigger">
                {editingTrigger ? 'Edit Automation Trigger' : 'Create Automation Trigger'}
              </DialogTitle>
              <DialogDescription data-testid="dialog-description-trigger">
                Configure when and how to automate your workflow
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
                        <Input {...field} placeholder="Auto-advance on payment" data-testid="input-trigger-name" />
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
                        <Textarea {...field} placeholder="Move workflow to next stage when payment is received" data-testid="input-trigger-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="event"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trigger Event</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-trigger-event">
                            <SelectValue placeholder="Select an event" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRIGGER_EVENTS.map((event) => (
                            <SelectItem key={event.value} value={event.value}>
                              {event.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the event that will trigger this automation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                
                {/* Time-Based Configuration */}
                {selectedEvent === 'scheduled' && (
                  <FormField
                    control={form.control}
                    name="cronExpression"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cron Expression</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0 9 * * *" data-testid="input-cron-expression" />
                        </FormControl>
                        <FormDescription>
                          Unix cron format (e.g., "0 9 * * *" for daily at 9am)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {selectedEvent === 'due_date' && (
                  <FormField
                    control={form.control}
                    name="dueDateOffsetDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days Before Due Date</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="3"
                            data-testid="input-due-date-offset"
                          />
                        </FormControl>
                        <FormDescription>
                          Trigger X days before task due date (e.g., 3 = 3 days before)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Scope (Optional)</h3>
                  <p className="text-sm text-muted-foreground">
                    Restrict this trigger to a specific workflow, stage, or step
                  </p>

                  <FormField
                    control={form.control}
                    name="workflowId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workflow</FormLabel>
                        <Select onValueChange={handleWorkflowChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-trigger-workflow">
                              <SelectValue placeholder="Any workflow" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Any workflow</SelectItem>
                            {workflows.map((workflow) => (
                              <SelectItem key={workflow.id} value={workflow.id}>
                                {workflow.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedWorkflowId && (
                    <FormField
                      control={form.control}
                      name="stageId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stage</FormLabel>
                          <Select onValueChange={handleStageChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-trigger-stage">
                                <SelectValue placeholder="Any stage" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Any stage</SelectItem>
                              {stages.map((stage: any) => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  {stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {selectedStageId && (
                    <FormField
                      control={form.control}
                      name="stepId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Step</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-trigger-step">
                                <SelectValue placeholder="Any step" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Any step</SelectItem>
                              {scopedSteps.map((step: any) => (
                                <SelectItem key={step.id} value={step.id}>
                                  {step.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="autoAdvanceEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Auto-Advance Workflow
                          </FormLabel>
                          <FormDescription>
                            Automatically move to a target stage when this event occurs
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-auto-advance"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("autoAdvanceEnabled") && (
                    <>
                      <FormField
                        control={form.control}
                        name="autoAdvanceTargetStageId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Stage</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-target-stage">
                                  <SelectValue placeholder="Select target stage" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {stages.map((stage: any) => (
                                  <SelectItem key={stage.id} value={stage.id}>
                                    {stage.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The workflow will move to this stage
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="autoAdvanceTargetStepId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Step (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-target-step">
                                  <SelectValue placeholder="Select target step" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {targetSteps.map((step: any) => (
                                  <SelectItem key={step.id} value={step.id}>
                                    {step.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Optionally specify a target step within the stage
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Actions</h3>
                      <p className="text-sm text-muted-foreground">
                        Define what happens when this trigger fires
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentActions = form.getValues('actions') || [];
                        form.setValue('actions', [
                          ...currentActions,
                          { type: 'send_notification', config: { title: '', message: '' } }
                        ]);
                      }}
                      data-testid="button-add-action"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Action
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="actions"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-3">
                            {(field.value || []).map((action: any, index: number) => (
                              <Card key={index} className="p-4" data-testid={`action-card-${index}`}>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Select
                                      value={action.type}
                                      onValueChange={(value) => {
                                        const newActions = [...(field.value || [])];
                                        newActions[index] = {
                                          type: value,
                                          config: value === 'send_notification' 
                                            ? { title: '', message: '' }
                                            : value === 'send_email'
                                            ? { to: '', subject: '', body: '' }
                                            : value === 'assign_task'
                                            ? { userId: '', taskName: '' }
                                            : value === 'update_status'
                                            ? { status: '' }
                                            : { documentType: '' }
                                        };
                                        form.setValue('actions', newActions);
                                      }}
                                    >
                                      <SelectTrigger className="w-[200px]" data-testid={`select-action-type-${index}`}>
                                        <SelectValue placeholder="Select action type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ACTION_TYPES.map((type) => (
                                          <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const newActions = (field.value || []).filter((_: any, i: number) => i !== index);
                                        form.setValue('actions', newActions);
                                      }}
                                      data-testid={`button-delete-action-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>

                                  {/* Action-specific configuration fields */}
                                  {action.type === 'send_notification' && (
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="Notification title"
                                        value={action.config.title || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.title = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-notification-title-${index}`}
                                      />
                                      <Textarea
                                        placeholder="Notification message"
                                        value={action.config.message || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.message = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-notification-message-${index}`}
                                      />
                                    </div>
                                  )}

                                  {action.type === 'send_email' && (
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="Recipient email"
                                        type="email"
                                        value={action.config.to || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.to = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-email-to-${index}`}
                                      />
                                      <Input
                                        placeholder="Email subject"
                                        value={action.config.subject || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.subject = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-email-subject-${index}`}
                                      />
                                      <Textarea
                                        placeholder="Email body"
                                        value={action.config.body || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.body = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-email-body-${index}`}
                                      />
                                    </div>
                                  )}

                                  {action.type === 'assign_task' && (
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="User ID"
                                        value={action.config.userId || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.userId = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-task-user-${index}`}
                                      />
                                      <Input
                                        placeholder="Task name"
                                        value={action.config.taskName || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.taskName = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-task-name-${index}`}
                                      />
                                    </div>
                                  )}

                                  {action.type === 'update_status' && (
                                    <div className="space-y-2">
                                      <Select
                                        value={action.config.status || ''}
                                        onValueChange={(value) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.status = value;
                                          form.setValue('actions', newActions);
                                        }}
                                      >
                                        <SelectTrigger data-testid={`select-status-${index}`}>
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="in_progress">In Progress</SelectItem>
                                          <SelectItem value="completed">Completed</SelectItem>
                                          <SelectItem value="on_hold">On Hold</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {action.type === 'create_document' && (
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="Document type"
                                        value={action.config.documentType || ''}
                                        onChange={(e) => {
                                          const newActions = [...(field.value || [])];
                                          newActions[index].config.documentType = e.target.value;
                                          form.setValue('actions', newActions);
                                        }}
                                        data-testid={`input-document-type-${index}`}
                                      />
                                    </div>
                                  )}
                                </div>
                              </Card>
                            ))}
                            {(!field.value || field.value.length === 0) && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No actions configured. Add an action to get started.
                              </p>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setCreateDialogOpen(false);
                      setEditingTrigger(null);
                      form.reset();
                    }}
                    data-testid="button-cancel-trigger"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTrigger.isPending || updateTrigger.isPending}
                    data-testid="button-save-trigger"
                  >
                    {editingTrigger ? 'Update Trigger' : 'Create Trigger'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">About Workflow Automation</h3>
              <p className="text-sm text-muted-foreground">
                Automation triggers listen for specific events and automatically execute actions or advance workflows. 
                This helps eliminate manual work and ensures workflows progress smoothly through each stage.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Triggers List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading automation triggers...</p>
        </div>
      ) : triggers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Automation Triggers</h3>
            <p className="text-muted-foreground mb-6">
              Get started by creating your first automation trigger
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-trigger">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Trigger
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {triggers.map((trigger) => (
            <Card key={trigger.id} className="hover-elevate" data-testid={`trigger-card-${trigger.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl" data-testid={`trigger-name-${trigger.id}`}>
                        {trigger.name}
                      </CardTitle>
                      <Badge
                        variant={trigger.isActive ? "default" : "outline"}
                        data-testid={`trigger-status-${trigger.id}`}
                      >
                        {trigger.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {trigger.autoAdvanceEnabled && (
                        <Badge variant="secondary" data-testid={`trigger-auto-advance-${trigger.id}`}>
                          Auto-Advance
                        </Badge>
                      )}
                    </div>
                    <CardDescription data-testid={`trigger-description-${trigger.id}`}>
                      {trigger.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleTrigger.mutate(trigger.id)}
                      data-testid={`button-toggle-${trigger.id}`}
                    >
                      {trigger.isActive ? (
                        <PowerOff className="h-4 w-4 text-destructive" />
                      ) : (
                        <Power className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(trigger)}
                      data-testid={`button-edit-${trigger.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(trigger.id, trigger.name)}
                      data-testid={`button-delete-${trigger.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Event:</span>
                    <Badge variant="outline" data-testid={`trigger-event-${trigger.id}`}>
                      {TRIGGER_EVENTS.find(e => e.value === trigger.event)?.label || trigger.event}
                    </Badge>
                  </div>
                  {trigger.workflowId && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Workflow:</span>
                      <span data-testid={`trigger-workflow-${trigger.id}`}>
                        {workflows.find(w => w.id === trigger.workflowId)?.name || 'Unknown'}
                      </span>
                    </div>
                  )}
                  {trigger.autoAdvanceEnabled && trigger.autoAdvanceTargetStageId && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Advances to:</span>
                      <span data-testid={`trigger-target-stage-${trigger.id}`}>
                        {stages.find(s => s.id === trigger.autoAdvanceTargetStageId)?.name || 'Unknown Stage'}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
