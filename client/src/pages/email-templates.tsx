import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function EmailTemplatesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/email-templates"],
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/email-templates", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setDialogOpen(false);
      toast({ title: "Email template created successfully" });
    },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display">Email Templates</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-template">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Email Template</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createTemplateMutation.mutate({
                  name: formData.get("name"),
                  category: formData.get("category"),
                  subject: formData.get("subject"),
                  body: formData.get("body"),
                  variables: [],
                  isActive: true,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label>Template Name</Label>
                <Input name="name" placeholder="Welcome Email" required data-testid="input-name" />
              </div>
              <div>
                <Label>Category</Label>
                <Select name="category" required>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="signature_request">Signature Request</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Input name="subject" placeholder="Welcome to {{company_name}}" required data-testid="input-subject" />
              </div>
              <div>
                <Label>Body</Label>
                <Textarea
                  name="body"
                  placeholder="Dear {{client_name}},..."
                  className="min-h-48"
                  required
                  data-testid="input-body"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use variables like [[client_name]], [[company_name]]
                </p>
              </div>
              <Button type="submit" className="w-full" data-testid="button-create-template">
                Create Template
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <p>Loading templates...</p>
        ) : templates?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <Mail className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-muted-foreground">No email templates yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          templates?.map((template: any) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{template.name}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="capitalize">{template.category}</Badge>
                    <Badge variant={template.isActive ? "default" : "secondary"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium">Subject:</p>
                    <p className="text-sm text-muted-foreground">{template.subject}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Body Preview:</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">{template.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
