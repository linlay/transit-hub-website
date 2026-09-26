import { useListFilters, useDebouncedValue } from "../lib/useListFilters";
import { useListScroll } from "../lib/useListScroll";
import { QueryFeedback } from "../components/QueryFeedback";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { api, isTelemetryError } from "../lib/api";
import { compactTokenCount, dateTime, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

export function Sessions() {
  const { t } = useI18n();
  const { params, setFilters } = useListFilters();
  const search = params.get("search") ?? "";
  const includeStale = params.get("include_stale") === "true";
  const debouncedSearch = useDebouncedValue(search);
  const sessions = useQuery({
    queryKey: ["sessions", debouncedSearch, includeStale],
    placeholderData: keepPreviousData,
    queryFn: () => api.sessions({ search: debouncedSearch, include_stale: includeStale }),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });

  useListScroll(Boolean(sessions.data));
  usePageActions(<RefreshButton isRefreshing={sessions.isFetching} onClick={() => sessions.refetch()} />, [sessions.isFetching, sessions.refetch]);

  return (
    <section className="page">
      {isTelemetryError(sessions.error) ? <TelemetryUnavailable /> : null}
      {!isTelemetryError(sessions.error) ? <section className="panel">
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setFilters({ search: event.target.value })} placeholder={t("Search device, source, key")} />
          </label>
          <label className="check-row">
            <input checked={includeStale} onChange={(event) => setFilters({ include_stale: event.target.checked ? "true" : null })} type="checkbox" />
            {t("Include stale")}
          </label>
        </div>
        <QueryFeedback query={sessions} />
        <div className="table-wrap data-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("API key")}</th>
                <th>{t("Device")}</th>
                <th>{t("Source")}</th>
                <th>{t("Status")}</th>
                <th className="numeric">{t("Requests")}</th>
                <th className="numeric">{t("Tokens")}</th>
                <th>{t("Last seen")}</th>
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
      </section> : null}
    </section>
  );
}
