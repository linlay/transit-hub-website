import { RefreshCw } from "lucide-react";

type RefreshButtonProps = {
  onClick: () => void | Promise<unknown>;
  isRefreshing: boolean;
  disabled?: boolean;
  label?: string;
};

export function RefreshButton({ onClick, isRefreshing, disabled = false, label = "Refresh" }: RefreshButtonProps) {
  return (
    <button className="icon-text" disabled={disabled || isRefreshing} onClick={onClick} type="button">
      <RefreshCw className={isRefreshing ? "spin" : undefined} size={16} />
      {label}
    </button>
  );
}
