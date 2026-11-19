import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { api, APIError } from "../lib/api";
import { creditAmount, decimalToMicro, integer } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { useDebouncedValue } from "../lib/useListFilters";
import type { APIKey, BatchKeyPolicyInput, BatchKeyPolicyResult, BatchRateLimit } from "../lib/types";
import { IconButton } from "./IconButton";
import { ModalDialog } from "./ModalDialog";
import { ModelWhitelistInput, publicModelsFromProviders } from "./ModelWhitelistInput";
import { QueryFeedback } from "./QueryFeedback";
import { RATE_LIMIT_WINDOWS } from "./RateLimitEditor";
import { Select } from "./ThemedControls";

const PAGE_SIZE = 25;
const MAX_TARGETS = 200;
const METRICS = [
  { key: "quota_microcredits", label: "Credits" },
  { key: "request_quota", label: "Requests" },
  { key: "token_quota", label: "Tokens" },
] as const;

type TargetType = "employee" | "authorization";
type Target = Pick<APIKey, "id" | "name" | "source" | "employee_identity" | "key_prefix">;
type ActionProps = { initialSource: TargetType; initialTargets?: Target[] };

function targetLabel(key: Target) {
  const subject = key.employee_identity?.subject;
  return subject && subject !== key.name ? subject + " · " + key.name : key.name;
}

export function BatchKeyPolicyAction({ initialSource, initialTargets = [] }: ActionProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <IconButton label={t("Batch settings")} className="icon-text" onClick={() => setOpen(true)}>
      <SlidersHorizontal size={16} /><span>{t("Batch settings")}</span>
    </IconButton>
    {open ? <BatchKeyPolicyDialog initialSource={initialSource} initialTargets={initialTargets} onClose={() => setOpen(false)} /> : null}
  </>;
}

function BatchKeyPolicyDialog({ initialSource, initialTargets = [], onClose }: ActionProps & { onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [targets, setTargets] = useState(() => new Map(initialTargets.map((key) => [key.id, key])));
  const [source, setSource] = useState(initialSource);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [showTargets, setShowTargets] = useState(initialTargets.length === 0);
  const [operation, setOperation] = useState<"models" | "rate_limits">("models");
  const [modelEnabled, setModelEnabled] = useState(false);
  const [enabledLimits, setEnabledLimits] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<{ input: BatchKeyPolicyInput; result: BatchKeyPolicyResult }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const keys = useQuery({
    queryKey: ["batch-policy-targets", source, debouncedSearch, offset],
    queryFn: () => (source === "employee" ? api.employeeKeys : api.apiKeys)({ search: debouncedSearch, offset, limit: PAGE_SIZE }),
    enabled: showTargets && !preview,
  });
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, enabled: operation === "models" && modelEnabled && !preview });
  const employeeCount = [...targets.values()].filter((key) => key.source === "employee").length;
  const pendingSearch = search !== debouncedSearch || keys.isFetching;

  function toggleTargets(list: Target[], select: boolean) {
    setTargets((current) => {
      const next = new Map(current);
      for (const key of list) {
        if (!select) next.delete(key.id);
        else if (next.size < MAX_TARGETS) next.set(key.id, key);
      }
      return next;
    });
    setError("");
  }

  function changeOperation(value: typeof operation) {
    if (value === operation) return;
    setOperation(value);
    setModelEnabled(false);
    setEnabledLimits(new Set());
    setError("");
  }

  async function run(input: BatchKeyPolicyInput) {
    setBusy(true);
    setError("");
    try {
      const result = await api.batchKeyPolicy(input);
      setPreview({ input, result });
      if (result.applied) {
        for (const key of ["employee-keys", "api-keys", "api-key", "api-key-usage", "batch-policy-targets"]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    } catch (failure) {
      if (failure instanceof APIError && failure.status === 409) {
        setPreview(undefined);
        setError(t("Settings changed since the preview. Preview again to continue."));
      } else {
        setError(failure instanceof Error ? failure.message : t("Unable to load data."));
      }
    } finally {
      setBusy(false);
    }
  }

  function requestPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ids = [...targets.keys()];
    if (!ids.length || ids.length > MAX_TARGETS || busy) return;
    if (operation === "models" && modelEnabled) {
      const models = form.getAll("allowed_models").map(String);
      if (!models.length) {
        setError(t("Select at least one model."));
        return;
      }
      void run({ ids, models: { mode: form.get("model_mode") === "replace" ? "replace" : "append", models } });
    }
    if (operation === "rate_limits" && enabledLimits.size) {
      const rate_limits: BatchRateLimit[] = [];
      try {
        for (const { value: window } of RATE_LIMIT_WINDOWS) {
          const patch: BatchRateLimit = { window };
          for (const metric of METRICS) {
            const field = window + "_" + metric.key;
            if (!enabledLimits.has(field)) continue;
            const text = String(form.get(field) ?? "").trim();
            if (!text) throw new Error();
            if (metric.key === "quota_microcredits") {
              patch[metric.key] = decimalToMicro(text);
            } else {
              const parsed = Number(text);
              if (!/^\d+$/.test(text) || !Number.isSafeInteger(parsed)) throw new Error();
              patch[metric.key] = parsed;
            }
          }
          if (Object.keys(patch).length > 1) rate_limits.push(patch);
        }
      } catch {
        setError(t("Enter a valid amount for every selected limit. Use 0 for unlimited."));
        return;
      }
      void run({ ids, rate_limits });
    }
  }

  const records = keys.data?.items ?? [];
  const missingCount = records.filter((key) => !targets.has(key.id)).length;
  return <ModalDialog title="Batch settings" onClose={onClose} busy={busy}>
    <form className="dialog-form batch-key-policy" onSubmit={requestPreview} hidden={!!preview}>
      <fieldset disabled={busy} className="batch-policy-section">
        <legend>{t("Select records")}</legend>
        <div className="batch-policy-toolbar">
          <span aria-live="polite">{t("Authentication keys")} {employeeCount} · {t("Authorization keys")} {targets.size - employeeCount}</span>
          <button type="button" aria-expanded={showTargets} onClick={() => setShowTargets(!showTargets)}>{t(showTargets ? "Hide records" : "Select records")}</button>
        </div>
        {targets.size >= MAX_TARGETS ? <span className="muted-cell">{t("Up to {count} records per batch", { count: MAX_TARGETS })}</span> : null}
        {showTargets ? <>
          <div className="batch-policy-toolbar">
            <Select aria-label={t("Key type")} value={source} onChange={(event) => { setSource(event.target.value === "employee" ? "employee" : "authorization"); setOffset(0); }}>
              <option value="employee">{t("Authentication keys")}</option>
              <option value="authorization">{t("Authorization keys")}</option>
            </Select>
            <input type="search" aria-label={t("Search keys")} placeholder={t("Search keys")} value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} />
          </div>
          <QueryFeedback query={keys} />
          <div className="batch-policy-targets" aria-label={t("Matching records")}>
            {records.map((key) => <label key={key.id} className="mini-check">
              <input type="checkbox" checked={targets.has(key.id)} disabled={pendingSearch || !targets.has(key.id) && targets.size >= MAX_TARGETS} onChange={(event) => toggleTargets([key], event.target.checked)} />
              <span>{targetLabel(key)}{key.key_prefix ? <small>{key.key_prefix}</small> : null}</span>
            </label>)}
          </div>
          {keys.isSuccess && !records.length ? <span className="muted-cell">{t("No matching options")}</span> : null}
          <div className="batch-policy-toolbar">
            <button type="button" disabled={pendingSearch || !records.length || targets.size + missingCount > MAX_TARGETS} onClick={() => toggleTargets(records, missingCount > 0)}>{t(missingCount ? "Select this page" : "Clear this page")}</button>
            <button type="button" disabled={pendingSearch || offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{t("Previous page")}</button>
            <button type="button" disabled={pendingSearch || !keys.data || offset + PAGE_SIZE >= (keys.data.total ?? records.length)} onClick={() => setOffset(offset + PAGE_SIZE)}>{t("Next page")}</button>
          </div>
          {targets.size > 0 ? <details>
            <summary>{t("Selected {count}", { count: targets.size })}</summary>
            <div className="batch-policy-targets">
              {[...targets.values()].map((key) => <label key={key.id} className="mini-check">
                <input type="checkbox" checked onChange={() => toggleTargets([key], false)} />
                <span>{targetLabel(key)}<small>{key.source === "employee" ? t("Authentication keys") : key.key_prefix || t("Authorization keys")}</small></span>
              </label>)}
            </div>
          </details> : null}
        </> : null}
      </fieldset>
      <fieldset disabled={busy} className="batch-policy-section">
        <legend>{t("Setting to update")}</legend>
        <div className="batch-policy-toolbar">
          <label className="mini-check"><input type="radio" name="batch_operation" checked={operation === "models"} onChange={() => changeOperation("models")} />{t("Update model permissions")}</label>
          <label className="mini-check"><input type="radio" name="batch_operation" checked={operation === "rate_limits"} onChange={() => changeOperation("rate_limits")} />{t("Periodic limits")}</label>
        </div>
        {operation === "models" ? <>
          <label className="mini-check"><input type="checkbox" checked={modelEnabled} onChange={(event) => setModelEnabled(event.target.checked)} />{t("Apply model changes")}</label>
          {modelEnabled ? <>
            <Select aria-label={t("Model operation")} name="model_mode">
              <option value="append">{t("Append to existing models")}</option>
              <option value="replace">{t("Replace the model list")}</option>
            </Select>
            <QueryFeedback query={providers} />
            <ModelWhitelistInput models={publicModelsFromProviders(providers.data)} />
          </> : null}
        </> : <>
          <p className="muted-cell">{t("Enable only the limits to change. Use 0 for unlimited.")}</p>
          {RATE_LIMIT_WINDOWS.map(({ value, label }) => <fieldset key={value} className="batch-policy-window">
            <legend>{t(label)}</legend>
            <div className="batch-policy-metrics">
              {METRICS.map((metric) => {
                const field = value + "_" + metric.key;
                const name = t(label) + " · " + t(metric.label);
                const enabled = enabledLimits.has(field);
                return <div key={field}>
                  <label className="mini-check"><input type="checkbox" checked={enabled} aria-label={t("Change {name}", { name })} onChange={(event) => {
                    const next = new Set(enabledLimits);
                    if (event.target.checked) next.add(field);
                    else next.delete(field);
                    setEnabledLimits(next);
                  }} />{t(metric.label)}</label>
                  <input aria-label={name} name={field} disabled={!enabled} required={enabled} type="text" inputMode={metric.key === "quota_microcredits" ? "decimal" : "numeric"} />
                </div>;
              })}
            </div>
          </fieldset>)}
        </>}
      </fieldset>
      {error && !preview ? <p role="alert" className="error">{error}</p> : null}
      <div className="dialog-actions">
        <button type="submit" className="primary" disabled={busy || !targets.size || targets.size > MAX_TARGETS || (operation === "models" ? !modelEnabled : !enabledLimits.size)}>{t("Preview changes")}</button>
      </div>
    </form>
    {preview ? <div className="dialog-form batch-key-policy">
      <BatchPolicyReview result={preview.result} targets={targets} />
      {error ? <p role="alert" className="error">{error}</p> : null}
      <div className="dialog-actions">
        {preview.result.applied ? <button type="button" className="primary" onClick={onClose}>{t("Done")}</button> : <>
          <button type="button" disabled={busy} onClick={() => { setPreview(undefined); setError(""); }}>{t("Back to editing")}</button>
          <button type="button" className="primary" disabled={busy || !preview.result.updated} onClick={() => void run({ ...preview.input, expected_preview: preview.result.preview })}>{t("Confirm and apply")}</button>
        </>}
      </div>
    </div> : null}
  </ModalDialog>;
}

function BatchPolicyReview({ result, targets }: { result: BatchKeyPolicyResult; targets: Map<string, Target> }) {
  const { t } = useI18n();
  const summary = useRef<HTMLHeadingElement>(null);
  useEffect(() => { summary.current?.focus(); }, [result]);
  return <>
    <h3 ref={summary} tabIndex={-1}>{t(result.applied ? "Updated {count} records" : "{count} records will change", { count: result.updated })} · {t("{count} already match", { count: result.items.length - result.updated })}</h3>
    {result.potentially_limited?.length ? <p role="status" className="batch-policy-warning">{t("{count} records are already at or above a new limit.", { count: result.potentially_limited.length })}</p> : null}
    {result.window_usage_unavailable ? <p className="batch-policy-warning">{t("Current window usage is unavailable for some records.")}</p> : null}
    {result.items.map((item) => <section key={item.id} className="batch-policy-diff">
      <strong>{item.name}</strong> <small>{item.source === "employee" ? targets.get(item.id)?.employee_identity?.subject || t("Authentication keys") : targets.get(item.id)?.key_prefix || t("Authorization keys")}</small>
      {result.potentially_limited?.includes(item.id) ? <small className="batch-policy-warning">{t("New limit reached")}</small> : null}
      {item.models ? <p>{item.models.before?.join(", ") || t("No models allowed")} → {item.models.after.join(", ")}</p> : null}
      {item.rate_limits?.flatMap(({ before, after }) => METRICS.flatMap(({ key, label }) => {
        if (before[key] === after[key]) return [];
        const window = RATE_LIMIT_WINDOWS.find(({ value }) => value === after.window);
        const format = (value: number) => value ? (key === "quota_microcredits" ? creditAmount(value) : integer(value)) : t("Unlimited");
        return <p key={after.window + key}>{t(window?.label ?? after.window)} · {t(label)} · {format(before[key])} → {format(after[key])}</p>;
      }))}
      {!item.models && !item.rate_limits?.length ? <p className="muted-cell">{t("Already matches")}</p> : null}
    </section>)}
  </>;
}
