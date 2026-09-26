import { IconButton } from "./IconButton";
import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";

type ModalDialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function ModalDialog({ title, children, onClose }: ModalDialogProps) {
  const { t } = useI18n();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="dialog-backdrop">
      <div aria-modal="true" className="dialog" role="dialog">
        <div className="dialog-header">
          <h2>{t(title)}</h2>
          <IconButton label={t("Close dialog")} className="icon-button" onClick={onClose} type="button"><X size={16} /></IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
