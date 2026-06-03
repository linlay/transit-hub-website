import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "../components/MetricCard";
import { api } from "../lib/api";
import { compactTokenCount, integer, nullablePercent, usdFromMicro } from "../lib/format";
import type { ProviderAccountUsage, ProviderUsage } from "../lib/types";

export function Providers() {
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, refetchInterval: 30_000 });
  const usage = useQuery({ queryKey: ["provider-usage"], queryFn: () => api.providerUsage(), refetchInterval: 30_000 });
  const usageByProvider = useMemo(() => new Map((usage.data?.items ?? []).map((item) => [item.provider, item])), [usage.data?.items]);
  const usageByAccount = useMemo(
    () => new Map((usage.data?.account_items ?? []).map((item) => [`${item.provider}:${item.pool}:${item.account}`, item])),
    [usage.data?.account_items],
  );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Routing</span>
          <h1>Providers</h1>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Provider usage</h2>
          <span>All time</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Requests</th>
                <th>Input</th>
                <th>Output</th>
                <th>Total</th>
                <th>Cache hit</th>
                <th>Cache miss</th>
                <th>Hit rate</th>
                <th>Errors</th>
                <th>Avg latency</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {(usage.data?.items ?? []).map((item) => (
                <tr key={item.provider}>
                  <td>{item.provider}</td>
                  <td>{integer(item.requests)}</td>
                  <td>{compactTokenCount(item.request_tokens)}</td>
                  <td>{compactTokenCount(item.response_tokens)}</td>
                  <td>{compactTokenCount(item.total_tokens)}</td>
                  <td>{compactTokenCount(item.cache_hit_tokens)}</td>
                  <td>{compactTokenCount(item.cache_miss_tokens)}</td>
                  <td>{nullablePercent(item.cache_hit_rate)}</td>
                  <td>{integer(item.error_requests)}</td>
                  <td>{integer(item.average_latency_ms)} ms</td>
                  <td>{usdFromMicro(item.cost_microusd)}</td>
                </tr>
              ))}
              {!usage.data?.items?.length ? (
                <tr>
                  <td colSpan={11} className="muted-cell">
                    No provider usage recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {(providers.data?.providers ?? []).map((provider) => (
        <section className="panel" key={provider.name}>
          <div className="panel-heading">
            <h2>{provider.name}</h2>
            <span>
              {provider.protocol} · {provider.base_url}
            </span>
          </div>
          <ProviderMetrics usage={usageByProvider.get(provider.name) ?? emptyProviderUsage(provider.name)} />
          <div className="provider-grid">
            <div>
              <h3>Models</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Public</th>
                      <th>Upstream</th>
                      <th>Pool</th>
                      <th>Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.models.map((model) => (
                      <tr key={model.public}>
                        <td>{model.public}</td>
                        <td>{model.upstream}</td>
                        <td>{model.pool}</td>
                        <td>{model.override_pool || "none"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>Pools</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pool</th>
                      <th>Account</th>
                      <th>Requests</th>
                      <th>Tokens</th>
                      <th>Weight</th>
                      <th>Circuit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.pools.flatMap((pool) =>
                      pool.accounts.map((account) => {
                        const accountUsage = usageByAccount.get(`${provider.name}:${pool.name}:${account.name}`) ?? emptyAccountUsage(provider.name, pool.name, account.name);
                        return (
                          <tr key={`${pool.name}:${account.name}`}>
                            <td>{pool.name}</td>
                            <td>{account.name}</td>
                            <td>{integer(accountUsage.requests)}</td>
                            <td>{compactTokenCount(accountUsage.total_tokens)}</td>
                            <td>{account.weight}</td>
                            <td>{String(account.circuit.state ?? "closed")}</td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      ))}
    </section>
  );
}

function ProviderMetrics({ usage }: { usage: ProviderUsage }) {
  return (
    <div className="provider-metrics">
      <MetricCard label="Requests" value={integer(usage.requests)} detail={`${integer(usage.error_requests)} failed`} />
      <MetricCard label="Tokens" value={compactTokenCount(usage.total_tokens)} detail={`${compactTokenCount(usage.request_tokens)} input`} />
      <MetricCard label="Cache hit" value={nullablePercent(usage.cache_hit_rate)} detail={`${compactTokenCount(usage.cache_total_tokens)} cache tokens`} />
      <MetricCard label="Cost" value={usdFromMicro(usage.cost_microusd)} detail={`${integer(usage.average_latency_ms)} ms avg`} />
    </div>
  );
}

function emptyProviderUsage(provider: string): ProviderUsage {
  return {
    provider,
    requests: 0,
    request_tokens: 0,
    response_tokens: 0,
    total_tokens: 0,
    cache_hit_tokens: 0,
    cache_miss_tokens: 0,
    cache_total_tokens: 0,
    cache_hit_rate: null,
    cost_microusd: 0,
    error_requests: 0,
    average_latency_ms: 0,
  };
}

function emptyAccountUsage(provider: string, pool: string, account: string): ProviderAccountUsage {
  return {
    provider,
    pool,
    account,
    requests: 0,
    request_tokens: 0,
    response_tokens: 0,
    total_tokens: 0,
    error_requests: 0,
  };
}
