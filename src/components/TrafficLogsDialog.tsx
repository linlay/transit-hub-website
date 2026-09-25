import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { creditAmount, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { RefreshButton } from "./RefreshButton";

export function TrafficLogsDialog({ query, timezone, onClose }: { query: Record<string, string | number | boolean | undefined>; timezone: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const logs = useQuery({ queryKey: ["traffic-logs", query, page], queryFn: () => api.logs({ ...query, limit: 50, offset: page * 50 }) });
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  const total = logs.data?.total ?? 0;
  return <dialog ref={dialogRef} className="api-key-logs-dialog" aria-labelledby="traffic-logs-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-header"><h2 id="traffic-logs-title">{t("Matching requests")}</h2><button autoFocus type="button" className="icon-button" aria-label={t("Close dialog")} onClick={onClose}><X size={16} /></button></div>
    <div className="panel-actions"><span>{t("Total")}: {integer(total)} · {timezone}</span><RefreshButton isRefreshing={logs.isFetching} onClick={() => logs.refetch()} /></div>
    <div className="table-wrap"><table><thead><tr>{["Time", "Key", "Model", "Provider", "Status", "Latency", "Tokens", "Spend (Credits)"].map((label) => <th key={label}>{t(label)}</th>)}</tr></thead>
      <tbody>
        {logs.isPending || logs.error || !logs.data?.items.length ? <tr><td colSpan={8}>{t(logs.isPending ? "Loading logs..." : logs.error ? "Unable to load logs" : "No requests yet.")}</td></tr> : null}
        {(logs.data?.items ?? []).map((log) => <tr key={log.id}>
          <td>{new Intl.DateTimeFormat(locale, { timeZone: timezone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(log.created_at))}</td>
          <td title={log.api_key_id}>{log.api_key_name || log.api_key_id}</td><td>{log.public_model}</td><td>{log.provider}</td><td>{log.status_code}{log.error_type ? <small>{log.error_type}</small> : null}</td><td>{integer(log.latency_ms)} ms</td><td>{integer(log.total_tokens)}</td><td>{creditAmount(log.charged_microcredits)}</td>
        </tr>)}
      </tbody></table></div>
    <div className="dialog-actions"><button type="button" className="icon-text" disabled={page === 0 || logs.isFetching} onClick={() => setPage(page - 1)}>{t("Previous page")}</button><span>{page + 1} / {Math.max(1, Math.ceil(total / 50))}</span><button type="button" className="icon-text" disabled={!logs.data || (page + 1) * 50 >= total || logs.isFetching} onClick={() => setPage(page + 1)}>{t("Next page")}</button></div>
  </dialog>;
}
