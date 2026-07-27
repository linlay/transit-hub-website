import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [search, setSearch] = useState("");
  const [includeStale, setIncludeStale] = useState(false);
  const sessions = useQuery({
    queryKey: ["sessions", search, includeStale],
    queryFn: () => api.sessions({ search, include_stale: includeStale }),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });

  usePageActions(<RefreshButton isRefreshing={sessions.isFetching} onClick={() => sessions.refetch()} />, [sessions.isFetching, sessions.refetch]);

  return (
    <section className="page">
      {isTelemetryError(sessions.error) ? <TelemetryUnavailable /> : null}
      {!isTelemetryError(sessions.error) ? <section className="panel">
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search device, source, key")} />
          </label>
          <label className="check-row">
            <input checked={includeStale} onChange={(event) => setIncludeStale(event.target.checked)} type="checkbox" />
            {t("Include stale")}
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("API key")}</th>
                <th>{t("Device")}</th>
                <th>{t("Source")}</th>
                <th>{t("Status")}</th>
                <th>{t("Requests")}</th>
                <th>{t("Tokens")}</th>
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
                  <td>{integer(session.request_count)}</td>
                  <td title={integer(session.token_count)}>{compactTokenCount(session.token_count)}</td>
                  <td>{dateTime(session.last_seen_at)}</td>
                </tr>
              ))}
              {!sessions.data?.items?.length ? (
                <tr>
                  <td colSpan={7} className="muted-cell">
                    {t("No sessions match the current filters.")}
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
