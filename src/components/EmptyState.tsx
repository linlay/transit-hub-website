import { useI18n } from "../lib/i18n";

export function EmptyState({ title }: { title: string }) {
  const { t } = useI18n();
  return <div className="empty-state">{t(title)}</div>;
}
