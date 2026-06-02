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
  const selectedModels = new Set(selected);
  return (
    <fieldset className="model-picker">
      <legend>Allowed models</legend>
      {models.length ? (
        <div className="model-picker-options">
          {models.map((model) => (
            <label className="model-option" key={model}>
              <input name="allowed_models" defaultChecked={selectedModels.has(model)} type="checkbox" value={model} />
              <span>{model}</span>
            </label>
          ))}
        </div>
      ) : (
        <span className="muted-cell">No provider models loaded.</span>
      )}
    </fieldset>
  );
}
