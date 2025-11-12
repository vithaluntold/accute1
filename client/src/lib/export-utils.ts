import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

// Generic data export (for reports, analytics, etc.)
export interface GenericExportData {
  [key: string]: string | number;
}

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

// Helper function to flatten nested field values
function flattenValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(flattenValue).join(", ");
    }
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${flattenValue(v)}`)
      .join("; ");
  }
  return String(value);
}

// Helper function to extract form field values
function extractFormFields(submissions: FormSubmission[]): string[] {
  const fieldSet = new Set<string>();
  submissions.forEach((submission) => {
    if (submission.data && typeof submission.data === "object") {
      Object.keys(submission.data).forEach((key) => fieldSet.add(key));
    }
  });
  return Array.from(fieldSet).sort();
}

// Helper function to trigger file download
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper function to format filename with date
function getFilename(formName: string, extension: string): string {
  const date = format(new Date(), "yyyy-MM-dd");
  const sanitizedName = formName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  return `${sanitizedName}_submissions_${date}.${extension}`;
}

// CSV Export
export function exportToCSV(submissions: FormSubmission[], formName: string) {
  if (submissions.length === 0) {
    throw new Error("No submissions to export");
  }

  const formFields = extractFormFields(submissions);
  const headers = ["Submission ID", "Submitted By", "Date", "Status", ...formFields];

  const rows = submissions.map((submission) => {
    const baseData = [
      submission.id.substring(0, 8),
      submission.submitterName || submission.submitterEmail || "Anonymous",
      format(new Date(submission.submittedAt), "MMM d, yyyy"),
      submission.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    ];

    const fieldData = formFields.map((field) => {
      const value = submission.data?.[field];
      return flattenValue(value);
    });

    return [...baseData, ...fieldData];
  });

  const csvContent = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadFile(blob, getFilename(formName, "csv"));
}

// JSON Export
export function exportToJSON(submissions: FormSubmission[], formName: string) {
  if (submissions.length === 0) {
    throw new Error("No submissions to export");
  }

  const jsonContent = JSON.stringify(submissions, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  downloadFile(blob, getFilename(formName, "json"));
}

// Excel Export
export function exportToExcel(submissions: FormSubmission[], formName: string) {
  if (submissions.length === 0) {
    throw new Error("No submissions to export");
  }

  const formFields = extractFormFields(submissions);
  const headers = ["Submission ID", "Submitted By", "Date", "Status", ...formFields];

  const data = submissions.map((submission) => {
    const row: any = {
      "Submission ID": submission.id.substring(0, 8),
      "Submitted By": submission.submitterName || submission.submitterEmail || "Anonymous",
      "Date": format(new Date(submission.submittedAt), "MMM d, yyyy"),
      "Status": submission.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    };

    formFields.forEach((field) => {
      row[field] = flattenValue(submission.data?.[field]);
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });

  // Auto-size columns
  const colWidths = headers.map((header) => {
    const maxLength = Math.max(
      header.length,
      ...data.map((row) => String(row[header] || "").length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  worksheet["!cols"] = colWidths;

  // Bold header row
  headers.forEach((header, index) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: index });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        font: { bold: true },
      };
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");

  XLSX.writeFile(workbook, getFilename(formName, "xlsx"));
}

// PDF Export
export function exportToPDF(submissions: FormSubmission[], formName: string) {
  if (submissions.length === 0) {
    throw new Error("No submissions to export");
  }

  const doc = new jsPDF();

  // Add title
  doc.setFontSize(16);
  doc.text(formName, 14, 15);

  // Add subtitle
  doc.setFontSize(10);
  doc.text(`Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`, 14, 22);

  // Prepare table data
  const formFields = extractFormFields(submissions);
  const headers = ["ID", "Submitted By", "Date", "Status", ...formFields.slice(0, 3)]; // Limit columns for PDF

  const tableData = submissions.map((submission) => [
    submission.id.substring(0, 8),
    submission.submitterName || submission.submitterEmail || "Anonymous",
    format(new Date(submission.submittedAt), "MMM d, yyyy"),
    submission.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    ...formFields.slice(0, 3).map((field) => {
      const value = flattenValue(submission.data?.[field]);
      return value.length > 30 ? value.substring(0, 27) + "..." : value;
    }),
  ]);

  // Add table
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 30,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 30, right: 14, bottom: 20, left: 14 },
    didDrawPage: (data) => {
      // Add page numbers
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    },
  });

  doc.save(getFilename(formName, "pdf"));
}

// ==================== Generic Export Functions ====================

/**
 * Export generic data to Excel (for reports, analytics, etc.)
 * @param data - Array of objects with string/number values
 * @param filename - Base filename (without extension)
 * @param sheetName - Name of the Excel sheet
 */
export function exportGenericToExcel(
  data: GenericExportData[],
  filename: string,
  sheetName: string = "Data"
) {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  // Extract headers from first row
  const headers = Object.keys(data[0]);

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });

  // Auto-size columns
  const colWidths = headers.map((header) => {
    const maxLength = Math.max(
      header.length,
      ...data.map((row) => String(row[header] || "").length)
    );
    return { wch: Math.min(maxLength + 2, 30) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const date = format(new Date(), "yyyy-MM-dd_HH-mm");
  const sanitizedName = filename.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  XLSX.writeFile(workbook, `${sanitizedName}_${date}.xlsx`);
}

/**
 * Export generic data to PDF (for reports, analytics, etc.)
 * @param data - Array of objects with string/number values
 * @param filename - Base filename (without extension)
 * @param title - Title to display on PDF
 */
export function exportGenericToPDF(
  data: GenericExportData[],
  filename: string,
  title: string
) {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  const doc = new jsPDF();

  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  // Add subtitle
  doc.setFontSize(10);
  doc.text(`Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}`, 14, 22);

  // Prepare table data
  const headers = Object.keys(data[0]);
  const tableData = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      // Format numbers with 2 decimals if they're not integers
      if (typeof value === "number" && !Number.isInteger(value)) {
        return value.toFixed(2);
      }
      // Truncate long strings
      const str = String(value);
      return str.length > 30 ? str.substring(0, 27) + "..." : str;
    })
  );

  // Add table
  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 30,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [66, 66, 66],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 30, right: 14, bottom: 20, left: 14 },
  });

  const date = format(new Date(), "yyyy-MM-dd_HH-mm");
  const sanitizedName = filename.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`${sanitizedName}_${date}.pdf`);
}

/**
 * Export generic data to CSV (for reports, analytics, etc.)
 * @param data - Array of objects with string/number values
 * @param filename - Base filename (without extension)
 */
export function exportGenericToCSV(
  data: GenericExportData[],
  filename: string
) {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      // Format numbers with 2 decimals if they're not integers
      if (typeof value === "number" && !Number.isInteger(value)) {
        return value.toFixed(2);
      }
      return String(value);
    })
  );

  const csvContent = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const date = format(new Date(), "yyyy-MM-dd_HH-mm");
  const sanitizedName = filename.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  downloadFile(blob, `${sanitizedName}_${date}.csv`);
}

