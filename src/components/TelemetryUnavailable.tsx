import { TriangleAlert } from "lucide-react";
import { useI18n } from "../lib/i18n";

export function TelemetryUnavailable() {
  const { t } = useI18n();

  return (
    <div className="telemetry-unavailable" role="status">
      <TriangleAlert aria-hidden="true" size={18} />
      <div>
        <strong>{t("Statistics service temporarily unavailable")}</strong>
        <span>{t("Sign-in, API keys, configuration, and request forwarding are still available.")}</span>
      </div>
    </div>
  );
}
