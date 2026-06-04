import { CheckCircle2, X, XCircle } from "lucide-react";
import { integer } from "../lib/format";
import type { ProviderConnectivityTestResult } from "../lib/types";

type ConnectivityResultToastProps = {
  label?: string;
  result?: ProviderConnectivityTestResult;
  onClose: () => void;
};

export function ConnectivityResultToast({ label, result, onClose }: ConnectivityResultToastProps) {
  if (!result) return null;

  const title = result.ok ? "Connected" : "Connection failed";
  const status = result.status_code > 0 ? `${result.status_code} · ${integer(result.latency_ms)} ms` : "Failed";

  return (
    <div className={`connectivity-toast ${result.ok ? "good" : "bad"}`} role="status">
      <div className="connectivity-toast-header">
        <div className="connectivity-toast-title">
          {result.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <div>
            <strong>{title}</strong>
            <span>{label ?? "Connectivity test"}</span>
          </div>
        </div>
        <button aria-label="Close result" className="icon-button" onClick={onClose} type="button">
          <X size={14} />
        </button>
      </div>
      <div className="connectivity-toast-status">{status}</div>
      <dl className="connectivity-toast-details">
        <div>
          <dt>Provider</dt>
          <dd>{result.provider || "none"}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{result.public_model || "none"}</dd>
        </div>
        <div>
          <dt>Pool</dt>
          <dd>{result.pool || "none"}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{result.account || "none"}</dd>
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
