import { IconButton } from "./IconButton";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";

type ModalDialogProps = { title: string; children: ReactNode; onClose: () => void; busy?: boolean };
let openDialogs = 0;
let previousOverflow = "";

export function ModalDialog({ title, children, onClose, busy = false }: ModalDialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogs++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    dialog.showModal();
    return () => {
      dialog.close();
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy} className="dialog" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(node => node.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="dialog-header">
        <h2 id={titleId}>{t(title)}</h2>
        <IconButton label={t("Close dialog")} disabled={busy} onClick={onClose}><X size={16} /></IconButton>
      </div>
      {children}
    </dialog>, document.body,
  );
}
