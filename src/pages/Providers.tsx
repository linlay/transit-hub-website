import { SortHeader, nextTableSort, sortRows, useTableSort, type TableSort } from "../components/TableSort";
import { QueryFeedback } from "../components/QueryFeedback";
import { IconButton } from "../components/IconButton";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronRight, Loader2 } from "lucide-react";
import { ConnectivityResultToast } from "../components/ConnectivityResultToast";
import { usePageActions } from "../components/Layout";
import { MetricCard } from "../components/MetricCard";
import { ModalDialog } from "../components/ModalDialog";
import { RefreshButton } from "../components/RefreshButton";
import { TelemetryUnavailable } from "../components/TelemetryUnavailable";
import { ProviderAccountStatusControl } from "../components/ProviderAccountStatusControl";
import { api, isTelemetryError } from "../lib/api";
import { compactTokenCount, dateTime, integer, nullablePercent, formatCredits } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import { useProviderConnectivityTest, type ConnectivityTarget } from "../lib/useProviderConnectivityTest";
import type { ProviderAccountUsage, ProviderQuotaAccount, ProviderUsage } from "../lib/types";

type ProviderSortKey = "requests" | "total_tokens" | "cache_hit_tokens" | "cache_miss_tokens" | "error_requests" | "average_latency_ms" | "charged_microcredits";
type AccountSortKey = "requests" | "total_tokens";

export function Providers({ onCreate, onConfigure }: { onCreate: () => void; onConfigure: () => void }) {
  const { t } = useI18n();
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const usage = useQuery({ queryKey: ["provider-usage"], queryFn: () => api.providerUsage(), refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const quota = useQuery({ queryKey: ["provider-quota"], queryFn: api.providerQuota, refetchInterval: PAGE_REFETCH_INTERVAL_MS });
  const telemetryUnavailable = isTelemetryError(usage.error);
  const isRefreshing = providers.isFetching || usage.isFetching || quota.isFetching;
  const connectivity = useProviderConnectivityTest();
  const usageByProvider = useMemo(() => new Map((usage.data?.items ?? []).map((item) => [item.provider, item])), [usage.data?.items]);
  const usageByAccount = useMemo(
    () => new Map((usage.data?.account_items ?? []).map((item) => [`${item.provider}:${item.pool}:${item.account}`, item])),
    [usage.data?.account_items],
  );
  const quotaByProvider = useMemo(() => {
    const items = new Map<string, ProviderQuotaAccount[]>();
    for (const account of quota.data?.items ?? []) {
      const providerItems = items.get(account.provider) ?? [];
      providerItems.push(account);
      items.set(account.provider, providerItems);
    }
    return items;
  }, [quota.data?.items]);

  const [sort, toggleSort] = useTableSort<ProviderSortKey>();
  const [accountSorts, setAccountSorts] = useState(() => new Map<string, TableSort<AccountSortKey> | null>());
  const sortedItems = sortRows(usage.data?.items ?? [], sort, (row, key) => row[key]);

  function toggleAccountSort(provider: string, key: AccountSortKey) {
    setAccountSorts(previous => new Map(previous).set(provider, nextTableSort(previous.get(provider) ?? null, key)));
  }

  function renderConnectivityAction(target: ConnectivityTarget, title: string, disabled = false) {
    const pending = connectivity.isPending && connectivity.pendingKey === target.resultKey;
    return (
      <div className="connection-test">
        <IconButton label={title} className="icon-button" disabled={disabled || connectivity.isPending} onClick={() => connectivity.run({ ...target, label: title })} type="button">{pending ? <Loader2 className="spin" size={16} /> : <Activity size={16} />}</IconButton>
      </div>
    );
  }

  usePageActions(<><RefreshButton isRefreshing={isRefreshing} onClick={() => Promise.all([providers.refetch(), usage.refetch(), quota.refetch()])} /><button onClick={onConfigure}>{t("Channel configuration")}</button><button className="primary" onClick={onCreate}>{t("New channel")}</button></>, [t, isRefreshing, providers.refetch, usage.refetch, quota.refetch, onCreate, onConfigure]);

  return (
    <>
      <QueryFeedback query={providers} />
      {!telemetryUnavailable ? <QueryFeedback query={usage} /> : null}
      <QueryFeedback query={quota} />
      {telemetryUnavailable ? <TelemetryUnavailable /> : null}
      {!telemetryUnavailable ? <section className="panel">
        <div className="panel-heading">
          <h2>{t("Provider usage")}</h2>
          <span>{t("All time")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Provider")}</th>
                <SortHeader sort={sort} sortKey="requests" onSort={toggleSort} className="numeric">{t("Requests")}</SortHeader>
                <th className="numeric">{t("Input")}</th>
                <th className="numeric">{t("Output")}</th>
                <SortHeader sort={sort} sortKey="total_tokens" onSort={toggleSort} firstDirection="asc" className="numeric">{t("Total")}</SortHeader>
                <SortHeader sort={sort} sortKey="cache_hit_tokens" onSort={toggleSort} firstDirection="asc" className="numeric">{t("Cache hit")}</SortHeader>
                <SortHeader sort={sort} sortKey="cache_miss_tokens" onSort={toggleSort} firstDirection="asc" className="numeric">{t("Cache miss")}</SortHeader>
                <th className="numeric">{t("Hit rate")}</th>
                <SortHeader sort={sort} sortKey="error_requests" onSort={toggleSort} className="numeric">{t("Errors")}</SortHeader>
                <SortHeader sort={sort} sortKey="average_latency_ms" onSort={toggleSort} className="numeric">{t("Avg latency")}</SortHeader>
                <SortHeader sort={sort} sortKey="charged_microcredits" onSort={toggleSort} className="numeric">{t("Cost")}</SortHeader>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.provider}>
                  <td>{item.provider}</td>
                  <td className="numeric">{integer(item.requests)}</td>
                  <td className="numeric">{compactTokenCount(item.request_tokens)}</td>
                  <td className="numeric">{compactTokenCount(item.response_tokens)}</td>
                  <td className="numeric">{compactTokenCount(item.total_tokens)}</td>
                  <td className="numeric">{compactTokenCount(item.cache_hit_tokens)}</td>
                  <td className="numeric">{compactTokenCount(item.cache_miss_tokens)}</td>
                  <td className="numeric">{nullablePercent(item.cache_hit_rate)}</td>
                  <td className="numeric">{integer(item.error_requests)}</td>
                  <td className="numeric">{integer(item.average_latency_ms)} ms</td>
                  <td className="numeric">{formatCredits(item.charged_microcredits)}</td>
                </tr>
              ))}
              {!usage.data?.items?.length ? (
                <tr>
                  <td colSpan={11} className="muted-cell">
                    {usage.isPending ? t("Loading...") : usage.isError ? t("Unable to load data.") : t("No provider usage recorded yet.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section> : null}
      {(providers.data?.providers ?? []).map((provider) => {
        const accountSort = accountSorts.get(provider.name) ?? null;
        const accounts = provider.pools.flatMap(pool => pool.accounts.map(account => ({
          pool: pool.name,
          account,
          usage: usageByAccount.get(`${provider.name}:${pool.name}:${account.name}`) ?? emptyAccountUsage(provider.name, pool.name, account.name),
        })));
        const sortedAccounts = sortRows(accounts, telemetryUnavailable ? null : accountSort, (row, key) => row.usage[key]);
        return <section className="panel" key={provider.name}>
          <div className="panel-heading">
            <div>
              <h2>{provider.name}</h2>
              <span>
                {provider.protocol} · {provider.base_url}
              </span>
            </div>
            <div className="table-actions">
              <Link className="channel-configure" aria-label={t("Configure {channel}", { channel: provider.name })} to={`/providers?${new URLSearchParams({ tab: "configuration", channel: provider.name })}`}>{t("Configure")}</Link>
              {renderConnectivityAction({ provider: provider.name, resultKey: `provider:${provider.name}` }, t("Test provider"))}
            </div>
          </div>
          {!telemetryUnavailable && usage.data ? <ProviderMetrics usage={usageByProvider.get(provider.name) ?? emptyProviderUsage(provider.name)} /> : null}
          {(quotaByProvider.get(provider.name)?.length ?? 0) > 0 ? <ProviderQuotaSummary items={quotaByProvider.get(provider.name) ?? []} /> : null}
          <div className="provider-grid">
            <div>
              <div className="provider-section-heading"><h3>{t("Models")}</h3></div>
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
              <div className="provider-section-heading">
                <h3>{t("Pools")}</h3>
                <div className="provider-pool-tests">
                  {provider.pools.map((pool) => (
                    <div className="provider-pool-test" key={pool.name}>
                      {provider.pools.length > 1 ? <span>{pool.name}</span> : null}
                      {renderConnectivityAction(
                        { provider: provider.name, pool: pool.name, resultKey: `pool:${provider.name}:${pool.name}` },
                        provider.pools.length > 1 ? `${t("Test pool")}: ${pool.name}` : t("Test pool"),
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Pool")}</th>
                      <th>{t("Account")}</th>
                      <th className="status-cell">{t("Status")}</th>
                      {telemetryUnavailable ? <>
                        <th className="numeric">{t("Requests")}</th>
                        <th>{t("Tokens")}</th>
                      </> : <>
                        <SortHeader sort={accountSort} sortKey="requests" onSort={key => toggleAccountSort(provider.name, key)} className="numeric">{t("Requests")}</SortHeader>
                        <SortHeader sort={accountSort} sortKey="total_tokens" onSort={key => toggleAccountSort(provider.name, key)}>{t("Tokens")}</SortHeader>
                      </>}
                      <th>{t("Weight")}</th>
                      <th>{t("Circuit")}</th>
                      <th>{t("Test")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAccounts.map(({ pool, account, usage: accountUsage }) => (
                      <tr key={`${pool}:${account.name}`}>
                        <td>{pool}</td>
                        <td>{account.name}</td>
                        <td><ProviderAccountStatusControl provider={provider.name} pool={pool} account={account.name} enabled={account.enabled !== false} reason={account.disabled_reason} failureCount={account.failure_count} /></td>
                        <td>{telemetryUnavailable ? t("Unavailable") : integer(accountUsage.requests)}</td>
                        <td>{telemetryUnavailable ? t("Unavailable") : compactTokenCount(accountUsage.total_tokens)}</td>
                        <td>{account.weight}</td>
                        <td>{String(account.circuit.state ?? "closed")}</td>
                        <td>
                          <div className="table-actions">
                            {renderConnectivityAction(
                              { provider: provider.name, pool, account: account.name, resultKey: `account:${provider.name}:${pool}:${account.name}` },
                              t("Test account"),
                              account.enabled === false,
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>;
      })}
      <ConnectivityResultToast result={connectivity.toast?.result} label={connectivity.toast?.label} onClose={connectivity.dismissToast} />
    </>
  );
}

function ProviderQuotaSummary({ items }: { items: ProviderQuotaAccount[] }) {
  const { t } = useI18n();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = items.find((item) => `${item.pool}:${item.account}` === selectedKey) ?? null;

  return (
    <div className="provider-quota">
      <div className="provider-quota-heading">
        <h3>{t("Upstream quota")}</h3>
        <span>{t("Cached provider data")}</span>
      </div>
      <div className="provider-quota-list">
        {items.map((item) => {
          const updatedAt = item.last_success_at ?? item.last_attempt_at;
          const entries = item.entries ?? [];
          const summaryEntry = entries[0];
          const summary = summaryEntry?.lines[0];
          return (
            <button
              aria-label={t("View quota details for {account}", { account: item.account })}
              className="provider-quota-account"
              key={`${item.pool}:${item.account}`}
              onClick={() => setSelectedKey(`${item.pool}:${item.account}`)}
              title={t("View quota details")}
              type="button"
            >
              <div className="provider-quota-account-identity">
                <strong>{item.account}</strong>
                <span>{item.pool}</span>
              </div>
              <div className="provider-quota-summary">
                {summary ? <><strong>{summaryEntry.title}</strong><span>{summary}</span></> : <span>{item.last_error || t("Awaiting quota data")}</span>}
              </div>
              <div className="provider-quota-account-action">
                <QuotaState state={item.state} />
                {item.state === "error" && item.last_success_at ? <span className="provider-quota-stale">{t("Stale data")}</span> : null}
                <span className="provider-quota-updated">{t(item.last_success_at ? "Updated" : "Last attempt")}: {updatedAt ? dateTime(updatedAt) : "—"}</span>
                <ChevronRight aria-hidden="true" size={16} />
              </div>
            </button>
          );
        })}
      </div>
      {selected ? (
        <ModalDialog title={`${selected.account} · ${t("Upstream quota")}`} onClose={() => setSelectedKey(null)}>
          <ProviderQuotaDetails item={selected} />
        </ModalDialog>
      ) : null}
    </div>
  );
}

function ProviderQuotaDetails({ item }: { item: ProviderQuotaAccount }) {
  const { t } = useI18n();
  const updatedAt = item.last_success_at ?? item.last_attempt_at;
  const entries = item.entries ?? [];

  return (
    <div className="provider-quota-dialog">
      <div className="provider-quota-dialog-heading">
        <div>
          <strong>{item.pool}</strong>
          <span>{t(item.last_success_at ? "Updated" : "Last attempt")}: {updatedAt ? dateTime(updatedAt) : "—"}</span>
        </div>
        <QuotaState state={item.state} />
      </div>
      {item.state === "error" && item.last_success_at ? <div className="provider-quota-stale">{t("Stale data")}</div> : null}
      {item.last_error ? <div className="provider-quota-error">{item.last_error}</div> : null}
      {entries.length ? (
        <div className="provider-quota-entries">
          {entries.map((entry, index) => (
            <section className="provider-quota-entry" key={`${entry.title}:${index}`}>
              <h4>{entry.title}</h4>
              <div className="provider-quota-lines">
                {entry.lines.map((line, lineIndex) => <p key={`${line}:${lineIndex}`}>{line}</p>)}
              </div>
            </section>
          ))}
        </div>
      ) : <div className="provider-quota-empty">{t("Awaiting quota data")}</div>}
    </div>
  );
}

function QuotaState({ state }: { state: ProviderQuotaAccount["state"] }) {
  const { t } = useI18n();
  const className = state === "ok" ? "good" : state === "error" ? "danger" : "muted";
  const label = state === "ok" ? "Query succeeded" : state === "error" ? "Query failed" : "Pending";
  return <span className={`pill ${className}`}>{t(label)}</span>;
}

function ProviderMetrics({ usage }: { usage: ProviderUsage }) {
  const { t } = useI18n();

  return (
    <div className="provider-metrics">
      <MetricCard label={t("Requests")} value={integer(usage.requests)} detail={t("{count} failed", { count: integer(usage.error_requests) })} />
      <MetricCard label={t("Tokens")} value={compactTokenCount(usage.total_tokens)} detail={t("{count} input", { count: compactTokenCount(usage.request_tokens) })} />
      <MetricCard label={t("Cache hit")} value={nullablePercent(usage.cache_hit_rate)} detail={t("{count} cache tokens", { count: compactTokenCount(usage.cache_total_tokens) })} />
      <MetricCard label={t("Cost")} value={formatCredits(usage.charged_microcredits)} detail={t("{count} ms avg", { count: integer(usage.average_latency_ms) })} />
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
    charged_microcredits: 0,
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
