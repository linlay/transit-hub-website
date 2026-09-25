import type { ReactNode } from "react";
import { compactTokenCount, creditAmount, dateTime, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { APIKey, RateLimit, RateLimitUsage, RateLimitWindow } from "../lib/types";

const windows: RateLimitWindow[] = ["1h", "5h", "1d", "7d", "30d"];
const windowNames = { "1h": "1 hour", "5h": "5 hours", "1d": "1 day", "7d": "7 days", "30d": "30 days" };
type UsageRow = Omit<RateLimit, "window"> & { window: RateLimitWindow | "total"; requests?: number; tokens?: number; charged_microcredits?: number; resets_at?: string; stale?: boolean; state?: string; starts_at?: string };

function currentUsage(key: APIKey, window: string, now: number): RateLimitUsage | undefined {
  if (key.rate_limit_usage_unavailable) return undefined;
  return key.rate_limit_usage?.find((item) => item.window === window && Date.parse(item.resets_at) > now);
}

export function keyHasWindowLimit(key: APIKey, now: number) {
  return (key.rate_limits ?? []).some((limit) => {
    const usage = currentUsage(key, limit.window, now);
    return usage && ((limit.quota_microcredits > 0 && usage.charged_microcredits >= limit.quota_microcredits)
      || (limit.request_quota > 0 && usage.requests >= limit.request_quota)
      || (limit.token_quota > 0 && usage.tokens >= limit.token_quota));
  });
}

function tone(used: number | undefined, limit: number) {
  if (used === undefined || limit <= 0) return "";
  return used >= limit ? "key-quota-exhausted" : used / limit >= 0.8 ? "key-quota-warning" : "";
}

export function KeyUsageCells({ apiKey: key, now }: { apiKey: APIKey; now: number }) {
  const { t } = useI18n();
  const rows: UsageRow[] = [
    { window: "total", requests: key.used_requests, tokens: key.used_tokens, charged_microcredits: key.used_microcredits,
      request_quota: key.request_quota, token_quota: key.token_quota, quota_microcredits: key.quota_microcredits ?? 0 },
    ...[...(key.rate_limits ?? [])].sort((a, b) => windows.indexOf(a.window) - windows.indexOf(b.window)).map((limit) => {
      const usage = currentUsage(key, limit.window, now);
      const previous = key.rate_limit_usage?.find((item) => item.window === limit.window);
      const waiting = !key.rate_limit_usage_unavailable && previous && (previous.state === "idle" || previous.state === "expired" || ((limit.window === "5h" || limit.window === "7d") && Date.parse(previous.resets_at) <= now));
      return { ...limit, requests: waiting ? 0 : usage?.requests, tokens: waiting ? 0 : usage?.tokens, charged_microcredits: waiting ? 0 : usage?.charged_microcredits,
        resets_at: usage?.resets_at, starts_at: usage?.starts_at, state: waiting ? (previous.state === "idle" ? "idle" : "expired") : undefined,
        stale: Boolean(previous && Date.parse(previous.resets_at) <= now) };
    }),
  ];
  const label = (row: UsageRow) => row.window === "total" ? t("Cumulative") : t(windowNames[row.window]);
  const stack = (render: (row: UsageRow) => ReactNode) => <div className="key-usage-stack">{rows.map((row) => <div className="key-usage-line" key={row.window}>{render(row)}</div>)}</div>;
  function quotaLabel(used: number | undefined, limit: number) {
    if (used === undefined || limit <= 0 || used / limit < 0.8) return "";
    return used >= limit ? t("Exhausted") : `${Math.floor(used / limit * 100)}%`;
  }
  function usageValue(row: UsageRow, used: number | undefined, limit: number, format: (value: number) => string) {
    const state = quotaLabel(used, limit);
    const full = `${label(row)}: ${used === undefined ? t("Usage unavailable") : integer(used)} / ${limit ? integer(limit) : t("Unlimited")}${state ? ` · ${state}` : ""}`;
    return <span className={`key-usage-detail ${tone(used, limit)}`} tabIndex={0} title={full} aria-label={full}>
      {used === undefined ? "—" : format(used)}
    </span>;
  }
  return <>
    <td>{stack((row) => <span className="muted-cell" title={label(row)}>{row.window === "total" ? t("Total") : row.window}</span>)}</td>
    <td>{stack((row) => <span className={tone(row.charged_microcredits, row.quota_microcredits)} title={`${label(row)}: ${row.charged_microcredits === undefined ? t("Usage unavailable") : creditAmount(row.charged_microcredits) + " Credits"}`}>{row.charged_microcredits === undefined ? "—" : creditAmount(row.charged_microcredits)}</span>)}</td>
    <td>{stack((row) => <span className={tone(row.charged_microcredits, row.quota_microcredits)} title={`${label(row)}: ${row.quota_microcredits ? creditAmount(row.quota_microcredits) + " Credits" : t("Unlimited")} · ${quotaLabel(row.charged_microcredits, row.quota_microcredits)}`}>
      {row.quota_microcredits ? creditAmount(row.quota_microcredits) : <span className="muted-cell" aria-label={t("Unlimited")}>∞</span>}
    </span>)}</td>
    <td>{stack((row) => usageValue(row, row.requests, row.request_quota, compactTokenCount))}</td>
    <td>{stack((row) => usageValue(row, row.tokens, row.token_quota, compactTokenCount))}</td>
    <td>{stack((row) => row.window === "total" ? <span className="muted-cell">—</span> : row.state
      ? <span className="muted-cell" title={t(row.state === "idle" ? "Starts on first use" : "Starts on next use")}>{t("Awaiting use")}</span> : row.resets_at
      ? <span className="muted-cell" title={`${dateTime(row.starts_at)} → ${dateTime(row.resets_at)}`}>{resetCountdown(row.resets_at, now)}</span>
      : <span className="muted-cell" title={t(row.stale ? "Awaiting window refresh" : "Usage unavailable")}>{row.stale ? t("Refreshing...") : "—"}</span>)}</td>
  </>;
}

function resetCountdown(value: string, now: number) {
  const minutes = Math.ceil((Date.parse(value) - now) / 60_000);
  if (minutes < 1) return "<1m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  if (days) return `${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours) return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  return `${minutes}m`;
}
