import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FormTemplate } from "@shared/schema";
import { FormRenderer } from "@/components/form-renderer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye } from "lucide-react";

export default function FormPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: formTemplate, isLoading } = useQuery<FormTemplate>({
    queryKey: ["/api/forms", id],
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: async (formData: Record<string, any>) => {
      if (!id) throw new Error("Form ID is required");
      return apiRequest("POST", `/api/forms/${id}/submit`, { data: formData });
    },
    onSuccess: () => {
      toast({
        title: "Form submitted successfully",
        description: "Thank you for your submission!",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading form...</div>
      </div>
    );
  }

  if (!formTemplate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Eye className="h-12 w-12 text-muted-foreground" />
        <div className="text-muted-foreground">Form not found</div>
        <Button onClick={() => setLocation("/forms")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Forms
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setLocation("/forms")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Forms
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            Preview Mode
          </div>
        </div>

        {/* Form Renderer */}
        <FormRenderer
          formTemplate={formTemplate}
          onSubmit={(data) => submitMutation.mutate(data)}
          isSubmitting={submitMutation.isPending}
        />
      </div>
    </div>
  );
}
