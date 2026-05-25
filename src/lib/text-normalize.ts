const INVISIBLE_CHARS = /[\u0000-\u001F\u007F-\u009F\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const SPACE_CHARS = /[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g;
const MOJIBAKE_MARKERS = /(?:Ð|Ñ|�|Â|Ã|ЁЂ)/;
const CYRILLIC = /[А-Яа-яЁё]/;

export function normalizeLookupKey(value: unknown) {
  return cleanImportedText(value)
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .toLowerCase();
}

export function normalizeCompositeKey(...parts: unknown[]) {
  return parts.map((part) => normalizeLookupKey(part)).join("::");
}

export function cleanImportedText(value: unknown) {
  return normalizeHumanText(repairMojibake(String(value ?? "")));
}

export function normalizeHumanText(value: string) {
  return value.normalize("NFC").replace(INVISIBLE_CHARS, "").replace(SPACE_CHARS, " ").trim();
}

export function looksLikeMojibake(value: unknown) {
  const text = String(value ?? "");
  return MOJIBAKE_MARKERS.test(text);
}

export function repairMojibake(value: unknown) {
  const text = String(value ?? "");
  if (!looksLikeMojibake(text)) return text;

  const bytes = new Uint8Array(Array.from(text, (char) => char.charCodeAt(0) & 0xff));
  const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!CYRILLIC.test(repaired)) return text;
  if (mojibakeScore(repaired) >= mojibakeScore(text)) return text;
  return repaired;
}

export function hasMojibakeInRecord(row: Record<string, unknown>) {
  return Object.values(row).some((value) => looksLikeMojibake(value));
}

function mojibakeScore(value: string) {
  const markers = value.match(MOJIBAKE_MARKERS);
  const replacementChars = value.match(/�/g);
  return (markers?.length ?? 0) + (replacementChars?.length ?? 0);
}
