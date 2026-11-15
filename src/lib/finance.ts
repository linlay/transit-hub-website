import { credits, microcredits, type Row } from "./enterprise";
export type BillingMode = "tokens" | "image" | "characters" | "free";
export type PriceDraft = {
 mode: BillingMode; input: string; output: string; cacheHit: string; cacheWrite: string; characters: string;
 images: { size: string; quality: string; amount: string }[];
 tiers: { threshold: string; input: string; output: string; cacheHit: string }[];
};
export function billingObject(value: unknown): Row | null {
 try { const data=typeof value === "string" ? JSON.parse(value) : value; return data && typeof data === "object" && !Array.isArray(data) ? data as Row : null; } catch { return null; }
}
export function amountInput(value: unknown): string { return value == null ? "" : credits(value).replace("−", "-").replace(/\.0$/, ""); }
export function priceDraft(price?: Row, upstream=false): PriceDraft {
 const billing=billingObject(price?.billing) ?? {};
 return { mode: (billing.mode ?? "tokens") as BillingMode,
 input:amountInput(upstream?billing.input_micros_per_1m:price?.input_microcredits_per_1m_tokens ?? price?.input_microcredits_per_1m),
 output:amountInput(upstream?billing.output_micros_per_1m:price?.output_microcredits_per_1m_tokens ?? price?.output_microcredits_per_1m),
 cacheHit:amountInput(upstream?billing.cache_hit_micros_per_1m:price?.input_cache_hit_microcredits_per_1m_tokens ?? price?.input_cache_hit_microcredits_per_1m),
 cacheWrite:amountInput(billing.cache_write_microcredits_per_1m_tokens),characters:amountInput(billing.microcredits_per_10k_characters),
 images:((billing.image_prices as Row[]|undefined)??[]).map(row=>({size:String(row.size??""),quality:String(row.quality??""),amount:amountInput(row.charged_microcredits)})),
 tiers:((billing.token_tiers as Row[]|undefined)??[]).map(row=>({threshold:String(row.above_input_tokens),input:amountInput(row.input_microcredits_per_1m_tokens),output:amountInput(row.output_microcredits_per_1m_tokens),cacheHit:amountInput(row.input_cache_hit_microcredits_per_1m_tokens)})) };
}
function positiveAmount(value:string, positive=false) { if (!value.trim()) throw new Error("A price is required"); const result=microcredits(value.trim());if(BigInt(result)<0n||(positive&&BigInt(result)===0n))throw new Error("Price must be positive");if(BigInt(result)>9223372036854775807n)throw new Error("Amount is too large");return result; }
export function pricePayload(draft: PriceDraft, upstream=false): Row {
 const billing:Row={mode:draft.mode};let input="0",output="0",hit:string|null=null;
 if(draft.mode==="tokens"){
  input=positiveAmount(draft.input);output=positiveAmount(draft.output);hit=draft.cacheHit.trim()?positiveAmount(draft.cacheHit):null;
  billing.cache_write_microcredits_per_1m_tokens=draft.cacheWrite.trim()?positiveAmount(draft.cacheWrite):null;
  const thresholds=new Set<number>();billing.token_tiers=draft.tiers.map(tier=>{const threshold=Number(tier.threshold);if(!Number.isSafeInteger(threshold)||threshold<1||thresholds.has(threshold))throw new Error("Tier thresholds must be unique positive integers");thresholds.add(threshold);return {above_input_tokens:threshold,input_microcredits_per_1m_tokens:positiveAmount(tier.input),output_microcredits_per_1m_tokens:positiveAmount(tier.output),input_cache_hit_microcredits_per_1m_tokens:tier.cacheHit.trim()?positiveAmount(tier.cacheHit):null};}).sort((a,b)=>a.above_input_tokens-b.above_input_tokens);
 }
 if(draft.mode==="characters")billing.microcredits_per_10k_characters=positiveAmount(draft.characters,true);
 if(draft.mode==="image"){
  if(!draft.images.length)throw new Error("At least one image rule is required");
  billing.image_prices=draft.images.map(rule=>({size:rule.size.trim(),quality:rule.quality.trim(),charged_microcredits:positiveAmount(rule.amount,true)}));
 }
 if(upstream)return {...billing,input_micros_per_1m:input,output_micros_per_1m:output,cache_hit_micros_per_1m:hit};
 return {billing,input_microcredits_per_1m_tokens:input,output_microcredits_per_1m_tokens:output,input_cache_hit_microcredits_per_1m_tokens:hit};
}
export function sumAmounts(rows:Row[],field:string):bigint { return rows.reduce((sum,row)=>sum+BigInt(String(row[field]??"0")),0n); }
export function currencyTotals(rows:Row[]):[string,bigint][] {
 const sums=new Map<string,bigint>();for(const row of rows){const currency=String(row.upstream_currency??"");if(currency&&row.upstream_cost_micros!=null)sums.set(currency,(sums.get(currency)??0n)+BigInt(String(row.upstream_cost_micros)));}return [...sums].sort(([a],[b])=>a.localeCompare(b));
}
export function localDay(date=new Date()):string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export function nextDay(value:string):string { const day=new Date(value+"T12:00:00");day.setDate(day.getDate()+1);return localDay(day); }
