import { formatCredits, creditsInputValue } from "../lib/format";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { usePageActions } from "../components/Layout";
import { CredentialTime } from "../components/CredentialTime";
import { RowActions } from "../components/RowActions";
import { CredentialModels } from "../components/CredentialModels";
import { ModalDialog } from "../components/ModalDialog";
import { ModelWhitelistInput, publicModelsFromProviders } from "../components/ModelWhitelistInput";
import { QuotaInput, quotaValue, creditsQuotaValue } from "../components/QuotaInput";
import { RateLimitEditor, rateLimitValue } from "../components/RateLimitEditor";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import type { JWTGrant } from "../lib/types";
import { compactTokenCount, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

export function JWTGrants() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const searchParam = params.get("search") ?? "";
  const [search, setSearch] = useState(searchParam);
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [copySource, setCopySource] = useState<JWTGrant | null>(null);
  const [editing, setEditing] = useState<JWTGrant | null>(null);
  const [viewing, setViewing] = useState<JWTGrant | null>(null);
  const [deleting, setDeleting] = useState<JWTGrant | null>(null);
  const [createdJWT, setCreatedJWT] = useState("");
  const [createModelError, setCreateModelError] = useState("");
  const [editModelError, setEditModelError] = useState("");
  const [createCopyMessage, setCreateCopyMessage] = useState("");
  const [viewCopyMessage, setViewCopyMessage] = useState("");
  const grants = useQuery({
    queryKey: ["jwt-grants", search, status],
    queryFn: () => api.jwtGrants({ search, status }),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: api.providers,
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const providerModels = useMemo(() => publicModelsFromProviders(providers.data), [providers.data]);
  const isRefreshing = grants.isFetching || providers.isFetching;
  const createGrant = useMutation({
    mutationFn: api.createJWTGrant,
    onSuccess: (data) => {
      setCreatedJWT(data.jwt);
      setCreateModelError("");
      setCreateCopyMessage("");
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
    mutationFn: ({ jti, deleteAPIKeys }: { jti: string; deleteAPIKeys: boolean }) => api.deleteJWTGrant(jti, { delete_api_keys: deleteAPIKeys }),
    onSuccess: () => {
      setEditing(null);
      setViewing(null);
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["jwt-grants"] });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  useEffect(() => {
    setSearch(searchParam);
  }, [searchParam]);

  function openCreateDialog(source: JWTGrant | null = null) {
    setCopySource(source);
    createGrant.reset();
    setCreatedJWT("");
    setCreateModelError("");
    setCreateCopyMessage("");
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
    setViewCopyMessage("");
    viewGrant.mutate(grant.jti);
  }

  async function copyCreatedJWT() {
    const copied = await copyText(createdJWT);
    setCreateCopyMessage(copied ? t("Copied.") : t("Copy failed. Select and copy the JWT manually."));
  }

  async function copyViewingJWT() {
    const copied = await copyText(viewing?.jwt ?? "");
    setViewCopyMessage(copied ? t("Copied.") : t("Copy failed. Select and copy the JWT manually."));
  }

  function submitGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createGrant.isPending || createdJWT) return;
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setCreateModelError(t("Select at least one model."));
      return;
    }
    setCreateModelError("");
    try {
    createGrant.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      issue_quota: quotaValue(form, "issue_quota"),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
      quota_microcredits: creditsQuotaValue(form,"credits_quota"),
      rate_limits: rateLimitValue(form, "rate_limits"),
      allowed_models: allowedModels,
    });
    } catch (error) { setCreateModelError(error instanceof Error ? error.message : String(error)); }
  }

  function submitGrantPatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setEditModelError(t("Select at least one model."));
      return;
    }
    setEditModelError("");
    try {
    updateGrant.mutate({
      jti: editing.jti,
      body: {
        status: String(form.get("status") ?? "active"),
        issue_quota: quotaValue(form, "issue_quota"),
        request_quota: quotaValue(form, "request_quota"),
        token_quota: quotaValue(form, "token_quota"),
      quota_microcredits: creditsQuotaValue(form,"credits_quota"),
        rate_limits: rateLimitValue(form, "rate_limits"),
        allowed_models: allowedModels,
      },
    });
    } catch (error) { setEditModelError(error instanceof Error ? error.message : String(error)); }
  }

  function deleteGrant(grant: JWTGrant) {
    removeGrant.reset();
    setDeleting(grant);
  }

  usePageActions(
    <>
      <RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([grants.refetch(), providers.refetch()])} />
      <button className="primary" onClick={() => openCreateDialog()} type="button">
        <Plus size={16} />
        {t("Create grant")}
      </button>
    </>,
    [isRefreshing, grants.refetch, providers.refetch, t],
  );

  return (
    <section className="page">
      <section className="panel credential-panel">
        <div className="toolbar filters">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search grants")} />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{t("All statuses")}</option>
            <option value="active">{t("Active")}</option>
            <option value="disabled">{t("Disabled")}</option>
          </select>
        </div>
        <div className="table-wrap credential-table-wrap">
          <table className="credential-table grant-table">
            <thead>
              <tr>
                <th className="credential-name-col">{t("Name")}</th>
                <th className="credential-status-col">{t("Status")}</th>
                <th className="credential-issued-col">{t("Issued")}</th>
                <th className="credential-limits-col">{t("Default limits")}</th>
                <th>{t("Models")}</th>
                <th className="credential-date-col">{t("Expires")}</th>
                <th className="credential-date-col">{t("Last issued")}</th>
                <th className="row-actions-cell" aria-label={t("Actions")} />
              </tr>
            </thead>
            <tbody>
              {(grants.data?.items ?? []).map((grant) => (
                <tr key={grant.jti}>
                  <td>
                    <strong className="cell-ellipsis" title={grant.name}>{grant.name}</strong>
                    <small className="mono cell-ellipsis" title={grant.jti}>{grant.jti}</small>
                  </td>
                  <td>
                    <StatusPill active={grant.status === "active"} label={grant.status === "active" ? "Active" : "Disabled"} />
                  </td>
                  <td>
                    {integer(grant.issued_count)} / {grant.issue_unlimited ? "∞" : integer(grant.issue_quota)}
                  </td>
                  <td>
                    <span>{grant.quota_microcredits ? formatCredits(grant.quota_microcredits) : `∞ ${t("Credits")}`}</span>
                    <small title={grant.token_quota ? integer(grant.token_quota) : "∞"}>
                      {t("{count} requests", { count: grant.request_quota ? integer(grant.request_quota) : "∞" })} · {t("{count} tokens", { count: grant.token_quota ? compactTokenCount(grant.token_quota) : "∞" })} · {grant.rate_limits.length ? t("{count} windows", { count: grant.rate_limits.length }) : t("No windows")}
                    </small>
                  </td>
                  <td><CredentialModels models={grant.allowed_models} /></td>
                  <td><CredentialTime value={grant.expires_at} /></td>
                  <td><CredentialTime value={grant.last_issued_at} /></td>
                  <td className="row-actions-cell">
                    <RowActions label={t("Actions for {name}", { name: grant.name })} items={[
                      { label: t("View JWT"), icon: <Eye size={15} />, onSelect: () => openViewDialog(grant) },
                      { label: t("Duplicate"), icon: <Copy size={15} />, onSelect: () => openCreateDialog(grant) },
                      { label: t("Edit"), icon: <Edit size={15} />, onSelect: () => openEditDialog(grant) },
                      { label: t("Delete"), icon: <Trash2 size={15} />, danger: true, onSelect: () => deleteGrant(grant) },
                    ]} />
                  </td>
                </tr>
              ))}
              {!grants.data?.items?.length ? (
                <tr>
                  <td colSpan={8} className="muted-cell">
                    {t("No JWT grants found.")}
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
            <input name="name" aria-label={t("Name")} placeholder={t("Name")} defaultValue={copySource ? t("{name} (copy)", { name: copySource.name }) : ""} required />
            <input name="description" aria-label={t("Description")} placeholder={t("Description")} defaultValue={copySource?.description ?? ""} />
            <QuotaInput label="Issue quota" name="issue_quota" initialValue={copySource?.issue_quota ?? 0} />
            <QuotaInput label="Total Credits" name="credits_quota" step="0.000001" initialValue={creditsInputValue(copySource?.quota_microcredits ?? 0)} />
            <QuotaInput label="Request quota" name="request_quota" initialValue={copySource?.request_quota ?? 500} />
            <QuotaInput label="Token quota" name="token_quota" initialValue={copySource?.token_quota ?? 2000000} />
            <RateLimitEditor name="rate_limits" initialValue={copySource?.rate_limits} />
            <ModelWhitelistInput models={Array.from(new Set([...providerModels, ...(copySource?.allowed_models ?? [])]))} selected={copySource?.allowed_models} />
            {createdJWT ? (
              <div className="secret-box">
                <code>{createdJWT}</code>
                <button className="icon-button" onClick={copyCreatedJWT} title={t("Copy JWT")} type="button">
                  <Copy size={16} />
                </button>
              </div>
            ) : null}
            {createCopyMessage ? <span className={createCopyMessage === "Copied." ? "muted-cell" : "error-text"}>{createCopyMessage}</span> : null}
            {createModelError ? <span className="error-text">{createModelError}</span> : null}
            {createGrant.error ? <span className="error-text">{createGrant.error.message}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setCreateOpen(false)} type="button">
                {t("Close")}
              </button>
              <button className="primary" disabled={createGrant.isPending || Boolean(createdJWT)} type="submit">
                <Plus size={16} />
                {t("Create")}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {editing ? (
        <ModalDialog title="Edit JWT grant" onClose={() => setEditing(null)}>
          <form key={editing.jti} className="dialog-form" onSubmit={submitGrantPatch}>
            <select name="status" defaultValue={editing.status}>
              <option value="active">{t("Active")}</option>
              <option value="disabled">{t("Disabled")}</option>
            </select>
            <QuotaInput label="Issue quota" name="issue_quota" initialValue={editing.issue_quota} />
            <QuotaInput label="Total Credits" name="credits_quota" step="0.000001" initialValue={creditsInputValue(editing.quota_microcredits ?? 0)} />
            <QuotaInput label="Request quota" name="request_quota" initialValue={editing.request_quota} />
            <QuotaInput label="Token quota" name="token_quota" initialValue={editing.token_quota} />
            <RateLimitEditor key={`rate-limits-${editing.jti}-${JSON.stringify(editing.rate_limits)}`} name="rate_limits" initialValue={editing.rate_limits} />
            <ModelWhitelistInput models={providerModels} selected={editing.allowed_models} />
            {editModelError ? <span className="error-text">{editModelError}</span> : null}
            {updateGrant.error ? <span className="error-text">{updateGrant.error.message}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setEditing(null)} type="button">
                {t("Close")}
              </button>
              <button className="primary" disabled={updateGrant.isPending} type="submit">
                {t("Save")}
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
                <button className="icon-button" onClick={copyViewingJWT} title="Copy JWT" type="button">
                  <Copy size={16} />
                </button>
              </div>
            ) : (
              <span className="muted-cell">{t("JWT unavailable")}</span>
            )}
            {viewCopyMessage ? <span className={viewCopyMessage === "Copied." ? "muted-cell" : "error-text"}>{viewCopyMessage}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setViewing(null)} type="button">
                {t("Close")}
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
      {viewGrant.error ? <span className="error-text">{viewGrant.error.message}</span> : null}

      {deleting ? (
        <ModalDialog title="Delete JWT grant" onClose={() => setDeleting(null)}>
          <div className="dialog-form">
            <p className="dialog-copy">
              {t("Delete")} <strong>{deleting.name}</strong>? {t("Choose whether issued API keys should remain active.")}
            </p>
            {removeGrant.error ? <span className="error-text">{removeGrant.error.message}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setDeleting(null)} type="button">
                {t("Cancel")}
              </button>
              <button className="icon-text danger" disabled={removeGrant.isPending} onClick={() => removeGrant.mutate({ jti: deleting.jti, deleteAPIKeys: false })} type="button">
                <Trash2 size={16} />
                {t("Grant only")}
              </button>
              <button className="primary" disabled={removeGrant.isPending} onClick={() => removeGrant.mutate({ jti: deleting.jti, deleteAPIKeys: true })} type="button">
                <Trash2 size={16} />
                {t("Grant and API keys")}
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}
