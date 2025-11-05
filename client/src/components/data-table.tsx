import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye, PanelRightClose, PanelRight } from "lucide-react";

type SortDirection = "asc" | "desc" | null;

export type ColumnDef<T> = {
  id: string;
  header: string;
  accessorKey?: keyof T;
  accessorFn?: (row: T) => any;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  onRowClick?: (row: T) => void;
  selectedRow?: T | null;
  actions?: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
  renderPreview?: (row: T) => React.ReactNode;
  previewTitle?: (row: T) => string;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchKeys = [],
  onRowClick,
  selectedRow,
  actions,
  emptyState,
  renderPreview,
  previewTitle,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((row) => {
      // Search in specified keys or all string values
      const keysToSearch = searchKeys.length > 0 ? searchKeys : Object.keys(row);
      return keysToSearch.some((key) => {
        const value = row[key];
        if (typeof value === "string") {
          return value.toLowerCase().includes(query);
        }
        return false;
      });
    });
  }, [data, searchQuery, searchKeys]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    const column = columns.find((col) => col.id === sortColumn);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (column.accessorFn) {
        aValue = column.accessorFn(a);
        bValue = column.accessorFn(b);
      } else if (column.accessorKey) {
        aValue = a[column.accessorKey];
        bValue = b[column.accessorKey];
      } else {
        return 0;
      }

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === "asc" ? 1 : -1;
      if (bValue == null) return sortDirection === "asc" ? -1 : 1;

      // Compare values
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="w-4 h-4 ml-2 opacity-40" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="w-4 h-4 ml-2" />;
    }
    return <ArrowDown className="w-4 h-4 ml-2" />;
  };

  const getRowId = (row: T): string => {
    if ('id' in row) return String(row.id);
    return JSON.stringify(row);
  };

  const isRowSelected = (row: T): boolean => {
    if (!selectedRow) return false;
    return getRowId(row) === getRowId(selectedRow);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar and Preview Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>
        {renderPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            data-testid="button-toggle-preview"
          >
            {showPreview ? (
              <>
                <PanelRightClose className="w-4 h-4 mr-2" />
                Hide Preview
              </>
            ) : (
              <>
                <PanelRight className="w-4 h-4 mr-2" />
                Show Preview
              </>
            )}
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Table Section */}
        <div className={showPreview && selectedRow && renderPreview ? "flex-1" : "w-full"}>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {columns.map((column) => (
                    <TableHead
                      key={column.id}
                      style={{ width: column.width }}
                      className={column.sortable !== false ? "cursor-pointer select-none" : ""}
                      onClick={() => column.sortable !== false && handleSort(column.id)}
                      data-testid={`column-header-${column.id}`}
                    >
                      <div className="flex items-center">
                        {column.header}
                        {column.sortable !== false && getSortIcon(column.id)}
                      </div>
                    </TableHead>
                  ))}
                  {actions && <TableHead className="w-[120px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-32">
                      {emptyState || (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Search className="h-8 w-8 mb-2 opacity-50" />
                          <p>No results found</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row) => (
                    <TableRow
                      key={getRowId(row)}
                      className={`${
                        onRowClick ? "cursor-pointer" : ""
                      } ${
                        isRowSelected(row) ? "bg-muted" : ""
                      }`}
                      onClick={() => onRowClick?.(row)}
                      data-testid={`table-row-${getRowId(row)}`}
                    >
                      {columns.map((column) => (
                        <TableCell key={column.id} data-testid={`cell-${column.id}-${getRowId(row)}`}>
                          {column.cell
                            ? column.cell(row)
                            : column.accessorFn
                            ? column.accessorFn(row)
                            : column.accessorKey
                            ? row[column.accessorKey]
                            : null}
                        </TableCell>
                      ))}
                      {actions && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">{actions(row)}</div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground mt-4">
            Showing {sortedData.length} of {data.length} {data.length === 1 ? "item" : "items"}
          </div>
        </div>

        {/* Preview Panel */}
        {showPreview && selectedRow && renderPreview && (
          <Card className="w-96 h-fit sticky top-6 max-h-[calc(100vh-200px)] overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">
                  {previewTitle ? previewTitle(selectedRow) : "Preview"}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRowClick?.(null as any)}
                  data-testid="button-close-preview"
                >
                  <span className="sr-only">Close</span>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {renderPreview(selectedRow)}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
