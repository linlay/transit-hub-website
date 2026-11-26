import { Select } from "../components/ThemedControls";
import { useListFilters, useDebouncedValue } from "../lib/useListFilters";
import { useListScroll } from "../lib/useListScroll";
import { useConfirm } from "../components/ConfirmProvider";
import { QueryFeedback } from "../components/QueryFeedback";
import { IconButton } from "../components/IconButton";
import { ListChecks, X, Ban, Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { creditsInputValue } from "../lib/format";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { usePageActions } from "../components/Layout";
import { CredentialTime } from "../components/CredentialTime";
import { RowActions } from "../components/RowActions";
import { CredentialModels } from "../components/CredentialModels";
import { ModalDialog } from "../components/ModalDialog";
import { BatchKeyPolicyAction } from "../components/BatchKeyPolicy";
import { ResponsiveFilters } from "../components/ResponsiveFilters";
import { ModelWhitelistInput, publicModelsFromProviders } from "../components/ModelWhitelistInput";
import { QuotaInput, quotaValue, creditsQuotaValue } from "../components/QuotaInput";
import { RateLimitEditor, rateLimitValue } from "../components/RateLimitEditor";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { nextTableSort, readTableSort, SortHeader } from "../components/TableSort";
import { TablePagination } from "../components/TablePagination";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { KeyUsageCells, keyHasWindowLimit } from "../components/KeyUsageCells";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { APIKey } from "../lib/types";

const keySorts = ["used_requests", "used_tokens", "used_microcredits", "last_used_at"] as const;
const pageSize = 50;

export function APIKeys() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const { params, setFilters } = useListFilters();
  const confirm = useConfirm();
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "all";
  const source = params.get("source") ?? "all";
  const issuerJTI = params.get("issuer_jti") ?? "";
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "", 10) || 0);
  const [createOpen, setCreateOpen] = useState(false);
  const [copySource, setCopySource] = useState<APIKey | null>(null);
  const [createdKey, setCreatedKey] = useState("");
  const [createModelError, setCreateModelError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Map<string, APIKey>>(() => new Map());
  const sort = readTableSort(params, keySorts, "asc");
  const debouncedSearch = useDebouncedValue(search);
  const debouncedIssuer = useDebouncedValue(issuerJTI);
  const query = { search: debouncedSearch, status, source, issuer_jti: debouncedIssuer, offset, limit: pageSize, sort: sort?.key, dir: sort?.dir };
  const keys = useQuery({
    queryKey: ["api-keys", query],
    placeholderData: keepPreviousData,
    queryFn: () => api.apiKeys(query),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  useListScroll(Boolean(keys.data));
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
      setSelectedKeys(new Map());
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const batch = useMutation({
    mutationFn: api.batchAPIKeys,
    onSuccess: () => {
      setSelectedKeys(new Map());
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const visibleKeys = keys.data?.items ?? [];
  const selectedCount = selectedKeys.size;
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key.id));
  const isRefreshing = keys.isFetching || providers.isFetching;

  function toggleSort(key: typeof keySorts[number], firstDirection: "asc" | "desc") {
    const next = nextTableSort(sort, key, firstDirection);
    setFilters({ sort: next?.key ?? null, dir: next?.dir ?? null, offset: null });
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

  function toggleSelection(key: APIKey) {
    setSelectedKeys((current) => {
      const next = new Map(current);
      if (next.has(key.id)) {
        next.delete(key.id);
      } else {
        next.set(key.id, key);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedKeys((current) => {
      const next = new Map(current);
      if (allVisibleSelected) {
        visibleKeys.forEach((key) => next.delete(key.id));
      } else {
        visibleKeys.forEach((key) => next.set(key.id, key));
      }
      return next;
    });
  }

  function batchSelected(action: "delete" | "inactive") {
    const ids = Array.from(selectedKeys.keys());
    if (ids.length === 0) return;
    confirm({ message: t(action === "delete" ? "Delete {count} selected API keys?" : "Inactive {count} selected API keys?", { count: ids.length }), action: () => batch.mutateAsync({ action, ids }) });
  }

  function deleteByIssuerJTI() {
    const value = issuerJTI.trim();
    if (!value) return;
    confirm({ message: t("Delete API keys issued by {value}?", { value }), action: () => batch.mutateAsync({ action: "delete", issuer_jti: value }) });
  }

  function inactiveKey(id: string, name: string) {
    confirm({ message: t("Inactive {name}?", { name }), action: () => batch.mutateAsync({ action: "inactive", ids: [id] }) });
  }

  usePageActions(
    <>
      <BatchKeyPolicyAction key="batch-policy" initialSource="authorization" initialTargets={[...selectedKeys.values()]} />
      <RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([keys.refetch(), providers.refetch()])} />
      <IconButton label={t("Create key")} className="primary" onClick={() => openCreateDialog()} type="button"><Plus size={16} /></IconButton>
    </>,
    [isRefreshing, keys.refetch, providers.refetch, selectedKeys, t],
  );

  return (
    <section className="page list-page api-keys-page">
      <section className="panel credential-panel">
        <div className="toolbar filters api-key-filters">
          <label className="search">
            <Search size={16} />
            <input type="search" value={search} onChange={(event) => setFilters({ search: event.target.value, offset: null })} placeholder={t("Search keys")} />
          </label>
          <ResponsiveFilters
            count={Number(status !== "all") + Number(source !== "all") + Number(Boolean(issuerJTI))}
            summary={[
              status !== "all" ? t(status === "active" ? "Active" : "Disabled") : "",
              source !== "all" ? t(source === "admin" ? "Admin" : source === "jwt" ? "JWT" : "User-device binding") : "",
              issuerJTI ? `${t("Issuer Name")}: ${issuerJTI}` : "",
            ].filter(Boolean).join(" · ")}
            onReset={() => setFilters({ status: null, source: null, issuer_jti: null, offset: null })}
          >
          <Select aria-label={t("Status")} value={status} onChange={(event) => setFilters({ status: event.target.value, offset: null })}>
            <option value="all">{t("All statuses")}</option>
            <option value="active">{t("Active")}</option>
            <option value="disabled">{t("Disabled")}</option>
          </Select>
          <Select aria-label={t("Source")} value={source} onChange={(event) => setFilters({ source: event.target.value, offset: null })}>
            <option value="all">{t("All sources")}</option>
            <option value="admin">{t("Admin")}</option>
            <option value="jwt">JWT</option>
            <option value="access_token">{t("User-device binding")}</option>
          </Select>
          <input aria-label={t("Issuer Name")} value={issuerJTI} onChange={(event) => setFilters({ issuer_jti: event.target.value, offset: null })} placeholder={t("Issuer Name")} />
          </ResponsiveFilters>
          <IconButton label={selecting ? t("Cancel selection") : t("Select keys")} aria-pressed={selecting} className="icon-text" onClick={() => {
              setSelecting((value) => !value);
              setSelectedKeys(new Map());
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
        <QueryFeedback query={keys} />
        {batch.error ? <div className="error-text">{batch.error.message}</div> : null}
        <div className="table-wrap credential-table-wrap data-table-scroll">
          <table className={`credential-table key-table pinned-table ${selecting ? "has-selection" : ""}`}>
            <thead>
              <tr>
                {selecting ? (
                  <th className="select-cell">
                    <input aria-label={t("Select all")} checked={allVisibleSelected} disabled={keys.isPlaceholderData} onChange={toggleAllVisible} type="checkbox" />
                  </th>
                ) : null}
                <th className="credential-name-col">{t("Name")}</th>
                <th className="credential-status-col">{t("Status")}</th>
                <th className="credential-source-col">{t("Source")} / {t("Issuer Name")}</th>
                <th className="key-models-col">{t("Models")}</th>
                <th className="key-period-col">{t("Period")}</th>
                <SortHeader className="key-spend-col numeric" sort={sort} sortKey="used_microcredits" onSort={toggleSort} title={t("Sort by cumulative usage")} hint={<span className="key-column-hint">Credits</span>}>{t("Spent")}</SortHeader>
                <th className="key-limit-col numeric">{t("Limit")}<span className="key-column-hint">Credits</span></th>
                <SortHeader className="credential-usage-col numeric" sort={sort} sortKey="used_requests" onSort={toggleSort} firstDirection="asc" title={t("Sort by cumulative usage")} hint={<span className="key-column-hint" title={t("Hover for usage and limit")}>{t("Used")}</span>}>{t("Requests")}</SortHeader>
                <SortHeader className="credential-usage-col numeric" sort={sort} sortKey="used_tokens" onSort={toggleSort} firstDirection="asc" title={t("Sort by cumulative usage")} hint={<span className="key-column-hint" title={t("Hover for usage and limit")}>{t("Used")}</span>}>{t("Tokens")}</SortHeader>
                <th className="key-reset-col">{t("Reset")}</th>
                <SortHeader className="credential-date-col" sort={sort} sortKey="last_used_at" onSort={toggleSort} firstDirection="asc">{t("Last used")}</SortHeader>
                <th className="row-actions-cell" aria-label={t("Actions")} />
              </tr>
            </thead>
            <tbody>
              {visibleKeys.map((key) => (
                <tr key={key.id}>
                  {selecting ? (
                    <td className="select-cell">
                      <input aria-label={t("Select {name}", { name: key.name })} checked={selectedKeys.has(key.id)} onChange={() => toggleSelection(key)} type="checkbox" />
                    </td>
                  ) : null}
                  <td>
                    <Link className="table-link cell-ellipsis" title={key.name} state={{ from: `/grant-keys${params.size ? `?${params}` : ""}` }} to={`/grant-keys/${key.id}`}>
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
                      <small><Link className="cell-ellipsis" title={key.issuer_jti} to={`/grant-keys?tab=jwt-grants&search=${encodeURIComponent(key.issuer_jti)}`}>{key.issuer_name || key.issuer_jti}</Link></small>
                    ) : <small className="muted-cell">—</small>}
                  </td>
                  <td><CredentialModels models={key.allowed_models} /></td>
                  <KeyUsageCells apiKey={key} now={now} />
                  <td><CredentialTime value={key.last_used_at} /></td>
                  <td className="row-actions-cell">
                    <RowActions label={t("Actions for {name}", { name: key.name })} items={[
                      { label: t("Edit"), icon: <Pencil size={15} />, onSelect: () => navigate(`/grant-keys/${key.id}#api-key-settings`, { state: { from: `/grant-keys${params.size ? `?${params}` : ""}` } }) },
                      { label: t("Duplicate"), icon: <Copy size={15} />, onSelect: () => openCreateDialog(key) },
                      ...(key.status === "active" ? [{ label: t("Inactive"), icon: <Ban size={15} />, onSelect: () => inactiveKey(key.id, key.name) }] : []),
                      { label: t("Delete"), icon: <Trash2 size={15} />, danger: true, onSelect: () => confirm({ message: t("Delete {name}?", { name: key.name }), action: () => remove.mutateAsync(key.id) }) },
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
        {keys.data || offset ? <TablePagination offset={offset} limit={pageSize} count={visibleKeys.length} total={keys.data?.total} pending={keys.isFetching} onPageChange={next => setFilters({ offset: next ? String(next) : null })} /> : null}
      </section>

      {createOpen ? (
        <ModalDialog title="Create API Key" busy={create.isPending} onClose={() => setCreateOpen(false)}>
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
              <IconButton label={t("Close")} className="icon-text" disabled={create.isPending} onClick={() => setCreateOpen(false)} type="button"><X size={16} /></IconButton>
              <IconButton label={t("Create")} className="primary" disabled={create.isPending || Boolean(createdKey)} type="submit"><Plus size={16} /></IconButton>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </section>
  );
}
