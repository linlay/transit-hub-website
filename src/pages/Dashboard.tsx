import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "../components/MetricCard";
import { api } from "../lib/api";
import { compactNumber, integer, percent, usdFromMicro } from "../lib/format";

export function Dashboard() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 30_000 });
  const data = overview.data;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Operations</span>
          <h1>Dashboard</h1>
        </div>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Requests" value={compactNumber(data?.total_requests ?? 0)} detail="All time" />
        <MetricCard label="Tokens" value={compactNumber(data?.total_tokens ?? 0)} detail="Prompt + completion" />
        <MetricCard label="Cost" value={usdFromMicro(data?.total_cost_microusd ?? 0)} detail="Estimated" />
        <MetricCard label="Active devices" value={integer(data?.active_devices ?? 0)} detail="Last 5 minutes" />
        <MetricCard
          label="Error rate"
          value={percent(data?.total_requests ? (data.error_requests || 0) / data.total_requests : 0)}
          detail={`${integer(data?.error_requests ?? 0)} failed`}
        />
        <MetricCard
          label="API keys"
          value={integer(data?.api_keys.active ?? 0)}
          detail={`${integer(data?.api_keys.disabled ?? 0)} disabled`}
        />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Recent traffic</h2>
          <span>Requests by day</span>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.recent_traffic ?? []}>
              <defs>
                <linearGradient id="requests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0a84ff" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#0a84ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="requests" stroke="#0a84ff" fill="url(#requests)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Quota watch</h2>
          <span>Keys above 80% of request or token quota</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Request use</th>
                <th>Token use</th>
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
                    No risky keys right now.
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
