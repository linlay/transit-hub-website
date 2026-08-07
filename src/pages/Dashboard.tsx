import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageActions } from "../components/Layout";
import { MetricCard } from "../components/MetricCard";
import { RefreshButton } from "../components/RefreshButton";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { TrafficChart } from "../components/TrafficChart";
import { api, isTelemetryError } from "../lib/api";
import { compactNumber, compactTokenCount, integer, percent, currencyIntegerValue, percentValue } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { TrafficBucketName } from "../lib/types";

type DashboardRange = "all" | "today" | "7d" | "30d";

export function Dashboard() {
  const { t } = useI18n();
  const [bucket, setBucket] = useState<TrafficBucketName>("day");
  const [range, setRange] = useState<DashboardRange>("all");
  const overview = useQuery({
    queryKey: ["overview", range],
    queryFn: () => api.overview(dashboardRangeQuery(range)),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const traffic = useQuery({
    queryKey: ["dashboard-traffic", bucket, range],
    queryFn: () => api.traffic(dashboardTrafficQuery(bucket, range)),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const data = overview.data;
  const trafficItems = traffic.data?.items ?? [];
  const telemetryUnavailable = Boolean(data?.degraded_components?.includes("telemetry")) || isTelemetryError(traffic.error);
  const isRefreshing = overview.isFetching || traffic.isFetching;

  usePageActions(
    <>
      <select aria-label={t("Time range")} value={range} onChange={(event) => setRange(event.target.value as DashboardRange)}>
        <option value="all">{t("All time")}</option>
        <option value="today">{t("Today")}</option>
        <option value="7d">{t("Last 7 days")}</option>
        <option value="30d">{t("Last 30 days")}</option>
      </select>
      <RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([overview.refetch(), traffic.refetch()])} />
    </>,
    [range, isRefreshing, overview.refetch, traffic.refetch, t],
  );

  return (
    <section className="page">
      {telemetryUnavailable ? <TelemetryUnavailable /> : null}
      <div className="metrics-grid">
        {!telemetryUnavailable ? (
          <>
            <MetricCard label={t("Requests")} value={compactNumber(data?.total_requests ?? 0)} detail={t(dashboardRangeLabel(range))} />
            <MetricCard label={t("Tokens")} value={<span title={integer(data?.total_tokens ?? 0)}>{compactTokenCount(data?.total_tokens ?? 0)}</span>} detail={t("Prompt + completion")} />
            <MetricCard label={t("Cost")} value={currencyIntegerValue(data?.total_cost_micro ?? 0)} detail={t("Estimated (CNY)")} />
            <MetricCard label={t("Active devices")} value={integer(data?.active_devices ?? 0)} detail={t("Last 5 minutes")} />
            <MetricCard
              label={t("Error rate (%)")}
              value={percentValue(data?.total_requests ? (data.error_requests || 0) / data.total_requests : 0)}
              detail={t("{count} failed", { count: integer(data?.error_requests ?? 0) })}
            />
          </>
        ) : null}
        <MetricCard
          label={t("API keys")}
          value={integer(data?.api_keys.active ?? 0)}
          detail={t("{count} disabled", { count: integer(data?.api_keys.disabled ?? 0) })}
        />
      </div>

      {!telemetryUnavailable ? <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t("Recent traffic")}</h2>
            <span>{t("Requests by model and tokens by {bucket}", { bucket: t(bucket) })}</span>
          </div>
          <div className="panel-actions">
            <select value={bucket} onChange={(event) => setBucket(event.target.value as TrafficBucketName)}>
              <option value="hour">{t("Hourly")}</option>
              <option value="day">{t("Daily")}</option>
              <option value="month">{t("Monthly")}</option>
            </select>
          </div>
        </div>
        <TrafficChart items={trafficItems} />
      </section> : null}

      <section className="panel">
        <div className="panel-heading">
          <h2>{t("Quota watch")}</h2>
          <span>{t("Keys above 80% of request or token quota")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Prefix")}</th>
                <th>{t("Request use")}</th>
                <th>{t("Token use")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.risk_keys ?? []).map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>{key.key_prefix}</td>
                  <td>{percent(key.request_used_ratio)}</td>
                  <td>{percent(key.token_used_ratio)}</td>
                </tr>
              ))}
              {!data?.risk_keys?.length ? (
                <tr>
                  <td colSpan={4} className="muted-cell">
                    {t("No risky keys right now.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function dashboardTrafficQuery(bucket: TrafficBucketName, range: DashboardRange) {
  return { bucket, ...dashboardRangeQuery(range) };
}

function dashboardRangeQuery(range: DashboardRange) {
  if (range === "all") return {};

  const now = new Date();
  let from: Date;
  if (range === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else {
    const days = range === "7d" ? 7 : 30;
    from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

function dashboardRangeLabel(range: DashboardRange) {
  switch (range) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    default:
      return "All time";
  }
}
