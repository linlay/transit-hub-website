import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { TrafficChart } from "../components/TrafficChart";
import { api, isTelemetryError } from "../lib/api";
import { compactTokenCount, dateTime, integer, formatCurrency } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { TrafficBucketName } from "../lib/types";

export function Traffic() {
  const { t } = useI18n();
  const [bucket, setBucket] = useState<TrafficBucketName>("day");
  const traffic = useQuery({ queryKey: ["traffic", bucket], queryFn: () => api.traffic({ bucket }), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const logs = useQuery({ queryKey: ["logs"], queryFn: () => api.logs({ limit: 100 }), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const telemetryUnavailable = isTelemetryError(traffic.error) || isTelemetryError(logs.error);
  const isRefreshing = traffic.isFetching || logs.isFetching;

  usePageActions(<RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([traffic.refetch(), logs.refetch()])} />, [isRefreshing, traffic.refetch, logs.refetch]);

  return (
    <section className="page">
      {telemetryUnavailable ? <TelemetryUnavailable /> : null}
      {!telemetryUnavailable ? (
      <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t("Traffic")}</h2>
            <span>{t("Requests by model and tokens by {bucket}", { bucket: t(bucket) })}</span>
          </div>
          <div className="panel-actions">
            <select value={bucket} onChange={(event) => setBucket(event.target.value as TrafficBucketName)}>
              <option value="day">{t("Daily")}</option>
              <option value="hour">{t("Hourly")}</option>
              <option value="month">{t("Monthly")}</option>
            </select>
          </div>
        </div>
        <TrafficChart items={traffic.data?.items ?? []} />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("Request logs")}</h2>
          <span>{t("Latest gateway activity")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Time")}</th>
                <th>{t("Key")}</th>
                <th>{t("Model")}</th>
                <th>{t("Provider")}</th>
                <th>{t("Status")}</th>
                <th>{t("Latency")}</th>
                <th>{t("Tokens")}</th>
                <th>{t("Cost")}</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data?.items ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{dateTime(log.created_at)}</td>
                  <td>{log.api_key_name}</td>
                  <td>{log.public_model}</td>
                  <td>{log.provider}</td>
                  <td>{log.status_code}</td>
                  <td>{integer(log.latency_ms)} ms</td>
                  <td title={integer(log.total_tokens)}>{compactTokenCount(log.total_tokens)}</td>
                  <td>{formatCurrency(log.cost_micro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>
      ) : null}
    </section>
  );
}
