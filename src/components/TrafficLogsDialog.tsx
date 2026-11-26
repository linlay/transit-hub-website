import { enterpriseRequest as request, type Row } from "../lib/enterprise";
import { IconButton } from "./IconButton";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { creditAmount, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { RefreshButton } from "./RefreshButton";
import { SortHeader, useTableSort } from "./TableSort";

type LogSort = "created_at" | "attempt_count" | "latency_ms" | "total_tokens" | "charged_microcredits";

export function TrafficLogsDialog({ query, timezone, onClose }: { query: Record<string, string | number | boolean | undefined>; timezone: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(0);
  const [sort, toggleSort] = useTableSort<LogSort>();
 const [selected,setSelected]=useState("");const trace=useQuery({queryKey:["request-trace",selected],queryFn:()=>request<Row>(`/admin/requests/${encodeURIComponent(selected)}`),enabled:Boolean(selected)});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestQuery = { ...query, limit: 50, offset: page * 50, sort: sort?.key, dir: sort?.dir };
  const logs = useQuery({ queryKey: ["traffic-logs", requestQuery], queryFn: () => api.logs(requestQuery) });
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  const total = logs.data?.total ?? 0;
  function sortLogs(key: LogSort, firstDirection: "asc" | "desc") {
    toggleSort(key, firstDirection);
    setPage(0);
  }
  return <dialog ref={dialogRef} className="api-key-logs-dialog" aria-labelledby="traffic-logs-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-header"><h2 id="traffic-logs-title">{t("Matching requests")}</h2><IconButton label={t("Close dialog")} autoFocus type="button" className="icon-button" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="panel-actions"><span>{t("Total")}: {integer(total)} · {timezone}</span><RefreshButton isRefreshing={logs.isFetching} onClick={() => logs.refetch()} /></div>
    <div className="table-wrap"><table><thead><tr>
      <SortHeader sort={sort} sortKey="created_at" onSort={sortLogs}>{t("Time")}</SortHeader>
      <th>{t("Key")}</th><th>{t("Model")}</th><th>{t("Provider")}</th>
      <SortHeader sort={sort} sortKey="attempt_count" onSort={sortLogs}>{t("Attempts / fallback")}</SortHeader>
      <th>{t("Gateway request ID")}</th><th>{t("Upstream request ID")}</th><th>{t("Status")}</th>
      <SortHeader sort={sort} sortKey="latency_ms" onSort={sortLogs}>{t("Latency")}</SortHeader>
      <SortHeader sort={sort} sortKey="total_tokens" onSort={sortLogs}>{t("Tokens")}</SortHeader>
      <th>{t("Characters")}</th>
      <SortHeader sort={sort} sortKey="charged_microcredits" onSort={sortLogs}>{t("Spend (Credits)")}</SortHeader>
    </tr></thead>
      <tbody>
        {logs.isPending || logs.error || !logs.data?.items.length ? <tr><td colSpan={12}>{t(logs.isPending ? "Loading logs..." : logs.error ? "Unable to load logs" : "No requests yet.")}</td></tr> : null}
        {(logs.data?.items ?? []).map((log) => <tr key={log.id}>
          <td>{new Intl.DateTimeFormat(locale, { timeZone: timezone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(log.created_at))}</td>
          <td title={log.api_key_id}>{log.api_key_name || log.api_key_id}</td><td>{log.public_model}</td><td>{log.provider}</td><td>{log.attempt_count??1}{log.fallback_used?t("· Fallback used"):""}</td><td>{log.gateway_request_id?<button className="inline-link" onClick={()=>setSelected(log.gateway_request_id??"")}>{log.gateway_request_id}</button>:"—"}</td><td><code>{log.upstream_request_id || "—"}</code></td><td>{log.status_code}{log.error_type ? <small>{log.error_type}</small> : null}</td><td>{integer(log.latency_ms)} ms</td><td>{integer(log.total_tokens)}</td><td>{log.protocol.endsWith("_tts") ? integer(log.characters ?? 0) : "—"}</td><td>{creditAmount(log.charged_microcredits)}</td>
        </tr>)}
      </tbody></table></div>
    {selected && <section className="panel"><h3>{t("Request details")}</h3><button onClick={()=>setSelected("")}>{t("Collapse")}</button>{trace.isPending ? <p>{t("Loading...")}</p>:trace.error?<p role="alert">{trace.error.message}</p>:<pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(trace.data,null,2)}</pre>}</section>}
    <div className="dialog-actions"><IconButton label={t("Previous page")} type="button" className="icon-text" disabled={page === 0 || logs.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></IconButton><span>{page + 1} / {Math.max(1, Math.ceil(total / 50))}</span><IconButton label={t("Next page")} type="button" className="icon-text" disabled={!logs.data || (page + 1) * 50 >= total || logs.isFetching} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></IconButton></div>
  </dialog>;
}
