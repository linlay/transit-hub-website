import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { AdminModel } from "../lib/types";

export function ModelStatusControl({ model }: { model: AdminModel }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: () => api.setModelEnabled(model.protocol, model.public_model, model.enabled === false),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["models"] });
      client.invalidateQueries({ queryKey: ["model", model.protocol, model.public_model] });
      client.invalidateQueries({ queryKey: ["providers"] });
    },
  });
  return <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <button type="button" role="switch" aria-label={`${t("Model status")}: ${model.public_model}`} aria-checked={model.enabled !== false} disabled={update.isPending} onClick={() => update.mutate()}>
      {t(model.enabled === false ? "Disabled" : "Enabled")}
    </button>
    {update.isError && <small role="alert" className="error-text">{update.error.message}</small>}
  </div>;
}
