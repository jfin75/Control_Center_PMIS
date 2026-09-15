/** Client-side exports. CSV is RFC 4180; "Excel" is SpreadsheetML 2003, which Excel opens natively. */

type Cell = string | number | null | undefined;

function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function save(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  save(filename, new Blob(["﻿" + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" }));
}

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function downloadExcel(filename: string, sheet: string, headers: string[], rows: Cell[][]) {
  const row = (cells: Cell[], head = false) =>
    `<Row>${cells
      .map((c) => {
        const isNum = typeof c === "number" && Number.isFinite(c);
        return `<Cell${head ? ' ss:StyleID="h"' : ""}><Data ss:Type="${isNum ? "Number" : "String"}">${isNum ? c : xml(String(c ?? ""))}</Data></Cell>`;
      })
      .join("")}</Row>`;
  const doc = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>
<Worksheet ss:Name="${xml(sheet.slice(0, 31))}"><Table>
${row(headers, true)}
${rows.map((r) => row(r)).join("\n")}
</Table></Worksheet></Workbook>`;
  save(filename, new Blob([doc], { type: "application/vnd.ms-excel" }));
}
