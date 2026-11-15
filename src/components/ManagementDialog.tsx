import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { ModalDialog } from "./ModalDialog";
import { useI18n } from "../lib/i18n";

export function ManagementDialog({ title, onClose, busy = false, children, showCloseAction = true }: { showCloseAction?: boolean; title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const { t } = useI18n();
  return <ModalDialog title={title} onClose={onClose} busy={busy}>
    <div className="enterprise-page management-dialog-content">{children}</div>
    {showCloseAction && <div className="dialog-actions management-dialog-footer"><button className="icon-text" type="button" disabled={busy} onClick={onClose}>{t("Close")}</button></div>}
  </ModalDialog>;
}

export function ManagementField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <label className="enterprise-field"><span id={id}>{label}</span>{isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-labelledby": id }) : children}</label>;
}
