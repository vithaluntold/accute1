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

const stageSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  order: z.number().int().min(0),
});

type StageFormData = z.infer<typeof stageSchema>;

interface StageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
  stage?: {
    id: string;
    name: string;
    description?: string;
    order: number;
  };
  stagesCount: number;
}

export function StageDialog({ open, onOpenChange, workflowId, stage, stagesCount }: StageDialogProps) {
  const { toast } = useToast();
  const isEditing = !!stage;

  const form = useForm<StageFormData>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: "",
      description: "",
      order: stagesCount,
    },
  });

  // Reset form when dialog opens with data
  useEffect(() => {
    if (open && stage) {
      form.reset({
        name: stage.name,
        description: stage.description || "",
        order: stage.order,
      });
    } else if (open && !stage) {
      form.reset({
        name: "",
        description: "",
        order: stagesCount,
      });
    }
  }, [open, stage, stagesCount, form]);

  const createMutation = useMutation({
    mutationFn: async (data: StageFormData) => {
      return await apiRequest("POST", `/api/workflows/${workflowId}/stages`, {
        ...data,
        workflowId,
      });
    },
    onSuccess: () => {
      // Invalidate multiple related queries to ensure UI refreshes
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Success",
        description: "Stage created successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create stage",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StageFormData) => {
      return await apiRequest("PATCH", `/api/workflows/stages/${stage!.id}`, data);
    },
    onSuccess: () => {
      // Invalidate multiple related queries to ensure UI refreshes
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      toast({
        title: "Success",
        description: "Stage updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update stage",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StageFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-stage">
        <DialogHeader>
          <DialogTitle data-testid="dialog-stage-title">
            {isEditing ? "Edit Stage" : "Create Stage"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the stage details below"
              : "Add a new stage to your workflow"}
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
                      placeholder="e.g., Initial Review"
                      {...field}
                      data-testid="input-stage-name"
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
                      placeholder="Describe what happens in this stage..."
                      {...field}
                      data-testid="input-stage-description"
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
                      value={field.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === "" ? 0 : parseInt(val, 10));
                      }}
                      data-testid="input-stage-order"
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
                data-testid="button-cancel-stage"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-stage"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Stage"
                  : "Create Stage"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
