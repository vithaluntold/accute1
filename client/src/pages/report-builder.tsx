import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart2, Plus, Play, Download, X, BarChart3, TrendingUp } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  exportGenericToExcel,
  exportGenericToPDF,
  exportGenericToCSV,
  type GenericExportData,
} from "@/lib/export-utils";

interface Filter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ReportResult {
  grouped: Array<{
    group: string;
    count: number;
    sumHours: number;
    sumRevenue: number;
    avgHours: number;
    avgRevenue: number;
  }>;
  totals: {
    count: number;
    sumHours: number;
    sumRevenue: number;
    avgHours: number;
    avgRevenue: number;
  };
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  dataSource: string;
  defaultFilters: Filter[];
  defaultGroupBy: string;
  category: string;
}

export default function ReportBuilder() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [reportResults, setReportResults] = useState<ReportResult | null>(null);
  const [chartType, setChartType] = useState<"none" | "bar" | "line">("none");

  // Fetch available templates
  const { data: templates = [] } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/reports/templates"],
  });

  // Execute report server-side
  const executeReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/reports/execute", {
        method: "POST",
        body: {
          dataSource,
          filters,
          groupBy,
        },
      });
      return response as ReportResult;
    },
    onSuccess: (data) => {
      setReportResults(data);
      toast({ title: "Report generated successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to execute report",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  // Load template configuration
  const loadTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    setReportResults(null); // Clear previous results
    setChartType("none"); // Reset chart

    if (!templateId) {
      // Reset to custom report
      setDataSource("");
      setFilters([]);
      setGroupBy("");
      return;
    }

    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setDataSource(template.dataSource);
      setFilters(
        template.defaultFilters.map((f) => ({
          ...f,
          id: Math.random().toString(),
        }))
      );
      setGroupBy(template.defaultGroupBy);
    }
  };

  // Add a new filter
  const addFilter = () => {
    setFilters([
      ...filters,
      { id: Math.random().toString(), field: "status", operator: "equals", value: "" },
    ]);
  };

  // Remove a filter
  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  // Update filter
  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  // Run the report - server-side execution
  const runReport = () => {
    executeReportMutation.mutate();
  };

  // Prepare export data (shared helper for all formats)
  const prepareExportData = (): GenericExportData[] => {
    if (!reportResults) return [];

    const data: GenericExportData[] = reportResults.grouped.map((g) => ({
      Group: g.group,
      Count: g.count,
      "Total Hours": parseFloat(g.sumHours.toFixed(2)),
      "Total Revenue": parseFloat(g.sumRevenue.toFixed(2)),
      "Avg Hours": parseFloat(g.avgHours.toFixed(2)),
      "Avg Revenue": parseFloat(g.avgRevenue.toFixed(2)),
    }));

    // Add totals row (preserve numeric types)
    data.push({
      Group: "TOTAL",
      Count: reportResults.totals.count,
      "Total Hours": parseFloat(reportResults.totals.sumHours.toFixed(2)),
      "Total Revenue": parseFloat(reportResults.totals.sumRevenue.toFixed(2)),
      "Avg Hours": parseFloat(reportResults.totals.avgHours.toFixed(2)),
      "Avg Revenue": parseFloat(reportResults.totals.avgRevenue.toFixed(2)),
    });

    return data;
  };

  // Export to CSV (using shared export-utils)
  const exportToCSV = () => {
    if (!reportResults || !reportResults.grouped.length) return;
    const data = prepareExportData();
    const baseName = selectedTemplate !== "custom" ? `report_${selectedTemplate}` : `report_${dataSource}`;
    exportGenericToCSV(data, baseName);
  };

  // Export to Excel (using shared export-utils)
  const exportToExcel = () => {
    if (!reportResults || !reportResults.grouped.length) return;
    const data = prepareExportData();
    const baseName = selectedTemplate !== "custom" ? `report_${selectedTemplate}` : `report_${dataSource}`;
    exportGenericToExcel(data, baseName, "Report");
  };

  // Export to PDF (using shared export-utils)
  const exportToPDF = () => {
    if (!reportResults || !reportResults.grouped.length) return;
    const data = prepareExportData();
    const baseName = selectedTemplate !== "custom" ? `report_${selectedTemplate}` : `report_${dataSource}`;
    exportGenericToPDF(data, baseName, "Report Results");
  };

  // Get field options based on data source
  const getFieldOptions = () => {
    if (dataSource === "time_entries") {
      return [
        { value: "date", label: "Date" },
        { value: "hours", label: "Hours" },
        { value: "isBillable", label: "Billable" },
        { value: "isInvoiced", label: "Invoiced" },
      ];
    } else if (dataSource === "invoices") {
      return [
        { value: "status", label: "Status" },
        { value: "issueDate", label: "Issue Date" },
        { value: "dueDate", label: "Due Date" },
        { value: "total", label: "Total Amount" },
      ];
    } else if (dataSource === "projects") {
      return [
        { value: "status", label: "Status" },
        { value: "priority", label: "Priority" },
        { value: "startDate", label: "Start Date" },
        { value: "dueDate", label: "Due Date" },
      ];
    } else if (dataSource === "clients") {
      return [
        { value: "status", label: "Status" },
        { value: "industry", label: "Industry" },
        { value: "country", label: "Country" },
      ];
    } else if (dataSource === "tasks") {
      return [
        { value: "status", label: "Status" },
        { value: "priority", label: "Priority" },
        { value: "dueDate", label: "Due Date" },
      ];
    }
    return [];
  };

  // Chart configuration
  const chartConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--primary))",
    },
    sumHours: {
      label: "Total Hours",
      color: "hsl(var(--chart-2))",
    },
    sumRevenue: {
      label: "Total Revenue",
      color: "hsl(var(--chart-3))",
    },
  };

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Report Builder"
        description="Create custom reports with pre-built templates, filters, and visualizations"
        icon={FileBarChart2}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Report Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">Quick Start Templates</label>
                <Select value={selectedTemplate} onValueChange={loadTemplate}>
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="Custom Report" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Custom Report</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && templates.find((t) => t.id === selectedTemplate) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {templates.find((t) => t.id === selectedTemplate)?.description}
                  </p>
                )}
              </div>

              {/* Data Source */}
              <div>
                <label className="text-sm font-medium mb-2 block">Data Source</label>
                <Select
                  value={dataSource}
                  onValueChange={(v) => {
                    setDataSource(v);
                    setReportResults(null);
                    setChartType("none");
                  }}
                >
                  <SelectTrigger data-testid="select-data-source">
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time_entries">Time Entries</SelectItem>
                    <SelectItem value="invoices">Invoices</SelectItem>
                    <SelectItem value="clients">Clients</SelectItem>
                    <SelectItem value="projects">Projects</SelectItem>
                    <SelectItem value="tasks">Tasks</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filters */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Filters{" "}
                  {filters.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {filters.length}
                    </Badge>
                  )}
                </label>
                <div className="space-y-2">
                  {filters.map((filter) => (
                    <div key={filter.id} className="flex gap-2 items-center">
                      <Select
                        value={filter.field}
                        onValueChange={(v) => updateFilter(filter.id, { field: v })}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getFieldOptions().map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={filter.operator}
                        onValueChange={(v) => updateFilter(filter.id, { operator: v })}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="greaterThan">Greater Than</SelectItem>
                          <SelectItem value="lessThan">Less Than</SelectItem>
                          <SelectItem value="in">In (comma-separated)</SelectItem>
                          <SelectItem value="between">Between (min,max)</SelectItem>
                          <SelectItem value="after">After</SelectItem>
                          <SelectItem value="before">Before</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        placeholder="Value"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFilter(filter.id)}
                        data-testid={`button-remove-filter-${filter.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addFilter}
                    disabled={!dataSource}
                    data-testid="button-add-filter"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Filter
                  </Button>
                </div>
              </div>

              {/* Group By */}
              <div>
                <label className="text-sm font-medium mb-2 block">Group By</label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger data-testid="select-group-by">
                    <SelectValue placeholder="No grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Grouping</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="assignedTo">Assigned To</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={runReport}
                  disabled={!dataSource || executeReportMutation.isPending}
                  data-testid="button-run-report"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run Report
                </Button>
              </div>

              {/* Export Buttons */}
              <div className="space-y-2">
                <label className="text-sm font-medium block">Export</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    disabled={!reportResults || !reportResults.grouped.length}
                    data-testid="button-export-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    disabled={!reportResults || !reportResults.grouped.length}
                    data-testid="button-export-excel"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToPDF}
                    disabled={!reportResults || !reportResults.grouped.length}
                    data-testid="button-export-pdf"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Results Table */}
            <Card>
              <CardHeader>
                <CardTitle>Report Results</CardTitle>
              </CardHeader>
              <CardContent>
                {!dataSource ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileBarChart2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Select a Data Source</p>
                    <p className="text-sm">Choose a template or data source to begin</p>
                  </div>
                ) : !reportResults ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileBarChart2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Ready to Run</p>
                    <p className="text-sm">Click "Run Report" to see results</p>
                  </div>
                ) : executeReportMutation.isPending ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : reportResults.grouped.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <p className="text-lg font-medium mb-2">No Results</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Records</div>
                          <div className="text-2xl font-bold">{reportResults.totals.count}</div>
                        </CardContent>
                      </Card>
                      {dataSource === "time_entries" && (
                        <Card>
                          <CardContent className="pt-4">
                            <div className="text-sm text-muted-foreground">Total Hours</div>
                            <div className="text-2xl font-bold">
                              {reportResults.totals.sumHours.toFixed(1)}h
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {(dataSource === "invoices" || dataSource === "projects") && (
                        <Card>
                          <CardContent className="pt-4">
                            <div className="text-sm text-muted-foreground">Total Revenue</div>
                            <div className="text-2xl font-bold">
                              ${reportResults.totals.sumRevenue.toFixed(0)}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          {dataSource === "time_entries" && (
                            <>
                              <TableHead className="text-right">Hours</TableHead>
                              <TableHead className="text-right">Avg Hours</TableHead>
                            </>
                          )}
                          {(dataSource === "invoices" || dataSource === "projects") && (
                            <>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">Avg Revenue</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportResults.grouped.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{row.group}</TableCell>
                            <TableCell className="text-right">{row.count}</TableCell>
                            {dataSource === "time_entries" && (
                              <>
                                <TableCell className="text-right">
                                  {row.sumHours.toFixed(1)}h
                                </TableCell>
                                <TableCell className="text-right">
                                  {row.avgHours.toFixed(1)}h
                                </TableCell>
                              </>
                            )}
                            {(dataSource === "invoices" || dataSource === "projects") && (
                              <>
                                <TableCell className="text-right">
                                  ${row.sumRevenue.toFixed(0)}
                                </TableCell>
                                <TableCell className="text-right">
                                  ${row.avgRevenue.toFixed(0)}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart Visualization */}
            {reportResults && reportResults.grouped.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Chart Visualization</CardTitle>
                    <Select value={chartType} onValueChange={(v: "none" | "bar" | "line") => setChartType(v)}>
                      <SelectTrigger className="w-[150px]" data-testid="select-chart-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Chart</SelectItem>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="line">Line Chart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartType === "none" ? (
                    <div className="text-center text-muted-foreground py-12">
                      <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Select a chart type to visualize data</p>
                    </div>
                  ) : (
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      {chartType === "bar" ? (
                        <BarChart data={reportResults.grouped}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="group" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="count" fill="var(--color-count)" />
                        </BarChart>
                      ) : (
                        <LineChart data={reportResults.grouped}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="group" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="count" stroke="var(--color-count)" />
                        </LineChart>
                      )}
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
