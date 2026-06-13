export const CURRENCY = import.meta.env.VITE_CURRENCY ?? "CNY";
const CURRENCY_LOCALE = CURRENCY === "CNY" ? "zh-CN" : "en-US";

export function compactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function compactTokenCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function integer(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(CURRENCY_LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 4 }).format((value || 0) / 1_000_000);
}

export function dateTime(value?: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("zh-CN", {
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
  if (value === null || value === undefined) return "n/a";
  return percent(value);
}

export function quotaRatio(used: number, quota: number) {
  if (!quota) return 0;
  return Math.min(1, used / quota);
}
