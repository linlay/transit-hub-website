import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Pause } from "lucide-react";
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
  const enabled = model.enabled !== false;
  return <div className="model-status-control" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <button type="button" className={`icon-text model-status-action ${enabled ? "stop" : "start"}`} aria-label={`${t(enabled ? "Disable model" : "Enable model")}: ${model.public_model}`} aria-busy={update.isPending} disabled={update.isPending} onClick={() => update.mutate()}>
      {update.isPending ? <Loader2 size={15} className="spin" aria-hidden /> : enabled ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
      {t(update.isPending ? "Processing..." : enabled ? "Disable model" : "Enable model")}
    </button>
    {update.isError && <small role="alert" className="error-text">{update.error.message}</small>}
  </div>;
}
