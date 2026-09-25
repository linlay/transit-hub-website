import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, decimal, integer, MICRO_PER_CREDIT } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { TrafficBucket } from "../lib/types";

type UsageChartProps = {
  items: TrafficBucket[];
  animate?: boolean;
  metric?: "average_requests" | "credits";
};

export function UsageChart({ items, metric = "average_requests", animate = true }: UsageChartProps) {
  const { t } = useI18n();
  const showCredits = metric === "credits";
  const data = items.map((item) => {
    const uniqueAPIKeys = item.unique_api_keys ?? 0;
    return {
      bucket: item.bucket,
      credits: (item.charged_microcredits ?? 0) / MICRO_PER_CREDIT,
      unique_api_keys: uniqueAPIKeys,
      average_requests_per_key: uniqueAPIKeys > 0 ? item.requests / uniqueAPIKeys : 0,
    };
  });

  return (
    <div className="chart" role="img" aria-label={t(showCredits ? "Active API keys and total Credits" : "Unique API keys and average requests per key")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
          <YAxis yAxisId="keys" allowDecimals={false} tickFormatter={compactNumber} tickLine={false} axisLine={false} />
          <YAxis yAxisId="activity" orientation="right" allowDecimals={!showCredits} tickFormatter={compactNumber} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value: number, name: string, item) => [
              item.dataKey === "average_requests_per_key" ? decimal(value) : integer(Math.round(value)),
              name,
            ]}
          />
          <Legend />
          <Bar isAnimationActive={animate} yAxisId="keys" dataKey="unique_api_keys" name={t(showCredits ? "Active API keys" : "Unique API keys")} fill="#0a84ff" radius={[6, 6, 0, 0]} />
          <Line isAnimationActive={animate} yAxisId="activity" type="monotone" dataKey={showCredits ? "credits" : "average_requests_per_key"} name={t(showCredits ? "Spend (Credits)" : "Average requests per key")} stroke="#7c3aed" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
