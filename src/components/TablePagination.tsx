import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { IconButton } from "./IconButton";

export function TablePagination({ offset, limit, count, total, pending, onPageChange, alwaysShow = false }: {
  offset: number;
  limit: number;
  count: number;
  total?: number;
  pending: boolean;
  onPageChange: (offset: number) => void;
  alwaysShow?: boolean;
}) {
  const { t } = useI18n();
  const hasNext = total === undefined ? count === limit : offset + limit < total;
  if (!offset && !hasNext && !alwaysShow) return null;
  return <div className="employee-keys-pagination">
    <span className="muted-cell">{t("Page {page}", { page: Math.floor(offset / limit) + 1 })} · {t("{count} records", { count: total ?? count })}</span>
    <IconButton label={t("Previous page")} type="button" disabled={!offset || pending} onClick={() => onPageChange(Math.max(0, offset - limit))}><ChevronLeft size={16} /></IconButton>
    <IconButton label={t("Next page")} type="button" disabled={!hasNext || pending} onClick={() => onPageChange(offset + limit)}><ChevronRight size={16} /></IconButton>
  </div>;
}
