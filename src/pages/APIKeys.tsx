import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Search, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ModalDialog } from "../components/ModalDialog";
import { ModelWhitelistInput, publicModelsFromProviders } from "../components/ModelWhitelistInput";
import { QuotaInput, quotaValue } from "../components/QuotaInput";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { dateTime, integer, quotaRatio } from "../lib/format";

export function APIKeys() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState(params.get("source") ?? "all");
  const [issuerJTI, setIssuerJTI] = useState(params.get("issuer_jti") ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState("");
  const [createModelError, setCreateModelError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const keys = useQuery({
    queryKey: ["api-keys", search, status, source, issuerJTI],
    queryFn: () => api.apiKeys({ search, status, source, issuer_jti: issuerJTI }),
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: api.providers,
  });
  const providerModels = useMemo(() => publicModelsFromProviders(providers.data), [providers.data]);
  const create = useMutation({
    mutationFn: api.createAPIKey,
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setCreateModelError("");
      setCopyMessage("");
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteAPIKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function openCreateDialog() {
    create.reset();
    setCreatedKey("");
    setCreateModelError("");
    setCopyMessage("");
    setCreateOpen(true);
  }

  async function copyCreatedKey() {
    const copied = await copyText(createdKey);
    setCopyMessage(copied ? "Copied." : "Copy failed. Select and copy the key manually.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setCreateModelError("Select at least one model.");
      return;
    }
    setCreateModelError("");
    create.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
      allowed_models: allowedModels,
    });
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Access</span>
          <h1>API Keys</h1>
        </div>
        <button className="primary" onClick={openCreateDialog} type="button">
          <Plus size={16} />
          Create key
        </button>
      </div>

      <section className="panel">
        <div className="toolbar filters">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search keys" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">All sources</option>
            <option value="admin">Admin</option>
            <option value="jwt">JWT</option>
          </select>
          <input value={issuerJTI} onChange={(event) => setIssuerJTI(event.target.value)} placeholder="Issuer JTI" />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Source</th>
                <th>Issuer JTI</th>
                <th>Requests</th>
                <th>Tokens</th>
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
                  <td>{key.source}</td>
                  <td>
                    {key.issuer_jti ? (
                      <Link className="table-link mono-link" to={`/jwt-grants?search=${encodeURIComponent(key.issuer_jti)}`}>
                        {key.issuer_jti}
                      </Link>
                    ) : (
                      <span className="muted-cell">-</span>
                    )}
                  </td>
                  <td>
                    <Progress value={quotaRatio(key.used_requests, key.request_quota)} label={`${integer(key.used_requests)} / ${key.request_quota || "∞"}`} />
                  </td>
                  <td>
                    <Progress value={quotaRatio(key.used_tokens, key.token_quota)} label={`${integer(key.used_tokens)} / ${key.token_quota ? integer(key.token_quota) : "∞"}`} />
                  </td>
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
                  <td colSpan={8} className="muted-cell">
                    No API keys found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen ? (
        <ModalDialog title="Create API key" onClose={() => setCreateOpen(false)}>
          <form className="dialog-form" onSubmit={submit}>
            <input name="name" placeholder="Name" required />
            <input name="description" placeholder="Description" />
            <QuotaInput label="Request quota" name="request_quota" />
            <QuotaInput label="Token quota" name="token_quota" />
            <ModelWhitelistInput models={providerModels} />
            {createdKey ? (
              <div className="secret-box">
                <code>{createdKey}</code>
                <button className="icon-button" onClick={copyCreatedKey} title="Copy API key" type="button">
                  <Copy size={16} />
                </button>
              </div>
            ) : null}
            {copyMessage ? <span className={copyMessage === "Copied." ? "muted-cell" : "error-text"}>{copyMessage}</span> : null}
            {createModelError ? <span className="error-text">{createModelError}</span> : null}
            {create.error ? <span className="error-text">{create.error.message}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setCreateOpen(false)} type="button">
                Close
              </button>
              <button className="primary" disabled={create.isPending} type="submit">
                <Plus size={16} />
                Create
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
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
