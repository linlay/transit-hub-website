import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { usePageActions } from "../components/Layout";
import { MetricCard } from "../components/MetricCard";
import { RefreshButton } from "../components/RefreshButton";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { TrafficChart } from "../components/TrafficChart";
import { UsageChart } from "../components/UsageChart";
import { TrafficMetricsChart, TrafficRankingChart } from "../components/TrafficAnalyticsCharts";
import { TrafficFilterSelect } from "../components/TrafficFilterSelect";
import { TrafficLogsDialog } from "../components/TrafficLogsDialog";
import { api, isTelemetryError } from "../lib/api";
import { compactTokenCount, integer, MICRO_PER_CREDIT } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { TrafficAnalytics } from "../lib/types";
import { trafficSelections, trafficTimeRange } from "../lib/trafficFilters";

export function Traffic() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const [logsOpen, setLogsOpen] = useState(false);
  const range = ["today", "yesterday", "7d", "30d", "custom"].includes(params.get("range") ?? "") ? params.get("range")! : "7d";
  const bucket = ["hour", "day", "month"].includes(params.get("bucket") ?? "") ? params.get("bucket")! : "day";
  const offset = params.get("timezone") === "UTC" ? 0 : 480;
  const timezone = offset === 0 ? "UTC" : "Asia/Shanghai";
  const keys = trafficSelections(params.get("keys"));
  const models = trafficSelections(params.get("models"));
  const provider = params.get("provider") ?? "";
  const status = ["success", "failed"].includes(params.get("status") ?? "") ? params.get("status")! : "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const dates = trafficTimeRange(range, from, to, offset, Date.now());
  const query = { ...dates, bucket, timezone_offset: offset, exclusive_end: true, api_key_ids: JSON.stringify(keys), models: JSON.stringify(models), provider, status };
  const [logsQuery, setLogsQuery] = useState(query);
  const analytics = useQuery({
    // Keep the cache identity tied to filters, not the moving end timestamp.
    queryKey: ["traffic-analytics", { range, from, to, bucket, offset, keys, models, provider, status }],
    queryFn: async () => {
      const request = { ...query, ...trafficTimeRange(range, from, to, offset, Date.now()) };
      return { result: await api.trafficAnalytics(request), request };
    },
    enabled: Boolean(dates),
    refetchInterval: logsOpen ? false : PAGE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: !logsOpen,
  });
  const data = analytics.data?.result;
  const [cachedOptions, setCachedOptions] = useState<TrafficAnalytics["options"]>({ keys: [], models: [], providers: [] });
  useEffect(() => { if (data) setCachedOptions(data.options); }, [data]);
  const options = data?.options ?? cachedOptions;
  const summary = data?.summary;
  const items = data?.items ?? [];

  function change(values: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === "" || value === "[]") next.delete(key); else next.set(key, value);
    }
    setParams(next);
  }
  function select(field: "keys" | "models", values: string[]) { change({ [field]: JSON.stringify(values) }); }
  usePageActions(<RefreshButton disabled={!dates} isRefreshing={analytics.isFetching} onClick={() => analytics.refetch()} />, [Boolean(dates), analytics.isFetching, analytics.refetch]);

  return <section className="page traffic-page">
    <section className="panel traffic-filters">
      <div className="panel-heading"><div><h2>{t("Traffic analysis")}</h2><span>{t("All charts follow the filters below")}</span></div><button type="button" className="icon-text" onClick={() => { setParams({}); }}>{t("Reset")}</button></div>
      <div className="traffic-filter-grid">
        <label>{t("Time range")}<select value={range} onChange={(e) => change({ range: e.target.value })}>
          <option value="today">{t("Today")}</option><option value="yesterday">{t("Yesterday")}</option><option value="7d">{t("Last 7 days")}</option><option value="30d">{t("Last 30 days")}</option><option value="custom">{t("Custom dates")}</option>
        </select></label>
        <div><span className="traffic-filter-label">{t("API keys")}</span><TrafficFilterSelect label="API keys" options={options.keys} values={keys} onChange={(values) => select("keys", values)} /></div>
        <div><span className="traffic-filter-label">{t("Models")}</span><TrafficFilterSelect label="Models" options={options.models} values={models} onChange={(values) => select("models", values)} /></div>
        <label>{t("Granularity")}<select value={bucket} onChange={(e) => change({ bucket: e.target.value })}><option value="hour">{t("Hourly")}</option><option value="day">{t("Daily")}</option><option value="month">{t("Monthly")}</option></select></label>
        <label>{t("Time zone")}<select value={timezone} onChange={(e) => change({ timezone: e.target.value })}><option value="Asia/Shanghai">UTC+8 · {t("Beijing time")}</option><option value="UTC">UTC</option></select></label>
      </div>
      {range === "custom" ? <div className="traffic-custom-dates"><label>{t("Start date")}<input type="date" value={from} onChange={(e) => change({ from: e.target.value })} /></label><label>{t("End date (inclusive)")}<input type="date" value={to} min={from} onChange={(e) => change({ to: e.target.value })} /></label></div> : null}
      <details className="traffic-advanced" open={provider || status ? true : undefined}>
        <summary>{t("Advanced filters")}</summary>
        <div className="traffic-custom-dates"><label>{t("Provider")}<select value={provider} onChange={(e) => change({ provider: e.target.value })}><option value="">{t("All")}</option>{options.providers.filter((item) => item.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}{provider && !options.providers.some((item) => item.id === provider) ? <option value={provider}>{provider}</option> : null}</select></label><label>{t("Request result")}<select value={status} onChange={(e) => change({ status: e.target.value })}><option value="">{t("All")}</option><option value="success">{t("Successful")}</option><option value="failed">{t("Failed")}</option></select></label></div>
      </details>
      {keys.length || models.length ? <div className="traffic-selected">{keys.map((id) => <button className="icon-text" type="button" key={`key-${id}`} onClick={() => select("keys", keys.filter((value) => value !== id))}>{t("Key")}: {options.keys.find((option) => option.id === id)?.name || id || t("Unknown")} ×</button>)}{models.map((id) => <button className="icon-text" type="button" key={`model-${id}`} onClick={() => select("models", models.filter((value) => value !== id))}>{t("Model")}: {id || t("Unknown")} ×</button>)}</div> : null}
      <p className="traffic-note">{t("Based on retained request logs; bucketed by completion time.")}</p>
    </section>
    {data && analytics.error ? <div className="form-error" role="status">{t("Unable to refresh analytics; showing the last successful results")}</div> : null}
    {!dates ? <div className="form-error" role="alert">{t("Choose a valid start and end date")}</div> : analytics.isPending ? <section className="panel" role="status">{t("Loading analytics...")}</section> : analytics.error && !data ? isTelemetryError(analytics.error) ? <TelemetryUnavailable /> : <div className="form-error" role="alert">{t("Unable to load analytics")}</div> : <>
      <div className="metrics-grid">
        <MetricCard label={t("Requests")} value={integer(summary?.requests ?? 0)} />
        <MetricCard label={t("Tokens")} value={compactTokenCount(summary?.total_tokens ?? 0)} />
        <MetricCard label={t("Spend (Credits)")} value={integer(Math.round((summary?.cost_micro ?? 0) / MICRO_PER_CREDIT))} />
        <MetricCard label={t("Active API keys")} value={integer(summary?.unique_api_keys ?? 0)} detail={t("Distinct across selected range")} />
        <MetricCard label={t("Failure rate")} value={new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(summary?.requests ? summary.error_requests / summary.requests : 0)} />
        <MetricCard label={t("Average latency (ms)")} value={integer(Math.round(summary?.average_latency_ms ?? 0))} />
      </div>
      <div className="traffic-results-toolbar"><span>{t("Filtered results")} · {timezone}</span><button className="icon-text" type="button" onClick={() => { setLogsQuery(analytics.data?.request ?? query); setLogsOpen(true); }}>{t("View matching requests")}</button></div>
      {!items.length ? <section className="panel">{t("No requests match these filters")}</section> : <div className="traffic-charts-grid">
        <section className="panel"><div className="panel-heading"><div><h2>{t("Call trend")}</h2><span>{t("Requests by model and tokens by {bucket}", { bucket: t(bucket) })}</span></div></div><TrafficChart items={items} animate={false} /></section>
        <section className="panel"><div className="panel-heading"><h2>{t("Activity and spend")}</h2></div><UsageChart items={items} metric="credits" animate={false} /></section>
        <TrafficRankingChart title="Model ranking" rows={data?.models ?? []} onSelect={(id) => select("models", [id])} />
        {keys.length !== 1 ? <TrafficRankingChart title="API Key ranking" rows={data?.keys ?? []} onSelect={(id) => select("keys", [id])} /> : null}
        <TrafficMetricsChart items={items} kind="tokens" />
        <TrafficMetricsChart items={items} kind="quality" />
      </div>}
    </>}
    {logsOpen && dates ? <TrafficLogsDialog query={logsQuery} timezone={timezone} onClose={() => setLogsOpen(false)} /> : null}
  </section>;
}
