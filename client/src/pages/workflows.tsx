import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Play, Edit, Trash2, Copy, Workflow } from "lucide-react";

export default function Workflows() {
  const { data: workflows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/workflows"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Workflows</h1>
          <p className="text-muted-foreground">
            Automate your accounting processes with AI-powered workflows
          </p>
        </div>
        <Button data-testid="button-create-workflow">
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            className="pl-9"
            data-testid="input-search-workflows"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" data-testid="button-filter-all">
            All
          </Button>
          <Button variant="outline" size="sm" data-testid="button-filter-active">
            Active
          </Button>
          <Button variant="outline" size="sm" data-testid="button-filter-draft">
            Draft
          </Button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Workflow className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2" data-testid="text-no-workflows">
              No workflows yet
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create your first workflow to automate client onboarding, tax preparation,
              bookkeeping, and more
            </p>
            <Button data-testid="button-create-first-workflow">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow: any) => (
            <Card key={workflow.id} className="hover-elevate" data-testid={`workflow-card-${workflow.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl" data-testid={`workflow-name-${workflow.id}`}>
                        {workflow.name}
                      </CardTitle>
                      <Badge
                        variant={workflow.isActive ? "default" : "outline"}
                        data-testid={`workflow-status-${workflow.id}`}
                      >
                        {workflow.isActive ? "Active" : "Draft"}
                      </Badge>
                    </div>
                    <CardDescription data-testid={`workflow-description-${workflow.id}`}>
                      {workflow.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-run-workflow-${workflow.id}`}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-edit-workflow-${workflow.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-copy-workflow-${workflow.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-delete-workflow-${workflow.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Version:</span> {workflow.version || 1}
                  </div>
                  <div>
                    <span className="font-medium">Trigger:</span>{" "}
                    {workflow.trigger || "Manual"}
                  </div>
                  <div>
                    <span className="font-medium">Last updated:</span>{" "}
                    {workflow.updatedAt
                      ? new Date(workflow.updatedAt).toLocaleDateString()
                      : "Never"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
