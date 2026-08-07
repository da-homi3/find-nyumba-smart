import { downloadCsv } from "@/lib/csv-export";
import {
  financialReportCsv,
  financialReportExcelXml,
  financialReportHtml,
  type FinancialReportInvoiceRow,
  type FinancialReportSummary,
} from "@/lib/pm/financial-report";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReportFormat = "csv" | "excel" | "pdf";

export function downloadFinancialReport(
  format: ReportFormat,
  summary: FinancialReportSummary,
  rows: FinancialReportInvoiceRow[],
) {
  const slug = summary.propertyName
    .replaceAll(/[^\w]+/g, "-")
    .toLowerCase()
    .slice(0, 40);
  const base = `nyumba-rent-${slug}-${summary.periodMonth}`;

  if (format === "csv") {
    const { headers, body } = financialReportCsv(summary, rows);
    downloadCsv(`${base}.csv`, headers, body);
    return;
  }

  if (format === "excel") {
    const xml = financialReportExcelXml(summary, rows);
    downloadBlob(
      `${base}.xls`,
      new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    );
    return;
  }

  // PDF: open printable HTML (user uses browser Print → Save as PDF).
  const html = financialReportHtml(summary, rows);
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    downloadBlob(`${base}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
    return;
  }
  const htmlBlob = new Blob([html], { type: "text/html;charset=utf-8" });
  const htmlUrl = URL.createObjectURL(htmlBlob);
  w.location.replace(htmlUrl);
  window.setTimeout(() => URL.revokeObjectURL(htmlUrl), 60_000);
}
