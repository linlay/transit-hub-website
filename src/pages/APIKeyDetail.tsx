import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePageActions } from "../components/Layout";
import { MetricCard } from "../components/MetricCard";
import { ModelWhitelistInput, publicModelsFromProviders } from "../components/ModelWhitelistInput";
import { QuotaInput, quotaValue } from "../components/QuotaInput";
import { RateLimitEditor, rateLimitValue } from "../components/RateLimitEditor";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { api, isTelemetryError } from "../lib/api";
import { compactNumber, compactTokenCount, dateTime, integer, nullablePercent, formatCurrency, quotaRatio } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { RateLimitUsage } from "../lib/types";

export function APIKeyDetail() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bucket, setBucket] = useState("day");
  const [range, setRange] = useState("14d");
  const [modelError, setModelError] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const detail = useQuery({ queryKey: ["api-key", id], queryFn: () => api.apiKey(id), enabled: Boolean(id), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const usage = useQuery({ queryKey: ["api-key-usage", id], queryFn: () => api.apiKeyUsage(id), enabled: Boolean(id), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const timeline = useQuery({
    queryKey: ["api-key-traffic", id, bucket, range],
    queryFn: () => api.traffic(apiKeyTrafficQuery(id, bucket, range)),
    enabled: Boolean(id),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const sessions = useQuery({
    queryKey: ["api-key-sessions", id],
    queryFn: () => api.apiKeySessions(id, { include_stale: true }),
    enabled: Boolean(id),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const logs = useQuery({
    queryKey: ["api-key-logs", id],
    queryFn: () => api.apiKeyLogs(id, { limit: 50 }),
    enabled: Boolean(id),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateAPIKey(id, body),
    onSuccess: () => {
      setModelError("");
      setSavedMessage(true);
      window.setTimeout(() => setSavedMessage(false), 1600);
      queryClient.invalidateQueries({ queryKey: ["api-key", id] });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAPIKey(id),
    onSuccess: () => navigate("/api-keys", { replace: true }),
  });
  const inactive = useMutation({
    mutationFn: () => api.batchAPIKeys({ action: "inactive", ids: [id] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-key", id] });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const key = detail.data;
  const summary = usage.data?.summary;
  const telemetryUnavailable =
    Boolean(usage.data?.degraded_components?.includes("telemetry")) ||
    isTelemetryError(timeline.error) ||
    isTelemetryError(sessions.error) ||
    isTelemetryError(logs.error);
  const providerModels = useMemo(() => publicModelsFromProviders(providers.data), [providers.data]);
  const isRefreshing = detail.isFetching || providers.isFetching || usage.isFetching || timeline.isFetching || sessions.isFetching || logs.isFetching;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setModelError(t("Select at least one model."));
      return;
    }
    setModelError("");
    update.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      status: String(form.get("status") ?? "active"),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
      rate_limits: rateLimitValue(form, "rate_limits"),
      allowed_models: allowedModels,
      forced_expired: form.get("forced_expired") === "on",
    });
  }

  function refreshDetail() {
    return Promise.all([detail.refetch(), providers.refetch(), usage.refetch(), timeline.refetch(), sessions.refetch(), logs.refetch()]);
  }

  usePageActions(<RefreshButton disabled={!id} isRefreshing={isRefreshing} onClick={refreshDetail} />, [
    id,
    isRefreshing,
    detail.refetch,
    providers.refetch,
    usage.refetch,
    timeline.refetch,
    sessions.refetch,
    logs.refetch,
  ]);

  return (
    <section className="page">
      {telemetryUnavailable ? <TelemetryUnavailable /> : null}
      {!telemetryUnavailable ? <div className="metrics-grid">
        <MetricCard label={t("Requests")} value={integer(summary?.requests ?? 0)} detail={t("Recorded calls")} />
        <MetricCard label={t("Tokens")} value={<span title={integer(summary?.total_tokens ?? 0)}>{compactTokenCount(summary?.total_tokens ?? 0)}</span>} detail={t("Prompt + completion")} />
        <MetricCard label={t("Cache hit")} value={nullablePercent(summary?.cache_hit_rate)} detail={<span title={integer(summary?.cache_total_tokens ?? 0)}>{t("{count} cache tokens", { count: compactTokenCount(summary?.cache_total_tokens ?? 0) })}</span>} />
        <MetricCard label={t("Cost")} value={formatCurrency(summary?.cost_micro ?? 0)} detail={t("Estimated")} />
        <MetricCard label={t("Active devices")} value={integer(usage.data?.active_devices ?? 0)} detail={t("Current window")} />
      </div> : null}

      <RateLimitUsagePanel items={usage.data?.rate_limit_usage ?? []} />

      {!telemetryUnavailable ? <section className="panel">
        <div className="panel-heading">
          <h2>{t("Traffic")}</h2>
          <div className="panel-actions">
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="7d">{t("7 days")}</option>
              <option value="14d">{t("14 days")}</option>
              <option value="30d">{t("30 days")}</option>
              <option value="all">{t("All time")}</option>
            </select>
            <select value={bucket} onChange={(event) => setBucket(event.target.value)}>
              <option value="day">{t("Daily")}</option>
              <option value="hour">{t("Hourly")}</option>
              <option value="month">{t("Monthly")}</option>
            </select>
          </div>
        </div>
        <div className="chart compact">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeline.data?.items ?? []}>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Bucket")}</th>
                <th>{t("Requests")}</th>
                <th>{t("Input")}</th>
                <th>{t("Output")}</th>
                <th>{t("Total")}</th>
                <th>{t("Cache hit")}</th>
                <th>{t("Cache miss")}</th>
                <th>{t("Hit rate")}</th>
                <th>{t("Cost")}</th>
              </tr>
            </thead>
            <tbody>
              {(timeline.data?.items ?? []).map((item) => (
                <tr key={item.bucket}>
                  <td>{item.bucket}</td>
                  <td>{integer(item.requests)}</td>
                  <td title={integer(item.request_tokens)}>{compactTokenCount(item.request_tokens)}</td>
                  <td title={integer(item.response_tokens)}>{compactTokenCount(item.response_tokens)}</td>
                  <td title={integer(item.total_tokens)}>{compactTokenCount(item.total_tokens)}</td>
                  <td title={integer(item.cache_hit_tokens)}>{compactTokenCount(item.cache_hit_tokens)}</td>
                  <td title={integer(item.cache_miss_tokens)}>{compactTokenCount(item.cache_miss_tokens)}</td>
                  <td>{nullablePercent(item.cache_hit_rate)}</td>
                  <td>{formatCurrency(item.cost_micro)}</td>
                </tr>
              ))}
              {!timeline.data?.items?.length ? (
                <tr>
                  <td colSpan={9} className="muted-cell">
                    {t("No traffic in this range.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section> : null}

      {!telemetryUnavailable ? <section className="panel">
        <div className="panel-heading">
          <h2>{t("Sessions")}</h2>
          <span>{t("Device IDs and sources")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Device")}</th>
                <th>{t("Source")}</th>
                <th>{t("Status")}</th>
                <th>{t("Requests")}</th>
                <th>{t("Tokens")}</th>
                <th>{t("Last seen")}</th>
              </tr>
            </thead>
            <tbody>
              {(sessions.data?.items ?? []).map((session) => (
                <tr key={`${session.device_id}:${session.source}`}>
                  <td>{session.device_id}</td>
                  <td>{session.source}</td>
                  <td>
                    <StatusPill active={session.active} />
                  </td>
                  <td>{integer(session.request_count)}</td>
                  <td title={integer(session.token_count)}>{compactTokenCount(session.token_count)}</td>
                  <td>{dateTime(session.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section> : null}

      {!telemetryUnavailable ? <section className="panel">
        <div className="panel-heading">
          <h2>{t("Logs")}</h2>
          <span>{t("Most recent requests")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Time")}</th>
                <th>{t("Model")}</th>
                <th>{t("Status")}</th>
                <th>{t("Device")}</th>
                <th>{t("Provider")}</th>
                <th>{t("Tokens")}</th>
                <th>{t("Cache")}</th>
                <th>{t("Cost")}</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data?.items ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{dateTime(log.created_at)}</td>
                  <td>{log.public_model}</td>
                  <td>{log.status_code}</td>
                  <td>{log.device_id || t("none")}</td>
                  <td>{log.provider || t("none")}</td>
                  <td title={integer(log.total_tokens)}>{compactTokenCount(log.total_tokens)}</td>
                  <td>{nullablePercent(log.cache_hit_rate)}</td>
                  <td>{formatCurrency(log.cost_micro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section> : null}

      {key ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{key.name}</h2>
              <span className="eyebrow">{t("Settings")}</span>
            </div>
            <div className="panel-actions">
              <StatusPill active={key.status === "active"} label={key.status === "active" ? "Active" : "Disabled"} />
              {key.status === "active" ? (
                <button className="icon-text" disabled={inactive.isPending} onClick={() => window.confirm(t("Inactive this key?")) && inactive.mutate()} type="button">
                  <Ban size={16} />
                  {t("Inactive")}
                </button>
              ) : null}
              <button className="icon-text danger" disabled={remove.isPending} onClick={() => window.confirm(t("Delete this key?")) && remove.mutate()} type="button">
                <Trash2 size={16} />
                {t("Delete")}
              </button>
              {savedMessage ? <span className="saved-text">{t("Saved")}</span> : null}
              <button className="primary" disabled={update.isPending} form="api-key-settings" type="submit">
                <Save size={16} />
                {t("Save")}
              </button>
            </div>
          </div>
          <form id="api-key-settings" className="settings-form" onSubmit={submit}>
            <div className="settings-group">
              <h3>{t("Identity")}</h3>
              <div className="settings-grid two">
                <label>
                  {t("Name")}
                  <input name="name" defaultValue={key.name} />
                </label>
                <label>
                  {t("Description")}
                  <input name="description" defaultValue={key.description} />
                </label>
              </div>
            </div>
            <div className="settings-group">
              <h3>{t("Limits")}</h3>
              <div className="settings-grid three">
                <label>
                  {t("Status")}
                  <select name="status" defaultValue={key.status}>
                    <option value="active">{t("Active")}</option>
                    <option value="disabled">{t("Disabled")}</option>
                  </select>
                </label>
                <QuotaInput key={`request-${key.id}-${key.request_quota}`} label="Request quota" name="request_quota" initialValue={key.request_quota} />
                <QuotaInput key={`token-${key.id}-${key.token_quota}`} label="Token quota" name="token_quota" initialValue={key.token_quota} />
              </div>
              <RateLimitEditor key={`rate-limits-${key.id}-${JSON.stringify(key.rate_limits)}`} name="rate_limits" initialValue={key.rate_limits} />
              <label className="check-row">
                <input name="forced_expired" defaultChecked={key.forced_expired} type="checkbox" />
                {t("Force expired")}
              </label>
            </div>
            <div className="settings-group">
              <h3>{t("Models")}</h3>
              <ModelWhitelistInput key={`models-${key.id}-${key.allowed_models.join(",")}`} models={providerModels} selected={key.allowed_models} />
              {key.allowed_models.length === 0 ? <span className="muted-cell full-row">{t("No models allowed")}</span> : null}
            </div>
            {modelError ? <span className="error-text">{modelError}</span> : null}
            {update.error ? <span className="error-text">{update.error.message}</span> : null}
            {inactive.error ? <span className="error-text">{inactive.error.message}</span> : null}
          </form>
        </section>
      ) : null}
    </section>
  );
}

function apiKeyTrafficQuery(id: string, bucket: string, range: string) {
  const query: Record<string, string> = { api_key_id: id, bucket };
  if (range !== "all") {
    const days = Number(range.replace("d", ""));
    const now = new Date();
    query.from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    query.to = now.toISOString();
  }
  return query;
}

function RateLimitUsagePanel({ items }: { items: RateLimitUsage[] }) {
  const { t } = useI18n();
  if (!items.length) return null;

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{t("Rate limits")}</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Window")}</th>
              <th>{t("Requests")}</th>
              <th>{t("Tokens")}</th>
              <th>{t("Cost")}</th>
              <th>{t("Resets")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.window}>
                <td>{t(windowLabel(item.window))}</td>
                <td>
                  <LimitProgress value={quotaRatio(item.requests, item.request_quota)} label={`${integer(item.requests)} / ${quotaLabel(item.request_quota)}`} />
                </td>
                <td>
                  <LimitProgress
                    value={quotaRatio(item.tokens, item.token_quota)}
                    label={`${compactTokenCount(item.tokens)} / ${item.token_quota ? compactTokenCount(item.token_quota) : "∞"}`}
                    title={`${integer(item.tokens)} / ${item.token_quota ? integer(item.token_quota) : "∞"}`}
                  />
                </td>
                <td>
                  <LimitProgress value={quotaRatio(item.cost_micro, item.cost_quota_micro)} label={`${formatCurrency(item.cost_micro)} / ${item.cost_quota_micro ? formatCurrency(item.cost_quota_micro) : "∞"}`} />
                </td>
                <td>{dateTime(item.resets_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LimitProgress({ value, label, title }: { value: number; label: string; title?: string }) {
  return (
    <div className="progress-cell">
      <div className="progress">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <small title={title}>{label}</small>
    </div>
  );
}

function quotaLabel(value: number) {
  return value ? integer(value) : "∞";
}

function windowLabel(window: string) {
  switch (window) {
    case "1h":
      return "1 hour";
    case "5h":
      return "5 hours";
    case "1d":
      return "1 day";
    case "7d":
      return "7 days";
    case "30d":
      return "30 days";
    default:
      return window;
  }
}
