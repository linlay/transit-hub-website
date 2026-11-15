// Local synthetic preview. It never forwards requests to a gateway.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrationFixture,integrationTokens,auditRecords,syntheticToken,traceLogs } from './integration-fixtures.mjs';
import { financeFixture, financePrices, financeUpstream, financeEntries } from './finance-fixtures.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const org={id:'vo_demo',code:'platform',name:'平台研发组',status:'active',org_type:'project'};
const histories=new Map();
const employee={issuer:'test',subject_claim:'sub',subject:'staff-01',principal_id:'key_demo',name:'演示员工',department_id:'team',department_path:'/示例公司/研发部/平台组',status:'active'};
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/admin/')){
  let data=integrationFixture(url)??financeFixture(url)??{items:[]};
  if(url.pathname.startsWith('/admin/requests/')){const id=decodeURIComponent(url.pathname.split('/').at(-1));if(!traceLogs.some(row=>row.gateway_request_id===id)&&!['up_demo_1','up_demo_2'].includes(id)){res.writeHead(404,{'Content-Type':'application/json'}).end(JSON.stringify({error:'request not found'}));return;}}
  if(url.pathname==='/admin/auth/me')data={user:{id:'preview',username:'reviewer',status:'active',role:'super_admin'},role:'super_admin',managed_orgs:['vo_demo']};
  if(url.pathname==='/admin/virtual-orgs')data={items:[org]};
  if(url.pathname==='/admin/employees')data={items:[employee]};
  if(url.pathname.endsWith('/members'))data={items:[{...employee,source:'employee'}]};
  if(url.pathname==='/admin/departments')data={items:[{id:'team',parent_id:'',name:'平台组',path:'/示例公司/研发部/平台组'}]};
  if(url.pathname==='/admin/providers')data={providers:[{name:'demo',protocol:'openai',base_url:'https://example.invalid',default_pool:'primary',models:[{public:'demo-model',upstream:'upstream-demo',pool:'primary'},{public:'speech-demo',upstream:'speech-upstream',pool:'primary'}],pools:[]},{name:'demo-alt',protocol:'openai',base_url:'https://example.invalid',models:[{public:'plan-model',upstream:'plan-model',pool:'primary'}],pools:[]}]};
  if(url.pathname==='/admin/models')data={items:[{protocol:'openai',public_model:'demo-model',display_name:'演示模型',provider:'demo',upstream_model:'upstream-demo',type:'chat'},{protocol:'minimax_tts',public_model:'speech-demo',display_name:'演示语音模型',provider:'demo',upstream_model:'speech-upstream',type:'tts'}]};
  if(url.pathname.startsWith('/admin/model-prices/')&&url.pathname.endsWith('/versions')){const id=url.pathname.split('/')[3];if(histories.has(id))data={items:histories.get(id)};}
  if(req.method!=='GET'){
   let raw='';for await(const chunk of req)raw+=chunk;let body={};try{body=JSON.parse(raw)}catch{}
   data={...body,id:'preview-result',applied:body.dry_run===false,preview:{after:body},audit_id:1};
   if(url.pathname==='/admin/mcp-tokens'&&req.method==='POST'){
    const record={id:'mcp_'+Date.now(),name:body.name,scopes:body.scopes,token_prefix:'thmcp_DEMO_ONLY',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+Number(body.ttl_days||90)*86400000).toISOString(),last_used_at:null,revoked_at:null};integrationTokens.unshift(record);data={token:syntheticToken,record};res.setHeader('Cache-Control','no-store');
   }
   if(url.pathname.startsWith('/admin/mcp-tokens/')&&req.method==='DELETE'){const id=url.pathname.split('/').at(-1);const record=integrationTokens.find(row=>row.id===id);if(record)record.revoked_at=new Date().toISOString();data={revoked:true};}
   if(url.pathname.includes('/mcp-tokens'))auditRecords.unshift({id:Math.max(...auditRecords.map(row=>row.id))+1,at:new Date().toISOString(),actor_id:'preview',actor_name:'reviewer',actor_role:'super_admin',via:'console',action:req.method+' mcp-tokens',target_id:body.name||url.pathname.split('/').at(-1),org_id:'',result:'ok',reason:'',before_json:'null',after_json:JSON.stringify({status:200})});
   if(url.pathname.startsWith('/admin/model-prices')){
    const id=url.pathname.split('/')[3];const index=financePrices.findIndex(row=>row.id===id);
    if(req.method==='DELETE'){if(index>=0)financePrices.splice(index,1);data={status:'ok'};}
    else{const now=new Date().toISOString();const price={...(index>=0?financePrices[index]:{}),...body,id:id||'price_'+Date.now(),created_at:now,updated_at:now};if(index>=0)financePrices[index]=price;else financePrices.push(price);histories.set(price.id,[{...price,id:'version_'+Date.now(),created_at:now,created_by:'reviewer'},...(histories.get(price.id)??[])]);data=price;}
   }
   if(url.pathname==='/admin/upstream-prices'&&body.dry_run===false){financeUpstream.push({...body,id:'up_'+Date.now(),billing:JSON.stringify(body.billing),effective_from:body.effective_from||new Date().toISOString()});}
   if(url.pathname==='/admin/ledger/adjustments'&&body.dry_run===false){financeEntries.push({...body,id:Math.max(...financeEntries.map(row=>row.id))+1,started_at:new Date().toISOString(),day:new Date().toISOString().slice(0,10),entry_type:'adjustment',entry_label:'报表调整',principal_name:employee.name,requests:0,tokens:0,upstream_currency:'',upstream_cost_micros:null,billing_status:'adjustment',virtual_org_id:body.budget_owner_type==='virtual_org'?body.budget_owner_id:''});}
  }
  if(url.searchParams.get('format')==='csv'){
   const rows=data.items??[],columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];const cell=value=>{let text=String(value??'');if(/^[=+@-]/.test(text)&&!/^[-+]?\d+(\.\d+)?$/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
   res.setHeader('Content-Type','text/csv;charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="ledger-preview.csv"');res.end('\ufeff'+[columns.map(cell).join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n'));return;
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
 }
 const target=path.extname(url.pathname)?path.join(root,'dist',url.pathname):path.join(root,'dist/index.html');
 try{const body=await readFile(target);res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(body)}catch{res.writeHead(404).end()}
}).listen(4178,'127.0.0.1',()=>console.log('Synthetic preview: http://127.0.0.1:4178/pricing'));
