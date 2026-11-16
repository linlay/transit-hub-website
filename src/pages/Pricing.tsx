import { Select } from "../components/ThemedControls";
import { usePageActions } from "../components/Layout";
import { RefreshButton } from "../components/RefreshButton";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { enterpriseRequest as request, type Row } from "../lib/enterprise";
import { billingObject, priceDraft, pricePayload, type PriceDraft } from "../lib/finance";
import { enterpriseValueLabel } from "../lib/enterprise-labels";
import { dateTime } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { ManagementDialog, ManagementField as Field } from "../components/ManagementDialog";
import { BillingModeSelect, PriceRuleFields, PriceRuleSummary } from "../components/PriceRules";
import { QueryFeedback } from "../components/QueryFeedback";
import { ResponsiveFilters } from "../components/ResponsiveFilters";
import { useConfirm } from "../components/ConfirmProvider";

type Dialog = {kind:"edit"|"details"|"history";price?:Row};
export function Pricing() {
 const {t}=useI18n();const confirm=useConfirm();const client=useQueryClient();
 const prices=useQuery({queryKey:["prices"],queryFn:api.prices});
 const [query,setQuery]=useState("");const [protocol,setProtocol]=useState("");const [mode,setMode]=useState("");const [dialog,setDialog]=useState<Dialog|null>(null);
 const remove=useMutation({mutationFn:api.deletePrice,onSuccess:()=>client.invalidateQueries({queryKey:["prices"]})});
 const all=(prices.data?.items??[]) as unknown as Row[];
 const rows=all.filter(row=>(!protocol||row.protocol===protocol)&&(!mode||(billingObject(row.billing)?.mode??"tokens")===mode)&&`${row.public_model} ${row.protocol}`.toLowerCase().includes(query.toLowerCase()));
 const reset=()=>{setProtocol("");setMode("");setQuery("");};
 usePageActions(<><RefreshButton isRefreshing={prices.isFetching} onClick={()=>prices.refetch()} /><button className="primary" onClick={()=>setDialog({kind:"edit"})}>{t("Add price")}</button></>, [t, prices.isFetching, prices.refetch]);
 return <section className="page list-page enterprise-page finance-page"><section className="panel">
  <p className="page-description">{t("Model usage is charged in Credits. Changes apply to new requests.")}</p>
  <div className="finance-toolbar"><Field label={t("Search models")}><input placeholder={t("Search models")} value={query} onChange={e=>setQuery(e.target.value)}/></Field><ResponsiveFilters count={Number(!!protocol)+Number(!!mode)} onReset={reset}><Field label={t("Protocol")}><Select value={protocol} onChange={e=>setProtocol(e.target.value)}><option value="">{t("All protocols")}</option>{[...new Set(all.map(row=>String(row.protocol)))].sort().map(value=><option key={value}>{value}</option>)}</Select></Field><Field label={t("Billing mode")}><Select value={mode} onChange={e=>setMode(e.target.value)}><option value="">{t("All billing modes")}</option>{["tokens","image","characters","free"].map(value=><option key={value} value={value}>{t(enterpriseValueLabel(value))}</option>)}</Select></Field></ResponsiveFilters><span className="results-count">{t("{count} prices",{count:rows.length})}</span></div>
  <QueryFeedback query={prices}/>{remove.error&&<p className="error-text" role="alert">{remove.error.message}</p>}
  <div className="table-wrap"><table><thead><tr><th>{t("Model")}</th><th>{t("Billing mode")}</th><th>{t("Current price")}</th><th>{t("Updated")}</th><th className="actions-cell">{t("Actions")}</th></tr></thead><tbody>{rows.map(price=><tr key={String(price.id)}><td><button className="table-link" onClick={()=>setDialog({kind:"details",price})}>{String(price.public_model)}</button><small>{String(price.protocol)}</small></td><td>{t(enterpriseValueLabel(billingObject(price.billing)?.mode??"tokens"))}</td><td><PriceRuleSummary price={price} compact/></td><td>{dateTime(String(price.updated_at))}</td><td><div className="table-actions"><button onClick={()=>setDialog({kind:"edit",price})}>{t("Edit price")}</button><button onClick={()=>setDialog({kind:"history",price})}>{t("Version history")}</button><button className="danger" disabled={remove.isPending} onClick={()=>confirm({message:t("Remove the price for {model}? New requests will have no configured price.",{model:String(price.public_model)}),label:t("Delete"),action:()=>remove.mutateAsync(String(price.id))})}>{t("Delete")}</button></div></td></tr>)}{!rows.length&&!prices.isFetching&&<tr><td colSpan={5} className="muted-cell">{t(all.length?"No prices match the current filters.":"No prices configured.")}</td></tr>}</tbody></table></div>
 </section>
 {dialog?.kind==="edit"&&<ModelPriceEditor key={String(dialog.price?.id??"new")} price={dialog.price} existing={all} onClose={()=>setDialog(null)}/>}
 {dialog?.kind==="history"&&dialog.price&&<PriceHistory price={dialog.price} onClose={()=>setDialog(null)}/>}
 {dialog?.kind==="details"&&dialog.price&&<ManagementDialog title={`${t("Price details")} · ${dialog.price.public_model}`} onClose={()=>setDialog(null)} showCloseAction={false}><p className="finance-note">{String(dialog.price.protocol)} · Credits</p><PriceRuleSummary price={dialog.price}/><div className="dialog-actions"><button onClick={()=>setDialog({kind:"history",price:dialog.price})}>{t("Version history")}</button><button className="primary" onClick={()=>setDialog({kind:"edit",price:dialog.price})}>{t("Edit price")}</button></div></ManagementDialog>}
 </section>;
}
function ModelPriceEditor({price,existing,onClose}:{price?:Row;existing:Row[];onClose:()=>void}) {
 const {t}=useI18n();const client=useQueryClient();const models=useQuery({queryKey:["models"],queryFn:api.models});
 const [protocol,setProtocol]=useState(String(price?.protocol??"openai"));const [model,setModel]=useState(String(price?.public_model??""));const [draft,setDraft]=useState<PriceDraft>(()=>priceDraft(price));const [error,setError]=useState("");
 const save=useMutation({mutationFn:(body:Row)=>request(price?`/admin/model-prices/${encodeURIComponent(String(price.id))}`:"/admin/model-prices",price?"PATCH":"POST",body),onSuccess:()=>{void client.invalidateQueries({queryKey:["prices"]});void client.invalidateQueries({queryKey:["price-versions"]});onClose();}});
 function submit(event:FormEvent){event.preventDefault();if(save.isPending)return;try{if(!price&&existing.some(row=>row.protocol===protocol&&row.public_model===model.trim()))throw new Error(t("This model already has a price. Edit the existing price instead."));save.mutate({protocol,public_model:model.trim(),unit:"CREDITS",...pricePayload(draft)});setError("");}catch(e){setError(t(e instanceof Error?e.message:String(e)));}}
 return <ManagementDialog title={t(price?"Edit price":"Add price")} onClose={onClose} busy={save.isPending} showCloseAction={false}><form onSubmit={submit}><p className="finance-note">{t("Saving creates a price version and takes effect immediately. Historical charges remain unchanged.")}</p><div className="enterprise-grid"><Field label={t("Protocol")}><Select disabled={!!price} value={protocol} onChange={e=>setProtocol(e.target.value)}>{["openai","anthropic","dashscope_tts","minimax_tts"].map(value=><option key={value}>{value}</option>)}</Select></Field><Field label={t("Public model")}><input required readOnly={!!price} value={model} onChange={e=>setModel(e.target.value)} list="price-model-options"/></Field><datalist id="price-model-options">{models.data?.items.filter(row=>row.protocol===protocol).map(row=><option key={row.public_model} value={row.public_model}>{row.display_name}</option>)}</datalist><BillingModeSelect value={draft.mode} onChange={mode=>setDraft({...draft,mode,images:mode==="image"&&!draft.images.length?[{size:"",quality:"",amount:""}]:draft.images})}/></div><PriceRuleFields value={draft} onChange={setDraft} unit="Credits"/>{(error||save.error)&&<p className="error-text" role="alert">{error||save.error?.message}</p>}<div className="dialog-actions"><button type="button" disabled={save.isPending} onClick={onClose}>{t("Cancel")}</button><button className="primary" type="submit" disabled={save.isPending||!model.trim()||!!price&&!billingObject(price.billing)}>{t(save.isPending?"Processing...":"Save price")}</button></div></form></ManagementDialog>;
}
function PriceHistory({price,onClose}:{price:Row;onClose:()=>void}) {
 const {t}=useI18n();const history=useQuery({queryKey:["price-versions",price.id],queryFn:()=>request<{items:Row[]}>(`/admin/model-prices/${encodeURIComponent(String(price.id))}/versions`)});
 return <ManagementDialog title={`${t("Price version history")} · ${price.public_model}`} onClose={onClose}><QueryFeedback query={history}/><div className="table-wrap"><table><thead><tr><th>{t("Time")}</th><th>{t("Price")}</th><th>{t("Actor")}</th><th>{t("Version")}</th></tr></thead><tbody>{history.data?.items.map(version=><tr key={String(version.id)}><td>{dateTime(String(version.created_at))}</td><td><PriceRuleSummary price={version}/></td><td>{String(version.created_by??"—")}</td><td><code className="finance-version" title={String(version.id)}>{String(version.id)}</code></td></tr>)}{!history.isFetching&&!history.data?.items.length&&<tr><td colSpan={4}>{t("No price history yet.")}</td></tr>}</tbody></table></div></ManagementDialog>;
}
