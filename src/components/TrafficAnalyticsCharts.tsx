import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, compactTokenCount, integer, MICRO_PER_CREDIT, percent } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { TrafficBucket, TrafficRanking } from "../lib/types";

type RankingMetric = "requests" | "total_tokens" | "cost_micro";
export function TrafficRankingChart({ title, rows, onSelect }: { title: string; rows: TrafficRanking[]; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const [metric, setMetric] = useState<RankingMetric>("requests");
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric] || a.id.localeCompare(b.id));
  const max = rows.reduce((maximum, row) => Math.max(maximum, row[metric]), 1);
  return <section className="panel">
    <div className="panel-heading">
      <div><h2>{t(title)}</h2><span>{t("Click a row to filter")}</span></div>
      <select aria-label={t(title)} value={metric} onChange={(e) => setMetric(e.target.value as RankingMetric)}>
        <option value="requests">{t("Requests")}</option><option value="total_tokens">{t("Tokens")}</option><option value="cost_micro">{t("Spend (Credits)")}</option>
      </select>
    </div>
    <div className="traffic-ranking">
      {sorted.map((row) => <button type="button" className="traffic-ranking-row" key={row.id} onClick={() => onSelect(row.id)}>
        <span className="traffic-ranking-name" title={row.id}>{row.name || row.id || t("Unknown")}</span>
        <span className="traffic-ranking-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, row[metric] / max * 100)}%` }} /></span>
        <strong>{integer(metric === "cost_micro" ? Math.round(row[metric] / MICRO_PER_CREDIT) : row[metric])}</strong>
      </button>)}
    </div>
  </section>;
}

export function TrafficMetricsChart({ items, kind }: { items: TrafficBucket[]; kind: "tokens" | "quality" }) {
  const { t, locale } = useI18n();
  const tokens = kind === "tokens";
  const data = items.map((item) => ({ ...item, error_rate: item.requests ? item.error_requests / item.requests : 0 }));
  return <section className="panel">
    <div className="panel-heading"><h2>{t(tokens ? "Tokens and cache" : "Request quality")}</h2></div>
    <div className="chart" role="img" aria-label={t(tokens ? "Tokens and cache" : "Request quality")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" tickFormatter={tokens ? compactTokenCount : percent} domain={tokens ? [0, "auto"] : [0, 1]} tickLine={false} axisLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={tokens ? percent : compactNumber} domain={tokens ? [0, 1] : [0, "auto"]} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value: number, name: string, entry) => [entry.dataKey === "cache_hit_rate" || entry.dataKey === "error_rate" ? new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value) : entry.dataKey === "average_latency_ms" ? `${integer(Math.round(value))} ms` : integer(value), name]} />
          <Legend />
          {tokens ? <>
            <Bar isAnimationActive={false} yAxisId="left" dataKey="request_tokens" stackId="tokens" name={t("Input")} fill="#0a84ff" />
            <Bar isAnimationActive={false} yAxisId="left" dataKey="response_tokens" stackId="tokens" name={t("Output")} fill="#7c3aed" />
            <Line isAnimationActive={false} yAxisId="right" dataKey="cache_hit_rate" name={t("Cache hit rate")} stroke="#12b76a" dot={false} strokeWidth={2} />
          </> : <>
            <Bar isAnimationActive={false} yAxisId="left" dataKey="error_rate" name={t("Failure rate")} fill="#f97316" />
            <Line isAnimationActive={false} yAxisId="right" dataKey="average_latency_ms" name={t("Average latency (ms)")} stroke="#7c3aed" dot={false} strokeWidth={2} />
          </>}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </section>;
}
