import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { 
  ArrowLeft, FileText, Clock, CheckCircle, XCircle, TrendingUp, 
  RefreshCw, Eye, Users, Calendar, BarChart3 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface FormSubmission {
  id: string;
  formTemplateId: string;
  formVersion: number;
  organizationId: string;
  submittedBy: string | null;
  clientId: string | null;
  data: any;
  attachments: any[];
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  submittedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  submitterName?: string;
  submitterEmail?: string;
}

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  fields: any[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
  draft: "#6b7280",
  under_review: "#3b82f6",
  submitted: "#8b5cf6",
};

export default function FormAnalyticsPage() {
  const params = useParams<{ formId: string }>();
  const [, setLocation] = useLocation();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedField, setSelectedField] = useState<string>("");

  const { data: formTemplate, isLoading: isLoadingForm } = useQuery<FormTemplate>({
    queryKey: ["/api/forms", params.formId],
    enabled: !!params.formId,
  });

  const { data: submissions = [], isLoading: isLoadingSubmissions, refetch } = useQuery<FormSubmission[]>({
    queryKey: ["/api/form-submissions", { formTemplateId: params.formId }],
    enabled: !!params.formId,
  });

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      await refetch();
      setLastUpdated(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  // Update last updated timestamp on data change
  useEffect(() => {
    if (submissions.length > 0) {
      setLastUpdated(new Date());
    }
  }, [submissions]);

  // Calculate metrics
  const totalSubmissions = submissions.length;
  const pendingCount = submissions.filter((s) => s.status === "pending" || s.status === "under_review" || s.status === "submitted").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const rejectedCount = submissions.filter((s) => s.status === "rejected").length;

  // Submissions over time (last 30 days)
  const submissionsOverTime = (() => {
    const days = 30;
    const dateMap = new Map<string, number>();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = format(startOfDay(subDays(new Date(), i)), "MMM dd");
      dateMap.set(date, 0);
    }

    submissions.forEach((submission) => {
      const date = format(startOfDay(parseISO(submission.submittedAt)), "MMM dd");
      if (dateMap.has(date)) {
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      }
    });

    return Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      submissions: count,
    }));
  })();

  // Submissions by status
  const submissionsByStatus = (() => {
    const statusMap = new Map<string, number>();
    submissions.forEach((submission) => {
      const status = submission.status;
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([status, count]) => ({
      name: status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value: count,
      color: STATUS_COLORS[status] || "#6b7280",
    }));
  })();

  // Field response analysis
  const fieldResponseData = (() => {
    if (!selectedField || !formTemplate?.fields) return [];

    const field = formTemplate.fields.find((f: any) => f.id === selectedField);
    if (!field) return [];

    const responseMap = new Map<string, number>();

    submissions.forEach((submission) => {
      const value = submission.data?.[selectedField];
      if (value !== undefined && value !== null && value !== "") {
        const stringValue = Array.isArray(value) ? value.join(", ") : String(value);
        responseMap.set(stringValue, (responseMap.get(stringValue) || 0) + 1);
      }
    });

    return Array.from(responseMap.entries())
      .map(([value, count]) => ({
        value: value.length > 30 ? value.substring(0, 30) + "..." : value,
        count,
        percentage: ((count / totalSubmissions) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  // Field-level statistics
  const fieldStatistics = (() => {
    if (!formTemplate?.fields) return [];

    return formTemplate.fields.map((field: any) => {
      const responses = submissions
        .map((s) => s.data?.[field.id])
        .filter((v) => v !== undefined && v !== null && v !== "");

      const responseRate = totalSubmissions > 0 ? ((responses.length / totalSubmissions) * 100).toFixed(1) : "0";

      let mostCommon = "-";
      let average = "-";
      let min = "-";
      let max = "-";

      if (responses.length > 0) {
        // Most common value
        const valueMap = new Map<string, number>();
        responses.forEach((r) => {
          const value = Array.isArray(r) ? r.join(", ") : String(r);
          valueMap.set(value, (valueMap.get(value) || 0) + 1);
        });
        const sorted = Array.from(valueMap.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          mostCommon = sorted[0][0].length > 30 ? sorted[0][0].substring(0, 30) + "..." : sorted[0][0];
        }

        // Numeric statistics
        const numericValues = responses
          .map((r) => parseFloat(String(r)))
          .filter((n) => !isNaN(n));

        if (numericValues.length > 0) {
          const sum = numericValues.reduce((acc, val) => acc + val, 0);
          average = (sum / numericValues.length).toFixed(2);
          min = Math.min(...numericValues).toString();
          max = Math.max(...numericValues).toString();
        }
      }

      return {
        fieldName: field.label || field.id,
        responseRate,
        mostCommon,
        average,
        min,
        max,
      };
    });
  })();

  // Recent submissions
  const recentSubmissions = submissions
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 10);

  // Set initial selected field
  useEffect(() => {
    if (formTemplate?.fields && formTemplate.fields.length > 0 && !selectedField) {
      const choiceField = formTemplate.fields.find(
        (f: any) => f.type === "select" || f.type === "radio" || f.type === "checkbox"
      );
      setSelectedField(choiceField?.id || formTemplate.fields[0].id);
    }
  }, [formTemplate, selectedField]);

  if (isLoadingForm || isLoadingSubmissions) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!formTemplate) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Form not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/forms")}
            data-testid="button-back-to-forms"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-display">Form Analytics</h1>
            <p className="text-muted-foreground mt-1">{formTemplate.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {format(lastUpdated, "MMM dd, yyyy HH:mm:ss")}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              data-testid="switch-auto-refresh"
            />
            <Label htmlFor="auto-refresh" className="cursor-pointer">
              Auto-refresh (30s)
            </Label>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="metric-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubmissions}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-pending" className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSubmissions > 0 ? `${((pendingCount / totalSubmissions) * 100).toFixed(1)}% of total` : "No submissions"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-approved" className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSubmissions > 0 ? `${((approvedCount / totalSubmissions) * 100).toFixed(1)}% of total` : "No submissions"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="metric-rejected" className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSubmissions > 0 ? `${((rejectedCount / totalSubmissions) * 100).toFixed(1)}% of total` : "No submissions"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      {totalSubmissions === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No submissions yet. Analytics will appear once submissions are received.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Submissions Over Time */}
          <Card data-testid="chart-submissions-over-time">
            <CardHeader>
              <CardTitle>Submissions Over Time</CardTitle>
              <CardDescription>Daily submission counts for the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={submissionsOverTime}>
                  <defs>
                    <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorSubmissions)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Submissions by Status */}
            <Card data-testid="chart-submissions-by-status">
              <CardHeader>
                <CardTitle>Submissions by Status</CardTitle>
                <CardDescription>Distribution of submission statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={submissionsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {submissionsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Field Response Analysis */}
            <Card data-testid="chart-field-response">
              <CardHeader>
                <CardTitle>Field Response Analysis</CardTitle>
                <CardDescription>Distribution of responses for selected field</CardDescription>
                <Select value={selectedField} onValueChange={setSelectedField}>
                  <SelectTrigger data-testid="select-field-analysis">
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {formTemplate.fields?.map((field: any) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label || field.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {fieldResponseData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No responses for this field
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={fieldResponseData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis 
                        dataKey="value" 
                        type="category" 
                        width={150}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Field-Level Statistics */}
          <Card data-testid="table-field-statistics">
            <CardHeader>
              <CardTitle>Field-Level Statistics</CardTitle>
              <CardDescription>Response rates and statistics for each form field</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Response Rate</TableHead>
                    <TableHead>Most Common</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldStatistics.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{stat.fieldName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{stat.responseRate}%</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={stat.mostCommon}>
                        {stat.mostCommon}
                      </TableCell>
                      <TableCell>{stat.average}</TableCell>
                      <TableCell>{stat.min}</TableCell>
                      <TableCell>{stat.max}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card data-testid="section-recent-submissions">
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
              <CardDescription>Last 10 form submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-mono text-xs">
                        {submission.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {submission.submitterName || submission.submitterEmail || "Anonymous"}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(submission.submittedAt), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          submission.status === "approved" ? "default" :
                          submission.status === "rejected" ? "destructive" :
                          "secondary"
                        }>
                          {submission.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(`/forms/${params.formId}/submissions/${submission.id}`)}
                          data-testid={`button-view-submission-${submission.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
