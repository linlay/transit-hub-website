import { useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/i18n";
import { ModalDialog } from "./ModalDialog";

export function CredentialModels({ models }: { models: string[] }) {
  const { t } = useI18n();
  const [viewing, setViewing] = useState(false);
  if (!models.length) return <span className="muted-cell">{t("No models allowed")}</span>;
  return (
    <div className="credential-model-cell">
      <span className="cell-ellipsis" title={models.join(", ")}>{models.join(", ")}</span>
      <button className="cell-model-link" type="button" onClick={() => setViewing(true)}>{t("View {count} models", { count: models.length })}</button>
      {viewing ? createPortal(
        <ModalDialog title="Allowed models" onClose={() => setViewing(false)}>
          <ul className="credential-model-list">{models.map((model) => <li key={model}>{model}</li>)}</ul>
        </ModalDialog>, document.body,
      ) : null}
    </div>
  );
}
