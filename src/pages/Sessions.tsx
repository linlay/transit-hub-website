import { useListFilters, useDebouncedValue } from "../lib/useListFilters";
import { useListScroll } from "../lib/useListScroll";
import { QueryFeedback } from "../components/QueryFeedback";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { ResponsiveFilters } from "../components/ResponsiveFilters";
import { StatusPill } from "../components/StatusPill";
import { nextTableSort, readTableSort, SortHeader } from "../components/TableSort";
import { TablePagination } from "../components/TablePagination";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { api, isTelemetryError } from "../lib/api";
import { compactTokenCount, dateTime, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

const sessionSorts = ["request_count", "token_count", "last_seen_at"] as const;
const pageSize = 100;

export function Sessions() {
  const { t } = useI18n();
  const { params, setFilters } = useListFilters();
  const search = params.get("search") ?? "";
  const includeStale = params.get("include_stale") === "true";
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "", 10) || 0);
  const sort = readTableSort(params, sessionSorts);
  const debouncedSearch = useDebouncedValue(search);
  const query = { search: debouncedSearch, include_stale: includeStale, limit: pageSize, offset, sort: sort?.key, dir: sort?.dir };
  const sessions = useQuery({
    queryKey: ["sessions", query],
    placeholderData: keepPreviousData,
    queryFn: () => api.sessions(query),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });

  useListScroll(Boolean(sessions.data));
  usePageActions(<RefreshButton isRefreshing={sessions.isFetching} onClick={() => sessions.refetch()} />, [sessions.isFetching, sessions.refetch]);

  function toggleSort(key: typeof sessionSorts[number], firstDirection: "asc" | "desc") {
    const next = nextTableSort(sort, key, firstDirection);
    setFilters({ sort: next?.key ?? null, dir: next?.dir ?? null, offset: null });
  }

  return (
    <section className="page list-page">
      {isTelemetryError(sessions.error) ? <TelemetryUnavailable /> : null}
      {!isTelemetryError(sessions.error) ? <section className="panel">
        <div className="toolbar session-filters">
          <label className="search">
            <Search size={16} />
            <input type="search" value={search} onChange={(event) => setFilters({ search: event.target.value, offset: null })} placeholder={t("Search device, source, key")} />
          </label>
          <ResponsiveFilters count={Number(includeStale)} summary={includeStale ? t("Include stale") : ""} onReset={() => setFilters({ include_stale: null, offset: null })}>
          <label className="check-row">
            <input checked={includeStale} onChange={(event) => setFilters({ include_stale: event.target.checked ? "true" : null, offset: null })} type="checkbox" />
            {t("Include stale")}
          </label>
          </ResponsiveFilters>
        </div>
        <QueryFeedback query={sessions} />
        <div className="table-wrap data-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("API key")}</th>
                <th>{t("Device")}</th>
                <th>{t("Source")}</th>
                <th className="status-cell">{t("Status")}</th>
                <SortHeader className="numeric" sort={sort} sortKey="request_count" onSort={toggleSort}>{t("Requests")}</SortHeader>
                <SortHeader className="numeric" sort={sort} sortKey="token_count" onSort={toggleSort}>{t("Tokens")}</SortHeader>
                <SortHeader sort={sort} sortKey="last_seen_at" onSort={toggleSort}>{t("Last seen")}</SortHeader>
              </tr>
            </thead>
            <tbody>
              {(sessions.data?.items ?? []).map((session) => (
                <tr key={`${session.api_key_id}:${session.device_id}:${session.source}`}>
                  <td>
                    {session.api_key_name}
                    <small>{session.key_prefix}</small>
                  </td>
                  <td>{session.device_id}</td>
                  <td>{session.source}</td>
                  <td>
                    <StatusPill active={session.active} />
                  </td>
                  <td className="numeric">{integer(session.request_count)}</td>
                  <td className="numeric" title={integer(session.token_count)}>{compactTokenCount(session.token_count)}</td>
                  <td>{dateTime(session.last_seen_at)}</td>
                </tr>
              ))}
              {!sessions.data?.items?.length ? (
                <tr>
                  <td colSpan={7} className="muted-cell">
                    {sessions.isPending ? t("Loading...") : sessions.isError ? t("Unable to load data.") : t("No sessions match the current filters.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination offset={offset} limit={pageSize} count={sessions.data?.items.length ?? 0} total={sessions.data?.total} pending={sessions.isFetching} onPageChange={next => setFilters({ offset: next ? String(next) : null })} />
      </section> : null}
    </section>
  );
}
