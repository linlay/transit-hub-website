import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";

type CopyStatus = "copied" | "failed" | null;

export function CopyableCodeBlock({ title, code }: { title: string; code: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<CopyStatus>(null);
  const resetTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copy() {
    const copied = await copyText(code);
    setStatus(copied ? "copied" : "failed");
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus(null), 2200);
  }

  return (
    <div className="code-panel">
      <div className="code-panel-heading">
        <strong>{title}</strong>
        <div className="code-copy-actions">
          <span aria-live="polite" className={status === "failed" ? "code-copy-status failed" : "code-copy-status"}>
            {status === "copied" ? t("Copied.") : status === "failed" ? t("Copy failed.") : ""}
          </span>
          <button aria-label={t("Copy {title}", { title })} className="icon-text compact" onClick={copy} type="button">
            {status === "copied" ? <Check size={15} /> : <Copy size={15} />}
            {t("Copy")}
          </button>
        </div>
      </div>
      <pre tabIndex={0}><code>{code}</code></pre>
    </div>
  );
}
