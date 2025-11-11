import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileBarChart2, Plus, Play, Download, X } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Filter {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ReportResult {
  grouped: any[];
  totals: {
    count: number;
    sumHours?: number;
    sumRevenue?: number;
    avgHours?: number;
    avgRevenue?: number;
  };
}

export default function ReportBuilder() {
  const [dataSource, setDataSource] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [executed, setExecuted] = useState(false);

  // Fetch all data sources
  const { data: timeEntries, isLoading: timeLoading } = useQuery<any[]>({
    queryKey: ["/api/time-entries"],
    enabled: dataSource === "time_entries",
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    enabled: dataSource === "invoices",
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: dataSource === "clients",
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    enabled: dataSource === "projects",
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    enabled: dataSource === "tasks",
  });

  // Get raw data based on selected source
  const rawData = useMemo(() => {
    if (dataSource === "time_entries") return timeEntries || [];
    if (dataSource === "invoices") return invoices || [];
    if (dataSource === "clients") return clients || [];
    if (dataSource === "projects") return projects || [];
    if (dataSource === "tasks") return tasks || [];
    return [];
  }, [dataSource, timeEntries, invoices, clients, projects, tasks]);

  // Apply filters to data
  const filteredData = useMemo(() => {
    if (!executed) return [];
    
    return rawData.filter(item => {
      return filters.every(filter => {
        const value = item[filter.field];
        
        if (filter.operator === "equals") {
          return value === filter.value;
        } else if (filter.operator === "contains") {
          return String(value || "").toLowerCase().includes(filter.value.toLowerCase());
        } else if (filter.operator === "greater_than") {
          return Number(value) > Number(filter.value);
        } else if (filter.operator === "less_than") {
          return Number(value) < Number(filter.value);
        } else if (filter.operator === "after") {
          return new Date(value) > new Date(filter.value);
        } else if (filter.operator === "before") {
          return new Date(value) < new Date(filter.value);
        }
        
        return true;
      });
    });
  }, [rawData, filters, executed]);

  // Compute report results with grouping and aggregations
  const reportResults: ReportResult = useMemo(() => {
    if (!executed || !filteredData.length) {
      return { grouped: [], totals: { count: 0 } };
    }

    // Group data if groupBy is selected
    const grouped = groupBy
      ? Object.entries(
          filteredData.reduce((acc, item) => {
            let key = "Ungrouped";
            
            if (groupBy === "client") {
              key = item.clientName || item.companyName || "No Client";
            } else if (groupBy === "project") {
              key = item.projectName || item.name || "No Project";
            } else if (groupBy === "month") {
              key = item.date || item.createdAt
                ? format(new Date(item.date || item.createdAt), "MMM yyyy")
                : "No Date";
            } else if (groupBy === "user") {
              key = item.userName || item.assignedToName || "No User";
            } else if (groupBy === "status") {
              key = item.status || "No Status";
            }

            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(item);
            return acc;
          }, {} as Record<string, any[]>)
        ).map(([groupKey, items]) => ({
          group: groupKey,
          count: items.length,
          sumHours: items.reduce((sum, i) => sum + (Number(i.hours) || 0), 0),
          sumRevenue: items.reduce((sum, i) => sum + (Number(i.total) || Number(i.amount) || 0), 0),
          avgHours: items.reduce((sum, i) => sum + (Number(i.hours) || 0), 0) / items.length,
          avgRevenue: items.reduce((sum, i) => sum + (Number(i.total) || Number(i.amount) || 0), 0) / items.length,
          items,
        }))
      : [
          {
            group: "All Records",
            count: filteredData.length,
            sumHours: filteredData.reduce((sum, i) => sum + (Number(i.hours) || 0), 0),
            sumRevenue: filteredData.reduce((sum, i) => sum + (Number(i.total) || Number(i.amount) || 0), 0),
            avgHours: filteredData.reduce((sum, i) => sum + (Number(i.hours) || 0), 0) / filteredData.length,
            avgRevenue: filteredData.reduce((sum, i) => sum + (Number(i.total) || Number(i.amount) || 0), 0) / filteredData.length,
            items: filteredData,
          },
        ];

    // Compute totals
    const totals = {
      count: filteredData.length,
      sumHours: filteredData.reduce((sum, i) => sum + (Number(i.hours) || 0), 0),
      sumRevenue: filteredData.reduce((sum, i) => sum + (Number(i.total) || Number(i.amount) || 0), 0),
      avgHours: filteredData.reduce((sum, i) => sum + (Number(i.hours) || 0), 0) / filteredData.length || 0,
      avgRevenue: filteredData.reduce((sum, i) => sum + (Number(i.total) || Number(i.amount) || 0), 0) / filteredData.length || 0,
    };

    return { grouped, totals };
  }, [filteredData, groupBy, executed]);

  // Add a new filter
  const addFilter = () => {
    setFilters([
      ...filters,
      { id: Math.random().toString(), field: "status", operator: "equals", value: "" },
    ]);
  };

  // Remove a filter
  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  // Update filter
  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(filters.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  // Run the report
  const runReport = () => {
    setExecuted(true);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!reportResults.grouped.length) return;

    const headers = ["Group", "Count", "Total Hours", "Total Revenue", "Avg Hours", "Avg Revenue"];
    const rows = reportResults.grouped.map(g => [
      g.group,
      g.count,
      g.sumHours.toFixed(2),
      g.sumRevenue.toFixed(2),
      g.avgHours.toFixed(2),
      g.avgRevenue.toFixed(2),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const isLoading = timeLoading || invoicesLoading || clientsLoading || projectsLoading || tasksLoading;

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Custom Report Builder"
        description="Build custom reports with filters, grouping, and aggregations"
        icon={FileBarChart2}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Report Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Data Source</label>
                <Select value={dataSource} onValueChange={(v) => { setDataSource(v); setExecuted(false); }}>
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

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Filters {filters.length > 0 && <Badge variant="secondary" className="ml-2">{filters.length}</Badge>}
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
                          {getFieldOptions().map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                          <SelectItem value="greater_than">Greater Than</SelectItem>
                          <SelectItem value="less_than">Less Than</SelectItem>
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

              <div>
                <label className="text-sm font-medium mb-2 block">Group By</label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger data-testid="select-group-by">
                    <SelectValue placeholder="No grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Grouping</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={runReport}
                  disabled={!dataSource || isLoading}
                  data-testid="button-run-report"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run Report
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  disabled={!executed || !reportResults.grouped.length}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report Results</CardTitle>
            </CardHeader>
            <CardContent>
              {!dataSource ? (
                <div className="text-center text-muted-foreground py-12">
                  <FileBarChart2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Select a Data Source</p>
                  <p className="text-sm">Choose a data source to begin building your report</p>
                </div>
              ) : !executed ? (
                <div className="text-center text-muted-foreground py-12">
                  <FileBarChart2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Ready to Run</p>
                  <p className="text-sm">Click "Run Report" to see results</p>
                </div>
              ) : isLoading ? (
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
                          <div className="text-2xl font-bold">{reportResults.totals.sumHours?.toFixed(1)}h</div>
                        </CardContent>
                      </Card>
                    )}
                    {(dataSource === "invoices" || dataSource === "projects") && (
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-sm text-muted-foreground">Total Revenue</div>
                          <div className="text-2xl font-bold">${reportResults.totals.sumRevenue?.toFixed(0)}</div>
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
                              <TableCell className="text-right">{row.sumHours.toFixed(1)}h</TableCell>
                              <TableCell className="text-right">{row.avgHours.toFixed(1)}h</TableCell>
                            </>
                          )}
                          {(dataSource === "invoices" || dataSource === "projects") && (
                            <>
                              <TableCell className="text-right">${row.sumRevenue.toFixed(0)}</TableCell>
                              <TableCell className="text-right">${row.avgRevenue.toFixed(0)}</TableCell>
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
        </div>
      </div>
    </div>
  );
}
