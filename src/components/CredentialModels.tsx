import { useState } from "react";
import { useI18n } from "../lib/i18n";

export function CredentialModels({ models }: { models: string[] }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? models : models.slice(0, 4);
  return (
    <div className="credential-models">
      <span className="muted-cell">{t("Models")}</span>
      {visible.map((model) => <span className="credential-model" key={model}>{model}</span>)}
      {!models.length ? <span className="muted-cell">{t("No models allowed")}</span> : null}
      {models.length > 4 ? <button className="model-picker-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? t("Show less") : t("Show all ({count})", { count: models.length })}</button> : null}
    </div>
  );
}
