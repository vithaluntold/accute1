import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientHero } from "@/components/gradient-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

interface ClientForm {
  id: string;
  formName: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  dueDate: string | null;
  assignedAt: string;
  completedAt: string | null;
}

export default function ClientMyForms() {
  const [, setLocation] = useLocation();

  const { data: forms = [], isLoading } = useQuery<ClientForm[]>({
    queryKey: ["/api/client-portal/forms"],
  });

  const pendingForms = forms.filter((f) => f.status === "pending" || f.status === "in_progress");
  const completedForms = forms.filter((f) => f.status === "completed");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "in_progress":
        return <Badge variant="default">In Progress</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="h-full overflow-auto">
      <GradientHero
        icon={FileText}
        title="My Forms"
        description="Complete and track forms assigned to you"
        testId="client-forms"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-all-forms">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">All Forms</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-all-forms">
                {forms.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-forms">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-forms">
                {pendingForms.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-completed-forms">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-completed-forms">
                {completedForms.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Forms */}
        <Card data-testid="card-pending-forms-list">
          <CardHeader>
            <CardTitle>Pending Forms</CardTitle>
            <CardDescription>Forms requiring your completion</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading forms...
              </div>
            ) : pendingForms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-pending">
                No pending forms
              </div>
            ) : (
              <div className="space-y-3">
                {pendingForms.map((form) => (
                  <div
                    key={form.id}
                    className="p-4 rounded-lg border hover-elevate"
                    data-testid={`form-${form.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{form.formName}</h3>
                          {getStatusBadge(form.status)}
                        </div>
                        {form.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {form.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Assigned: {new Date(form.assignedAt).toLocaleDateString()}
                          </div>
                          {form.dueDate && (
                            <div className="flex items-center gap-1">
                              Due: {new Date(form.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setLocation(`/client-portal/forms/${form.id}/submit`)}
                        data-testid={`button-complete-form-${form.id}`}
                      >
                        {form.status === "in_progress" ? "Continue" : "Start"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Forms */}
        <Card data-testid="card-completed-forms-list">
          <CardHeader>
            <CardTitle>Completed Forms</CardTitle>
            <CardDescription>Forms you have already submitted</CardDescription>
          </CardHeader>
          <CardContent>
            {completedForms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-completed">
                No completed forms
              </div>
            ) : (
              <div className="space-y-3">
                {completedForms.map((form) => (
                  <div
                    key={form.id}
                    className="p-4 rounded-lg border"
                    data-testid={`completed-form-${form.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold">{form.formName}</h3>
                          {getStatusBadge(form.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed: {form.completedAt ? new Date(form.completedAt).toLocaleDateString() : "N/A"}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/client-portal/forms/${form.id}/view`)}
                        data-testid={`button-view-form-${form.id}`}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
