import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { ConnectivityResultToast } from "../components/ConnectivityResultToast";
import { usePageActions } from "../components/Layout";
import { MetricCard } from "../components/MetricCard";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { compactTokenCount, integer, nullablePercent, formatCurrency } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import { useProviderConnectivityTest, type ConnectivityTarget } from "../lib/useProviderConnectivityTest";
import type { ProviderAccountUsage, ProviderUsage } from "../lib/types";

export function Providers() {
  const { t } = useI18n();
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const usage = useQuery({ queryKey: ["provider-usage"], queryFn: () => api.providerUsage(), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const isRefreshing = providers.isFetching || usage.isFetching;
  const connectivity = useProviderConnectivityTest();
  const usageByProvider = useMemo(() => new Map((usage.data?.items ?? []).map((item) => [item.provider, item])), [usage.data?.items]);
  const usageByAccount = useMemo(
    () => new Map((usage.data?.account_items ?? []).map((item) => [`${item.provider}:${item.pool}:${item.account}`, item])),
    [usage.data?.account_items],
  );

  type SortKey = "total_tokens" | "cache_hit_tokens" | "cache_miss_tokens" | null;
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedItems = useMemo(() => {
    if (!sortKey) return usage.data?.items ?? [];
    const items = [...(usage.data?.items ?? [])];
    items.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = aVal - bVal;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [usage.data?.items, sortKey, sortDir]);

  function renderConnectivityAction(target: ConnectivityTarget, title: string) {
    const pending = connectivity.isPending && connectivity.pendingKey === target.resultKey;
    return (
      <div className="connection-test">
        <button
          aria-label={title}
          className="icon-button"
          disabled={connectivity.isPending}
          onClick={() => connectivity.run({ ...target, label: title })}
          title={title}
          type="button"
        >
          {pending ? <Loader2 className="spin" size={16} /> : <Activity size={16} />}
        </button>
      </div>
    );
  }

  usePageActions(<RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([providers.refetch(), usage.refetch()])} />, [isRefreshing, providers.refetch, usage.refetch]);

  return (
    <section className="page">
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("Provider usage")}</h2>
          <span>{t("All time")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Provider")}</th>
                <th>{t("Requests")}</th>
                <th>{t("Input")}</th>
                <th>{t("Output")}</th>
                <th className="sortable">
                  <button className="sort-header" type="button" onClick={() => toggleSort("total_tokens")}>
                    {t("Total")}
                    {sortKey === "total_tokens" ? (
                      sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="sortable">
                  <button className="sort-header" type="button" onClick={() => toggleSort("cache_hit_tokens")}>
                    {t("Cache hit")}
                    {sortKey === "cache_hit_tokens" ? (
                      sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th className="sortable">
                  <button className="sort-header" type="button" onClick={() => toggleSort("cache_miss_tokens")}>
                    {t("Cache miss")}
                    {sortKey === "cache_miss_tokens" ? (
                      sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} />
                    )}
                  </button>
                </th>
                <th>{t("Hit rate")}</th>
                <th>{t("Errors")}</th>
                <th>{t("Avg latency")}</th>
                <th>{t("Cost")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
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
                  <td>{formatCurrency(item.cost_micro)}</td>
                </tr>
              ))}
              {!usage.data?.items?.length ? (
                <tr>
                  <td colSpan={11} className="muted-cell">
                    {t("No provider usage recorded yet.")}
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
            <div>
              <h2>{provider.name}</h2>
              <span>
                {provider.protocol} · {provider.base_url}
              </span>
            </div>
            {renderConnectivityAction({ provider: provider.name, resultKey: `provider:${provider.name}` }, t("Test provider"))}
          </div>
          <ProviderMetrics usage={usageByProvider.get(provider.name) ?? emptyProviderUsage(provider.name)} />
          <div className="provider-grid">
            <div>
              <h3>{t("Models")}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Public")}</th>
                      <th>{t("Upstream")}</th>
                      <th>{t("Pool")}</th>
                      <th>{t("Override")}</th>
                      <th>{t("Test")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.models.map((model) => {
                      const overridePool = model.override_pool && model.override_valid !== false ? model.override_pool : undefined;
                      return (
                        <tr key={model.public}>
                          <td>{model.public}</td>
                          <td>{model.upstream}</td>
                          <td>{model.pool}</td>
                          <td>{model.override_pool || t("none")}</td>
                          <td>
                            {renderConnectivityAction(
                              { provider: provider.name, public_model: model.public, pool: overridePool, resultKey: `model:${provider.name}:${model.public}` },
                              t("Test route"),
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>{t("Pools")}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Pool")}</th>
                      <th>{t("Account")}</th>
                      <th>{t("Requests")}</th>
                      <th>{t("Tokens")}</th>
                      <th>{t("Weight")}</th>
                      <th>{t("Circuit")}</th>
                      <th>{t("Test")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.pools.flatMap((pool) =>
                      pool.accounts.map((account, accountIndex) => {
                        const accountUsage = usageByAccount.get(`${provider.name}:${pool.name}:${account.name}`) ?? emptyAccountUsage(provider.name, pool.name, account.name);
                        return (
                          <tr key={`${pool.name}:${account.name}`}>
                            <td>{pool.name}</td>
                            <td>{account.name}</td>
                            <td>{integer(accountUsage.requests)}</td>
                            <td>{compactTokenCount(accountUsage.total_tokens)}</td>
                            <td>{account.weight}</td>
                            <td>{String(account.circuit.state ?? "closed")}</td>
                            <td>
                              <div className="table-actions">
                                {accountIndex === 0
                                  ? renderConnectivityAction({ provider: provider.name, pool: pool.name, resultKey: `pool:${provider.name}:${pool.name}` }, t("Test pool"))
                                  : null}
                                {renderConnectivityAction(
                                  { provider: provider.name, pool: pool.name, account: account.name, resultKey: `account:${provider.name}:${pool.name}:${account.name}` },
                                  t("Test account"),
                                )}
                              </div>
                            </td>
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
      <ConnectivityResultToast result={connectivity.toast?.result} label={connectivity.toast?.label} onClose={connectivity.dismissToast} />
    </section>
  );
}

function ProviderMetrics({ usage }: { usage: ProviderUsage }) {
  const { t } = useI18n();

  return (
    <div className="provider-metrics">
      <MetricCard label={t("Requests")} value={integer(usage.requests)} detail={t("{count} failed", { count: integer(usage.error_requests) })} />
      <MetricCard label={t("Tokens")} value={compactTokenCount(usage.total_tokens)} detail={t("{count} input", { count: compactTokenCount(usage.request_tokens) })} />
      <MetricCard label={t("Cache hit")} value={nullablePercent(usage.cache_hit_rate)} detail={t("{count} cache tokens", { count: compactTokenCount(usage.cache_total_tokens) })} />
      <MetricCard label={t("Cost")} value={formatCurrency(usage.cost_micro)} detail={t("{count} ms avg", { count: integer(usage.average_latency_ms) })} />
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
    cost_micro: 0,
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
