import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parse, stringify } from "yaml";
import { enterpriseRequest as request, type ProviderDocument } from "../lib/enterprise";
import { useI18n } from "../lib/i18n";
import { enterpriseValueLabel } from "../lib/enterprise-labels";
import { ManagementDialog, ManagementField as Field } from "./ManagementDialog";
import { QueryFeedback } from "./QueryFeedback";

type Channel = { protocol: string; default_pool?: string; pools?: { name: string }[]; models?: { public: string; protocol?: string; [key: string]: unknown }[]; [key: string]: unknown };

export function ModelCreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const client = useQueryClient();
  const docs = useQuery({ queryKey: ["provider-documents"], queryFn: () => request<{ items: ProviderDocument[]; read_only?: boolean }>("/admin/provider-configs") });
  const [channel, setChannel] = useState("");
  const [publicModel, setPublicModel] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [upstream, setUpstream] = useState("");
  const [protocol, setProtocol] = useState("openai");
  const [type, setType] = useState("chat");
  const [pool, setPool] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState("");
  const document = docs.data?.items.find(item => item.name === channel);
  let config: Channel | undefined;
  let error = "";
  try { if (document) config = parse(document.yaml) as Channel; } catch { error = t("Channel configuration must be an object"); }
  const duplicate = config?.models?.some(model => model.public === publicModel.trim() && (model.protocol || config?.protocol) === protocol);
  if (duplicate) error = t("This model already exists in the selected channel.");
  const body = document && config ? {
    yaml: stringify({ ...config, models: [...(config.models ?? []), { public: publicModel.trim(), display_name: displayName.trim() || publicModel.trim(), upstream: upstream.trim(), protocol, type, pool: pool || config.default_pool || config.pools?.[0]?.name || "", priority: 0, weight: 1 }] }),
    revision: document.revision, reason: reason.trim(),
  } : null;
  const signature = JSON.stringify(body);
  const ready = Boolean(body && publicModel.trim() && upstream.trim() && reason.trim().length >= 4 && reason.trim().length <= 500 && !error && !docs.data?.read_only);
  const save = useMutation({
    mutationFn: async (dryRun: boolean) => {
      if (!ready || !body || (!dryRun && preview !== signature)) throw new Error(t("Preview changes before applying."));
      await request(`/admin/provider-configs/${encodeURIComponent(channel)}`, "PUT", { ...body, dry_run: dryRun });
      return { dryRun, signature };
    },
    onSuccess: ({ dryRun, signature }) => {
      if (dryRun) setPreview(signature);
      else { void client.invalidateQueries(); onClose(); }
    },
  });
  function chooseChannel(name: string) {
    setChannel(name); setPreview("");
    const item = docs.data?.items.find(item => item.name === name);
    if (!item) return;
    try {
      const cfg = parse(item.yaml) as Channel;
      setProtocol(cfg.protocol); setType(cfg.protocol.endsWith("_tts") ? "tts" : "chat");
      setPool(cfg.default_pool || cfg.pools?.[0]?.name || "");
    } catch { /* The invalid document is reported above. */ }
  }
  return <ManagementDialog title={t("Add model")} onClose={onClose} busy={save.isPending} showCloseAction={false}>
    <QueryFeedback query={docs} />
    {docs.data?.read_only && <p role="status">{t("YAML mode is read-only. Edit the configuration files and reload.")}</p>}
    {docs.data && !docs.data.items.length && <p role="status">{t("Create a channel before adding a model.")}</p>}
    <fieldset className="management-fields" disabled={save.isPending || docs.data?.read_only}>
      <div className="enterprise-grid">
        <Field label={t("Select channel")}><select value={channel} onChange={e => chooseChannel(e.target.value)}><option value="">{t("Select channel")}</option>{docs.data?.items.map(item => <option key={item.name}>{item.name}</option>)}</select></Field>
        <Field label={t("Protocol")}><select value={protocol} onChange={e => { setProtocol(e.target.value); setType(e.target.value.endsWith("_tts") ? "tts" : "chat"); }}>{["openai", "anthropic", "dashscope_tts", "minimax_tts"].map(value => <option key={value}>{value}</option>)}</select></Field>
        <Field label={t("Public model")}><input value={publicModel} onChange={e => setPublicModel(e.target.value)} /></Field>
        <Field label={t("Display name")}><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></Field>
        <Field label={t("Upstream model")}><input value={upstream} onChange={e => setUpstream(e.target.value)} /></Field>
        <Field label={t("Model type")}><select value={type} onChange={e => setType(e.target.value)}>{(protocol.endsWith("_tts") ? ["tts"] : protocol === "anthropic" ? ["chat"] : ["chat", "embedding", "image-generation"]).map(value => <option key={value} value={value}>{t(enterpriseValueLabel(value))}</option>)}</select></Field>
        <Field label={t("Account pools")}><select value={pool} onChange={e => setPool(e.target.value)}><option value="">{t("Default account pool")}</option>{config?.pools?.map(item => <option key={item.name}>{item.name}</option>)}</select></Field>
        <Field label={t("Change reason")}><input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></Field>
      </div>
    </fieldset>
    {(error || save.error) && <p role="alert" className="error-text">{error || save.error?.message}</p>}
    {preview === signature && <div role="status" className="enterprise-result"><p>{t("Preview ready. Review the changes, then apply.")}</p><dl className="finance-details"><div><dt>{t("Public model")}</dt><dd>{publicModel}</dd></div><div><dt>{t("Channel")}</dt><dd>{channel}</dd></div><div><dt>{t("Upstream model")}</dt><dd>{upstream}</dd></div><div><dt>{t("Protocol")}</dt><dd>{protocol}</dd></div></dl></div>}
    <div className="dialog-actions"><button disabled={save.isPending} onClick={onClose}>{t("Cancel")}</button><div className="table-actions"><button disabled={!ready || save.isPending} onClick={() => save.mutate(true)}>{t("Preview changes")}</button><button className="primary" disabled={!ready || save.isPending || preview !== signature} onClick={() => save.mutate(false)}>{t("Add model")}</button></div></div>
  </ManagementDialog>;
}
