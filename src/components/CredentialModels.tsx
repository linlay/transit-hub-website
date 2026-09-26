import { IconButton } from "./IconButton";
import { List } from "lucide-react";
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
      <IconButton label={t("View {count} models", { count: models.length })} className="cell-model-link" type="button" onClick={() => setViewing(true)}><List size={16} /></IconButton>
      {viewing ? createPortal(
        <ModalDialog title="Allowed models" onClose={() => setViewing(false)}>
          <ul className="credential-model-list">{models.map((model) => <li key={model}>{model}</li>)}</ul>
        </ModalDialog>, document.body,
      ) : null}
    </div>
  );
}
