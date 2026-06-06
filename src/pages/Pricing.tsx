import { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { usdFromMicro } from "../lib/format";

const CURRENCY = import.meta.env.VITE_CURRENCY ?? "CNY";

export function Pricing() {
  const queryClient = useQueryClient();
  const prices = useQuery({ queryKey: ["prices"], queryFn: api.prices });
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
      input_cost_microusd_per_1m_tokens: Math.round(Number(form.get("input_usd") || 0) * 1_000_000),
      input_cache_hit_cost_microusd_per_1m_tokens:
        String(form.get("input_cache_hit_usd") ?? "").trim() === ""
          ? null
          : Math.round(Number(form.get("input_cache_hit_usd") || 0) * 1_000_000),
      output_cost_microusd_per_1m_tokens: Math.round(Number(form.get("output_usd") || 0) * 1_000_000),
      currency: CURRENCY,
    });
    event.currentTarget.reset();
  }

  return (
    <section className="page">
      <section className="panel">
        <form className="inline-form" onSubmit={submit}>
          <select name="protocol" defaultValue="openai">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <input name="public_model" placeholder="Public model" required />
          <input name="input_usd" placeholder={`Input miss ${CURRENCY} / 1M`} type="number" min="0" step="0.0001" />
          <input name="input_cache_hit_usd" placeholder={`Cache hit ${CURRENCY} / 1M`} type="number" min="0" step="0.0001" />
          <input name="output_usd" placeholder={`Output ${CURRENCY} / 1M`} type="number" min="0" step="0.0001" />
          <button className="primary" type="submit">
            <Plus size={16} />
            Save
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Model</th>
                <th>Input miss / 1M</th>
                <th>Cache hit / 1M</th>
                <th>Output / 1M</th>
                <th>Currency</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(prices.data?.items ?? []).map((price) => (
                <tr key={price.id}>
                  <td>{price.protocol}</td>
                  <td>{price.public_model}</td>
                  <td>{usdFromMicro(price.input_cost_microusd_per_1m_tokens)}</td>
                  <td>{price.input_cache_hit_cost_microusd_per_1m_tokens === null ? "n/a" : usdFromMicro(price.input_cache_hit_cost_microusd_per_1m_tokens)}</td>
                  <td>{usdFromMicro(price.output_cost_microusd_per_1m_tokens)}</td>
                  <td>{price.currency}</td>
                  <td>
                    <button className="icon-button danger" onClick={() => remove.mutate(price.id)} type="button">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
