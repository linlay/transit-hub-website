import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";
import { ModalDialog } from "./ModalDialog";
import { IconButton } from "./IconButton";
import { useI18n } from "../lib/i18n";

type Confirmation = { message: string; action: () => Promise<unknown>; label?: string };
const Context = createContext<((request: Confirmation) => void) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [request, setRequest] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(0);
  useEffect(() => { if (!success) return; const timer = setTimeout(() => setSuccess(0), 3000); return () => clearTimeout(timer); }, [success]);
  const confirm = useCallback((next: Confirmation) => { if (!busy.current) { setError(""); setSuccess(0); setRequest(next); } }, []);
  async function execute() {
    if (!request || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try { await request.action(); setRequest(null); setSuccess(Date.now()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { busy.current = false; setPending(false); }
  }
  return <Context.Provider value={confirm}>
    {children}
    {success ? <div key={success} className="feedback-toast" role="status">{t("Operation completed.")}<IconButton label={t("Close")} onClick={() => setSuccess(0)}><X size={14} /></IconButton></div> : null}
    {request ? <ModalDialog title="Confirm action" busy={pending} onClose={() => setRequest(null)}>
      <p className="dialog-copy">{request.message}</p>
      {error ? <div className="error-text" role="alert">{error}</div> : null}
      <div className="dialog-actions">
        <IconButton label={t("Cancel")} autoFocus disabled={pending} onClick={() => setRequest(null)}><X size={16} /></IconButton>
        <IconButton label={pending ? t("Processing...") : request.label ?? t("Confirm")} className="icon-button danger" disabled={pending} onClick={execute}>{pending ? <Loader2 className="spin" size={16} /> : <Check size={16} />}</IconButton>
      </div>
    </ModalDialog> : null}
  </Context.Provider>;
}

export function useConfirm() {
  const confirm = useContext(Context);
  if (!confirm) throw new Error("ConfirmProvider is required");
  return confirm;
}
