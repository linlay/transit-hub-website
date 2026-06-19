import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { compactNumber, compactTokenCount, dateTime, integer, formatCurrency } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { TrafficBucketName } from "../lib/types";

export function Traffic() {
  const { t } = useI18n();
  const [bucket, setBucket] = useState<TrafficBucketName>("day");
  const traffic = useQuery({ queryKey: ["traffic", bucket], queryFn: () => api.traffic({ bucket }), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const logs = useQuery({ queryKey: ["logs"], queryFn: () => api.logs({ limit: 100 }), refetchInterval: PAGE_REFETCH_INTERVAL_MS });

  return (
    <section className="page">
      <div className="page-actions">
        <RefreshButton isRefreshing={traffic.isFetching || logs.isFetching} onClick={() => Promise.all([traffic.refetch(), logs.refetch()])} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>{t("Traffic")}</h2>
          <div className="panel-actions">
            <select value={bucket} onChange={(event) => setBucket(event.target.value as TrafficBucketName)}>
              <option value="day">{t("Daily")}</option>
              <option value="hour">{t("Hourly")}</option>
              <option value="month">{t("Monthly")}</option>
            </select>
          </div>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={traffic.data?.items ?? []}>
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
              <YAxis yAxisId="requests" tickFormatter={compactNumber} tickLine={false} axisLine={false} />
              <YAxis yAxisId="tokens" orientation="right" tickFormatter={compactTokenCount} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value: number, name: string) => [name === "total_tokens" ? compactTokenCount(value) : integer(value), name === "total_tokens" ? t("Tokens") : t("Requests")]} />
              <Legend formatter={(value) => (value === "total_tokens" ? t("Tokens") : t("Requests"))} />
              <Bar yAxisId="requests" dataKey="requests" fill="#0a84ff" radius={[6, 6, 0, 0]} />
              <Line yAxisId="tokens" type="monotone" dataKey="total_tokens" stroke="#12b76a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
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
    </section>
  );
}
