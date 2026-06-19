import { useId, useState } from "react";
import { useI18n } from "../lib/i18n";

type QuotaInputProps = {
  label: string;
  name: string;
  initialValue?: number;
};

export function QuotaInput({ label, name, initialValue = 0 }: QuotaInputProps) {
  const { t } = useI18n();
  const inputId = useId();
  const checkId = useId();
  const [unlimited, setUnlimited] = useState(initialValue === 0);
  const [value, setValue] = useState(initialValue > 0 ? String(initialValue) : "");

  return (
    <div className="quota-input">
      <label htmlFor={inputId}>{t(label)}</label>
      <div>
        <input
          id={inputId}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t(label)}
          type="number"
          min="1"
          required={!unlimited}
          disabled={unlimited}
        />
        <label className="mini-check" htmlFor={checkId}>
          <input
            id={checkId}
            name={`${name}_unlimited`}
            checked={unlimited}
            onChange={(event) => setUnlimited(event.target.checked)}
            type="checkbox"
          />
          {t("Unlimited")}
        </label>
      </div>
    </div>
  );
}

export function quotaValue(form: FormData, name: string) {
  if (form.get(`${name}_unlimited`) === "on") {
    return 0;
  }
  return Number(form.get(name) || 0);
}
