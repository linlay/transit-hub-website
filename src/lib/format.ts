export const CURRENCY = import.meta.env.VITE_CURRENCY ?? "CNY";

export type FormatLocale = "zh-CN" | "en-US";

let currentLocale: FormatLocale = initialFormatLocale();

export function setFormatLocale(locale: FormatLocale) {
  currentLocale = locale;
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat(currentLocale, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function compactTokenCount(value: number) {
  return new Intl.NumberFormat(currentLocale, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function integer(value: number) {
  return new Intl.NumberFormat(currentLocale).format(value || 0);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(currencyLocale(), { style: "currency", currency: CURRENCY, maximumFractionDigits: 4 }).format((value || 0) / 1_000_000);
}

export function formatCurrencyInteger(value: number) {
  return new Intl.NumberFormat(currencyLocale(), { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format((value || 0) / 1_000_000);
}

export function currencyIntegerValue(value: number) {
  return new Intl.NumberFormat(currentLocale, { maximumFractionDigits: 0 }).format(
    Math.round((value || 0) / 1_000_000),
  );
}

export function percentValue(value: number) {
  return String(Math.round((value || 0) * 100));
}

export function dateTime(value?: string) {
  if (!value) return currentLocale === "zh-CN" ? "从未" : "Never";
  return new Intl.DateTimeFormat(currentLocale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function percent(value: number) {
  return `${Math.round((value || 0) * 100)}%`;
}

export function nullablePercent(value?: number | null) {
  if (value === null || value === undefined) return currentLocale === "zh-CN" ? "无" : "n/a";
  return percent(value);
}

export function quotaRatio(used: number, quota: number) {
  if (!quota) return 0;
  return Math.min(1, used / quota);
}

function currencyLocale() {
  if (CURRENCY === "CNY") return currentLocale;
  return currentLocale === "zh-CN" ? "zh-CN" : "en-US";
}

function initialFormatLocale(): FormatLocale {
  if (typeof navigator === "undefined") return "en-US";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}
