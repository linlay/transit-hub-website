import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function Providers() {
  const providers = useQuery({ queryKey: ["providers"], queryFn: api.providers, refetchInterval: 30_000 });

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Routing</span>
          <h1>Providers</h1>
        </div>
      </div>
      {(providers.data?.providers ?? []).map((provider) => (
        <section className="panel" key={provider.name}>
          <div className="panel-heading">
            <h2>{provider.name}</h2>
            <span>
              {provider.protocol} · {provider.base_url}
            </span>
          </div>
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
                      <th>Weight</th>
                      <th>Circuit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.pools.flatMap((pool) =>
                      pool.accounts.map((account) => (
                        <tr key={`${pool.name}:${account.name}`}>
                          <td>{pool.name}</td>
                          <td>{account.name}</td>
                          <td>{account.weight}</td>
                          <td>{String(account.circuit.state ?? "closed")}</td>
                        </tr>
                      )),
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
