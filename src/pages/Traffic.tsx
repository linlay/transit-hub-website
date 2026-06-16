import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { compactTokenCount, dateTime, integer, formatCurrency } from "../lib/format";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

export function Traffic() {
  const [bucket, setBucket] = useState("day");
  const traffic = useQuery({ queryKey: ["traffic", bucket], queryFn: () => api.traffic({ bucket }), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const logs = useQuery({ queryKey: ["logs"], queryFn: () => api.logs({ limit: 100 }), refetchInterval: PAGE_REFETCH_INTERVAL_MS });

  return (
    <section className="page">
      <div className="page-actions">
        <RefreshButton isRefreshing={traffic.isFetching || logs.isFetching} onClick={() => Promise.all([traffic.refetch(), logs.refetch()])} />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Traffic</h2>
          <div className="panel-actions">
            <select value={bucket} onChange={(event) => setBucket(event.target.value)}>
              <option value="day">Daily</option>
              <option value="hour">Hourly</option>
            </select>
          </div>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={traffic.data?.items ?? []}>
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="requests" fill="#0a84ff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Request logs</h2>
          <span>Latest gateway activity</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Key</th>
                <th>Model</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Cost</th>
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
