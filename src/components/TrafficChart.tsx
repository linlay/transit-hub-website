import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber, compactTokenCount, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { TrafficBucket } from "../lib/types";

const MAX_MODEL_SERIES = 8;
const MODEL_COLORS = ["#0a84ff", "#7c3aed", "#f97316", "#0891b2", "#db2777", "#d97706", "#4f46e5", "#dc2626"];
const OTHER_MODELS_COLOR = "#64748b";

type TrafficChartProps = {
  items: TrafficBucket[];
};

type ModelSeries = {
  key: string;
  label: string;
  color: string;
};

type TrafficChartRow = {
  bucket: string;
  requests: number;
  total_tokens: number;
  [key: string]: string | number;
};

export function TrafficChart({ items }: TrafficChartProps) {
  const { t } = useI18n();
  const { data, modelSeries } = buildChartData(items, t("Other models"), t("Unknown model"), t("Requests"));

  return (
    <div className="chart" role="img" aria-label={t("Requests by model and total tokens")}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
          <YAxis yAxisId="requests" tickFormatter={compactNumber} tickLine={false} axisLine={false} />
          <YAxis yAxisId="tokens" orientation="right" tickFormatter={compactTokenCount} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(value: number, name: string, item) => [
              item.dataKey === "total_tokens" ? compactTokenCount(value) : integer(value),
              name,
            ]}
          />
          <Legend />
          {modelSeries.map((series) => (
            <Bar
              key={series.key}
              yAxisId="requests"
              dataKey={series.key}
              name={series.label}
              fill={series.color}
              stackId="models"
            />
          ))}
          <Line
            yAxisId="tokens"
            type="monotone"
            dataKey="total_tokens"
            name={t("Tokens")}
            stroke="#12b76a"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildChartData(items: TrafficBucket[], otherLabel: string, unknownLabel: string, requestsLabel: string) {
  const totals = new Map<string, number>();
  for (const item of items) {
    for (const usage of item.models ?? []) {
      totals.set(usage.model, (totals.get(usage.model) ?? 0) + usage.requests);
    }
  }

  if (totals.size === 0) {
    return {
      data: items.map(({ bucket, requests, total_tokens }) => ({ bucket, requests, total_tokens })),
      modelSeries: [{ key: "requests", label: requestsLabel, color: MODEL_COLORS[0] }],
    };
  }

  const selectedModels = [...totals.entries()]
    .sort(([modelA, requestsA], [modelB, requestsB]) => requestsB - requestsA || modelA.localeCompare(modelB))
    .slice(0, MAX_MODEL_SERIES)
    .map(([model]) => model);
  const selectedModelSet = new Set(selectedModels);
  const hasUnattributedRequests = items.some((item) =>
    (item.models ?? []).reduce((sum, usage) => sum + usage.requests, 0) < item.requests,
  );
  const hasOtherModels = totals.size > selectedModels.length || hasUnattributedRequests;
  const keyByModel = new Map(selectedModels.map((model, index) => [model, `model_${index}`]));
  const modelSeries: ModelSeries[] = selectedModels.map((model, index) => ({
    key: `model_${index}`,
    label: model || unknownLabel,
    color: MODEL_COLORS[index],
  }));
  if (hasOtherModels) {
    modelSeries.push({ key: "model_other", label: otherLabel, color: OTHER_MODELS_COLOR });
  }

  const data: TrafficChartRow[] = items.map((item) => {
    const row: TrafficChartRow = { bucket: item.bucket, requests: item.requests, total_tokens: item.total_tokens };
    let attributedRequests = 0;
    for (const usage of item.models ?? []) {
      attributedRequests += usage.requests;
      const key = keyByModel.get(usage.model) ?? "model_other";
      row[key] = Number(row[key] ?? 0) + usage.requests;
    }
    if (hasOtherModels && attributedRequests < item.requests) {
      row.model_other = Number(row.model_other ?? 0) + item.requests - attributedRequests;
    }
    return row;
  });

  return { data, modelSeries };
}
