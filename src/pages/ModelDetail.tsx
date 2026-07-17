import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CopyableCodeBlock } from "../components/CopyableCodeBlock";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import {
  modelCurlExample,
  modelGatewayURL,
  modelReloadCurl,
  modelYAMLExample,
  providerAPIKeyEnv,
  providerConfigFilename,
} from "../lib/modelDocs";

export function ModelDetail() {
  const { locale, t } = useI18n();
  const location = useLocation();
  const { protocol = "", modelId = "" } = useParams();
  const model = useQuery({
    queryKey: ["model", protocol, modelId],
    queryFn: () => api.model(protocol, modelId),
    enabled: Boolean(protocol && modelId),
  });
  usePageActions(<RefreshButton isRefreshing={model.isFetching} onClick={() => model.refetch()} />, [model.isFetching, model.refetch]);

  const from = (location.state as { from?: string } | null)?.from ?? "/models";
  if (model.isLoading) {
    return <section className="page"><section className="panel catalog-state">{t("Loading model details...")}</section></section>;
  }
  if (model.isError || !model.data) {
    return (
      <section className="page">
        <Link className="back-link" to={from}><ArrowLeft size={16} />{t("Back to models")}</Link>
        <section className="panel"><div className="error-text">{t("Model details failed to load.")}</div></section>
      </section>
    );
  }

  const data = model.data;
  const curl = modelCurlExample(data);
  const yaml = modelYAMLExample(data);
  const gatewayURL = modelGatewayURL(data);
  const auth = data.protocol === "anthropic" ? "x-api-key: $CLIENT_API_KEY" : "Authorization: Bearer $CLIENT_API_KEY";

  return (
    <section className="page model-detail-page">
      <Link className="back-link" to={from}><ArrowLeft size={16} />{t("Back to models")}</Link>

      <section className="panel model-detail-hero">
        <div className="model-detail-heading">
          <div>
            <span className="eyebrow">{t("Model details")}</span>
            <h1>{data.display_name}</h1>
            <code>{data.public_model}</code>
          </div>
          <div className="model-badges">
            <span className="pill muted">{data.protocol}</span>
            <span className="pill muted">{t(modelTypeLabel(data.type))}</span>
            <span className="pill good">{data.provider}</span>
          </div>
        </div>
        {data.override_pool && !data.override_valid ? (
          <div className="error-text">{t("The route override references unavailable pool {pool}. Requests will fail until the override is fixed or cleared.", { pool: data.override_pool })}</div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>{t("Model and route")}</h2><span>{t("Runtime mapping currently loaded by Transit Hub")}</span></div>
        </div>
        <dl className="model-detail-grid">
          <DetailField label={t("Public model")} mono>{data.public_model}</DetailField>
          <DetailField label={t("Upstream model")} mono>{data.upstream_model}</DetailField>
          <DetailField label={t("Owner")}>{data.owned_by}</DetailField>
          <DetailField label={t("Created")}>{new Date(data.created_at).toLocaleString(locale)}</DetailField>
          <DetailField label={t("Provider")}>{data.provider}</DetailField>
          <DetailField label={t("Provider Base URL")} mono>{data.provider_base_url}</DetailField>
          <DetailField label={t("Configured pool")}>{data.configured_pool}</DetailField>
          <DetailField label={t("Override pool")}>{data.override_pool || t("none")}</DetailField>
          <DetailField label={t("Effective pool")}>{data.effective_pool || t("Unavailable")}</DetailField>
          <DetailField label={t("Gateway endpoint")} mono>{data.gateway_path || t("Unsupported")}</DetailField>
          <DetailField label={t("Upstream path")} mono>{data.upstream_path || t("Unsupported")}</DetailField>
          <DetailField label={t("Upstream endpoint")} mono>{data.upstream_url || t("Unsupported")}</DetailField>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>{t("Connect a client")}</h2><span>{t("Call Transit Hub with a client API key allowed to use this model")}</span></div>
        </div>
        {curl ? (
          <>
            <dl className="connection-summary">
              <DetailField label={t("Request URL")} mono>{gatewayURL}</DetailField>
              <DetailField label={t("Authentication")} mono>{auth}</DetailField>
            </dl>
            <CopyableCodeBlock code={curl} title={t("curl example")} />
          </>
        ) : (
          <div className="error-text">{t("This protocol and model type do not map to a supported public endpoint, so no curl example is available.")}</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>{t("Provider YAML")}</h2><span>{t("Minimal, secret-free configuration for this model")}</span></div>
        </div>
        <div className="configuration-note">
          <p>{t("Save as {path} and inject the upstream key through {env}.", { path: providerConfigFilename(data), env: providerAPIKeyEnv(data) })}</p>
          <p>{t("The YAML uses the configured pool. A temporary runtime pool override remains in the database and is not written into this file.")}</p>
        </div>
        <CopyableCodeBlock code={yaml} title={t("Provider YAML")} />
        <div className="reload-block">
          <p>{t("After saving the YAML and setting the environment variable, reload provider configuration:")}</p>
          <CopyableCodeBlock code={modelReloadCurl()} title={t("Reload command")} />
        </div>
      </section>
    </section>
  );
}

function DetailField({ label, mono = false, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="model-detail-field">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{children}</dd>
    </div>
  );
}

function modelTypeLabel(type: string): string {
  if (type === "chat") return "Chat";
  if (type === "embedding") return "Embedding";
  if (type === "image-generation") return "Image generation";
  return type || "Unknown";
}
