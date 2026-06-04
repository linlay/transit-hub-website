import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";
import { ConnectivityResultToast } from "../components/ConnectivityResultToast";
import { api } from "../lib/api";
import { useProviderConnectivityTest } from "../lib/useProviderConnectivityTest";
import type { ProviderSnapshot } from "../lib/types";

type ProviderItem = ProviderSnapshot["providers"][number];

export function ProviderTests() {
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, refetchInterval: 30_000 });
  const connectivity = useProviderConnectivityTest();
  const providerList = providers.data?.providers ?? [];
  const [providerName, setProviderName] = useState("");
  const [publicModel, setPublicModel] = useState("");
  const [poolName, setPoolName] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (!providerName && providerList.length > 0) {
      setProviderName(providerList[0].name);
    }
  }, [providerList, providerName]);

  const selectedProvider = useMemo(
    () => providerList.find((provider) => provider.name === providerName),
    [providerList, providerName],
  );
  const selectedModel = useMemo(
    () => selectedProvider?.models.find((model) => model.public === publicModel),
    [selectedProvider, publicModel],
  );
  const inferredPoolName = poolName || effectiveModelPool(selectedModel);
  const selectedPool = useMemo(
    () => selectedProvider?.pools.find((pool) => pool.name === inferredPoolName),
    [selectedProvider, inferredPoolName],
  );

  useEffect(() => {
    if (!selectedProvider) return;
    if (publicModel && !selectedProvider.models.some((model) => model.public === publicModel)) {
      setPublicModel("");
    }
    if (poolName && !selectedProvider.pools.some((pool) => pool.name === poolName)) {
      setPoolName("");
    }
  }, [selectedProvider, publicModel, poolName]);

  useEffect(() => {
    if (!accountName) return;
    if (!selectedPool?.accounts.some((account) => account.name === accountName)) {
      setAccountName("");
    }
  }, [accountName, selectedPool]);

  function runTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!providerName) return;
    const requestPool = poolName || (accountName ? inferredPoolName : effectiveModelPool(selectedModel));
    connectivity.run({
      provider: providerName,
      public_model: publicModel || undefined,
      pool: requestPool || undefined,
      account: accountName || undefined,
      resultKey: `standalone:${providerName}:${publicModel}:${requestPool}:${accountName}`,
      label: "Connectivity",
    });
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Routing</span>
          <h1>Connectivity</h1>
        </div>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Connection test</h2>
            <span>Provider, model, pool, account</span>
          </div>
        </div>
        {providers.isError ? <div className="error-text">Failed to load providers.</div> : null}
        <form className="settings-form" onSubmit={runTest}>
          <div className="settings-grid four">
            <label>
              Provider
              <select
                disabled={providers.isLoading || providerList.length === 0}
                onChange={(event) => {
                  setProviderName(event.target.value);
                  setPublicModel("");
                  setPoolName("");
                  setAccountName("");
                }}
                value={providerName}
              >
                <option value="">Select provider</option>
                {providerList.map((provider) => (
                  <option key={provider.name} value={provider.name}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                disabled={!selectedProvider}
                onChange={(event) => {
                  setPublicModel(event.target.value);
                  setAccountName("");
                }}
                value={publicModel}
              >
                <option value="">Any model</option>
                {selectedProvider?.models.map((model) => (
                  <option key={model.public} value={model.public}>
                    {model.public}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pool
              <select
                disabled={!selectedProvider}
                onChange={(event) => {
                  setPoolName(event.target.value);
                  setAccountName("");
                }}
                value={poolName}
              >
                <option value="">Route pool</option>
                {selectedProvider?.pools.map((pool) => (
                  <option key={pool.name} value={pool.name}>
                    {pool.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Account
              <select disabled={!selectedPool} onChange={(event) => setAccountName(event.target.value)} value={accountName}>
                <option value="">Any account</option>
                {selectedPool?.accounts.map((account) => (
                  <option key={account.name} value={account.name}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="connectivity-target">
            <TargetDetail label="Provider" value={providerName || "none"} />
            <TargetDetail label="Model" value={publicModel || "any"} />
            <TargetDetail label="Pool" value={inferredPoolName || "route"} />
            <TargetDetail label="Account" value={accountName || "any"} />
          </div>
          <div className="dialog-actions">
            <button className="primary" disabled={!providerName || connectivity.isPending} type="submit">
              {connectivity.isPending ? <Loader2 className="spin" size={16} /> : <Activity size={16} />}
              Run test
            </button>
          </div>
        </form>
      </section>
      <ConnectivityResultToast result={connectivity.toast?.result} label={connectivity.toast?.label} onClose={connectivity.dismissToast} />
    </section>
  );
}

function effectiveModelPool(model: ProviderItem["models"][number] | undefined) {
  if (!model) return "";
  if (model.override_pool && model.override_valid !== false) {
    return model.override_pool;
  }
  return model.pool;
}

function TargetDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
