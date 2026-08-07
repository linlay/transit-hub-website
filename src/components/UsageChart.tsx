import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { TrafficBucket } from "../lib/types";

type UsageChartProps = {
  items: TrafficBucket[];
};

export function UsageChart({ items }: UsageChartProps) {
  const { t } = useI18n();
  const data = items.map((item) => ({
    bucket: item.bucket,
    unique_api_keys: item.unique_api_keys ?? 0,
    requests: item.requests,
  }));

  return (
    <div className="chart" role="img" aria-label={t("Unique API keys and request PV")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
          <YAxis yAxisId="keys" tickFormatter={compactNumber} tickLine={false} axisLine={false} />
          <YAxis yAxisId="pv" orientation="right" tickFormatter={compactNumber} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value: number) => integer(value)} />
          <Legend />
          <Bar yAxisId="keys" dataKey="unique_api_keys" name={t("Unique API keys")} fill="#0a84ff" radius={[6, 6, 0, 0]} />
          <Line yAxisId="pv" type="monotone" dataKey="requests" name={t("PV")} stroke="#7c3aed" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
