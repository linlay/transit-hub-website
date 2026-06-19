import { useI18n } from "../lib/i18n";

export function StatusPill({ active, label }: { active: boolean; label?: string }) {
  const { t } = useI18n();
  return <span className={`pill ${active ? "good" : "muted"}`}>{label ? t(label) : active ? t("Active") : t("Inactive")}</span>;
}
