import { Select } from "../components/ThemedControls";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Settings } from "lucide-react";
import { usePageActions } from "../components/Layout";
import { QueryFeedback } from "../components/QueryFeedback";
import { IconButton } from "../components/IconButton";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { CredentialModels } from "../components/CredentialModels";
import { CredentialTime } from "../components/CredentialTime";
import { nextTableSort, readTableSort, SortHeader } from "../components/TableSort";
import { TablePagination } from "../components/TablePagination";
import { KeyUsageCells, keyHasWindowLimit } from "../components/KeyUsageCells";
import { EmployeeDefaultPolicyForm } from "../components/EmployeeDefaultPolicyForm";
import { BatchKeyPolicyAction } from "../components/BatchKeyPolicy";
import type { EmployeePolicy } from "../lib/types";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useDebouncedValue, useListFilters } from "../lib/useListFilters";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

const keySorts = ["used_requests", "used_tokens", "used_microcredits", "last_used_at"] as const;

export function EmployeeKeys() {
  const { t } = useI18n();
  const [editingPolicy, setEditingPolicy] = useState<EmployeePolicy | null>(null);
  const [policySaved, setPolicySaved] = useState(false);
  const { params, setFilters } = useListFilters();
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "all";
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "", 10) || 0);
  const sort = readTableSort(params, keySorts);
  const debouncedSearch = useDebouncedValue(search);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const settings = useQuery({ queryKey: ["employee-auth"], queryFn: api.employeeAuth, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const query = { search: debouncedSearch, status, offset, limit: 50, sort: sort?.key, dir: sort?.dir };
  const keys = useQuery({
    queryKey: ["employee-keys", query],
    queryFn: () => api.employeeKeys(query),
    placeholderData: keepPreviousData,
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });
  const refreshing = settings.isFetching || keys.isFetching;
  usePageActions(<>
    {policySaved ? <span className="saved-text" role="status">{t("Saved")}</span> : null}
    <BatchKeyPolicyAction key="batch-policy" initialSource="employee" />
    <IconButton label={t("Authentication key defaults")} disabled={!settings.data || editingPolicy !== null} onClick={() => { if (settings.data) { setPolicySaved(false); setEditingPolicy(settings.data); } }}><Settings size={16} /></IconButton>
    {settings.data?.enabled === false
      ? <StatusPill active={false} label="Disabled" />
      : <RefreshButton disabled={!settings.data} isRefreshing={refreshing} onClick={() => Promise.all([settings.refetch(), keys.refetch()])} />}
  </>, [settings.data, editingPolicy, policySaved, refreshing, settings.refetch, keys.refetch, t]);

  function toggleSort(key: typeof keySorts[number], firstDirection: "asc" | "desc") {
    const next = nextTableSort(sort, key, firstDirection);
    setFilters({ sort: next?.key ?? null, dir: next?.dir ?? null, offset: null });
  }

  return <section className="page list-page">
    <QueryFeedback query={settings} />
    {editingPolicy ? <EmployeeDefaultPolicyForm initialPolicy={editingPolicy} onCancel={() => setEditingPolicy(null)} onSaved={() => { setEditingPolicy(null); setPolicySaved(true); void settings.refetch(); }} /> : null}
    <section className="panel credential-panel">
      <div className="toolbar filters">
        <label className="search"><Search size={16} /><input aria-label={t("Search identifiers or usernames")} placeholder={t("Search identifiers or usernames")} value={search} onChange={event => setFilters({ search: event.target.value, offset: null })} /></label>
        <Select aria-label={t("Status")} value={status} onChange={event => setFilters({ status: event.target.value, offset: null })}>
          <option value="all">{t("All statuses")}</option><option value="active">{t("Active")}</option><option value="disabled">{t("Disabled")}</option>
        </Select>
      </div>
      <QueryFeedback query={keys} />
      <div className="table-wrap credential-table-wrap data-table-scroll">
        <table className="credential-table key-table employee-keys-table pinned-table">
          <thead><tr>
            <th className="credential-name-col">{t("Unique identifier")}</th><th className="credential-status-col">{t("Status")}</th><th className="key-models-col">{t("Models")}</th>
            <th>{t("Period")}</th>
            <SortHeader className="numeric" sort={sort} sortKey="used_microcredits" onSort={toggleSort} title={t("Sort by cumulative usage")} hint={<span className="key-column-hint">Credits</span>}>{t("Spent")}</SortHeader>
            <th className="numeric">{t("Limit")}<span className="key-column-hint">Credits</span></th>
            <SortHeader className="numeric" sort={sort} sortKey="used_requests" onSort={toggleSort} title={t("Sort by cumulative usage")}>{t("Requests")}</SortHeader>
            <SortHeader className="numeric" sort={sort} sortKey="used_tokens" onSort={toggleSort} title={t("Sort by cumulative usage")}>{t("Tokens")}</SortHeader>
            <th>{t("Reset")}</th>
            <SortHeader sort={sort} sortKey="last_used_at" onSort={toggleSort}>{t("Last used")}</SortHeader>
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
      {keys.data || offset ? <TablePagination offset={offset} limit={50} count={keys.data?.items.length ?? 0} total={keys.data?.total} pending={keys.isFetching} onPageChange={next => setFilters({ offset: next ? String(next) : null })} alwaysShow /> : null}
    </section>
  </section>;
}
