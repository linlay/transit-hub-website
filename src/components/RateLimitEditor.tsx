import { useMemo, useState } from "react";
import { creditsInputValue, decimalToMicro } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { RateLimit, RateLimitWindow } from "../lib/types";

const WINDOWS: Array<{ value: RateLimitWindow; label: string }> = [
  { value: "1h", label: "1 hour" },
  { value: "5h", label: "5 hours" },
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

type RateLimitEditorProps = {
  name: string;
  initialValue?: RateLimit[];
};

export function RateLimitEditor({ name, initialValue = [] }: RateLimitEditorProps) {
  const { t } = useI18n();
  const initialByWindow = useMemo(() => new Map(initialValue.map((limit) => [limit.window, limit])), [initialValue]);
  const [enabled, setEnabled] = useState<Set<RateLimitWindow>>(() => new Set(initialValue.map((limit) => limit.window)));

  function toggle(window: RateLimitWindow, checked: boolean) {
    setEnabled((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(window);
      } else {
        next.delete(window);
      }
      return next;
    });
  }

  return (
    <div className="rate-limit-editor">
      <div className="rate-limit-header">
        <span>{t("Window")}</span>
        <span>{t("Credits")}</span>
        <span>{t("Requests")}</span>
        <span>{t("Tokens")}</span>
      </div>
      {WINDOWS.map((window) => {
        const limit = initialByWindow.get(window.value);
        const checked = enabled.has(window.value);
        return (
          <div className="rate-limit-row" key={window.value}>
            <label className="mini-check">
              <input checked={checked} name={`${name}_${window.value}_enabled`} onChange={(event) => toggle(window.value, event.target.checked)} type="checkbox" />
              {t(window.label)}
            </label>
            <input defaultValue={creditsValue(limit?.quota_microcredits)} disabled={!checked} min="0" name={`${name}_${window.value}_cost_quota`} aria-label={`${t(window.label)} · ${t("Credits")}`} placeholder="∞" step="0.000001" type="number" />
            <input defaultValue={positiveValue(limit?.request_quota)} disabled={!checked} min="0" name={`${name}_${window.value}_request_quota`} aria-label={`${t(window.label)} · ${t("Requests")}`} placeholder="∞" type="number" />
            <input defaultValue={positiveValue(limit?.token_quota)} disabled={!checked} min="0" name={`${name}_${window.value}_token_quota`} aria-label={`${t(window.label)} · ${t("Tokens")}`} placeholder="∞" type="number" />
          </div>
        );
      })}
    </div>
  );
}

export function rateLimitValue(form: FormData, name: string): RateLimit[] {
  return WINDOWS.flatMap((window) => {
    if (form.get(`${name}_${window.value}_enabled`) !== "on") {
      return [];
    }
    const limit = {
      window: window.value,
      request_quota: numberValue(form.get(`${name}_${window.value}_request_quota`)),
      token_quota: numberValue(form.get(`${name}_${window.value}_token_quota`)),
      quota_microcredits: decimalToMicro(form.get(`${name}_${window.value}_cost_quota`), 1_000_000),
    };
    if (!limit.request_quota && !limit.token_quota && !limit.quota_microcredits) {
      return [];
    }
    return [limit];
  });
}

function positiveValue(value?: number) {
  return value && value > 0 ? String(value) : "";
}

function creditsValue(value?: number) {
  if (!value || value <= 0) return "";
  return creditsInputValue(value);
}

function numberValue(value: FormDataEntryValue | null) {
  return Math.max(0, Math.floor(Number(value || 0)));
}
