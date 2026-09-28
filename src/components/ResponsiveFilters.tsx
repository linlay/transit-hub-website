import { useEffect, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ModalDialog } from "./ModalDialog";
import { useI18n } from "../lib/i18n";

/** Keep one set of filter controls: inline on desktop, in a dialog on phones. */
export function ResponsiveFilters({ children, count, summary, onReset }: {
  children: ReactNode;
  count: number;
  summary?: string;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => { setMobile(query.matches); setOpen(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!mobile) return <>{children}</>;
  return <>
    <button className="mobile-filter-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <SlidersHorizontal size={16} />
      <span>{t("Filters")}{count > 0 ? ` (${count})` : ""}</span>
    </button>
    {summary ? <span className="mobile-filter-summary">{summary}</span> : null}
    {open ? <ModalDialog title="Filter settings" onClose={() => setOpen(false)}>
      <p className="mobile-filter-note">{t("Filters apply immediately")}</p>
      <div className="mobile-filter-content">{children}</div>
      <div className="mobile-filter-footer">
        <button className="icon-text" type="button" onClick={onReset}>{t("Reset")}</button>
        <button className="primary" type="button" onClick={() => setOpen(false)}>{t("Done")}</button>
      </div>
    </ModalDialog> : null}
  </>;
}
