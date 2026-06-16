import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { RefreshButton } from "../components/RefreshButton";
import { StatusPill } from "../components/StatusPill";
import { api } from "../lib/api";
import { compactTokenCount, dateTime, integer } from "../lib/format";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

export function Sessions() {
  const [search, setSearch] = useState("");
  const [includeStale, setIncludeStale] = useState(false);
  const sessions = useQuery({
    queryKey: ["sessions", search, includeStale],
    queryFn: () => api.sessions({ search, include_stale: includeStale }),
    refetchInterval: PAGE_REFETCH_INTERVAL_MS,
  });

  return (
    <section className="page">
      <div className="page-actions">
        <RefreshButton isRefreshing={sessions.isFetching} onClick={() => sessions.refetch()} />
      </div>

      <section className="panel">
        <div className="toolbar">
          <label className="search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search device, source, key" />
          </label>
          <label className="check-row">
            <input checked={includeStale} onChange={(event) => setIncludeStale(event.target.checked)} type="checkbox" />
            Include stale
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>API key</th>
                <th>Device</th>
                <th>Source</th>
                <th>Status</th>
                <th>Requests</th>
                <th>Tokens</th>
                <th>Last seen</th>
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
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
