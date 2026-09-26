import { Loader2, RotateCw } from "lucide-react";
import { IconButton } from "./IconButton";
import { useI18n } from "../lib/i18n";

type QueryState = { isPending: boolean; isFetching: boolean; error: Error | null; data: unknown; refetch: () => unknown };

/** Keep loading, empty results and failed refreshes distinct. */
export function QueryFeedback({ query }: { query: QueryState }) {
  const { t } = useI18n();
  if (query.error) return <div className="query-feedback error-text" role="alert">
    <span>{t(query.data ? "Refresh failed; showing previous results." : "Unable to load data.")} <span>{query.error.message}</span></span>
    <IconButton label={t("Retry")} disabled={query.isFetching} onClick={() => query.refetch()}><RotateCw size={16} /></IconButton>
  </div>;
  if (!query.isFetching) return null;
  // Background refresh is already visible in the page refresh icon; do not move the table.
  if (query.data) return <span className="visually-hidden" role="status">{t("Updating results...")}</span>;
  return <div className="query-feedback" role="status"><Loader2 className="spin" size={14} />{t(query.isPending ? "Loading..." : "Updating results...")}</div>;
}
