import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, decimal, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { TrafficBucket } from "../lib/types";

type UsageChartProps = {
  items: TrafficBucket[];
};

export function UsageChart({ items }: UsageChartProps) {
  const { t } = useI18n();
  const data = items.map((item) => {
    const uniqueAPIKeys = item.unique_api_keys ?? 0;
    return {
      bucket: item.bucket,
      unique_api_keys: uniqueAPIKeys,
      average_requests_per_key: uniqueAPIKeys > 0 ? item.requests / uniqueAPIKeys : 0,
    };
  });

  return (
    <div className="chart" role="img" aria-label={t("Unique API keys and average requests per key")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
          <YAxis yAxisId="keys" tickFormatter={compactNumber} tickLine={false} axisLine={false} />
          <YAxis yAxisId="activity" orientation="right" tickFormatter={compactNumber} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value: number, name: string, item) => [
              item.dataKey === "average_requests_per_key" ? decimal(value) : integer(value),
              name,
            ]}
          />
          <Legend />
          <Bar yAxisId="keys" dataKey="unique_api_keys" name={t("Unique API keys")} fill="#0a84ff" radius={[6, 6, 0, 0]} />
          <Line yAxisId="activity" type="monotone" dataKey="average_requests_per_key" name={t("Average requests per key")} stroke="#7c3aed" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
