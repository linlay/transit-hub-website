import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { creditsInputValue } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { EmployeePolicy } from "../lib/types";
import { ModelWhitelistInput, publicModelsFromProviders } from "./ModelWhitelistInput";
import { QuotaInput, quotaValue, creditsQuotaValue } from "./QuotaInput";
import { RateLimitEditor, rateLimitValue } from "./RateLimitEditor";
import { QueryFeedback } from "./QueryFeedback";

export function EmployeeDefaultPolicyForm({ initialPolicy, onSaved, onCancel }: {
  initialPolicy: EmployeePolicy;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers });
  const update = useMutation({ mutationFn: api.updateEmployeeDefaults, onSuccess: onSaved });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const allowedModels = form.getAll("allowed_models").map(String);
    if (!allowedModels.length) { setError(t("Select at least one model.")); return; }
    try {
      setError("");
      update.mutate({
        allowed_models: allowedModels,
        request_quota: quotaValue(form, "request_quota"),
        token_quota: quotaValue(form, "token_quota"),
        quota_microcredits: creditsQuotaValue(form, "credits_quota"),
        rate_limits: rateLimitValue(form, "rate_limits"),
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  return <form className="settings-form" onSubmit={submit}>
    <div className="settings-group">
      <h3>{t("Authentication key defaults")}</h3>
      <p className="muted-cell">{t("Defaults apply only when an identity has no record. Existing permissions, limits and usage stay unchanged.")}</p>
      <div className="settings-grid three">
        <QuotaInput label="Total Credits" name="credits_quota" step="0.000001" initialValue={creditsInputValue(initialPolicy.quota_microcredits ?? 0)} />
        <QuotaInput label="Request quota" name="request_quota" initialValue={initialPolicy.request_quota} />
        <QuotaInput label="Token quota" name="token_quota" initialValue={initialPolicy.token_quota} />
      </div>
      <div className="employee-default-rate-limits"><RateLimitEditor name="rate_limits" initialValue={initialPolicy.rate_limits ?? []} /></div>
    </div>
    <div className="settings-group">
      <QueryFeedback query={providers} />
      {providers.data ? <ModelWhitelistInput models={publicModelsFromProviders(providers.data)} selected={initialPolicy.allowed_models ?? []} /> : null}
    </div>
    {error || update.error ? <span className="error-text" role="alert">{error || update.error?.message}</span> : null}
    <div className="panel-actions">
      <button className="icon-text" type="button" disabled={update.isPending} onClick={onCancel}>{t("Cancel")}</button>
      <button className="primary" type="submit" disabled={update.isPending || !providers.data || providers.isError}>{t(update.isPending ? "Saving..." : "Save")}</button>
    </div>
  </form>;
}
