import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, Settings } from "lucide-react";
import { usePageActions } from "../components/Layout";
import { QueryFeedback } from "../components/QueryFeedback";
import { IconButton } from "../components/IconButton";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { CredentialModels } from "../components/CredentialModels";
import { CredentialTime } from "../components/CredentialTime";
import { KeyUsageCells, keyHasWindowLimit } from "../components/KeyUsageCells";
import { EmployeeDefaultPolicyForm } from "../components/EmployeeDefaultPolicyForm";
import type { EmployeePolicy } from "../lib/types";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useDebouncedValue, useListFilters } from "../lib/useListFilters";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

export function EmployeeKeys() {
  const { t } = useI18n();
  const [editingPolicy, setEditingPolicy] = useState<EmployeePolicy | null>(null);
  const [policySaved, setPolicySaved] = useState(false);
  const { params, setFilters } = useListFilters();
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "all";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const debouncedSearch = useDebouncedValue(search);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const settings = useQuery({ queryKey: ["employee-auth"], queryFn: api.employeeAuth, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const keys = useQuery({
    queryKey: ["employee-keys", debouncedSearch, status, offset],
    queryFn: () => api.employeeKeys({ search: debouncedSearch, status, offset, limit: 50 }),
    placeholderData: keepPreviousData,
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const refreshing = settings.isFetching || keys.isFetching;
  usePageActions(<>
    {policySaved ? <span className="saved-text" role="status">{t("Saved")}</span> : null}
    <IconButton label={t("Authentication key defaults")} disabled={!settings.data || editingPolicy !== null} onClick={() => { if (settings.data) { setPolicySaved(false); setEditingPolicy(settings.data); } }}><Settings size={16} /></IconButton>
    {settings.data?.enabled === false
      ? <StatusPill active={false} label="Disabled" />
      : <RefreshButton disabled={!settings.data} isRefreshing={refreshing} onClick={() => Promise.all([settings.refetch(), keys.refetch()])} />}
  </>, [settings.data, editingPolicy, policySaved, refreshing, settings.refetch, keys.refetch, t]);

  return <section className="page list-page">
    <QueryFeedback query={settings} />
    {editingPolicy ? <EmployeeDefaultPolicyForm initialPolicy={editingPolicy} onCancel={() => setEditingPolicy(null)} onSaved={() => { setEditingPolicy(null); setPolicySaved(true); void settings.refetch(); }} /> : null}
    <section className="panel credential-panel">
      <div className="toolbar filters">
        <label className="search"><Search size={16} /><input aria-label={t("Search identifiers or usernames")} placeholder={t("Search identifiers or usernames")} value={search} onChange={event => setFilters({ search: event.target.value, offset: null })} /></label>
        <select aria-label={t("Status")} value={status} onChange={event => setFilters({ status: event.target.value, offset: null })}>
          <option value="all">{t("All statuses")}</option><option value="active">{t("Active")}</option><option value="disabled">{t("Disabled")}</option>
        </select>
      </div>
      <QueryFeedback query={keys} />
      <div className="table-wrap credential-table-wrap data-table-scroll">
        <table className="credential-table key-table employee-keys-table pinned-table">
          <thead><tr>
            <th className="credential-name-col">{t("Unique identifier")}</th><th className="credential-status-col">{t("Status")}</th><th className="key-models-col">{t("Models")}</th>
            <th>{t("Period")}</th><th className="numeric">{t("Spent")}<span className="key-column-hint">Credits</span></th><th className="numeric">{t("Limit")}<span className="key-column-hint">Credits</span></th>
            <th className="numeric">{t("Requests")}</th><th className="numeric">{t("Tokens")}</th><th>{t("Reset")}</th><th>{t("Last used")}</th>
          </tr></thead>
          <tbody>
            {keys.data?.items.map(key => <tr key={key.id}>
              <td><Link className="table-link cell-ellipsis" title={key.employee_identity?.subject ?? key.name} to={`/employee-keys/${key.id}`} state={{ from: `/employee-keys${params.size ? `?${params}` : ""}` }}>{key.employee_identity?.subject ?? key.name}</Link>{key.name !== key.employee_identity?.subject ? <small title={key.name}>{key.name}</small> : null}</td>
              <td><StatusPill active={key.status === "active" && !key.forced_expired} label={key.status === "active" && !key.forced_expired ? "Active" : "Disabled"} />{keyHasWindowLimit(key, now) ? <span className="key-window-limited">{t("Window limited")}</span> : null}</td>
              <td><CredentialModels models={key.allowed_models} /></td>
              <KeyUsageCells apiKey={key} now={now} />
              <td><CredentialTime value={key.last_used_at} /></td>
            </tr>)}
            {!keys.isPending && !keys.isError && !keys.data?.items.length ? <tr><td colSpan={10} className="muted-cell">{t("Records appear after the first authenticated request.")}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {keys.data ? <div className="employee-keys-pagination">
        <span className="muted-cell">{t("{count} records", { count: keys.data.total ?? keys.data.items.length })}</span>
        <IconButton label={t("Previous page")} disabled={offset === 0 || keys.isFetching} onClick={() => setFilters({ offset: String(Math.max(0, offset - 50)) })}><ChevronLeft size={16} /></IconButton>
        <IconButton label={t("Next page")} disabled={offset + 50 >= (keys.data.total ?? keys.data.items.length) || keys.isFetching} onClick={() => setFilters({ offset: String(offset + 50) })}><ChevronRight size={16} /></IconButton>
      </div> : null}
    </section>
  </section>;
}
