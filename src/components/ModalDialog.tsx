import { ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";

type ModalDialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function ModalDialog({ title, children, onClose }: ModalDialogProps) {
  const { t } = useI18n();

  return (
    <div className="dialog-backdrop">
      <div aria-modal="true" className="dialog" role="dialog">
        <div className="dialog-header">
          <h2>{t(title)}</h2>
          <button aria-label={t("Close dialog")} className="icon-button" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
