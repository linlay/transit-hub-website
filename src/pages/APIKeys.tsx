import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Save, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { QuotaInput, quotaValue } from "../components/QuotaInput";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { dateTime, integer, quotaRatio } from "../lib/format";

export function APIKeys() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [createdKey, setCreatedKey] = useState("");
  const [createdJWT, setCreatedJWT] = useState("");
  const keys = useQuery({
    queryKey: ["api-keys", search, status],
    queryFn: () => api.apiKeys({ search, status }),
  });
  const grants = useQuery({
    queryKey: ["jwt-grants"],
    queryFn: api.jwtGrants,
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
  const createGrant = useMutation({
    mutationFn: api.createJWTGrant,
    onSuccess: (data) => {
      setCreatedJWT(data.jwt);
      queryClient.invalidateQueries({ queryKey: ["jwt-grants"] });
    },
  });
  const updateGrant = useMutation({
    mutationFn: ({ jti, body }: { jti: string; body: Record<string, unknown> }) => api.updateJWTGrant(jti, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jwt-grants"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
    });
    event.currentTarget.reset();
  }

  function submitGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createGrant.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      issue_quota: Number(form.get("issue_quota") || 0),
    });
    event.currentTarget.reset();
  }

  function submitGrantPatch(event: FormEvent<HTMLFormElement>, jti: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    updateGrant.mutate({
      jti,
      body: {
        status: String(form.get("status") ?? "active"),
        issue_quota: Number(form.get("issue_quota") || 0),
      },
    });
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
          <QuotaInput label="Request quota" name="request_quota" />
          <QuotaInput label="Token quota" name="token_quota" />
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
        <div className="panel-heading">
          <h2>JWT Grants</h2>
          <span>Desktop issuance</span>
        </div>
        <form className="inline-form grant-form" onSubmit={submitGrant}>
          <input name="name" placeholder="Name" required />
          <input name="description" placeholder="Description" />
          <input name="issue_quota" placeholder="Issue quota" type="number" min="1" required />
          <button className="primary" disabled={createGrant.isPending} type="submit">
            <Plus size={16} />
            Create
          </button>
        </form>
        {createdJWT ? (
          <div className="secret-box">
            <code>{createdJWT}</code>
            <button className="icon-button" onClick={() => navigator.clipboard.writeText(createdJWT)} type="button">
              <Copy size={16} />
            </button>
          </div>
        ) : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Last issued</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(grants.data?.items ?? []).map((grant) => (
                <tr key={grant.jti}>
                  <td>
                    <strong>{grant.name}</strong>
                    <small>{grant.jti}</small>
                  </td>
                  <td>
                    <StatusPill active={grant.status === "active"} label={grant.status} />
                  </td>
                  <td>
                    {integer(grant.issued_count)} / {grant.issue_unlimited ? "∞" : integer(grant.issue_quota)}
                  </td>
                  <td>{dateTime(grant.expires_at)}</td>
                  <td>{dateTime(grant.last_issued_at)}</td>
                  <td>
                    <form className="table-edit" onSubmit={(event) => submitGrantPatch(event, grant.jti)}>
                      <select name="status" defaultValue={grant.status}>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                      <input name="issue_quota" defaultValue={grant.issue_quota || ""} min="1" placeholder="Issue quota" type="number" required />
                      <button className="icon-button" disabled={updateGrant.isPending} type="submit">
                        <Save size={16} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!grants.data?.items?.length ? (
                <tr>
                  <td colSpan={6} className="muted-cell">
                    No JWT grants found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
                    <small>
                      {key.key_prefix} / {key.source}
                    </small>
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
