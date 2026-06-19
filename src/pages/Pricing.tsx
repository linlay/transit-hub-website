import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";

const CURRENCY = import.meta.env.VITE_CURRENCY ?? "CNY";

export function Pricing() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const prices = useQuery({ queryKey: ["prices"], queryFn: api.prices, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const create = useMutation({
    mutationFn: api.createPrice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prices"] }),
  });
  const remove = useMutation({
    mutationFn: api.deletePrice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prices"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      protocol: String(form.get("protocol") ?? "openai"),
      public_model: String(form.get("public_model") ?? ""),
      input_cost_micro_per_1m_tokens: Math.round(Number(form.get("input_cost") || 0) * 1_000_000),
      input_cache_hit_cost_micro_per_1m_tokens:
        String(form.get("input_cache_hit_cost") ?? "").trim() === ""
          ? null
          : Math.round(Number(form.get("input_cache_hit_cost") || 0) * 1_000_000),
      output_cost_micro_per_1m_tokens: Math.round(Number(form.get("output_cost") || 0) * 1_000_000),
      currency: CURRENCY,
    });
    event.currentTarget.reset();
  }

  return (
    <section className="page">
      <div className="page-actions">
        <RefreshButton isRefreshing={prices.isFetching} onClick={() => prices.refetch()} />
      </div>

      <section className="panel">
        <form className="inline-form" onSubmit={submit}>
          <select name="protocol" defaultValue="openai">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <input name="public_model" placeholder={t("Public model")} required />
          <input name="input_cost" placeholder={t("Input miss {currency} / 1M", { currency: CURRENCY })} type="number" min="0" step="0.0001" />
          <input name="input_cache_hit_cost" placeholder={t("Cache hit {currency} / 1M", { currency: CURRENCY })} type="number" min="0" step="0.0001" />
          <input name="output_cost" placeholder={t("Output {currency} / 1M", { currency: CURRENCY })} type="number" min="0" step="0.0001" />
          <button className="primary" type="submit">
            <Plus size={16} />
            {t("Save")}
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Protocol")}</th>
                <th>{t("Model")}</th>
                <th>{t("Input miss / 1M")}</th>
                <th>{t("Cache hit / 1M")}</th>
                <th>{t("Output / 1M")}</th>
                <th>{t("Currency")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(prices.data?.items ?? []).map((price) => (
                <tr key={price.id}>
                  <td>{price.protocol}</td>
                  <td>{price.public_model}</td>
                  <td>{formatCurrency(price.input_cost_micro_per_1m_tokens)}</td>
                  <td>{price.input_cache_hit_cost_micro_per_1m_tokens === null ? t("n/a") : formatCurrency(price.input_cache_hit_cost_micro_per_1m_tokens)}</td>
                  <td>{formatCurrency(price.output_cost_micro_per_1m_tokens)}</td>
                  <td>{price.currency}</td>
                  <td>
                    <button className="icon-button danger" onClick={() => remove.mutate(price.id)} type="button">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!prices.data?.items?.length ? (
                <tr>
                  <td colSpan={7} className="muted-cell">
                    {t("No prices configured.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
