import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { usePageActions } from "../components/Layout";
import { QueryFeedback } from "../components/QueryFeedback";
import { IconButton } from "../components/IconButton";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { CredentialModels } from "../components/CredentialModels";
import { CredentialTime } from "../components/CredentialTime";
import { KeyUsageCells, keyHasWindowLimit } from "../components/KeyUsageCells";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useDebouncedValue, useListFilters } from "../lib/useListFilters";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

export function EmployeeKeys() {
  const { t } = useI18n();
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
  usePageActions(<RefreshButton isRefreshing={refreshing} onClick={() => Promise.all([settings.refetch(), keys.refetch()])} />, [refreshing, settings.refetch, keys.refetch]);

  return <section className="page list-page">
    <section className="panel employee-auth-policy">
      <QueryFeedback query={settings} />
      {settings.data ? <>
        <div className="panel-heading">
          <div>
            <h2>{t("Employee authentication keys")}</h2>
            <span>{t("Call models with your login access token. Usage is shared across tokens and devices for the same employee.")}</span>
          </div>
          <StatusPill active={settings.data.enabled} label={settings.data.enabled ? "Enabled" : "Disabled"} />
        </div>
        <div className="employee-auth-identity">
          <span>{t("Identity claim")}: <code>{settings.data.subject_claim}</code></span>
          {settings.data.enabled ? <><span>{t("Issuer")}: <code>{settings.data.issuer}</code></span><span>{t("Audience")}: <code>{settings.data.audience}</code></span></> : <span className="muted-cell">{t("Enable employee authentication in the server configuration.")}</span>}
        </div>
      </> : null}
    </section>
    <section className="panel credential-panel">
      <div className="toolbar filters">
        <label className="search"><Search size={16} /><input aria-label={t("Search employees")} placeholder={t("Search employees")} value={search} onChange={event => setFilters({ search: event.target.value, offset: null })} /></label>
        <select aria-label={t("Status")} value={status} onChange={event => setFilters({ status: event.target.value, offset: null })}>
          <option value="all">{t("All statuses")}</option><option value="active">{t("Active")}</option><option value="disabled">{t("Disabled")}</option>
        </select>
      </div>
      <QueryFeedback query={keys} />
      <div className="table-wrap credential-table-wrap data-table-scroll">
        <table className="credential-table key-table employee-keys-table pinned-table">
          <thead><tr>
            <th className="credential-name-col">{t("Employee identity")}</th><th className="credential-status-col">{t("Status")}</th><th className="key-models-col">{t("Models")}</th>
            <th>{t("Period")}</th><th className="numeric">{t("Spent")}<span className="key-column-hint">Credits</span></th><th className="numeric">{t("Limit")}<span className="key-column-hint">Credits</span></th>
            <th className="numeric">{t("Requests")}</th><th className="numeric">{t("Tokens")}</th><th>{t("Reset")}</th><th>{t("Last used")}</th>
          </tr></thead>
          <tbody>
            {keys.data?.items.map(key => <tr key={key.id}>
              <td><Link className="table-link cell-ellipsis" title={key.employee_identity?.subject ?? key.name} to={`/employee-keys/${key.id}`} state={{ from: `/employee-keys${params.size ? `?${params}` : ""}` }}>{key.employee_identity?.subject ?? key.name}</Link><small>{key.name !== key.employee_identity?.subject ? key.name : key.employee_identity?.claim}</small></td>
              <td><StatusPill active={key.status === "active" && !key.forced_expired} label={key.status === "active" && !key.forced_expired ? "Active" : "Disabled"} />{keyHasWindowLimit(key, now) ? <span className="key-window-limited">{t("Window limited")}</span> : null}</td>
              <td><CredentialModels models={key.allowed_models} /></td>
              <KeyUsageCells apiKey={key} now={now} />
              <td><CredentialTime value={key.last_used_at} /></td>
            </tr>)}
            {!keys.isPending && !keys.isError && !keys.data?.items.length ? <tr><td colSpan={10} className="muted-cell">{t("Employees appear after their first authenticated request.")}</td></tr> : null}
          </tbody>
        </table>
      </div>
      {keys.data ? <div className="employee-keys-pagination">
        <span className="muted-cell">{t("{count} employees", { count: keys.data.total ?? keys.data.items.length })}</span>
        <IconButton label={t("Previous page")} disabled={offset === 0 || keys.isFetching} onClick={() => setFilters({ offset: String(Math.max(0, offset - 50)) })}><ChevronLeft size={16} /></IconButton>
        <IconButton label={t("Next page")} disabled={offset + 50 >= (keys.data.total ?? keys.data.items.length) || keys.isFetching} onClick={() => setFilters({ offset: String(offset + 50) })}><ChevronRight size={16} /></IconButton>
      </div> : null}
    </section>
  </section>;
}
