import { RefreshCw } from "lucide-react";
import { useI18n } from "../lib/i18n";

type RefreshButtonProps = {
  onClick: () => void | Promise<unknown>;
  isRefreshing: boolean;
  disabled?: boolean;
  label?: string;
};

export function RefreshButton({ onClick, isRefreshing, disabled = false, label = "Refresh" }: RefreshButtonProps) {
  const { t } = useI18n();

  return (
    <button className="icon-text" disabled={disabled || isRefreshing} onClick={onClick} type="button">
      <RefreshCw className={isRefreshing ? "spin" : undefined} size={16} />
      {t(label)}
    </button>
  );
}
