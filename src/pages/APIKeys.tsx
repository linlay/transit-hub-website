import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Ban, Copy, Plus, Search, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ModalDialog } from "../components/ModalDialog";
import { ModelWhitelistInput, publicModelsFromProviders } from "../components/ModelWhitelistInput";
import { QuotaInput, quotaValue } from "../components/QuotaInput";
import { RateLimitEditor, rateLimitValue } from "../components/RateLimitEditor";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { compactTokenCount, dateTime, integer, quotaRatio } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { APIKey } from "../lib/types";

export function APIKeys() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  type SortKey = "used_requests" | "used_tokens" | "last_used_at" | null;
  type SortDir = "asc" | "desc";
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState(params.get("source") ?? "all");
  const [issuerJTI, setIssuerJTI] = useState(params.get("issuer_jti") ?? "");
  const [createOpen, setCreateOpen] = useState(false);
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

  function openCreateDialog() {
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
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (allowedModels.length === 0) {
      setCreateModelError(t("Select at least one model."));
      return;
    }
    setCreateModelError("");
    create.mutate({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      request_quota: quotaValue(form, "request_quota"),
      token_quota: quotaValue(form, "token_quota"),
      rate_limits: rateLimitValue(form, "rate_limits"),
      allowed_models: allowedModels,
    });
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

  return (
    <section className="page">
      <div className="page-actions">
        <RefreshButton isRefreshing={keys.isFetching || providers.isFetching} onClick={() => Promise.all([keys.refetch(), providers.refetch()])} />
        <button className="primary" onClick={openCreateDialog} type="button">
          <Plus size={16} />
          {t("Create key")}
        </button>
      </div>

      <section className="panel">
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
          </select>
          <input value={issuerJTI} onChange={(event) => setIssuerJTI(event.target.value)} placeholder={t("Issuer JTI")} />
          <button
            className="icon-text"
            onClick={() => {
              setSelecting((value) => !value);
              setSelectedIDs(new Set());
            }}
            type="button"
          >
            {selecting ? t("Cancel selection") : t("Select keys")}
          </button>
          <button className="icon-text danger" disabled={!issuerJTI.trim() || batch.isPending} onClick={deleteByIssuerJTI} type="button">
            <Trash2 size={16} />
            {t("Delete by Issuer JTI")}
          </button>
        </div>
        {selecting ? (
          <div className="bulk-bar">
            <span>{t("Selected {count}", { count: selectedCount })}</span>
            <button className="icon-text" disabled={selectedCount === 0 || batch.isPending} onClick={() => batchSelected("inactive")} type="button">
              <Ban size={16} />
              {t("Inactive selected")}
            </button>
            <button className="icon-text danger" disabled={selectedCount === 0 || batch.isPending} onClick={() => batchSelected("delete")} type="button">
              <Trash2 size={16} />
              {t("Delete selected")}
            </button>
          </div>
        ) : null}
        {batch.error ? <div className="error-text">{batch.error.message}</div> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {selecting ? (
                  <th className="select-cell">
                    <input checked={allVisibleSelected} onChange={toggleAllVisible} type="checkbox" />
                  </th>
                ) : null}
                <th>{t("Name")}</th>
                <th>{t("Status")}</th>
                <th>{t("Source")}</th>
                <th>{t("Issuer JTI")}</th>
                <th className="sortable">
                  <button className="sort-header" type="button" onClick={() => toggleSort("used_requests")}>
                    {t("Requests")}
                    {sortIcon("used_requests")}
                  </button>
                </th>
                <th className="sortable">
                  <button className="sort-header" type="button" onClick={() => toggleSort("used_tokens")}>
                    {t("Tokens")}
                    {sortIcon("used_tokens")}
                  </button>
                </th>
                <th className="sortable">
                  <button className="sort-header" type="button" onClick={() => toggleSort("last_used_at")}>
                    {t("Last used")}
                    {sortIcon("last_used_at")}
                  </button>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleKeys.map((key) => (
                <tr key={key.id}>
                  {selecting ? (
                    <td className="select-cell">
                      <input checked={selectedIDs.has(key.id)} onChange={() => toggleSelection(key.id)} type="checkbox" />
                    </td>
                  ) : null}
                  <td>
                    <Link className="table-link" to={`/api-keys/${key.id}`}>
                      {key.name}
                    </Link>
                    <small>{key.key_prefix}</small>
                  </td>
                  <td>
                    <StatusPill active={key.status === "active" && !key.forced_expired} label={key.status === "active" ? "Active" : "Disabled"} />
                  </td>
                  <td>{key.source === "admin" ? t("Admin") : "JWT"}</td>
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
                    <Progress value={quotaRatio(key.used_tokens, key.token_quota)} label={`${compactTokenCount(key.used_tokens)} / ${key.token_quota ? compactTokenCount(key.token_quota) : "∞"}`} title={`${integer(key.used_tokens)} / ${key.token_quota ? integer(key.token_quota) : "∞"}`} />
                  </td>
                  <td>{dateTime(key.last_used_at)}</td>
                  <td>
                    <div className="table-actions">
                      {key.status === "active" ? (
                        <button className="icon-button" onClick={() => inactiveKey(key.id, key.name)} title={t("Inactive")} type="button">
                          <Ban size={16} />
                        </button>
                      ) : null}
                      <button
                        className="icon-button danger"
                        onClick={() => window.confirm(t("Delete {name}?", { name: key.name })) && remove.mutate(key.id)}
                        title={t("Delete")}
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!keys.data?.items?.length ? (
                <tr>
                  <td colSpan={selecting ? 9 : 8} className="muted-cell">
                    {t("No API keys found.")}
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
            <input name="name" placeholder={t("Name")} required />
            <input name="description" placeholder={t("Description")} />
            <QuotaInput label="Request quota" name="request_quota" />
            <QuotaInput label="Token quota" name="token_quota" />
            <RateLimitEditor name="rate_limits" />
            <ModelWhitelistInput models={providerModels} />
            {createdKey ? (
              <div className="secret-box">
                <code>{createdKey}</code>
                <button className="icon-button" onClick={copyCreatedKey} title={t("Copy API key")} type="button">
                  <Copy size={16} />
                </button>
              </div>
            ) : null}
            {copyMessage ? <span className={copyMessage === "Copied." ? "muted-cell" : "error-text"}>{copyMessage}</span> : null}
            {createModelError ? <span className="error-text">{createModelError}</span> : null}
            {create.error ? <span className="error-text">{create.error.message}</span> : null}
            <div className="dialog-actions">
              <button className="icon-text" onClick={() => setCreateOpen(false)} type="button">
                {t("Close")}
              </button>
              <button className="primary" disabled={create.isPending} type="submit">
                <Plus size={16} />
                {t("Create")}
              </button>
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

function Progress({ value, label, title: cellTitle }: { value: number; label: string; title?: string }) {
  return (
    <div className="progress-cell">
      <div className="progress">
        <span style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <small title={cellTitle}>{label}</small>
    </div>
  );
}
