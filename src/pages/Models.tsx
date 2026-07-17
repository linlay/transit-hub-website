import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, X } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { AdminModel } from "../lib/types";

export function Models() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const models = useQuery({ queryKey: ["models"], queryFn: api.models, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const query = params.get("q") ?? "";
  const protocol = params.get("protocol") ?? "";
  const type = params.get("type") ?? "";
  const provider = params.get("provider") ?? "";
  const allModels = models.data?.items ?? [];

  usePageActions(<RefreshButton isRefreshing={models.isFetching} onClick={() => models.refetch()} />, [models.isFetching, models.refetch]);

  const providers = useMemo(
    () => Array.from(new Set(allModels.map((model) => model.provider))).sort((a, b) => a.localeCompare(b)),
    [allModels],
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return allModels.filter((model) => {
      const matchesQuery = !normalizedQuery || [model.public_model, model.display_name, model.upstream_model, model.provider]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      return matchesQuery
        && (!protocol || model.protocol === protocol)
        && (!type || model.type === type)
        && (!provider || model.provider === provider);
    });
  }, [allModels, provider, protocol, query, type]);

  const hasFilters = Boolean(query || protocol || type || provider);

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setParams({}, { replace: true });
  }

  function openModel(model: AdminModel) {
    navigate(`/models/${encodeURIComponent(model.protocol)}/${encodeURIComponent(model.public_model)}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  }

  return (
    <section className="page">
      <section className="panel models-catalog-panel">
        <div className="toolbar models-toolbar">
          <div className="models-filters">
            <label className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setFilter("q", event.target.value)} placeholder={t("Search models")} />
            </label>
            <select aria-label={t("Filter by protocol")} value={protocol} onChange={(event) => setFilter("protocol", event.target.value)}>
              <option value="">{t("All protocols")}</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
            <select aria-label={t("Filter by model type")} value={type} onChange={(event) => setFilter("type", event.target.value)}>
              <option value="">{t("All model types")}</option>
              <option value="chat">{t("Chat")}</option>
              <option value="embedding">{t("Embedding")}</option>
              <option value="image-generation">{t("Image generation")}</option>
            </select>
            <select aria-label={t("Filter by provider")} value={provider} onChange={(event) => setFilter("provider", event.target.value)}>
              <option value="">{t("All providers")}</option>
              {providers.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            {hasFilters ? (
              <button className="icon-text" onClick={clearFilters} type="button">
                <X size={15} />
                {t("Clear filters")}
              </button>
            ) : null}
          </div>
          <span className="results-count">{t("{count} of {total} models", { count: filtered.length, total: allModels.length })}</span>
        </div>

        {models.isLoading ? <div className="catalog-state">{t("Loading models...")}</div> : null}
        {models.isError ? <div className="error-text">{t("Models failed to load.")}</div> : null}
        {!models.isLoading && !models.isError && allModels.length === 0 ? <EmptyState title="No models loaded." /> : null}
        {!models.isLoading && !models.isError && allModels.length > 0 && filtered.length === 0 ? <EmptyState title="No models match the current filters." /> : null}
        {filtered.length > 0 ? (
          <div className="table-wrap models-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Model")}</th>
                  <th>{t("Protocol")}</th>
                  <th>{t("Type")}</th>
                  <th>{t("Provider")}</th>
                  <th>{t("Upstream model")}</th>
                  <th>{t("Effective pool")}</th>
                  <th>{t("Endpoint")}</th>
                  <th aria-label={t("View details")} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((model) => (
                  <tr
                    aria-label={t("View {model}", { model: model.display_name })}
                    className="model-row"
                    key={`${model.protocol}:${model.public_model}`}
                    onClick={() => openModel(model)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openModel(model);
                      }
                    }}
                    role="link"
                    tabIndex={0}
                  >
                    <td className="model-name-cell">
                      <strong className="table-link">{model.display_name}</strong>
                      <small className="mono">{model.public_model}</small>
                    </td>
                    <td><span className="pill muted">{model.protocol}</span></td>
                    <td><span className="pill muted">{t(modelTypeLabel(model.type))}</span></td>
                    <td>{model.provider}</td>
                    <td className="mono">{model.upstream_model}</td>
                    <td>
                      {model.override_pool && !model.override_valid
                        ? <span className="pill danger-pill" title={t("Override pool {pool} is unavailable", { pool: model.override_pool })}>{t("Invalid override")}</span>
                        : model.effective_pool || t("Unavailable")}
                    </td>
                    <td className="mono">{model.gateway_path || t("Unsupported")}</td>
                    <td><ArrowRight aria-hidden size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function modelTypeLabel(type: string): string {
  if (type === "chat") return "Chat";
  if (type === "embedding") return "Embedding";
  if (type === "image-generation") return "Image generation";
  return type || "Unknown";
}
