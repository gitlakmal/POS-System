/** Excel-friendly CSV download (UTF-8 BOM so Sinhala text opens correctly in Excel). */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`; // block CSV formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
