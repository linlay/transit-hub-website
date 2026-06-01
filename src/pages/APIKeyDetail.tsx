import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "../components/MetricCard";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { dateTime, integer, usdFromMicro } from "../lib/format";

export function APIKeyDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["api-key", id], queryFn: () => api.apiKey(id), enabled: Boolean(id) });
  const usage = useQuery({ queryKey: ["api-key-usage", id], queryFn: () => api.apiKeyUsage(id), enabled: Boolean(id) });
  const sessions = useQuery({ queryKey: ["api-key-sessions", id], queryFn: () => api.apiKeySessions(id, { include_stale: true }), enabled: Boolean(id) });
  const logs = useQuery({ queryKey: ["api-key-logs", id], queryFn: () => api.apiKeyLogs(id, { limit: 50 }), enabled: Boolean(id) });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateAPIKey(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-key", id] });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAPIKey(id),
    onSuccess: () => navigate("/api-keys", { replace: true }),
  });

  const key = detail.data;
  const summary = usage.data?.summary;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      status: String(form.get("status") ?? "active"),
      request_quota: Number(form.get("request_quota") || 0),
      token_quota: Number(form.get("token_quota") || 0),
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
        {key ? <StatusPill active={key.status === "active"} label={key.status} /> : null}
      </div>

      <div className="metrics-grid">
        <MetricCard label="Requests" value={integer(summary?.requests ?? 0)} detail="Recorded calls" />
        <MetricCard label="Tokens" value={integer(summary?.total_tokens ?? 0)} detail="Prompt + completion" />
        <MetricCard label="Cost" value={usdFromMicro(summary?.cost_microusd ?? 0)} detail="Estimated" />
        <MetricCard label="Active devices" value={integer(usage.data?.active_devices ?? 0)} detail="Current window" />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Traffic</h2>
          <span>Recent daily calls</span>
        </div>
        <div className="chart compact">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usage.data?.recent_traffic ?? []}>
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="requests" stroke="#0a84ff" fill="#d8ecff" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
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
                <th>Tokens</th>
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
                  <td>{integer(log.total_tokens)}</td>
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
            <button className="icon-text danger" onClick={() => window.confirm("Delete this key?") && remove.mutate()} type="button">
              <Trash2 size={16} />
              Delete
            </button>
          </div>
          <form className="settings-form" onSubmit={submit}>
            <label>
              Name
              <input name="name" defaultValue={key.name} />
            </label>
            <label>
              Description
              <input name="description" defaultValue={key.description} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={key.status}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label>
              Request quota
              <input name="request_quota" defaultValue={key.request_quota} min="0" type="number" />
            </label>
            <label>
              Token quota
              <input name="token_quota" defaultValue={key.token_quota} min="0" type="number" />
            </label>
            <label className="check-row">
              <input name="forced_expired" defaultChecked={key.forced_expired} type="checkbox" />
              Force expired
            </label>
            <button className="primary" type="submit">
              <Save size={16} />
              Save
            </button>
          </form>
        </section>
      ) : null}
    </section>
  );
}
