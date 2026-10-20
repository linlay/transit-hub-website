import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { usePageActions } from "../components/Layout";
import { MetricCard } from "../components/MetricCard";
import { QueryFeedback } from "../components/QueryFeedback";
import { RefreshButton } from "../components/RefreshButton";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { api, isTelemetryError } from "../lib/api";
import { compactTokenCount, creditAmount, dateTime, integer, percent } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { UsageCalibration, UsageSource, UsageSourceSummary } from "../lib/types";

const ranges = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 } as const;
type RangeKey = keyof typeof ranges;

const sources: UsageSource[] = ["reported", "missing", "interrupted", "undecodable", "none"];
const sourceLabels: Record<UsageSource, string> = {
  reported: "Reported",
  missing: "Missing",
  interrupted: "Interrupted",
  undecodable: "Undecodable",
  none: "No usage",
};
const estimatedSources: UsageSource[] = ["missing", "interrupted", "undecodable"];

// Estimates within this band of reported usage are considered calibrated.
const calibratedBand = [0.8, 1.25] as const;

type ModelRow = {
  key: string;
  provider: string;
  model: string;
  counts: Record<UsageSource, number>;
  alerting: Set<UsageSource>;
  lastSeen: string;
};

export function UsageAudit() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const range: RangeKey = (params.get("range") ?? "") in ranges ? (params.get("range") as RangeKey) : "7d";
  const timeQuery = () => ({ from: new Date(Date.now() - ranges[range] * 3_600_000).toISOString() });

  const summary = useQuery({
    queryKey: ["usage-sources", range],
    queryFn: () => api.usageSources(timeQuery()),
    placeholderData: keepPreviousData,
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const calibration = useQuery({
    queryKey: ["usage-calibration", range],
    queryFn: () => api.usageCalibration(timeQuery()),
    placeholderData: keepPreviousData,
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const isRefreshing = summary.isFetching || calibration.isFetching;
  usePageActions(
    <>
      <select aria-label={t("Time range")} value={range} onChange={(event) => setParams({ range: event.target.value }, { replace: true })}>
        <option value="24h">{t("Last 24 hours")}</option>
        <option value="7d">{t("Last 7 days")}</option>
        <option value="30d">{t("Last 30 days")}</option>
      </select>
      <RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([summary.refetch(), calibration.refetch()])} />
    </>,
    [range, isRefreshing, summary.refetch, calibration.refetch, t],
  );

  const items = summary.data?.items ?? [];
  const anomalies = useMemo(
    () => items.filter((item) => item.alerting).sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at)),
    [items],
  );
  const rows = useMemo(() => modelRows(items), [items]);
  const totals = useMemo(() => {
    const counts = Object.fromEntries(sources.map((source) => [source, 0])) as Record<UsageSource, number>;
    for (const item of items) counts[item.usage_source] = (counts[item.usage_source] ?? 0) + item.requests;
    const observed = counts.reported + estimatedSources.reduce((sum, source) => sum + counts[source], 0);
    return { counts, observed, estimated: observed - counts.reported };
  }, [items]);

  if (isTelemetryError(summary.error) || isTelemetryError(calibration.error)) {
    return (
      <section className="page">
        <TelemetryUnavailable />
      </section>
    );
  }

  return (
    <section className="page">
      <QueryFeedback query={summary} />
      <div className="metrics-grid">
        <MetricCard label={t("Requests with upstream usage")} value={integer(totals.observed)} detail={t("{count} rejected or failed without usage", { count: integer(totals.counts.none) })} />
        <MetricCard
          label={t("Reported usage")}
          value={totals.observed ? percent(totals.counts.reported / totals.observed) : "-"}
          detail={t("{count} requests billed from upstream usage", { count: integer(totals.counts.reported) })}
        />
        <MetricCard label={t("Estimated usage")} value={integer(totals.estimated)} detail={t("Missing, interrupted or undecodable")} />
        <MetricCard label={t("Alerting models")} value={integer(new Set(anomalies.map((item) => `${item.provider}/${item.public_model}`)).size)} detail={t("Missing or undecodable usage on success")} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>{t("Usage anomalies")}</h2>
          <span>{t("Successful responses whose usage could not be read")}</span>
        </div>
        {anomalies.length ? (
          <div className="table-wrap data-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Provider")}</th>
                  <th>{t("Model")}</th>
                  <th>{t("Usage source")}</th>
                  <th className="numeric">{t("Requests")}</th>
                  <th className="numeric">{t("Estimated charge")}</th>
                  <th>{t("Last seen")}</th>
                  <th>{t("Upstream request ID")}</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((item) => (
                  <tr key={`${item.provider}:${item.public_model}:${item.usage_source}`}>
                    <td>{item.provider}</td>
                    <td>{item.public_model}</td>
                    <td><SourcePill source={item.usage_source} /></td>
                    <td className="numeric">{integer(item.success_requests)}</td>
                    <td className="numeric">{creditAmount(item.charged_microcredits)}</td>
                    <td>{dateTime(item.last_seen_at)}</td>
                    <td><code>{item.last_upstream_request_id || "-"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={summary.isPending ? "Loading..." : "No usage anomalies in this range."} />
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>{t("Usage source by model")}</h2>
          <span>{t("Logs written before usage sources were recorded are excluded")}</span>
        </div>
        <div className="table-wrap data-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Provider")}</th>
                <th>{t("Model")}</th>
                {sources.map((source) => (
                  <th key={source} className="numeric">{t(sourceLabels[source])}</th>
                ))}
                <th className="numeric">{t("Reported share")}</th>
                <th>{t("Last seen")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const observed = row.counts.reported + estimatedSources.reduce((sum, source) => sum + row.counts[source], 0);
                return (
                  <tr key={row.key}>
                    <td>{row.provider || "-"}</td>
                    <td>{row.model || t("Unparsed request")}</td>
                    {sources.map((source) => (
                      <td key={source} className="numeric">
                        {row.alerting.has(source) ? <span className="pill danger">{integer(row.counts[source])}</span> : integer(row.counts[source])}
                      </td>
                    ))}
                    <td className="numeric">{observed ? percent(row.counts.reported / observed) : "-"}</td>
                    <td>{dateTime(row.lastSeen)}</td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={sources.length + 4} className="muted-cell">
                    {summary.isPending ? t("Loading...") : summary.isError ? t("Unable to load data.") : t("No requests in this range.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>{t("Estimate calibration")}</h2>
          <span>{t("Reported tokens ÷ estimated tokens for requests with upstream usage; 1.00 means the estimate is exact")}</span>
        </div>
        <QueryFeedback query={calibration} />
        <div className="table-wrap data-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Provider")}</th>
                <th>{t("Model")}</th>
                <th className="numeric">{t("Samples")}</th>
                <th className="numeric">{t("Reported input")}</th>
                <th className="numeric">{t("Estimated input")}</th>
                <th className="numeric">{t("Input ratio")}</th>
                <th className="numeric">{t("Text samples")}</th>
                <th className="numeric">{t("Reported output")}</th>
                <th className="numeric">{t("Estimated output")}</th>
                <th className="numeric">{t("Output ratio")}</th>
              </tr>
            </thead>
            <tbody>
              {(calibration.data?.items ?? []).map((item: UsageCalibration) => (
                <tr key={`${item.provider}:${item.public_model}`}>
                  <td>{item.provider}</td>
                  <td>{item.public_model}</td>
                  <td className="numeric">{integer(item.samples)}</td>
                  <td className="numeric" title={integer(item.reported_input_tokens)}>{compactTokenCount(item.reported_input_tokens)}</td>
                  <td className="numeric" title={integer(item.estimated_input_tokens)}>{compactTokenCount(item.estimated_input_tokens)}</td>
                  <td className="numeric"><RatioPill value={item.input_ratio} /></td>
                  <td className="numeric">{integer(item.output_samples)}</td>
                  <td className="numeric" title={integer(item.reported_output_tokens)}>{compactTokenCount(item.reported_output_tokens)}</td>
                  <td className="numeric" title={integer(item.estimated_output_tokens)}>{compactTokenCount(item.estimated_output_tokens)}</td>
                  <td className="numeric"><RatioPill value={item.output_ratio} /></td>
                </tr>
              ))}
              {!calibration.data?.items?.length ? (
                <tr>
                  <td colSpan={10} className="muted-cell">
                    {calibration.isPending ? t("Loading...") : calibration.isError ? t("Unable to load data.") : t("No calibration samples in this range.")}
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

function modelRows(items: UsageSourceSummary[]): ModelRow[] {
  const rows = new Map<string, ModelRow>();
  for (const item of items) {
    const key = `${item.provider}/${item.public_model}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        provider: item.provider,
        model: item.public_model,
        counts: Object.fromEntries(sources.map((source) => [source, 0])) as Record<UsageSource, number>,
        alerting: new Set(),
        lastSeen: item.last_seen_at,
      };
      rows.set(key, row);
    }
    row.counts[item.usage_source] = (row.counts[item.usage_source] ?? 0) + item.requests;
    if (item.alerting) row.alerting.add(item.usage_source);
    if (item.last_seen_at > row.lastSeen) row.lastSeen = item.last_seen_at;
  }
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function SourcePill({ source }: { source: UsageSource }) {
  const { t } = useI18n();
  const tone = source === "reported" ? "good" : source === "missing" || source === "undecodable" ? "danger" : "muted";
  return <span className={`pill ${tone}`}>{t(sourceLabels[source] ?? source)}</span>;
}

function RatioPill({ value }: { value: number | null }) {
  if (value == null) return <>-</>;
  const calibrated = value >= calibratedBand[0] && value <= calibratedBand[1];
  return <span className={`pill ${calibrated ? "good" : "danger"}`}>{value.toFixed(2)}</span>;
}
