import { useI18n } from "../lib/i18n";
import { enterpriseValueLabel } from "../lib/enterprise-labels";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useQuery } from "@tanstack/react-query";
import { enterpriseRequest as request, type Row } from "../lib/enterprise";
import { QueryFeedback } from "./QueryFeedback";

type Channel = { name: string; data_region: string; pools: { accounts: { enabled: boolean; circuit: { state: string } }[] }[] };
export function ChannelHealth() {
  const { t } = useI18n();

 const channels=useQuery({queryKey:["channel-health"],queryFn:()=>request<{providers:Channel[]}>("/admin/providers"),refetchInterval:60000});
 const stats=useQuery({queryKey:["routing-stats"],queryFn:()=>request<{items:Row[]}>("/admin/routing/stats"),refetchInterval:60000});
 return <section className="panel"><div className="panel-heading"><h2>{t("Channel health")}</h2><span>{t("Last 15 minutes")}</span></div><QueryFeedback query={channels} /><QueryFeedback query={stats} /><div className="table-wrap"><table><thead><tr><th>{t("Channel / region")}</th><th>{t("Available / open-circuit accounts")}</th><th>{t("Attempts")}</th><th>{t("Retry rate")}</th><th>TTFT p50 / p95</th><th>{t("Latency p50 / p95")}</th></tr></thead><tbody>{channels.data?.providers.map(channel=>{
 const accounts=channel.pools.flatMap(pool=>pool.accounts);const recent=stats.data?.items.filter(row=>row.provider===channel.name)??[];
 const attempts=recent.reduce((n,row)=>n+Number(row.attempts),0);const retries=recent.reduce((n,row)=>n+Number(row.attempts)*Number(row.retry_rate),0);
 return <tr key={channel.name}><td>{channel.name}<small>{t(enterpriseValueLabel(channel.data_region))}</small></td><td>{accounts.filter(a=>a.enabled&&a.circuit.state!=="open").length} / {accounts.filter(a=>a.circuit.state==="open").length}</td><td>{attempts}</td><td>{attempts?(retries/attempts*100).toFixed(1):"0"}%</td><td>{recent.map((row,i)=><div key={i}>{String(row.upstream_model)}: {String(row.p50_ttft_ms??"—")} / {String(row.p95_ttft_ms??"—")} ms</div>)}</td><td>{recent.map((row,i)=><div key={i}>{String(row.p50_latency_ms??"—")} / {String(row.p95_latency_ms??"—")} ms</div>)}</td></tr>;
 })}</tbody></table></div></section>;
}

export function BudgetVacancies() {
  const { t } = useI18n();

 const me=useQuery({queryKey:["me"],queryFn:api.me});
 const orgs=useQuery({queryKey:["organizations"],queryFn:()=>request<{items:Row[]}>("/admin/virtual-orgs"),enabled:me.data?.role==="super_admin"});
 const vacant=orgs.data?.items.filter(org=>org.admin_vacant&&org.status!=="archived")??[];
 if(!vacant.length)return null;
 return <section className="panel"><h2>{t("Unassigned owners")}</h2><div className="enterprise-actions">{vacant.map(org=><Link key={String(org.id)} to={`/organizations/${org.id}`}>{String(org.name)} →</Link>)}</div></section>;
}
