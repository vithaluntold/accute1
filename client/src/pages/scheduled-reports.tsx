import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertScheduledReportSchema, type ScheduledReport } from "@shared/schema";
import { FileText, Calendar, Mail, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const reportFormSchema = insertScheduledReportSchema.extend({
  name: z.string().min(1, "Name is required"),
  reportType: z.enum(["time_tracking", "profitability", "workload", "custom"]),
  schedule: z.enum(["daily", "weekly", "monthly", "quarterly"]),
  recipientEmail: z.string().email("Valid email required"),
}).omit({ recipients: true });

export default function ScheduledReportsPage() {
  const { toast } = useToast();
  const [showNewReport, setShowNewReport] = useState(false);

  const form = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      name: "",
      description: "",
      reportType: "time_tracking",
      schedule: "monthly",
      scheduleTime: "09:00",
      recipientEmail: "",
      format: "pdf",
      reportConfig: { includeCharts: true },
      isActive: true,
    },
  });

  const { data: reports = [], isLoading } = useQuery<ScheduledReport[]>({
    queryKey: ["/api/scheduled-reports"],
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/scheduled-reports", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports"] });
      setShowNewReport(false);
      form.reset();
      toast({ title: "Scheduled report created successfully" });
    },
    onError: () => toast({ title: "Failed to create report", variant: "destructive" }),
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/scheduled-reports/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports"] });
      toast({ title: "Report updated successfully" });
    },
    onError: () => toast({ title: "Failed to update report", variant: "destructive" }),
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/scheduled-reports/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports"] });
      toast({ title: "Report deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete report", variant: "destructive" }),
  });

  const onSubmit = (data: z.infer<typeof reportFormSchema>) => {
    const { recipientEmail, ...rest } = data;
    createReportMutation.mutate({ ...rest, recipients: [recipientEmail] });
  };

  const toggleReportStatus = (report: ScheduledReport) => {
    updateReportMutation.mutate({
      id: report.id,
      data: { isActive: !report.isActive },
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Scheduled Reports</h1>
        </div>
        <Dialog open={showNewReport} onOpenChange={setShowNewReport}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-report">
              <Plus className="w-4 h-4" />
              New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Scheduled Report</DialogTitle>
              <DialogDescription>Automatically email reports on a schedule</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Monthly Revenue Report" {...field} data-testid="input-report-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reportType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-report-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="time_tracking">Time Tracking</SelectItem>
                          <SelectItem value="profitability">Profitability</SelectItem>
                          <SelectItem value="workload">Workload</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schedule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-schedule">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} data-testid="input-recipient" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={createReportMutation.isPending} data-testid="button-create-report">
                    Create Report
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowNewReport(false); form.reset(); }} data-testid="button-cancel">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-muted-foreground" data-testid="text-loading">Loading reports...</div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-reports">No scheduled reports yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <Card key={report.id} data-testid={`card-report-${report.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base" data-testid={`text-report-name-${report.id}`}>{report.name}</CardTitle>
                      <CardDescription className="text-xs mt-1" data-testid={`text-report-type-${report.id}`}>
                        {report.reportType} • {report.schedule}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={report.isActive}
                      onCheckedChange={() => toggleReportStatus(report)}
                      data-testid={`switch-active-${report.id}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span data-testid={`text-schedule-${report.id}`}>{report.schedule} at {report.scheduleTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span data-testid={`text-recipients-${report.id}`}>{report.recipients.length} recipient(s)</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Badge variant="outline" data-testid={`badge-format-${report.id}`}>{report.format.toUpperCase()}</Badge>
                    <Badge variant={report.isActive ? "default" : "secondary"} data-testid={`badge-status-${report.id}`}>
                      {report.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => deleteReportMutation.mutate(report.id)}
                    disabled={deleteReportMutation.isPending}
                    data-testid={`button-delete-${report.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
