import { CheckCircle2, X, XCircle } from "lucide-react";
import { integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { ProviderConnectivityTestResult } from "../lib/types";

type ConnectivityResultToastProps = {
  label?: string;
  result?: ProviderConnectivityTestResult;
  onClose: () => void;
};

export function ConnectivityResultToast({ label, result, onClose }: ConnectivityResultToastProps) {
  const { t } = useI18n();
  if (!result) return null;

  const title = result.ok ? t("Connected") : t("Connection failed");
  const status = result.status_code > 0 ? `${result.status_code} · ${integer(result.latency_ms)} ms` : t("Failed");

  return (
    <div className={`connectivity-toast ${result.ok ? "good" : "bad"}`} role="status">
      <div className="connectivity-toast-header">
        <div className="connectivity-toast-title">
          {result.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <div>
            <strong>{title}</strong>
            <span>{label ?? t("Connectivity test")}</span>
          </div>
        </div>
        <button aria-label={t("Close result")} className="icon-button" onClick={onClose} type="button">
          <X size={14} />
        </button>
      </div>
      <div className="connectivity-toast-status">{status}</div>
      <dl className="connectivity-toast-details">
        <div>
          <dt>{t("Provider")}</dt>
          <dd>{result.provider || t("none")}</dd>
        </div>
        <div>
          <dt>{t("Model")}</dt>
          <dd>{result.public_model || t("none")}</dd>
        </div>
        <div>
          <dt>{t("Pool")}</dt>
          <dd>{result.pool || t("none")}</dd>
        </div>
        <div>
          <dt>{t("Account")}</dt>
          <dd>{result.account || t("none")}</dd>
        </div>
      </dl>
      {result.endpoint ? (
        <div className="connectivity-toast-endpoint" title={result.endpoint}>
          {result.endpoint}
        </div>
      ) : null}
      {result.error ? <div className="connectivity-toast-error">{result.error}</div> : null}
    </div>
  );
}
