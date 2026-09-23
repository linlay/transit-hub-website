import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { decimalToMicro, formatCredits, formatCurrency } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { ModelPrice, PriceBilling } from "../lib/types";

export function Pricing() {
 const { t } = useI18n();
 const client = useQueryClient();
 const prices = useQuery({queryKey:["prices"],queryFn:api.prices,refetchInterval:PAGE_REFETCH_INTERVAL_MS});
 const [editing,setEditing] = useState<ModelPrice>();
 const [mode,setMode] = useState<PriceBilling["mode"]>("tokens");
 const [rules,setRules] = useState([{size:"",quality:"",amount:""}]);
 const [error,setError] = useState("");
 const [revision,setRevision] = useState(0);
 usePageActions(<RefreshButton isRefreshing={prices.isFetching} onClick={()=>prices.refetch()} />,[prices.isFetching,prices.refetch]);
 const save = useMutation({mutationFn:(body:Partial<ModelPrice>)=>editing ? api.updatePrice(editing.id,body) : api.createPrice(body),onSuccess:()=>{client.invalidateQueries({queryKey:["prices"]});select();},onError:(err:Error)=>setError(err.message)});
 const remove = useMutation({mutationFn:api.deletePrice,onSuccess:()=>client.invalidateQueries({queryKey:["prices"]}),onError:(err:Error)=>setError(err.message)});
 function select(price?:ModelPrice) {
  setEditing(price); setMode(price?.billing?.mode ?? "tokens");setError("");setRevision(v=>v+1);
  setRules(price?.billing?.image_prices?.map(r=>({size:r.size,quality:r.quality,amount:String(r.cost_micro/1_000_000)})) ?? [{size:"",quality:"",amount:""}]);
 }
 function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setError("");const form=new FormData(event.currentTarget);
  try {
   const optionalAmount=(name:string)=>String(form.get(name)??"").trim() ? decimalToMicro(form.get(name)) : null;
   const billing:PriceBilling={mode};
   if (mode === "tokens" && editing?.billing?.token_tiers) billing.token_tiers = editing.billing.token_tiers;
   if(mode==="tokens") {
    billing.cache_write_cost_micro_per_1m_tokens=optionalAmount("cache_write");
   }
   if(mode==="image") billing.image_prices=rules.map(r=>({size:r.size.trim(),quality:r.quality.trim(),cost_micro:decimalToMicro(r.amount)}));
   save.mutate({protocol:String(form.get("protocol")),public_model:String(form.get("public_model")).trim(),currency:"CNY",billing,
    input_cost_micro_per_1m_tokens:mode==="tokens"?decimalToMicro(form.get("input")):0,
    input_cache_hit_cost_micro_per_1m_tokens:mode==="tokens"?optionalAmount("cache_hit"):null,
    output_cost_micro_per_1m_tokens:mode==="tokens"?decimalToMicro(form.get("output")):0});
  }catch(err){setError(err instanceof Error?err.message:String(err));}
 }
 const amount=(value?:number|null)=>value==null?"":String(value/1_000_000);
 return <section className="page">
  <section className="panel">
   <p>{t("Prices are in CNY. 1 CNY = 100 Credits.")}</p>
   {error && <p role="alert">{error}</p>}
   <form className="pricing-form" key={revision} onSubmit={submit}>
    <div className="pricing-meta">
     <select name="protocol" defaultValue={editing?.protocol??"openai"} aria-label={t("Protocol")}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select>
     <input name="public_model" defaultValue={editing?.public_model} placeholder={t("Public model")} required readOnly={!!editing}/>
     <select value={mode} onChange={e=>setMode(e.target.value as PriceBilling["mode"])} aria-label={t("Billing mode")}>
      <option value="tokens">{t("Per token")}</option><option value="image">{t("Per image")}</option><option value="free">{t("Free")}</option>
     </select>
    </div>
    {mode==="tokens" && <div className="pricing-fields">
     <label>{t("Input CNY / 1M")}<input name="input" defaultValue={amount(editing?.input_cost_micro_per_1m_tokens)} type="number" min="0" step="0.000001"/></label>
     <label>{t("Cache hit CNY / 1M")}<input name="cache_hit" defaultValue={amount(editing?.input_cache_hit_cost_micro_per_1m_tokens)} placeholder={t("Use input price")} type="number" min="0" step="0.000001"/></label>
     <label>{t("Cache write CNY / 1M")}<input name="cache_write" defaultValue={amount(editing?.billing?.cache_write_cost_micro_per_1m_tokens)} placeholder={t("Use input price")} type="number" min="0" step="0.000001"/></label>
     <label>{t("Output CNY / 1M")}<input name="output" defaultValue={amount(editing?.output_cost_micro_per_1m_tokens)} type="number" min="0" step="0.000001"/></label>
    </div>}
    {mode==="image" && <div>
     <p>{t("Empty size or quality matches any value. Specific rules take priority.")}</p>
     {rules.map((rule,index)=><div className="pricing-image-rule" key={index}>
      <input aria-label={t("Size")} placeholder={t("Size")} value={rule.size} onChange={e=>setRules(rows=>rows.map((r,i)=>i===index?{...r,size:e.target.value}:r))}/>
      <input aria-label={t("Quality")} placeholder={t("Quality")} value={rule.quality} onChange={e=>setRules(rows=>rows.map((r,i)=>i===index?{...r,quality:e.target.value}:r))}/>
      <input aria-label={t("CNY per image")} placeholder={t("CNY per image")} value={rule.amount} type="number" min="0.000001" step="0.000001" required onChange={e=>setRules(rows=>rows.map((r,i)=>i===index?{...r,amount:e.target.value}:r))}/>
      <button type="button" disabled={rules.length===1} onClick={()=>setRules(rows=>rows.filter((_,i)=>i!==index))}>{t("Remove")}</button>
     </div>)}
     <button type="button" onClick={()=>setRules(rows=>[...rows,{size:"",quality:"",amount:""}])}>{t("Add price rule")}</button>
    </div>}
    <div className="pricing-meta"><button className="primary" type="submit" disabled={save.isPending}><Plus size={16}/>{t("Save")}</button>{editing && <button type="button" onClick={()=>select()}>{t("Cancel")}</button>}</div>
   </form>
  </section>
  <section className="panel"><div className="table-wrap"><table>
   <thead><tr><th>{t("Protocol")}</th><th>{t("Model")}</th><th>{t("Billing mode")}</th><th>{t("Price")}</th><th/></tr></thead>
   <tbody>{(prices.data?.items??[]).map(price=><tr key={price.id}>
    <td>{price.protocol}</td><td>{price.public_model}</td><td>{t(price.billing?.mode==="free"?"Free":price.billing?.mode==="image"?"Per image":"Per token")}</td>
    <td>{price.billing?.mode==="image" ? price.billing.image_prices?.map((r,i)=><div key={i}>{r.size||"*"} / {r.quality||"*"}: {formatCurrency(r.cost_micro)} · {formatCredits(r.cost_micro)}</div>) : price.billing?.mode==="free" ? formatCredits(0) : <>
     <div>{t("Input / output per 1M")}: {formatCurrency(price.input_cost_micro_per_1m_tokens)} / {formatCurrency(price.output_cost_micro_per_1m_tokens)}</div>
     <small>{formatCredits(price.input_cost_micro_per_1m_tokens)} / {formatCredits(price.output_cost_micro_per_1m_tokens)}</small>
     {price.billing?.token_tiers?.map(tier => <div key={tier.above_input_tokens}>输入 &gt; {tier.above_input_tokens.toLocaleString()} tokens：{formatCurrency(tier.input_cost_micro_per_1m_tokens)} / {formatCurrency(tier.output_cost_micro_per_1m_tokens)}（输入 / 输出，每百万 tokens）</div>)}
     <div>{t("Cache hit / write per 1M")}: {formatCurrency(price.input_cache_hit_cost_micro_per_1m_tokens??price.input_cost_micro_per_1m_tokens)} / {formatCurrency(price.billing?.cache_write_cost_micro_per_1m_tokens??price.input_cost_micro_per_1m_tokens)}</div>
    </>}</td>
    <td><button className="icon-button" aria-label={t("Edit")} onClick={()=>select(price)}><Pencil size={16}/></button><button className="icon-button danger" aria-label={t("Delete")} onClick={()=>remove.mutate(price.id)}><Trash2 size={16}/></button></td>
   </tr>)}{!prices.data?.items?.length && <tr><td colSpan={5}>{t("No prices configured.")}</td></tr>}</tbody>
  </table></div></section>
 </section>;
}
