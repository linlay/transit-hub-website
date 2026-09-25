
export type FormatLocale = "zh-CN" | "en-US";

let currentLocale: FormatLocale = initialFormatLocale();

export function setFormatLocale(locale: FormatLocale) {
  currentLocale = locale;
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat(currentLocale, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function compactTokenCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function integer(value: number) {
  return new Intl.NumberFormat(currentLocale).format(value || 0);
}

export function decimal(value: number) {
  return new Intl.NumberFormat(currentLocale, { maximumFractionDigits: 1 }).format(value || 0);
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


function initialFormatLocale(): FormatLocale {
  if (typeof navigator === "undefined") return "en-US";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export const MICRO_PER_CREDIT = 1_000_000;
export function creditsInputValue(value: number) {
 if (!Number.isSafeInteger(value)) throw new Error("Invalid Credits amount");
 const amount = BigInt(value);
 const absolute = amount < 0n ? -amount : amount;
 const whole = absolute / 1_000_000n;
 const fraction = String(absolute % 1_000_000n).padStart(6, "0").replace(/0+$/, "");
 return `${amount < 0n ? "-" : ""}${whole}${fraction ? "." + fraction : ""}`;
}
export function creditAmount(value: number) {
 const [whole, fraction] = creditsInputValue(value).split(".");
 const negative = whole.startsWith("-");
 const grouped = new Intl.NumberFormat(currentLocale).format(BigInt(negative ? whole.slice(1) : whole));
 return `${negative ? "-" : ""}${grouped}${fraction ? "." + fraction : ""}`;
}
export function formatCredits(value: number) {
 return `${creditAmount(value || 0)} Credits`;
}
// Parse decimal form inputs without binary floating point monetary arithmetic.
export function decimalToMicro(value: FormDataEntryValue | string | null, scale = 1_000_000) {
 const text = String(value ?? "").trim() || "0";
 if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Invalid amount");
 const [whole, fraction = ""] = text.split(".");
 const digits = String(scale).length - 1;
 if (fraction.length > digits) throw new Error("Amount has too many decimal places");
 const result = BigInt(whole) * BigInt(scale) + BigInt(fraction.padEnd(digits,"0") || "0");
 if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large");
 return Number(result);
}
