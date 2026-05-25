import * as XLSX from "xlsx";
import { looksLikeMojibake } from "@/lib/text-normalize";

export type CsvDecodeResult = {
  text: string;
  detectedEncoding: "utf-8-bom" | "utf-8" | "windows-1251";
  encodingIssueDetected: boolean;
};

export function decodeCsvBytes(input: ArrayBuffer | Uint8Array): CsvDecodeResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hasBom ? bytes.slice(3) : bytes;

  const utf8 = decode(body, "utf-8", true);
  if (utf8 && !looksLikeMojibake(utf8)) {
    return { text: utf8, detectedEncoding: hasBom ? "utf-8-bom" : "utf-8", encodingIssueDetected: false };
  }

  const cp1251 = decode(body, "windows-1251", false) ?? "";
  if (cp1251 && (!utf8 || looksBetter(cp1251, utf8))) {
    return { text: cp1251, detectedEncoding: "windows-1251", encodingIssueDetected: false };
  }

  const text = utf8 ?? cp1251;
  return { text, detectedEncoding: hasBom ? "utf-8-bom" : "utf-8", encodingIssueDetected: looksLikeMojibake(text) };
}

export function parseCsvRows(input: ArrayBuffer | Uint8Array) {
  const decoded = decodeCsvBytes(input);
  const workbook = XLSX.read(decoded.text, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }) : [];
  return { rows, ...decoded };
}

function decode(bytes: Uint8Array, encoding: string, fatal: boolean) {
  try {
    return new TextDecoder(encoding, { fatal }).decode(bytes);
  } catch {
    return null;
  }
}

function looksBetter(candidate: string, current: string) {
  const candidateHasCyrillic = /[А-Яа-яЁё]/.test(candidate);
  const currentHasMojibake = looksLikeMojibake(current);
  return candidateHasCyrillic && currentHasMojibake;
}
