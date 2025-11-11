import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileBarChart2, Plus, Play } from "lucide-react";
import { GradientHero } from "@/components/gradient-hero";

export default function ReportBuilder() {
  const [entity, setEntity] = useState("");
  const [filters, setFilters] = useState<any[]>([]);

  return (
    <div className="flex flex-col h-screen">
      <GradientHero
        title="Custom Report Builder"
        description="Build custom reports with drag-drop fields and visual filters"
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
                <Select value={entity} onValueChange={setEntity}>
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
                <label className="text-sm font-medium mb-2 block">Filters</label>
                <Button variant="outline" size="sm" className="w-full" data-testid="button-add-filter">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Filter
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Group By</label>
                <Select>
                  <SelectTrigger data-testid="select-group-by">
                    <SelectValue placeholder="Select grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Aggregations</label>
                <div className="space-y-2">
                  <Badge>Sum of Hours</Badge>
                  <Badge className="ml-2">Sum of Revenue</Badge>
                </div>
              </div>

              <Button className="w-full" data-testid="button-run-report">
                <Play className="h-4 w-4 mr-2" />
                Run Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <FileBarChart2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Report Preview</p>
                <p className="text-sm">Configure your report and click "Run Report" to see results</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
