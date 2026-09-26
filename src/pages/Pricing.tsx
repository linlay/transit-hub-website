import { QueryFeedback } from "../components/QueryFeedback";
import { useConfirm } from "../components/ConfirmProvider";
import { IconButton } from "../components/IconButton";
import { X, Save, Plus, Trash2, Pencil } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { api } from "../lib/api";
import { decimalToMicro, creditsInputValue, formatCredits } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { PAGE_REFETCH_INTERVAL_MS } from "../lib/query";
import type { ModelPrice, PriceBilling } from "../lib/types";

export function Pricing() {
 const { t } = useI18n();
 const confirm = useConfirm();
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
  setRules(price?.billing?.image_prices?.map(r=>({size:r.size,quality:r.quality,amount:creditsInputValue(r.charged_microcredits)})) ?? [{size:"",quality:"",amount:""}]);
 }
 function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();if(save.isPending)return;setError("");const form=new FormData(event.currentTarget);
  try {
   const optionalAmount=(name:string)=>String(form.get(name)??"").trim() ? decimalToMicro(form.get(name)) : null;
   const billing:PriceBilling={mode};
   if (mode === "tokens" && editing?.billing?.token_tiers) billing.token_tiers = editing.billing.token_tiers;
   if(mode==="tokens") {
    billing.cache_write_microcredits_per_1m_tokens=optionalAmount("cache_write");
   }
   if(mode==="image") billing.image_prices=rules.map(r=>({size:r.size.trim(),quality:r.quality.trim(),charged_microcredits:decimalToMicro(r.amount)}));
   save.mutate({protocol:String(form.get("protocol")),public_model:String(form.get("public_model")).trim(),unit:"CREDITS",billing,
    input_microcredits_per_1m_tokens:mode==="tokens"?decimalToMicro(form.get("input")):0,
    input_cache_hit_microcredits_per_1m_tokens:mode==="tokens"?optionalAmount("cache_hit"):null,
    output_microcredits_per_1m_tokens:mode==="tokens"?decimalToMicro(form.get("output")):0});
  }catch(err){setError(err instanceof Error?err.message:String(err));}
 }
 const amount=(value?:number|null)=>value==null?"":creditsInputValue(value);
 return <section className="page">
  <section className="panel">
   <p>{t("Prices are configured and charged directly in Credits.")}</p>
   {save.isSuccess && !error && <span className="saved-text" role="status">{t("Saved.")}</span>}
   {error && <p role="alert">{error}</p>}
   <form className="pricing-form" onChange={() => { if(save.isSuccess) save.reset(); }} key={revision} onSubmit={submit}>
    <div className="pricing-meta">
     <select name="protocol" defaultValue={editing?.protocol??"openai"} aria-label={t("Protocol")}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select>
     <input name="public_model" defaultValue={editing?.public_model} placeholder={t("Public model")} required readOnly={!!editing}/>
     <select value={mode} onChange={e=>setMode(e.target.value as PriceBilling["mode"])} aria-label={t("Billing mode")}>
      <option value="tokens">{t("Per token")}</option><option value="image">{t("Per image")}</option><option value="free">{t("Free")}</option>
     </select>
    </div>
    {mode==="tokens" && <div className="pricing-fields">
     <label>{t("Input Credits / 1M")}<input name="input" defaultValue={amount(editing?.input_microcredits_per_1m_tokens)} type="number" min="0" step="0.000001"/></label>
     <label>{t("Cache hit Credits / 1M")}<input name="cache_hit" defaultValue={amount(editing?.input_cache_hit_microcredits_per_1m_tokens)} placeholder={t("Use input price")} type="number" min="0" step="0.000001"/></label>
     <label>{t("Cache write Credits / 1M")}<input name="cache_write" defaultValue={amount(editing?.billing?.cache_write_microcredits_per_1m_tokens)} placeholder={t("Use input price")} type="number" min="0" step="0.000001"/></label>
     <label>{t("Output Credits / 1M")}<input name="output" defaultValue={amount(editing?.output_microcredits_per_1m_tokens)} type="number" min="0" step="0.000001"/></label>
    </div>}
    {mode==="image" && <div>
     <p>{t("Empty size or quality matches any value. Specific rules take priority.")}</p>
     {rules.map((rule,index)=><div className="pricing-image-rule" key={index}>
      <input aria-label={t("Size")} placeholder={t("Size")} value={rule.size} onChange={e=>setRules(rows=>rows.map((r,i)=>i===index?{...r,size:e.target.value}:r))}/>
      <input aria-label={t("Quality")} placeholder={t("Quality")} value={rule.quality} onChange={e=>setRules(rows=>rows.map((r,i)=>i===index?{...r,quality:e.target.value}:r))}/>
      <input aria-label={t("Credits per image")} placeholder={t("Credits per image")} value={rule.amount} type="number" min="0.000001" step="0.000001" required onChange={e=>setRules(rows=>rows.map((r,i)=>i===index?{...r,amount:e.target.value}:r))}/>
      <IconButton label={t("Remove")} type="button" disabled={rules.length===1} onClick={()=>setRules(rows=>rows.filter((_,i)=>i!==index))}><Trash2 size={16} /></IconButton>
     </div>)}
     <IconButton label={t("Add price rule")} type="button" onClick={()=>setRules(rows=>[...rows,{size:"",quality:"",amount:""}])}><Plus size={16} /></IconButton>
    </div>}
    <div className="pricing-meta"><IconButton label={t("Save")} className="primary" type="submit" disabled={save.isPending}><Save size={16}/></IconButton>{editing && <IconButton label={t("Cancel")} type="button" onClick={()=>{save.reset();select();}}><X size={16} /></IconButton>}</div>
   </form>
  </section>
  <section className="panel"><QueryFeedback query={prices} /><div className="table-wrap data-table-scroll"><table>
   <thead><tr><th>{t("Protocol")}</th><th>{t("Model")}</th><th>{t("Billing mode")}</th><th>{t("Price")}</th><th/></tr></thead>
   <tbody>{(prices.data?.items??[]).map(price=><tr key={price.id}>
    <td>{price.protocol}</td><td>{price.public_model}</td><td>{t(price.billing?.mode==="free"?"Free":price.billing?.mode==="image"?"Per image":"Per token")}</td>
    <td>{price.billing?.mode==="image" ? price.billing.image_prices?.map((r,i)=><div key={i}>{r.size||"*"} / {r.quality||"*"}: {formatCredits(r.charged_microcredits)}</div>) : price.billing?.mode==="free" ? formatCredits(0) : <>
     <div>{t("Input / output per 1M")}: {formatCredits(price.input_microcredits_per_1m_tokens)} / {formatCredits(price.output_microcredits_per_1m_tokens)}</div>
     {price.billing?.token_tiers?.map(tier => <div key={tier.above_input_tokens}>输入 &gt; {tier.above_input_tokens.toLocaleString()} tokens：{formatCredits(tier.input_microcredits_per_1m_tokens)} / {formatCredits(tier.output_microcredits_per_1m_tokens)}（输入 / 输出，每百万 tokens）</div>)}
     <div>{t("Cache hit / write per 1M")}: {formatCredits(price.input_cache_hit_microcredits_per_1m_tokens??price.input_microcredits_per_1m_tokens)} / {formatCredits(price.billing?.cache_write_microcredits_per_1m_tokens??price.input_microcredits_per_1m_tokens)}</div>
    </>}</td>
    <td><IconButton label={t("Edit")} className="icon-button" onClick={()=>{save.reset();select(price);}}><Pencil size={16}/></IconButton><IconButton label={t("Delete")} className="icon-button danger" disabled={remove.isPending} onClick={()=>confirm({ message:t("Delete {name}?", { name:price.public_model }), label:t("Delete"), action:()=>remove.mutateAsync(price.id) })}><Trash2 size={16}/></IconButton></td>
   </tr>)}{!prices.data?.items?.length && <tr><td colSpan={5}>{prices.isPending ? t("Loading...") : prices.isError ? t("Unable to load data.") : t("No prices configured.")}</td></tr>}</tbody>
  </table></div></section>
 </section>;
}
