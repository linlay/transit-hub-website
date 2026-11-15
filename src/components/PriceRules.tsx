import { ManagementField as Field } from "./ManagementDialog";
import { useI18n } from "../lib/i18n";
import { billingObject, priceDraft, type PriceDraft } from "../lib/finance";
import { type Row } from "../lib/enterprise";
export function BillingModeSelect({value,onChange}:{value:string;onChange:(value:PriceDraft["mode"])=>void}) {
 const {t}=useI18n();return <Field label={t("Billing mode")}><select value={value} onChange={e=>onChange(e.target.value as PriceDraft["mode"])}>{[["tokens","Per token"],["image","Per image"],["characters","Per character"],["free","Free"]].map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></Field>;
}
export function PriceRuleFields({value,onChange,unit}:{value:PriceDraft;onChange:(value:PriceDraft)=>void;unit:string}) {
 const {t}=useI18n();
 const money=(label:string,key:"input"|"output"|"cacheHit"|"cacheWrite"|"characters",optional=false)=><Field label={`${t(label)} · ${unit}`}><input value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})} inputMode="decimal" type="number" min={key==="characters"?"0.000001":"0"} step="0.000001" required={!optional} placeholder={optional?t("Use input price"):undefined}/></Field>;
 return <>
  {value.mode==="tokens"&&<><div className="enterprise-grid">{money("Input price / 1M tokens","input")}{money("Output price / 1M tokens","output")}{money("Cache hit price / 1M tokens","cacheHit",true)}{money("Cache write price / 1M tokens","cacheWrite",true)}</div>
   <details open={value.tiers.length>0}><summary>{t("Context pricing tiers")} ({value.tiers.length})</summary><p className="finance-note">{t("Each tier applies when input tokens exceed its threshold.")}</p>{value.tiers.map((tier,index)=><fieldset className="price-rule-editor" key={index}><legend>{t("Tier {number}",{number:index+1})}</legend><div className="enterprise-grid">{[["threshold","Input token threshold"],["input","Input price / 1M tokens"],["output","Output price / 1M tokens"],["cacheHit","Cache hit price / 1M tokens"]].map(([key,label])=><Field key={key} label={`${t(label)} · ${index+1}${key==="threshold"?"":` · ${unit}`}`}><input type="number" min={key==="threshold"?1:0} step={key==="threshold"?1:"0.000001"} required={key!=="cacheHit"} value={tier[key as keyof typeof tier]} placeholder={key==="cacheHit"?t("Use tier input price"):undefined} onChange={e=>onChange({...value,tiers:value.tiers.map((row,i)=>i===index?{...row,[key]:e.target.value}:row)})}/></Field>)}</div><button type="button" onClick={()=>onChange({...value,tiers:value.tiers.filter((_,i)=>i!==index)})}>{t("Remove tier")}</button></fieldset>)}<button type="button" onClick={()=>onChange({...value,tiers:[...value.tiers,{threshold:"",input:"",output:"",cacheHit:""}]})}>{t("Add tier")}</button></details>
  </>}
  {value.mode==="characters"&&money("Price / 10K characters","characters")}
  {value.mode==="image"&&<><p className="finance-note">{t("Empty size or quality matches any value. Specific rules take priority.")}</p>{value.images.map((rule,index)=><fieldset className="price-rule-editor" key={index}><legend>{t("Image rule {number}",{number:index+1})}</legend><div className="enterprise-grid">{[["size","Size"],["quality","Quality"],["amount","Price per image"]].map(([key,label])=><Field key={key} label={`${t(label)} · ${index+1}${key==="amount"?` · ${unit}`:""}`}><input value={rule[key as keyof typeof rule]} type={key==="amount"?"number":"text"} min="0.000001" step="0.000001" required={key==="amount"} placeholder={key==="amount"?undefined:t("Any")} onChange={e=>onChange({...value,images:value.images.map((row,i)=>i===index?{...row,[key]:e.target.value}:row)})}/></Field>)}</div><button type="button" disabled={value.images.length<=1} onClick={()=>onChange({...value,images:value.images.filter((_,i)=>i!==index)})}>{t("Remove rule")}</button></fieldset>)}<button type="button" onClick={()=>onChange({...value,images:[...value.images,{size:"",quality:"",amount:""}]})}>{t("Add price rule")}</button></>}
  {value.mode==="free"&&<p className="finance-note">{t("Requests using this price are free of charge.")}</p>}
 </>;
}
export function PriceRuleSummary({price,upstream=false,compact=false}:{price:Row;upstream?:boolean;compact?:boolean}) {
 const {t}=useI18n();const billing=billingObject(price.billing);
 if(!billing)return <span className="error-text">{t("Price data unavailable")}</span>;
 if(upstream&&price.pricing_kind==="plan")return <div className="price-rule-summary"><span>{t("Subscription plan (costs are not allocated)")}</span><small>{String(price.currency)}</small></div>;
 const draft=priceDraft(price,upstream),unit=upstream?String(price.currency):"Credits";
 const amount=(value:string)=>value||"0";
 if(draft.mode==="free")return <span className="pill good">{t("Free")}</span>;
 if(draft.mode==="characters")return <span>{amount(draft.characters)} {unit} / {t("10K characters")}</span>;
 if(draft.mode==="image")return <div className="price-rule-summary">{(compact?draft.images.slice(0,1):draft.images).map((rule,index)=><div key={index}><span>{rule.size||t("Any size")} · {rule.quality||t("Any quality")}</span><strong>{rule.amount} {unit} / {t("image")}</strong></div>)}{compact&&draft.images.length>1&&<small>{t("{count} image rules",{count:draft.images.length})}</small>}</div>;
 return <div className="price-rule-summary"><div><span>{t("Input / output per 1M")}</span><strong>{amount(draft.input)} / {amount(draft.output)} {unit}</strong></div>{!compact&&<div><span>{t("Cache hit / write per 1M")}</span><strong>{draft.cacheHit||amount(draft.input)} / {draft.cacheWrite||amount(draft.input)} {unit}</strong></div>}{compact&&draft.tiers.length>0&&<small>{t("{count} context tiers",{count:draft.tiers.length})}</small>}{!compact&&draft.tiers.map((tier,index)=><div key={index}><span>{t("Input above {count} tokens",{count:tier.threshold})}</span><strong>{tier.input} / {tier.output} {unit}</strong><small>{t("Cache hit")}: {tier.cacheHit||tier.input} {unit}</small></div>)}</div>;
}
