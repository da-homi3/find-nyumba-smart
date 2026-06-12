/** Build and download a CSV file in the browser. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (cell: string) => {
    const s = String(cell ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
