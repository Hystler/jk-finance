import * as XLSX from "xlsx";

export type ImportKind = "menu" | "recipes" | "ingredients" | "capex" | "opex" | "tax";

export function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
}

export function parseCsvOrXlsx(file: File): Promise<Record<string, unknown>[]> {
  return file.arrayBuffer().then((buffer) => parseWorkbook(buffer));
}
