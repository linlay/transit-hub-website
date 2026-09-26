import { IconButton } from "../components/IconButton";
import { ListChecks, X, ArrowDown, ArrowUp, ArrowUpDown, Ban, Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { creditsInputValue } from "../lib/format";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { KeyUsageCells, keyHasWindowLimit } from "../components/KeyUsageCells";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { APIKey } from "../lib/types";

export function APIKeys() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const [params] = useSearchParams();
  type SortKey = "used_requests" | "used_tokens" | "last_used_at" | null;
  type SortDir = "asc" | "desc";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState(params.get("source") ?? "all");
  const [issuerJTI, setIssuerJTI] = useState(params.get("issuer_jti") ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [copySource, setCopySource] = useState<APIKey | null>(null);
  const [createdKey, setCreatedKey] = useState("");
  const [createModelError, setCreateModelError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const keys = useQuery({
    queryKey: ["api-keys", search, status, source, issuerJTI],
    queryFn: () => api.apiKeys({ search, status, source, issuer_jti: issuerJTI }),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: api.providers,
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
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
    mutationFn: (id: string) => api.batchAPIKeys({ action: "delete", ids: [id] }),
    onSuccess: () => {
      setSelectedIDs(new Set());
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const batch = useMutation({
    mutationFn: api.batchAPIKeys,
    onSuccess: () => {
      setSelectedIDs(new Set());
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const visibleKeys = useMemo(() => {
    const items = [...(keys.data?.items ?? [])];
    if (!sortKey) return items;

    items.sort((a, b) => compareAPIKeys(a, b, sortKey, sortDir));
    return items;
  }, [keys.data?.items, sortKey, sortDir]);
  const selectedCount = selectedIDs.size;
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedIDs.has(key.id));
  const isRefreshing = keys.isFetching || providers.isFetching;

  function toggleSort(key: Exclude<SortKey, null>) {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIcon(key: Exclude<SortKey, null>) {
    if (sortKey !== key) return <ArrowUpDown size={14} />;
    return sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  }

  function openCreateDialog(source: APIKey | null = null) {
    setCopySource(source);
    create.reset();
    setCreatedKey("");
    setCreateModelError("");
    setCopyMessage("");
    setCreateOpen(true);
  }

  async function copyCreatedKey() {
    const copied = await copyText(createdKey);
    setCopyMessage(copied ? t("Copied.") : t("Copy failed. Select and copy the key manually."));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending || createdKey) return;
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setCreateModelError(t("Select at least one model."));
      return;
    }
    setCreateModelError("");
    try {
    create.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
      quota_microcredits: creditsQuotaValue(form,"credits_quota"),
      rate_limits: rateLimitValue(form, "rate_limits"),
      allowed_models: allowedModels,
    });
    } catch (error) { setCreateModelError(error instanceof Error ? error.message : String(error)); }
  }

  function toggleSelection(id: string) {
    setSelectedIDs((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIDs((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleKeys.forEach((key) => next.delete(key.id));
      } else {
        visibleKeys.forEach((key) => next.add(key.id));
      }
      return next;
    });
  }

  function batchSelected(action: "delete" | "inactive") {
    const ids = Array.from(selectedIDs);
    if (ids.length === 0) return;
    if (window.confirm(t(action === "delete" ? "Delete {count} selected API keys?" : "Inactive {count} selected API keys?", { count: ids.length }))) {
      batch.mutate({ action, ids });
    }
  }

  function deleteByIssuerJTI() {
    const value = issuerJTI.trim();
    if (!value) return;
    if (window.confirm(t("Delete API keys issued by {value}?", { value }))) {
      batch.mutate({ action: "delete", issuer_jti: value });
    }
  }

  function inactiveKey(id: string, name: string) {
    if (window.confirm(t("Inactive {name}?", { name }))) {
      batch.mutate({ action: "inactive", ids: [id] });
    }
  }

  usePageActions(
    <>
      <RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([keys.refetch(), providers.refetch()])} />
      <IconButton label={t("Create key")} className="primary" onClick={() => openCreateDialog()} type="button"><Plus size={16} /></IconButton>
    </>,
    [isRefreshing, keys.refetch, providers.refetch, t],
  );

  return (
    <section className="page api-keys-page">
      <section className="panel credential-panel">
        <div className="toolbar filters">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search keys")} />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{t("All statuses")}</option>
            <option value="active">{t("Active")}</option>
            <option value="disabled">{t("Disabled")}</option>
          </select>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">{t("All sources")}</option>
            <option value="admin">{t("Admin")}</option>
            <option value="jwt">JWT</option>
            <option value="access_token">{t("User-device binding")}</option>
          </select>
          <input value={issuerJTI} onChange={(event) => setIssuerJTI(event.target.value)} placeholder={t("Issuer Name")} />
          <IconButton label={selecting ? t("Cancel selection") : t("Select keys")} aria-pressed={selecting} className="icon-text" onClick={() => {
              setSelecting((value) => !value);
              setSelectedIDs(new Set());
            }} type="button"><ListChecks size={16} /></IconButton>
          <IconButton label={t("Delete by Issuer JTI")} className="icon-text danger" disabled={!issuerJTI.trim() || batch.isPending} onClick={deleteByIssuerJTI} type="button"><Trash2 size={16} /></IconButton>
        </div>
        {selecting ? (
          <div className="bulk-bar">
            <span>{t("Selected {count}", { count: selectedCount })}</span>
            <IconButton label={t("Inactive selected")} className="icon-text" disabled={selectedCount === 0 || batch.isPending} onClick={() => batchSelected("inactive")} type="button"><Ban size={16} /></IconButton>
            <IconButton label={t("Delete selected")} className="icon-text danger" disabled={selectedCount === 0 || batch.isPending} onClick={() => batchSelected("delete")} type="button"><Trash2 size={16} /></IconButton>
          </div>
        ) : null}
        {keys.error ? <div className="error-text" role="alert">{keys.error.message}</div> : null}
        {batch.error ? <div className="error-text">{batch.error.message}</div> : null}
        <div className="table-wrap credential-table-wrap">
          <table className="credential-table key-table">
            <thead>
              <tr>
                {selecting ? (
                  <th className="select-cell">
                    <input aria-label={t("Select all")} checked={allVisibleSelected} onChange={toggleAllVisible} type="checkbox" />
                  </th>
                ) : null}
                <th className="credential-name-col">{t("Name")}</th>
                <th className="credential-status-col">{t("Status")}</th>
                <th className="credential-source-col">{t("Source")} / {t("Issuer Name")}</th>
                <th className="key-models-col">{t("Models")}</th>
                <th className="key-period-col">{t("Period")}</th>
                <th className="key-spend-col">{t("Spent")}<span className="key-column-hint">Credits</span></th>
                <th className="key-limit-col">{t("Limit")}<span className="key-column-hint">Credits</span></th>
                <th className="sortable credential-usage-col" aria-sort={sortKey === "used_requests" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="sort-header" type="button" title={t("Sort by cumulative usage")} onClick={() => toggleSort("used_requests")}>
                    {t("Requests")}
                    {sortIcon("used_requests")}
                  </button>
                  <span className="key-column-hint" title={t("Hover for usage and limit")}>{t("Used")}</span>
                </th>
                <th className="sortable credential-usage-col" aria-sort={sortKey === "used_tokens" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="sort-header" type="button" title={t("Sort by cumulative usage")} onClick={() => toggleSort("used_tokens")}>
                    {t("Tokens")}
                    {sortIcon("used_tokens")}
                  </button>
                  <span className="key-column-hint" title={t("Hover for usage and limit")}>{t("Used")}</span>
                </th>
                <th className="key-reset-col">{t("Reset")}</th>
                <th className="sortable credential-date-col" aria-sort={sortKey === "last_used_at" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="sort-header" type="button" onClick={() => toggleSort("last_used_at")}>
                    {t("Last used")}
                    {sortIcon("last_used_at")}
                  </button>
                </th>
                <th className="row-actions-cell" aria-label={t("Actions")} />
              </tr>
            </thead>
            <tbody>
              {visibleKeys.map((key) => (
                <tr key={key.id}>
                  {selecting ? (
                    <td className="select-cell">
                      <input aria-label={t("Select {name}", { name: key.name })} checked={selectedIDs.has(key.id)} onChange={() => toggleSelection(key.id)} type="checkbox" />
                    </td>
                  ) : null}
                  <td>
                    <Link className="table-link cell-ellipsis" title={key.name} to={`/api-keys/${key.id}`}>
                      {key.name}
                    </Link>
                    <small>{key.key_prefix}</small>
                  </td>
                  <td>
                    <StatusPill active={key.status === "active" && !key.forced_expired} label={key.status === "active" ? "Active" : "Disabled"} />
                    {key.status === "active" && !key.forced_expired && keyHasWindowLimit(key, now) ? <span className="key-window-limited">{t("Window limited")}</span> : null}
                  </td>
                  <td>
                    <span>{key.source === "admin" ? t("Admin") : key.source === "access_token" ? t("User-device binding") : "JWT"}</span>
                    {key.issuer_jti ? (
                      <small><Link className="cell-ellipsis" title={key.issuer_jti} to={`/jwt-grants?search=${encodeURIComponent(key.issuer_jti)}`}>{key.issuer_name || key.issuer_jti}</Link></small>
                    ) : <small className="muted-cell">—</small>}
                  </td>
                  <td><CredentialModels models={key.allowed_models} /></td>
                  <KeyUsageCells apiKey={key} now={now} />
                  <td><CredentialTime value={key.last_used_at} /></td>
                  <td className="row-actions-cell">
                    <RowActions label={t("Actions for {name}", { name: key.name })} items={[
                      { label: t("Edit"), icon: <Pencil size={15} />, onSelect: () => navigate(`/api-keys/${key.id}#api-key-settings`) },
                      { label: t("Duplicate"), icon: <Copy size={15} />, onSelect: () => openCreateDialog(key) },
                      ...(key.status === "active" ? [{ label: t("Inactive"), icon: <Ban size={15} />, onSelect: () => inactiveKey(key.id, key.name) }] : []),
                      { label: t("Delete"), icon: <Trash2 size={15} />, danger: true, onSelect: () => { if (window.confirm(t("Delete {name}?", { name: key.name }))) remove.mutate(key.id); } },
                    ]} />
                  </td>
                </tr>
              ))}
              {!visibleKeys.length ? (
                <tr>
                  <td colSpan={selecting ? 13 : 12} className="muted-cell">
                    {keys.isLoading ? t("Loading...") : keys.isError ? t("Unable to load keys") : t("No API keys found.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen ? (
        <ModalDialog title="Create API Key" onClose={() => setCreateOpen(false)}>
          <form className="dialog-form" onSubmit={submit}>
            <input name="name" aria-label={t("Name")} placeholder={t("Name")} defaultValue={copySource ? t("{name} (copy)", { name: copySource.name }) : ""} required />
            <input name="description" aria-label={t("Description")} placeholder={t("Description")} defaultValue={copySource?.description ?? ""} />
            <QuotaInput label="Total Credits" name="credits_quota" step="0.000001" initialValue={creditsInputValue(copySource?.quota_microcredits ?? 0)} />
            <QuotaInput label="Request quota" name="request_quota" initialValue={copySource?.request_quota ?? 0} />
            <QuotaInput label="Token quota" name="token_quota" initialValue={copySource?.token_quota ?? 0} />
            <RateLimitEditor name="rate_limits" initialValue={copySource?.rate_limits} />
            <ModelWhitelistInput models={Array.from(new Set([...providerModels, ...(copySource?.allowed_models ?? [])]))} selected={copySource?.allowed_models} />
            {createdKey ? (
              <div className="secret-box">
                <code>{createdKey}</code>
                <IconButton label={t("Copy API key")} className="icon-button" onClick={copyCreatedKey} type="button"><Copy size={16} /></IconButton>
              </div>
            ) : null}
            {copyMessage ? <span className={copyMessage === "Copied." ? "muted-cell" : "error-text"}>{copyMessage}</span> : null}
            {createModelError ? <span className="error-text">{createModelError}</span> : null}
            {create.error ? <span className="error-text">{create.error.message}</span> : null}
            <div className="dialog-actions">
              <IconButton label={t("Close")} className="icon-text" onClick={() => setCreateOpen(false)} type="button"><X size={16} /></IconButton>
              <IconButton label={t("Create")} className="primary" disabled={create.isPending || Boolean(createdKey)} type="submit"><Plus size={16} /></IconButton>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </section>
  );
}

function compareAPIKeys(a: APIKey, b: APIKey, key: "used_requests" | "used_tokens" | "last_used_at", dir: "asc" | "desc") {
  let cmp = 0;
  if (key === "last_used_at") {
    cmp = compareOptionalTime(a.last_used_at, b.last_used_at);
  } else {
    cmp = a[key] - b[key];
  }

  if (cmp === 0) {
    cmp = a.name.localeCompare(b.name);
  }
  return dir === "asc" ? cmp : -cmp;
}

function compareOptionalTime(a?: string, b?: string) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}
