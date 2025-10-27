import { useEffect } from "react";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const stepSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  order: z.number().int().min(0),
});

type StepFormData = z.infer<typeof stepSchema>;

interface StepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  stageId: string;
  step?: {
    id: string;
    name: string;
    description?: string;
    order: number;
  };
  stepsCount: number;
}

export function StepDialog({ open, onOpenChange, workflowId, stageId, step, stepsCount }: StepDialogProps) {
  const { toast } = useToast();
  const isEditing = !!step;

  const form = useForm<StepFormData>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      name: "",
      description: "",
      order: stepsCount,
    },
  });

  // Reset form when dialog opens with data
  useEffect(() => {
    if (open && step) {
      form.reset({
        name: step.name,
        description: step.description || "",
        order: step.order,
      });
    } else if (open && !step) {
      form.reset({
        name: "",
        description: "",
        order: stepsCount,
      });
    }
  }, [open, step, stepsCount, form]);

  const createMutation = useMutation({
    mutationFn: async (data: StepFormData) => {
      return await apiRequest("POST", `/api/workflows/stages/${stageId}/steps`, {
        ...data,
        stageId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages", stageId, "steps"] });
      toast({
        title: "Success",
        description: "Step created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create step",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StepFormData) => {
      return await apiRequest("PATCH", `/api/workflows/steps/${step!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages", stageId, "steps"] });
      toast({
        title: "Success",
        description: "Step updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update step",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StepFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-step">
        <DialogHeader>
          <DialogTitle data-testid="dialog-step-title">
            {isEditing ? "Edit Step" : "Create Step"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the step details below"
              : "Add a new step to this stage"}
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
                      placeholder="e.g., Document Collection"
                      {...field}
                      data-testid="input-step-name"
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what happens in this step..."
                      {...field}
                      data-testid="input-step-description"
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
                      data-testid="input-step-order"
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
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-step"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-step"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Step"
                  : "Create Step"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
