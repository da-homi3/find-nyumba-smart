import { formatKes } from "@/lib/properties";

export type FinancialReportInvoiceRow = {
  propertyName: string;
  unitLabel: string;
  tenantName: string;
  periodMonth: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  lateFee: number;
  status: string;
};

export type FinancialReportSummary = {
  propertyName: string;
  periodMonth: string;
  invoiceCount: number;
  totalDue: number;
  totalPaid: number;
  totalLateFees: number;
  totalOutstanding: number;
  collectionRate: number;
};

export function buildFinancialReportSummary(
  propertyName: string,
  periodMonth: string,
  rows: FinancialReportInvoiceRow[],
): FinancialReportSummary {
  let totalDue = 0;
  let totalPaid = 0;
  let totalLateFees = 0;
  let totalOutstanding = 0;
  for (const r of rows) {
    totalDue += r.amountDue;
    totalPaid += r.amountPaid;
    totalLateFees += r.lateFee;
    if (r.status !== "paid") {
      totalOutstanding += Math.max(0, r.amountDue + r.lateFee - r.amountPaid);
    }
  }
  const collectionRate =
    totalDue <= 0 ? 100 : Math.round((totalPaid / totalDue) * 100);
  return {
    propertyName,
    periodMonth,
    invoiceCount: rows.length,
    totalDue,
    totalPaid,
    totalLateFees,
    totalOutstanding,
    collectionRate: Math.min(100, Math.max(0, collectionRate)),
  };
}

export function financialReportCsv(
  summary: FinancialReportSummary,
  rows: FinancialReportInvoiceRow[],
): { headers: string[]; body: string[][] } {
  const headers = [
    "Property",
    "Unit",
    "Tenant",
    "Period",
    "Due date",
    "Amount due",
    "Paid",
    "Late fee",
    "Outstanding",
    "Status",
  ];
  const body = [
    ...rows.map((r) => [
      r.propertyName,
      r.unitLabel,
      r.tenantName,
      r.periodMonth,
      r.dueDate,
      String(r.amountDue),
      String(r.amountPaid),
      String(r.lateFee),
      String(Math.max(0, r.amountDue + r.lateFee - r.amountPaid)),
      r.status,
    ]),
    [],
    ["Summary", "", "", summary.periodMonth, "", "", "", "", "", ""],
    ["Total due", "", "", "", "", String(summary.totalDue), "", "", "", ""],
    ["Total paid", "", "", "", "", "", String(summary.totalPaid), "", "", ""],
    ["Outstanding", "", "", "", "", "", "", "", String(summary.totalOutstanding), ""],
    ["Collection rate %", "", "", "", "", "", "", "", String(summary.collectionRate), ""],
  ];
  return { headers, body };
}

/** SpreadsheetML that Excel opens as .xls — no npm dependency. */
export function financialReportExcelXml(
  summary: FinancialReportSummary,
  rows: FinancialReportInvoiceRow[],
): string {
  const { headers, body } = financialReportCsv(summary, rows);
  const escape = (s: string) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const cell = (v: string) => `<Cell><Data ss:Type="String">${escape(v)}</Data></Cell>`;
  const rowXml = (cells: string[]) => `<Row>${cells.map(cell).join("")}</Row>`;
  const tableRows = [rowXml(headers), ...body.filter((r) => r.length).map((r) => rowXml(r))];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Rent report">
  <Table>
${tableRows.join("\n")}
  </Table>
 </Worksheet>
</Workbook>`;
}

/** Minimal printable HTML suitable for Save as PDF from the browser. */
export function financialReportHtml(
  summary: FinancialReportSummary,
  rows: FinancialReportInvoiceRow[],
): string {
  const tr = rows
    .map(
      (r) => `<tr>
      <td>${escapeHtml(r.unitLabel)}</td>
      <td>${escapeHtml(r.tenantName)}</td>
      <td>${escapeHtml(r.periodMonth)}</td>
      <td>${escapeHtml(r.dueDate)}</td>
      <td>${formatKes(r.amountDue)}</td>
      <td>${formatKes(r.amountPaid)}</td>
      <td>${formatKes(r.lateFee)}</td>
      <td>${escapeHtml(r.status)}</td>
    </tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Rent report — ${escapeHtml(summary.propertyName)}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 8px}
  .meta{color:#555;font-size:13px;margin-bottom:20px}
  table{border-collapse:collapse;width:100%;font-size:13px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f5f5f5}
  .summary{margin-top:24px;font-size:14px}
  @media print{button{display:none}}
</style></head><body>
<button onclick="window.print()">Print / Save as PDF</button>
<h1>${escapeHtml(summary.propertyName)} — rent report</h1>
<p class="meta">Period ${escapeHtml(summary.periodMonth)} · ${summary.invoiceCount} invoices ·
collection ${summary.collectionRate}%</p>
<table>
<thead><tr>
<th>Unit</th><th>Tenant</th><th>Period</th><th>Due</th>
<th>Amount due</th><th>Paid</th><th>Late fee</th><th>Status</th>
</tr></thead>
<tbody>${tr}</tbody>
</table>
<div class="summary">
  <p><strong>Total due:</strong> ${formatKes(summary.totalDue)}</p>
  <p><strong>Total paid:</strong> ${formatKes(summary.totalPaid)}</p>
  <p><strong>Outstanding:</strong> ${formatKes(summary.totalOutstanding)}</p>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
