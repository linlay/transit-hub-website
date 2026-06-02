import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ModalDialog } from "../components/ModalDialog";
import { ModelWhitelistInput, publicModelsFromProviders } from "../components/ModelWhitelistInput";
import { QuotaInput, quotaValue } from "../components/QuotaInput";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import type { JWTGrant } from "../lib/types";
import { dateTime, integer } from "../lib/format";

export function JWTGrants() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const searchParam = params.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<JWTGrant | null>(null);
  const [viewing, setViewing] = useState<JWTGrant | null>(null);
  const [createdJWT, setCreatedJWT] = useState("");
  const [createModelError, setCreateModelError] = useState("");
  const [editModelError, setEditModelError] = useState("");
  const grants = useQuery({
    queryKey: ["jwt-grants", search, status],
    queryFn: () => api.jwtGrants({ search, status }),
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: api.providers,
  });
  const providerModels = useMemo(() => publicModelsFromProviders(providers.data), [providers.data]);
  const createGrant = useMutation({
    mutationFn: api.createJWTGrant,
    onSuccess: (data) => {
      setCreatedJWT(data.jwt);
      setCreateModelError("");
      queryClient.invalidateQueries({ queryKey: ["jwt-grants"] });
    },
  });
  const updateGrant = useMutation({
    mutationFn: ({ jti, body }: { jti: string; body: Record<string, unknown> }) => api.updateJWTGrant(jti, body),
    onSuccess: () => {
      setEditing(null);
      setEditModelError("");
      queryClient.invalidateQueries({ queryKey: ["jwt-grants"] });
    },
  });
  const viewGrant = useMutation({
    mutationFn: api.jwtGrant,
    onSuccess: (data) => setViewing(data),
  });
  const removeGrant = useMutation({
    mutationFn: api.deleteJWTGrant,
    onSuccess: () => {
      setEditing(null);
      setViewing(null);
      queryClient.invalidateQueries({ queryKey: ["jwt-grants"] });
    },
  });

  useEffect(() => {
    setSearch(searchParam);
  }, [searchParam]);

  function openCreateDialog() {
    createGrant.reset();
    setCreatedJWT("");
    setCreateModelError("");
    setCreateOpen(true);
  }

  function openEditDialog(grant: JWTGrant) {
    updateGrant.reset();
    setEditModelError("");
    setEditing(grant);
  }

  function openViewDialog(grant: JWTGrant) {
    viewGrant.reset();
    setViewing(null);
    viewGrant.mutate(grant.jti);
  }

  function submitGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setCreateModelError("Select at least one model.");
      return;
    }
    setCreateModelError("");
    createGrant.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      issue_quota: quotaValue(form, "issue_quota"),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
      allowed_models: allowedModels,
    });
  }

  function submitGrantPatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setEditModelError("Select at least one model.");
      return;
    }
    setEditModelError("");
    updateGrant.mutate({
      jti: editing.jti,
      body: {
        status: String(form.get("status") ?? "active"),
        issue_quota: quotaValue(form, "issue_quota"),
        request_quota: quotaValue(form, "request_quota"),
        token_quota: quotaValue(form, "token_quota"),
        allowed_models: allowedModels,
      },
    });
  }

  function deleteGrant(grant: JWTGrant) {
    if (window.confirm(`Delete ${grant.name}? Issued API keys will remain active.`)) {
      removeGrant.mutate(grant.jti);
    }
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Access</span>
          <h1>JWT Grants</h1>
        </div>
        <button className="primary" onClick={openCreateDialog} type="button">
          <Plus size={16} />
          Create grant
        </button>
      </div>

      <section className="panel">
        <div className="toolbar filters">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search grants" />
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
                <th>Issued</th>
                <th>Default limits</th>
                <th>Models</th>
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
                    <small className="mono">{grant.jti}</small>
                  </td>
                  <td>
                    <StatusPill active={grant.status === "active"} label={grant.status} />
                  </td>
                  <td>
                    {integer(grant.issued_count)} / {grant.issue_unlimited ? "∞" : integer(grant.issue_quota)}
                  </td>
                  <td>
                    <span>{grant.request_quota || "∞"} requests</span>
                    <small>{grant.token_quota ? `${integer(grant.token_quota)} tokens` : "∞ tokens"}</small>
                  </td>
                  <td>
                    {grant.allowed_models.length ? (
                      <span className="model-summary">{grant.allowed_models.join(", ")}</span>
                    ) : (
                      <span className="muted-cell">No models allowed</span>
                    )}
                  </td>
                  <td>{dateTime(grant.expires_at)}</td>
                  <td>{dateTime(grant.last_issued_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="icon-button" onClick={() => openViewDialog(grant)} title="View JWT" type="button">
                        <Eye size={16} />
                      </button>
                      <button className="icon-button" onClick={() => openEditDialog(grant)} title="Edit" type="button">
                        <Edit size={16} />
                      </button>
                      <button className="icon-button danger" onClick={() => deleteGrant(grant)} title="Delete" type="button">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!grants.data?.items?.length ? (
                <tr>
                  <td colSpan={8} className="muted-cell">
                    No JWT grants found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen ? (
        <ModalDialog title="Create JWT grant" onClose={() => setCreateOpen(false)}>
          <form className="dialog-form" onSubmit={submitGrant}>
            <input name="name" placeholder="Name" required />
            <input name="description" placeholder="Description" />
            <QuotaInput label="Issue quota" name="issue_quota" />
            <QuotaInput label="Request quota" name="request_quota" initialValue={500} />
            <QuotaInput label="Token quota" name="token_quota" initialValue={2000000} />
            <ModelWhitelistInput models={providerModels} />
            {createdJWT ? (
              <div className="secret-box">
                <code>{createdJWT}</code>
                <button className="icon-button" onClick={() => navigator.clipboard.writeText(createdJWT)} type="button">
                  <Copy size={16} />
                </button>
              </div>
            ) : null}
            {createModelError ? <span className="error-text">{createModelError}</span> : null}
            {createGrant.error ? <span className="error-text">{createGrant.error.message}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setCreateOpen(false)} type="button">
                Close
              </button>
              <button className="primary" disabled={createGrant.isPending} type="submit">
                <Plus size={16} />
                Create
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {editing ? (
        <ModalDialog title="Edit JWT grant" onClose={() => setEditing(null)}>
          <form key={editing.jti} className="dialog-form" onSubmit={submitGrantPatch}>
            <select name="status" defaultValue={editing.status}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <QuotaInput label="Issue quota" name="issue_quota" initialValue={editing.issue_quota} />
            <QuotaInput label="Request quota" name="request_quota" initialValue={editing.request_quota} />
            <QuotaInput label="Token quota" name="token_quota" initialValue={editing.token_quota} />
            <ModelWhitelistInput models={providerModels} selected={editing.allowed_models} />
            {editModelError ? <span className="error-text">{editModelError}</span> : null}
            {updateGrant.error ? <span className="error-text">{updateGrant.error.message}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setEditing(null)} type="button">
                Close
              </button>
              <button className="primary" disabled={updateGrant.isPending} type="submit">
                Save
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {viewing ? (
        <ModalDialog title="JWT" onClose={() => setViewing(null)}>
          <div className="dialog-form">
            <strong>{viewing.name}</strong>
            {viewing.jwt ? (
              <div className="secret-box">
                <code>{viewing.jwt}</code>
                <button className="icon-button" onClick={() => navigator.clipboard.writeText(viewing.jwt ?? "")} type="button">
                  <Copy size={16} />
                </button>
              </div>
            ) : (
              <span className="muted-cell">JWT unavailable</span>
            )}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setViewing(null)} type="button">
                Close
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
      {viewGrant.error ? <span className="error-text">{viewGrant.error.message}</span> : null}
      {removeGrant.error ? <span className="error-text">{removeGrant.error.message}</span> : null}
    </section>
  );
}
