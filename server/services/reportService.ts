import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq } from "drizzle-orm";

// Report template definitions
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  dataSource: "tasks" | "time_entries" | "invoices" | "clients" | "projects";
  defaultFilters: ReportFilter[];
  defaultGroupBy: string;
  category: "workflow" | "team" | "finance";
}

export interface ReportFilter {
  field: string;
  operator: 
    | "equals"
    | "contains"
    | "greaterThan"
    | "greater_than" // backward compatibility
    | "lessThan"
    | "less_than" // backward compatibility
    | "in"
    | "between"
    | "after"
    | "before";
  value: string;
}

export interface ReportExecutionParams {
  dataSource: string;
  filters: ReportFilter[];
  groupBy?: string;
}

export interface ReportResult {
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

// Pre-built report templates
const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "task-progress",
    name: "Task Progress Overview",
    description: "Track task completion across all workflows with status breakdown and overdue alerts",
    dataSource: "tasks",
    defaultFilters: [],
    defaultGroupBy: "status",
    category: "workflow",
  },
  {
    id: "team-workload",
    name: "Team Workload Summary",
    description: "View task distribution by team member to balance workload and identify capacity issues",
    dataSource: "tasks",
    defaultFilters: [
      { field: "status", operator: "equals", value: "in_progress" },
    ],
    defaultGroupBy: "assignedTo",
    category: "team",
  },
  {
    id: "time-tracking",
    name: "Time Tracking Report",
    description: "Analyze billable hours by month with revenue projections and utilization rates",
    dataSource: "time_entries",
    defaultFilters: [],
    defaultGroupBy: "month",
    category: "finance",
  },
];

export class ReportService {
  /**
   * Get list of available report templates
   */
  static getTemplates(): ReportTemplate[] {
    return REPORT_TEMPLATES;
  }

  /**
   * Get specific template by ID
   */
  static getTemplate(templateId: string): ReportTemplate | null {
    return REPORT_TEMPLATES.find((t) => t.id === templateId) || null;
  }

  /**
   * Execute custom report with user-defined parameters
   */
  static async executeCustomReport(
    organizationId: string,
    params: ReportExecutionParams
  ): Promise<ReportResult> {
    const { dataSource, filters, groupBy } = params;

    // Fetch data based on source (organization-scoped)
    const rawData = await this.fetchDataSource(organizationId, dataSource);

    // Apply filters
    const filteredData = this.applyFilters(rawData, filters);

    // Group and aggregate
    const grouped = this.groupAndAggregate(filteredData, groupBy, dataSource);

    // Compute totals
    const totals = this.computeTotals(filteredData);

    return { grouped, totals };
  }

  /**
   * Execute pre-built template report with optional parameter overrides
   */
  static async executeTemplateReport(
    organizationId: string,
    templateId: string,
    overrides?: Partial<ReportExecutionParams>
  ): Promise<ReportResult> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Merge template defaults with overrides
    const params: ReportExecutionParams = {
      dataSource: overrides?.dataSource || template.dataSource,
      filters: overrides?.filters || template.defaultFilters,
      groupBy: overrides?.groupBy || template.defaultGroupBy,
    };

    return this.executeCustomReport(organizationId, params);
  }

  /**
   * Fetch data from specified source (organization-scoped)
   */
  private static async fetchDataSource(
    organizationId: string,
    dataSource: string
  ): Promise<any[]> {
    if (dataSource === "time_entries") {
      return await db
        .select()
        .from(schema.timeEntries)
        .where(eq(schema.timeEntries.organizationId, organizationId));
    } else if (dataSource === "invoices") {
      return await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.organizationId, organizationId));
    } else if (dataSource === "clients") {
      return await db
        .select()
        .from(schema.clients)
        .where(eq(schema.clients.organizationId, organizationId));
    } else if (dataSource === "projects") {
      return await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.organizationId, organizationId));
    } else if (dataSource === "tasks") {
      const joinedData = await db
        .select()
        .from(schema.projectTasks)
        .innerJoin(
          schema.projects,
          eq(schema.projectTasks.projectId, schema.projects.id)
        )
        .where(eq(schema.projects.organizationId, organizationId));

      // Flatten joined data - extract task fields to top level
      return joinedData.map((row) => ({
        ...row.project_tasks,
        projectName: row.projects.name,
        clientId: row.projects.clientId,
      }));
    } else {
      throw new Error(`Invalid data source: ${dataSource}`);
    }
  }

  /**
   * Apply filters to data
   */
  private static applyFilters(
    data: any[],
    filters: ReportFilter[]
  ): any[] {
    if (!filters || filters.length === 0) {
      return data;
    }

    return data.filter((item) => {
      return filters.every((filter) => {
        const value = item[filter.field];

        if (filter.operator === "equals") {
          return String(value) === String(filter.value);
        } else if (filter.operator === "contains") {
          return String(value || "")
            .toLowerCase()
            .includes(String(filter.value).toLowerCase());
        } else if (filter.operator === "greaterThan" || filter.operator === "greater_than") {
          return Number(value) > Number(filter.value);
        } else if (filter.operator === "lessThan" || filter.operator === "less_than") {
          return Number(value) < Number(filter.value);
        } else if (filter.operator === "in") {
          // Value should be in comma-separated list
          const values = String(filter.value).split(',').map(v => v.trim());
          return values.includes(String(value));
        } else if (filter.operator === "between") {
          // Value format: "min,max"
          const [min, max] = String(filter.value).split(',').map(v => Number(v.trim()));
          return Number(value) >= min && Number(value) <= max;
        } else if (filter.operator === "after") {
          return new Date(value) > new Date(filter.value);
        } else if (filter.operator === "before") {
          return new Date(value) < new Date(filter.value);
        }

        return true;
      });
    });
  }

  /**
   * Group data and compute aggregations
   */
  private static groupAndAggregate(
    data: any[],
    groupBy: string | undefined,
    dataSource: string
  ): Array<{
    group: string;
    count: number;
    sumHours: number;
    sumRevenue: number;
    avgHours: number;
    avgRevenue: number;
  }> {
    if (!groupBy) {
      // No grouping - return single aggregate
      const totals = this.computeTotals(data);
      return [
        {
          group: "All Records",
          ...totals,
        },
      ];
    }

    // Group data
    const groups = data.reduce((acc, item) => {
      let key = "Ungrouped";

      if (groupBy === "status") {
        key = item.status || "No Status";
      } else if (groupBy === "month") {
        const date = item.date || item.createdAt || item.issueDate;
        key = date
          ? new Date(date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
            })
          : "No Date";
      } else if (groupBy === "assignedTo") {
        key = item.assignedTo || "Unassigned";
      } else {
        // Generic fallback: support any field for grouping
        key = String(item[groupBy] ?? "Ungrouped");
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // Compute aggregations per group
    return Object.entries(groups).map(([groupKey, items]) => {
      const count = items.length;
      const sumHours = items.reduce(
        (sum, i) => sum + (Number(i.hours) || 0),
        0
      );
      const sumRevenue = items.reduce(
        (sum, i) => sum + (Number(i.total) || Number(i.budget) || 0),
        0
      );

      return {
        group: groupKey,
        count,
        sumHours,
        sumRevenue,
        avgHours: count > 0 ? sumHours / count : 0,
        avgRevenue: count > 0 ? sumRevenue / count : 0,
      };
    });
  }

  /**
   * Compute total aggregations
   */
  private static computeTotals(data: any[]): {
    count: number;
    sumHours: number;
    sumRevenue: number;
    avgHours: number;
    avgRevenue: number;
  } {
    const count = data.length;
    const sumHours = data.reduce(
      (sum, i) => sum + (Number(i.hours) || 0),
      0
    );
    const sumRevenue = data.reduce(
      (sum, i) => sum + (Number(i.total) || Number(i.budget) || 0),
      0
    );

    return {
      count,
      sumHours,
      sumRevenue,
      avgHours: count > 0 ? sumHours / count : 0,
      avgRevenue: count > 0 ? sumRevenue / count : 0,
    };
  }
}
