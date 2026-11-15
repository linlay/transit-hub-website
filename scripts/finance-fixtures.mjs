// Synthetic billing data shared by UI regression tests and the local preview.
export const financePrices = [
 {id:'price_token',protocol:'openai',public_model:'demo-model',unit:'CREDITS',input_microcredits_per_1m_tokens:'2500000',input_cache_hit_microcredits_per_1m_tokens:'250000',output_microcredits_per_1m_tokens:'10000000',billing:{mode:'tokens',cache_write_microcredits_per_1m_tokens:'3125000',token_tiers:[{above_input_tokens:200000,input_microcredits_per_1m_tokens:'5000000',output_microcredits_per_1m_tokens:'15000000'}]},created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-14T06:00:00Z'},
 {id:'price_tts',protocol:'minimax_tts',public_model:'speech-demo',unit:'CREDITS',input_microcredits_per_1m_tokens:'0',input_cache_hit_microcredits_per_1m_tokens:null,output_microcredits_per_1m_tokens:'0',billing:{mode:'characters',microcredits_per_10k_characters:'1200000'},created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-12T06:00:00Z'},
 {id:'price_image',protocol:'openai',public_model:'image-demo',unit:'CREDITS',input_microcredits_per_1m_tokens:'0',input_cache_hit_microcredits_per_1m_tokens:null,output_microcredits_per_1m_tokens:'0',billing:{mode:'image',image_prices:[{size:'1024x1024',quality:'standard',charged_microcredits:'40000'},{size:'',quality:'',charged_microcredits:'80000'}]},created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-13T06:00:00Z'},
 {id:'price_free',protocol:'openai',public_model:'embedding-demo',unit:'CREDITS',input_microcredits_per_1m_tokens:'0',input_cache_hit_microcredits_per_1m_tokens:null,output_microcredits_per_1m_tokens:'0',billing:{mode:'free'},created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T06:00:00Z'},
];
export const financeUpstream = [
 {id:'up_current',provider:'demo',upstream_model:'upstream-demo',currency:'USD',pricing_kind:'metered',effective_from:'2026-11-14T00:00:00Z',created_by:'reviewer',billing:JSON.stringify({mode:'tokens',input_micros_per_1m:'1500000',output_micros_per_1m:'6000000',cache_hit_micros_per_1m:'150000',cache_write_microcredits_per_1m_tokens:'1800000'})},
 {id:'up_old',provider:'demo',upstream_model:'upstream-demo',currency:'USD',pricing_kind:'metered',effective_from:'2026-11-01T00:00:00Z',created_by:'reviewer',billing:JSON.stringify({mode:'tokens',input_micros_per_1m:'2000000',output_micros_per_1m:'8000000'})},
 {id:'up_tts',provider:'demo',upstream_model:'speech-upstream',currency:'CNY',pricing_kind:'metered',effective_from:'2026-11-01T00:00:00Z',billing:JSON.stringify({mode:'characters',microcredits_per_10k_characters:'800000'})},
 {id:'up_plan',provider:'demo-alt',upstream_model:'plan-model',currency:'CNY',pricing_kind:'plan',effective_from:'2026-11-01T00:00:00Z',billing:JSON.stringify({mode:'tokens',input_micros_per_1m:'0',output_micros_per_1m:'0'})},
];
export const financeEntries = [
 {id:101,started_at:'2026-11-14T06:10:00Z',day:'2026-11-14',entry_type:'usage',entry_label:'用量',principal_id:'key_demo',principal_name:'演示员工',public_model:'demo-model',provider:'demo',virtual_org_id:'vo_demo',budget_owner_type:'virtual_org',budget_owner_id:'vo_demo',request_tokens:100000,response_tokens:20000,requests:1,tokens:120000,charged_microcredits:'450000',upstream_currency:'USD',upstream_cost_micros:'270000',billing_status:'charged',price_version_id:'price_version_demo',gateway_request_id:'thr_demo_101',department_path:'/示例公司/研发部/平台组'},
 {id:102,started_at:'2026-11-14T07:10:00Z',day:'2026-11-14',entry_type:'usage',entry_label:'用量',principal_id:'key_demo',principal_name:'演示员工',public_model:'speech-demo',provider:'demo',virtual_org_id:'vo_demo',budget_owner_type:'virtual_org',budget_owner_id:'vo_demo',characters:10000,requests:1,tokens:0,charged_microcredits:'1200000',upstream_currency:'CNY',upstream_cost_micros:'800000',billing_status:'charged',department_path:'/示例公司/研发部/平台组'},
 {id:103,started_at:'2026-11-15T01:00:00Z',day:'2026-11-15',entry_type:'adjustment',entry_label:'报表调整',principal_id:'key_demo',principal_name:'演示员工',public_model:'',provider:'',virtual_org_id:'vo_demo',budget_owner_type:'virtual_org',budget_owner_id:'vo_demo',requests:0,tokens:0,charged_microcredits:'-50000',upstream_currency:'',upstream_cost_micros:null,billing_status:'adjustment',adjusts_entry_id:101,reason:'演示报表更正',created_by:'reviewer'},
];
export function financeFixture(url) {
 const p=url.pathname;
 if(p==='/admin/model-prices')return {items:financePrices};
 if(p.endsWith('/versions')&&p.startsWith('/admin/model-prices/'))return {items:[{id:'version_demo',price_id:'price_token',protocol:'openai',public_model:'demo-model',input_microcredits_per_1m:'2500000',input_cache_hit_microcredits_per_1m:'250000',output_microcredits_per_1m:'10000000',billing:JSON.stringify(financePrices[0].billing),created_at:'2026-11-14T06:00:00Z',created_by:'reviewer'}]};
 if(p==='/admin/upstream-prices')return {items:financeUpstream};
 if(p==='/admin/ledger/reconcile')return {balanced:false,differences:[{principal_id:'key_demo',request_difference:0,token_difference:0,difference_microcredits:'25000'}]};
 if(p==='/admin/api-keys')return {items:[{id:'key_demo',name:'演示员工',source:'employee',status:'active'}]};
 if(p==='/admin/ledger/entries'||p==='/admin/ledger/summary'){
  const detail=p.endsWith('/entries');
  let rows=financeEntries.filter(row=>(!url.searchParams.get('principal_id')||row.principal_id===url.searchParams.get('principal_id'))&&(!url.searchParams.get('org_id')||row.virtual_org_id===url.searchParams.get('org_id'))&&(!url.searchParams.get('department_path_prefix')||String(row.department_path??'').startsWith(url.searchParams.get('department_path_prefix')))&&(!url.searchParams.get('from')||(detail?row.started_at:row.day)>=url.searchParams.get('from'))&&(!url.searchParams.get('to')||(detail?row.started_at:row.day)<url.searchParams.get('to')));
  if(!detail){
   const fields={day:['day'],principal:['principal_id'],provider:['provider'],model:['public_model'],owner:['budget_owner_type','budget_owner_id'],department:['department_id','department_path'],entry_type:['entry_type']};
   const selected=[...(fields[url.searchParams.get('group_by')]??fields.day),'upstream_currency','entry_type'];const groups=new Map();
   for(const row of rows){const id=JSON.stringify(selected.map(key=>row[key]??''));let group=groups.get(id);if(!group){group={...Object.fromEntries(selected.map(key=>[key,row[key]??''])),entry_label:row.entry_label,requests:0,tokens:0,charged_microcredits:'0',upstream_cost_micros:'0',unknown_cost_requests:0};groups.set(id,group);}group.requests+=row.requests??0;group.tokens+=row.tokens??0;group.charged_microcredits=String(BigInt(group.charged_microcredits)+BigInt(row.charged_microcredits));group.upstream_cost_micros=String(BigInt(group.upstream_cost_micros)+BigInt(row.upstream_cost_micros??0));}
   rows=[...groups.values()].sort((a,b)=>Number(BigInt(b.charged_microcredits)-BigInt(a.charged_microcredits)));
  }else rows=[...rows].sort((a,b)=>b.id-a.id);
  const offset=Number(url.searchParams.get('offset'))||0,limit=Number(url.searchParams.get('limit'))||100;
  return {items:rows.slice(offset,offset+limit)};
 }
 return undefined;
}
