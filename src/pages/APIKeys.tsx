import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { dateTime, integer, quotaRatio } from "../lib/format";

export function APIKeys() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createdKey, setCreatedKey] = useState("");
  const keys = useQuery({
    queryKey: ["api-keys", search, status],
    queryFn: () => api.apiKeys({ search, status }),
  });
  const create = useMutation({
    mutationFn: api.createAPIKey,
    onSuccess: (data) => {
      setCreatedKey(data.key);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteAPIKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      request_quota: Number(form.get("request_quota") || 0),
      token_quota: Number(form.get("token_quota") || 0),
    });
    event.currentTarget.reset();
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Access</span>
          <h1>API Keys</h1>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Create key</h2>
          <span>Plaintext is shown once after creation.</span>
        </div>
        <form className="inline-form" onSubmit={submit}>
          <input name="name" placeholder="Name" required />
          <input name="description" placeholder="Description" />
          <input name="request_quota" placeholder="Request quota" type="number" min="0" />
          <input name="token_quota" placeholder="Token quota" type="number" min="0" />
          <button className="primary" disabled={create.isPending} type="submit">
            <Plus size={16} />
            Create
          </button>
        </form>
        {createdKey ? (
          <div className="secret-box">
            <code>{createdKey}</code>
            <button className="icon-button" onClick={() => navigator.clipboard.writeText(createdKey)} type="button">
              <Copy size={16} />
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search keys" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Requests</th>
                <th>Tokens</th>
                <th>Devices</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(keys.data?.items ?? []).map((key) => (
                <tr key={key.id}>
                  <td>
                    <Link className="table-link" to={`/api-keys/${key.id}`}>
                      {key.name}
                    </Link>
                    <small>{key.key_prefix}</small>
                  </td>
                  <td>
                    <StatusPill active={key.status === "active" && !key.forced_expired} label={key.status} />
                  </td>
                  <td>
                    <Progress value={quotaRatio(key.used_requests, key.request_quota)} label={`${integer(key.used_requests)} / ${key.request_quota || "∞"}`} />
                  </td>
                  <td>
                    <Progress value={quotaRatio(key.used_tokens, key.token_quota)} label={`${integer(key.used_tokens)} / ${key.token_quota ? integer(key.token_quota) : "∞"}`} />
                  </td>
                  <td className="muted-cell">Open detail</td>
                  <td>{dateTime(key.last_used_at)}</td>
                  <td>
                    <button
                      className="icon-button danger"
                      onClick={() => window.confirm(`Delete ${key.name}?`) && remove.mutate(key.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!keys.data?.items?.length ? (
                <tr>
                  <td colSpan={7} className="muted-cell">
                    No API keys found.
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

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress-cell">
      <div className="progress">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <small>{label}</small>
    </div>
  );
}
