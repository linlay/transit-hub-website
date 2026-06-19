import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import type { ProviderSnapshot } from "../lib/types";

type ModelWhitelistInputProps = {
  models: string[];
  selected?: string[];
};

export function publicModelsFromProviders(snapshot?: ProviderSnapshot) {
  const seen = new Set<string>();
  for (const provider of snapshot?.providers ?? []) {
    for (const model of provider.models) {
      const publicModel = model.public.trim();
      if (publicModel) {
        seen.add(publicModel);
      }
    }
  }
  return Array.from(seen).sort();
}

export function ModelWhitelistInput({ models, selected = [] }: ModelWhitelistInputProps) {
  const { t } = useI18n();
  const [selectedModels, setSelectedModels] = useState(() => new Set(selected));
  const allSelected = models.length > 0 && models.every((model) => selectedModels.has(model));
  const modelKey = models.join("\0");
  const selectedKey = selected.join("\0");

  useEffect(() => {
    setSelectedModels(new Set(selected));
  }, [modelKey, selectedKey]);

  function toggleModel(model: string, checked: boolean) {
    setSelectedModels((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(model);
      } else {
        next.delete(model);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedModels(allSelected ? new Set() : new Set(models));
  }

  return (
    <fieldset className="model-picker">
      <legend>
        <span>{t("Allowed models")}</span>
        {models.length ? (
          <button className="model-picker-toggle" onClick={toggleAll} type="button">
            {allSelected ? t("Clear all") : t("Select all")}
          </button>
        ) : null}
      </legend>
      {models.length ? (
        <div className="model-picker-options">
          {models.map((model) => (
            <label className="model-option" key={model}>
              <input
                checked={selectedModels.has(model)}
                name="allowed_models"
                onChange={(event) => toggleModel(model, event.target.checked)}
                type="checkbox"
                value={model}
              />
              <span>{model}</span>
            </label>
          ))}
        </div>
      ) : (
        <span className="muted-cell">{t("No provider models loaded.")}</span>
      )}
    </fieldset>
  );
}
