const cleanZero = (value?: number | null) => {
  const next = value ?? 0;
  return Object.is(next, -0) ? 0 : next;
};

const normalizeSpaces = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");

export function formatNumber(value?: number | null, digits = 0) {
  return normalizeSpaces(new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(cleanZero(value)));
}

export function formatRub(value?: number | null) {
  return `${formatNumber(value, 0)} ₽`;
}

export function formatPercent(value?: number | null, digits = 1) {
  return `${formatNumber(value, digits)} %`;
}

export function parseFormattedNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "")
    .replace(/[\s\u00a0\u202f₽%]/g, "")
    .replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export const rub = formatRub;

export const num = (value?: number | null, digits = 1) => formatNumber(value, digits);

export const percent = (value?: number | null) => formatPercent(cleanZero(value) * 100, 1);
