import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Bar, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "../components/MetricCard";
import { ModelWhitelistInput, publicModelsFromProviders } from "../components/ModelWhitelistInput";
import { QuotaInput, quotaValue } from "../components/QuotaInput";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { dateTime, integer, nullablePercent, usdFromMicro } from "../lib/format";

export function APIKeyDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bucket, setBucket] = useState("day");
  const [range, setRange] = useState("14d");
  const [modelError, setModelError] = useState("");
  const [savedMessage, setSavedMessage] = useState(false);
  const trafficQuery = useMemo(() => {
    const query: Record<string, string> = { api_key_id: id, bucket };
    if (range !== "all") {
      const days = Number(range.replace("d", ""));
      const now = new Date();
      query.from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      query.to = now.toISOString();
    }
    return query;
  }, [bucket, id, range]);
  const detail = useQuery({ queryKey: ["api-key", id], queryFn: () => api.apiKey(id), enabled: Boolean(id) });
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers });
  const usage = useQuery({ queryKey: ["api-key-usage", id], queryFn: () => api.apiKeyUsage(id), enabled: Boolean(id) });
  const timeline = useQuery({ queryKey: ["api-key-traffic", id, bucket, range], queryFn: () => api.traffic(trafficQuery), enabled: Boolean(id) });
  const sessions = useQuery({ queryKey: ["api-key-sessions", id], queryFn: () => api.apiKeySessions(id, { include_stale: true }), enabled: Boolean(id) });
  const logs = useQuery({ queryKey: ["api-key-logs", id], queryFn: () => api.apiKeyLogs(id, { limit: 50 }), enabled: Boolean(id) });
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
  const providerModels = useMemo(() => publicModelsFromProviders(providers.data), [providers.data]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setModelError("Select at least one model.");
      return;
    }
    setModelError("");
    update.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      status: String(form.get("status") ?? "active"),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
      allowed_models: allowedModels,
      forced_expired: form.get("forced_expired") === "on",
    });
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">API Key</span>
          <h1>{key?.name ?? "Loading..."}</h1>
        </div>
        {key ? (
          <div className="page-actions">
            <StatusPill active={key.status === "active"} label={key.status} />
            {key.status === "active" ? (
              <button className="icon-text" disabled={inactive.isPending} onClick={() => window.confirm("Inactive this key?") && inactive.mutate()} type="button">
                <Ban size={16} />
                Inactive
              </button>
            ) : null}
            <button className="icon-text danger" disabled={remove.isPending} onClick={() => window.confirm("Delete this key?") && remove.mutate()} type="button">
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        ) : null}
      </div>

      <div className="metrics-grid">
        <MetricCard label="Requests" value={integer(summary?.requests ?? 0)} detail="Recorded calls" />
        <MetricCard label="Tokens" value={integer(summary?.total_tokens ?? 0)} detail="Prompt + completion" />
        <MetricCard label="Cache hit" value={nullablePercent(summary?.cache_hit_rate)} detail={`${integer(summary?.cache_total_tokens ?? 0)} cache tokens`} />
        <MetricCard label="Cost" value={usdFromMicro(summary?.cost_microusd ?? 0)} detail="Estimated" />
        <MetricCard label="Active devices" value={integer(usage.data?.active_devices ?? 0)} detail="Current window" />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Traffic</h2>
          <div className="panel-actions">
            <select value={range} onChange={(event) => setRange(event.target.value)}>
              <option value="7d">7 days</option>
              <option value="14d">14 days</option>
              <option value="30d">30 days</option>
              <option value="all">All time</option>
            </select>
            <select value={bucket} onChange={(event) => setBucket(event.target.value)}>
              <option value="day">Daily</option>
              <option value="hour">Hourly</option>
            </select>
          </div>
        </div>
        <div className="chart compact">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeline.data?.items ?? []}>
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
              <YAxis yAxisId="requests" tickLine={false} axisLine={false} />
              <YAxis yAxisId="tokens" orientation="right" tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="requests" dataKey="requests" fill="#0a84ff" radius={[6, 6, 0, 0]} />
              <Line yAxisId="tokens" type="monotone" dataKey="total_tokens" stroke="#12b76a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Requests</th>
                <th>Input</th>
                <th>Output</th>
                <th>Total</th>
                <th>Cache hit</th>
                <th>Cache miss</th>
                <th>Hit rate</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {(timeline.data?.items ?? []).map((item) => (
                <tr key={item.bucket}>
                  <td>{item.bucket}</td>
                  <td>{integer(item.requests)}</td>
                  <td>{integer(item.request_tokens)}</td>
                  <td>{integer(item.response_tokens)}</td>
                  <td>{integer(item.total_tokens)}</td>
                  <td>{integer(item.cache_hit_tokens)}</td>
                  <td>{integer(item.cache_miss_tokens)}</td>
                  <td>{nullablePercent(item.cache_hit_rate)}</td>
                  <td>{usdFromMicro(item.cost_microusd)}</td>
                </tr>
              ))}
              {!timeline.data?.items?.length ? (
                <tr>
                  <td colSpan={9} className="muted-cell">
                    No traffic in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Sessions</h2>
          <span>Device IDs and sources</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>Source</th>
                <th>Status</th>
                <th>Requests</th>
                <th>Tokens</th>
                <th>Last seen</th>
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
                  <td>{integer(session.token_count)}</td>
                  <td>{dateTime(session.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Logs</h2>
          <span>Most recent requests</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Model</th>
                <th>Status</th>
                <th>Device</th>
                <th>Provider</th>
                <th>Tokens</th>
                <th>Cache</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data?.items ?? []).map((log) => (
                <tr key={log.id}>
                  <td>{dateTime(log.created_at)}</td>
                  <td>{log.public_model}</td>
                  <td>{log.status_code}</td>
                  <td>{log.device_id || "none"}</td>
                  <td>{log.provider || "none"}</td>
                  <td>{integer(log.total_tokens)}</td>
                  <td>{nullablePercent(log.cache_hit_rate)}</td>
                  <td>{usdFromMicro(log.cost_microusd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {key ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Settings</h2>
            <div className="panel-actions">
              {savedMessage ? <span className="saved-text">Saved</span> : null}
              <button className="primary" disabled={update.isPending} form="api-key-settings" type="submit">
                <Save size={16} />
                Save
              </button>
            </div>
          </div>
          <form id="api-key-settings" className="settings-form" onSubmit={submit}>
            <div className="settings-group">
              <h3>Identity</h3>
              <div className="settings-grid two">
                <label>
                  Name
                  <input name="name" defaultValue={key.name} />
                </label>
                <label>
                  Description
                  <input name="description" defaultValue={key.description} />
                </label>
              </div>
            </div>
            <div className="settings-group">
              <h3>Limits</h3>
              <div className="settings-grid three">
                <label>
                  Status
                  <select name="status" defaultValue={key.status}>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
                <QuotaInput key={`request-${key.id}-${key.request_quota}`} label="Request quota" name="request_quota" initialValue={key.request_quota} />
                <QuotaInput key={`token-${key.id}-${key.token_quota}`} label="Token quota" name="token_quota" initialValue={key.token_quota} />
              </div>
              <label className="check-row">
                <input name="forced_expired" defaultChecked={key.forced_expired} type="checkbox" />
                Force expired
              </label>
            </div>
            <div className="settings-group">
              <h3>Models</h3>
              <ModelWhitelistInput key={`models-${key.id}-${key.allowed_models.join(",")}`} models={providerModels} selected={key.allowed_models} />
              {key.allowed_models.length === 0 ? <span className="muted-cell full-row">No models allowed</span> : null}
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
