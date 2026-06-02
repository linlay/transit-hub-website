export function compactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function integer(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value || 0);
}

export function usdFromMicro(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format((value || 0) / 1_000_000);
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
