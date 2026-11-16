// Uses only synthetic HTTP responses. Never connects to a configured gateway.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { transformWithEsbuild } from 'vite';
import ts from 'typescript';
import { parse as parseYAML } from 'yaml';
import { checkCompactUI } from './compact-ui-check.mjs';
import { financeFixture } from './finance-fixtures.mjs';
import { integrationFixture, syntheticToken } from './integration-fixtures.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const translationSource=await readFile(path.join(root,'src/lib/enterprise-i18n.ts'),'utf8');
const translationModule=await transformWithEsbuild(translationSource,'enterprise-i18n.ts',{loader:'ts'});
const {enterpriseZhCN}=await import('data:text/javascript;base64,'+Buffer.from(translationModule.code).toString('base64'));
const integrationModule=await transformWithEsbuild(await readFile(path.join(root,'src/lib/integration.ts'),'utf8'),'integration.ts',{loader:'ts'});
const integrationValues=await import('data:text/javascript;base64,'+Buffer.from(integrationModule.code).toString('base64'));
assert.deepEqual(integrationValues.auditChanges('"default"','"custom"'),[{field:'value',before:'default',after:'custom'}]);
assert.deepEqual(integrationValues.auditChanges('{"name":"same","enabled":true}','{"name":"same","enabled":false}'),[{field:'enabled',before:true,after:false}]);
assert.equal(integrationValues.validDay('2026-02-31'),false);
assert.equal(integrationValues.tokenStatus({revoked_at:'2026-01-01',expires_at:'2026-01-02'}),'Revoked');

const baseSource=ts.createSourceFile('i18n.tsx',await readFile(path.join(root,'src/lib/i18n.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const baseTranslations={};
function readBase(node){if(ts.isVariableDeclaration(node)&&node.name.getText(baseSource)==='zhCN'){for(const property of node.initializer.properties)baseTranslations[property.name.text]=property.initializer.text;}ts.forEachChild(node,readBase)}readBase(baseSource);
const messages={...baseTranslations,...enterpriseZhCN};
const output=process.env.UI_SCREENSHOT_DIR || '/private/tmp/transit-hub-ui-review';
await mkdir(output,{recursive:true});
const org={id:'vo_demo',code:'platform',name:'平台研发组',org_type:'project',status:'active',revision:1,description:'',source_department_id:'',weekly_quota_microcredits:'1000000000',five_hour_quota_microcredits:'0',default_member_weekly_cap_microcredits:'100000000',default_member_five_hour_cap_microcredits:'0',models_mode:'member',allowed_models:[],alert_thresholds:[80,100],webhook_url:''};
const yaml='name: demo\nprotocol: openai\nbase_url: https://example.invalid\ndata_region: domestic\nmodels:\n  - public: demo-model\n    upstream: upstream-demo\npools:\n  - name: primary\n    accounts:\n      - name: main\n        api_key: "${secret:account/primary/main}"\n';
const model={protocol:'openai',public_model:'demo-model',display_name:'演示模型',type:'chat',enabled:true,provider:'demo',upstream_model:'upstream-demo',provider_base_url:'https://example.invalid',owned_by:'demo',created_at:'2026-11-11T00:00:00Z',default_pool:'primary',configured_pool:'primary',effective_pool:'primary',override_valid:true,gateway_path:'/v1/chat/completions',upstream_path:'/v1/chat/completions',upstream_url:'https://example.invalid/v1/chat/completions',candidates:[{provider:'demo',pool:'primary',upstream_model:'upstream-demo',priority:0,weight:1,data_region:'domestic',enabled_accounts:2,enabled:true}]};
const trafficBucket={bucket:'2026-11-15T00:00:00Z',requests:30,unique_api_keys:4,request_tokens:12000,response_tokens:8000,total_tokens:20000,cache_hit_tokens:3000,cache_miss_tokens:9000,cache_total_tokens:12000,cache_hit_rate:0.25,charged_microcredits:'2500000',error_requests:1,average_latency_ms:450,models:[{model:'demo-model',requests:30,total_tokens:20000}]};
const otherModel={...model,protocol:'anthropic',display_name:'备用模型',provider:'other-channel',candidates:[{...model.candidates[0],provider:'other-channel',upstream_model:'other-upstream'}]};
const modelRoute='/models/openai/demo-model/routing';
const employee={issuer:'test',subject_claim:'sub',subject:'staff-01',name:'演示员工',department_id:'team',department_path:'/示例公司/研发部/平台组',principal_id:'key_demo',virtual_org_id:'vo_demo',virtual_org_name:org.name,policy_mode:'default',status:'active'};
const personal={id:'key_demo',name:'演示员工',source:'employee',status:'active',quota_microcredits:'1000000000',used_microcredits:'1000',allowed_models:['*'],rate_limits:[]};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const target=path.extname(url.pathname)?path.join(root,'dist',url.pathname):path.join(root,'dist/index.html');
 try {const body=await readFile(target);res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(body)}catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=`http://127.0.0.1:${server.address().port}`;
let executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if(!executablePath && process.platform==='darwin') {const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';try{await access(chrome);executablePath=chrome}catch{}}
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
let checked=0;let latestPage;
try{
 for(const locale of ['zh-CN','en-US']) for(const role of ['super_admin','platform_admin','user']) {
  const msg=(key,values={})=>(locale==='zh-CN'?(messages[key]??key):key).replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??''));
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(locale=>{
   localStorage.setItem('transit-hub.locale',locale);
   // Keep dated fixtures and expiry states deterministic across future runs.
   const NativeDate=Date,instant=NativeDate.parse('2026-11-16T04:00:00Z');
   class FixtureDate extends NativeDate {constructor(...values){super(...(values.length?values:[instant]));}static now(){return instant;}}
   window.Date=FixtureDate;
  },locale);
  const errors=[];const writes=[];const reads=[];
  await context.route('**/admin/**',async route=>{
   const request=route.request(),url=new URL(request.url()),p=url.pathname;
   if(request.method()==='GET')reads.push({p,query:Object.fromEntries(url.searchParams)});
   let data={items:[]};
   if(p==='/admin/auth/me')data={user:{id:'usr_demo',username:'reviewer',role,status:'active'},role,managed_orgs:role==='user'?['vo_demo']:[],managed_principals:role==='user'?['key_demo']:[]};
   else if(p==='/admin/overview')data={total_requests:30,total_tokens:20000,total_microcredits:'2500000',active_devices:4,error_requests:1,api_keys:{total:5,active:4,disabled:1,deleted:0},recent_traffic:[trafficBucket],risk_keys:[]};
   else if(p==='/admin/traffic')data={items:[trafficBucket]};
   else if(p==='/admin/traffic/analytics')data={items:[trafficBucket],summary:trafficBucket,models:[],keys:[],options:{keys:[],models:[],providers:[]}};
   else if(p==='/admin/employee-auth')data={enabled:true,allowed_models:['*'],request_quota:0,token_quota:0,quota_microcredits:'0',rate_limits:[]};
   else if(p==='/admin/virtual-orgs')data={items:[org]};
   else if(p==='/admin/virtual-orgs/vo_demo')data=org;
   else if(p.endsWith('/members'))data={items:[{principal_id:'key_demo',name:'演示员工',source:'employee',weekly_cap_microcredits:null,five_hour_cap_microcredits:null}]};
   else if(p.endsWith('/admins'))data={items:[{name:'组织负责人',subject:'staff-01',appointed_at:'2026-11-11T00:00:00Z'}]};
   else if(p==='/admin/models')data={items:[model,otherModel]};
   else if(p==='/admin/models/detail')data=url.searchParams.get('protocol')==='anthropic'?otherModel:model;
   else if(p==='/admin/providers')data={providers:[{name:'demo',protocol:'openai',base_url:'https://example.invalid',default_pool:'primary',models:[{public:'demo-model',upstream:'upstream-demo',pool:'primary'}],pools:[{name:'primary',accounts:[{name:'main',weight:1,enabled:true,circuit:{state:'closed'}}]}]}]};
   else if(p==='/admin/departments')data={items:[{id:'company',parent_id:'',name:'示例公司',path:'/示例公司',employee_count:0},{id:'rd',parent_id:'company',name:'研发部',path:'/示例公司/研发部',employee_count:0},{id:'team',parent_id:'rd',name:'平台组',path:'/示例公司/研发部/平台组',employee_count:1}]};
   else if(p==='/admin/employees')data={items:!url.searchParams.get('department_id')||url.searchParams.get('department_id')==='team'?[employee]:[]};
   else if(p==='/admin/managed-people')data={items:[personal]};
   else if(p==='/admin/employees/staff-01')data={name:'演示员工',subject:'staff-01',department_path:'/研发部',principal_id:'key_demo',budget_checks:[{scope_type:'vo',window:'week',quota_microcredits:'1000000000',used_microcredits:'120000'}]};
   else if(p==='/admin/catalog')data={protocol:'openai',public_model:'demo-model',display_name:'演示模型',allowed_regions:['domestic'],retry_policy:{max_attempts:3,first_byte_timeout:'30s',max_elapsed:'90s'}};
   else if(p==='/admin/provider-configs')data={items:[{name:'demo',yaml,revision:1}],version:1};
   else if(p==='/admin/config-versions')data={items:[{id:1,created_at:'2026-11-11T00:00:00Z',reason:'首次导入'}]};
   else if(p==='/admin/users')data={items:[{id:'usr_demo',username:'manager',role:'user',managed_orgs:['vo_demo'],managed_principals:['key_demo'],status:'active',created_at:'2026-11-11T00:00:00Z',updated_at:'2026-11-11T00:00:00Z'}]};
   else if(p.startsWith('/admin/ledger/') && !p.endsWith('/reconcile'))data={items:[{day:'2026-11-11',requests:3,charged_microcredits:'120000',upstream_currency:'CNY',upstream_cost_micros:'11000'}]};
   data=integrationFixture(url,role)??financeFixture(url)??data;
   if(p==='/admin/api-keys')data={items:[{...personal,source:'admin',key_prefix:'th_demo',created_at:'2026-11-11T00:00:00Z',request_quota:0,token_quota:0,requests_used:0,tokens_used:0}]};
   if(request.method()!=='GET'){const body=request.postData()?request.postDataJSON():{};writes.push({p,body});data={applied:body?.dry_run===false,preview:{before:null,after:body},audit_id:1};if(p==='/admin/mcp-tokens'&&request.method()==='POST')data={token:syntheticToken,record:{id:'mcp_new_demo',name:body.name,scopes:body.scopes,expires_at:'2030-12-01T00:00:00Z'}};}
   if(p==='/admin/requests/thr_demo_missing'){await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'request not found'})});return;}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();latestPage=page;page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack)});
  const pages=role==='user'?['/organizations','/organizations/vo_demo','/managed-people','/ledger','/audit-logs','/mcp-access','/budget-alerts']:[ '/', '/employee-keys', '/grant-keys', '/grant-keys?tab=jwt-grants', '/traffic', '/sessions', '/usage-audit', '/playground', '/organizations','/organizations/vo_demo','/directory','/ledger','/pricing','/audit-logs','/mcp-access','/models','/models/openai/demo-model',modelRoute,'/models/anthropic/demo-model/routing','/providers','/provider-configuration','/request-trace','/upstream-pricing','/routing','/budget-alerts',...(role==='super_admin'?['/users']:[])];
  for(const route of pages){
   console.log(`Checking ${locale} ${role} ${route}`);
   await page.goto(address+route);await page.locator('main section.page').waitFor();
   assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth+2),false,`${role}${route} overflows`);
   assert.equal(await page.locator('.main-content').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,`${role}${route} content overflows`);
   assert.ok(await page.evaluate(()=>document.scrollingElement.scrollHeight<=innerHeight+1),`${role}${route} document must not scroll`);
   assert.equal(await page.locator('nav a').first().getAttribute('href'),role==='user'?'/organizations':'/');
   assert.equal(await page.locator('.nav-group').count(),role==='user'?4:5);
   if(route==='/'||route==='/traffic'){await page.locator('.metric').filter({has:page.getByText(msg('Spend (Credits)'),{exact:true})}).getByText('2.5',{exact:true}).waitFor();}
   if(route==='/'){
    await page.getByRole('heading',{name:msg('Channel health'),exact:true}).waitFor();
    const order=await page.locator('.main-content').evaluate(e=>[...e.querySelectorAll('.metrics-grid,h2')].map(node=>node.matches('.metrics-grid')?'metrics':node.textContent));
    assert.ok(order.indexOf('metrics')<order.indexOf(msg('Recent traffic')));assert.ok(order.indexOf(msg('Activity and spend'))<order.indexOf(msg('Channel health')));await page.waitForTimeout(1700);
   }
   if(route==='/organizations/vo_demo'){
    assert.equal(await page.locator('.main-content input, .main-content textarea, .main-content select').count(),0);
    await page.locator('.topbar').getByRole('button',{name:msg('Edit organization'),exact:true}).click();let edit=page.getByRole('dialog');await edit.getByLabel(msg('Change reason'),{exact:true}).fill('Review organization settings');assert.equal(await edit.getByLabel(msg('Weekly budget / Credits'),{exact:true}).count(),role==='super_admin'?1:0);await page.screenshot({path:path.join(output,`${locale}-${role}-edit-organization-dialog.png`)});await page.keyboard.press('Escape');await edit.waitFor({state:'detached'});
    await page.locator('.topbar').getByRole('button',{name:msg('Manage members'),exact:true}).click();await page.getByRole('dialog').getByLabel(msg('Change reason'),{exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
   }
   if(route==='/audit-logs'){
    await page.getByRole('button',{name:msg('View details'),exact:true}).first().waitFor();assert.equal(await page.locator('main pre').count(),0);
    if(role==='super_admin'){
     assert.equal(await page.locator('main tbody tr').count(),50);await page.getByRole('button',{name:msg('Next'),exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('main tbody tr').length===13);assert.ok(reads.at(-1).query.before_id);await page.getByRole('button',{name:msg('Previous'),exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('main tbody tr').length===50);
    }
    await page.getByRole('button',{name:msg('View details'),exact:true}).first().click();let dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:msg(role==='platform_admin'?'Recorded changes':'Recorded operation context'),exact:true}).waitFor();assert.equal(await dialog.locator('pre').count(),0);await dialog.getByRole('columnheader',{name:msg('Before'),exact:true}).waitFor();await dialog.getByRole('columnheader',{name:msg('After'),exact:true}).waitFor();if(role!=='platform_admin')await dialog.getByText('1500.0 Credits',{exact:true}).waitFor();await page.screenshot({path:path.join(output,`${locale}-${role}-audit-detail.png`),fullPage:false});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.getByLabel(msg('Source'),{exact:true}).selectOption('mcp');await page.getByLabel(msg('Result'),{exact:true}).selectOption('denied');await page.getByLabel(msg('Search audit records'),{exact:true}).fill('reviewer');await page.getByRole('button',{name:msg('Search'),exact:true}).click();await page.getByRole('button',{name:msg('View details'),exact:true}).first().waitFor();const auditReads=reads.filter(row=>row.p==='/admin/audit-logs');assert.equal(auditReads.at(-1).query.query,'reviewer');assert.equal(auditReads.at(-1).query.via,'mcp');assert.equal(auditReads.at(-1).query.result,'denied');if(role==='user')assert.ok(auditReads.every(row=>row.query.org_id==='vo_demo'));
   }
   if(route==='/request-trace'){
    await page.getByRole('button',{name:msg('View trace'),exact:true}).first().waitFor();assert.equal(await page.locator('main pre').count(),0);await page.getByRole('button',{name:msg('View trace'),exact:true}).first().click();let dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:msg('Routing decision'),exact:true}).waitFor();assert.equal(await dialog.locator('.attempt-timeline > li').count(),2);assert.equal(await dialog.locator('pre').count(),0);await dialog.getByText(msg('This retried attempt may have incurred an upstream charge.'),{exact:true}).waitFor();await page.screenshot({path:path.join(output,`${locale}-${role}-request-trace-dialog.png`),fullPage:false});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.getByLabel(msg('Request ID'),{exact:true}).fill('thr_demo_failed');await page.getByRole('button',{name:msg('Trace request'),exact:true}).click();dialog=page.getByRole('dialog');await page.waitForFunction(()=>document.querySelectorAll('dialog .attempt-timeline > li').length===1);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.getByLabel(msg('Request ID'),{exact:true}).fill('thr_demo_missing');await page.getByRole('button',{name:msg('Trace request'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('alert').waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.goto(address+'/request-trace?request_id=thr_demo_retry');dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:msg('Attempt timeline'),exact:true}).waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(new URL(page.url()).searchParams.has('request_id'),false);
   }
   if(route==='/mcp-access'){
    await page.getByRole('button',{name:'桌面助手',exact:true}).waitFor();await page.locator('main').getByText(/2030/).first().waitFor();assert.equal(await page.locator('main tbody tr').count(),1);assert.equal(await page.locator('main input[type="number"], main input[type="checkbox"], main pre').count(),0);await page.getByLabel(msg('Status'),{exact:true}).selectOption('');assert.equal(await page.locator('main tbody tr').count(),3);
    await page.getByRole('button',{name:msg('Connection guide'),exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByText(msg('Client configuration template'),{exact:true}).waitFor();assert.ok((await dialog.locator('pre').innerText()).includes('<YOUR_MCP_TOKEN>'));await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.getByRole('button',{name:msg('Create personal token'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Name'),{exact:true}).fill('Test integration');await dialog.getByLabel(msg('Validity (days)'),{exact:true}).fill('30');if(role==='user'){assert.equal(await dialog.getByRole('checkbox').count(),2);assert.equal(await dialog.getByRole('checkbox',{name:msg('Directory management'),exact:false}).count(),0);}await page.screenshot({path:path.join(output,`${locale}-${role}-create-mcp-dialog.png`),fullPage:false});await dialog.getByRole('button',{name:msg('Create personal token'),exact:true}).click();await dialog.getByLabel(msg('New MCP token'),{exact:true}).waitFor();assert.equal(await dialog.getByLabel(msg('New MCP token'),{exact:true}).getAttribute('type'),'password');assert.equal(await dialog.getByLabel(msg('New MCP token'),{exact:true}).inputValue(),syntheticToken);assert.equal(writes.at(-1).body.ttl_days,30);assert.deepEqual(writes.at(-1).body.scopes,['read']);assert.equal(await page.locator('body').evaluate((body,plain)=>body.textContent.includes(plain),syntheticToken),false);assert.equal(await page.evaluate(plain=>Object.values(localStorage).some(value=>value.includes(plain)),syntheticToken),false);await dialog.getByRole('button',{name:msg('Saved; close'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.locator('body').evaluate((body,plain)=>body.innerHTML.includes(plain),syntheticToken),false);
    await page.getByRole('button',{name:msg('Revoke'),exact:true}).click();dialog=page.getByRole('dialog');const count=writes.length;await dialog.getByRole('button',{name:msg('Cancel'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.length,count);await page.getByRole('button',{name:msg('Revoke'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:msg('Revoke'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.at(-1).p,'/admin/mcp-tokens/mcp_active');
   }
   if(route==='/ledger'){
    await page.getByRole('button',{name:msg('View details'),exact:true}).first().waitFor();
    assert.equal(await page.locator('main textarea, main input[type="number"]').count(),0,'ledger adjustments must be in dialogs');
    await page.locator('.finance-metrics').getByText('0.8 CNY',{exact:true}).waitFor();await page.locator('.finance-metrics').getByText('0.27 USD',{exact:true}).waitFor();await page.locator('.finance-metrics').getByText('1.6 Credits',{exact:true}).waitFor();
    await page.getByRole('button',{name:msg('View details'),exact:true}).first().click();let dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:msg('Ledger entry details'),exact:true}).waitFor();assert.equal(await dialog.locator('pre').count(),0);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    if(role==='super_admin'){
     await page.locator('main tbody tr').filter({hasText:'demo-model'}).getByRole('button',{name:msg('Adjust entry'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Adjustment Credits (may be negative)'),{exact:true}).fill('-0.123456');await dialog.getByLabel(msg('Adjustment reason'),{exact:true}).fill('Correct demonstration charge');await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes.at(-1).body.charged_microcredits,'-123456');assert.equal(writes.at(-1).body.adjusts_entry_id,101);assert.equal(writes.at(-1).body.budget_owner_id,'vo_demo');await dialog.getByLabel(msg('Adjustment Credits (may be negative)'),{exact:true}).fill('-0.2');assert.equal(await dialog.getByRole('button',{name:msg('Apply adjustment'),exact:true}).isDisabled(),true);await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();await page.screenshot({path:path.join(output,`${locale}-ledger-adjustment-dialog.png`),fullPage:true});await dialog.getByRole('button',{name:msg('Apply adjustment'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.at(-1).body.dry_run,false);
    }else if(role==='user'){assert.equal(await page.getByRole('button',{name:msg('Add report adjustment'),exact:true}).count(),0);assert.ok(reads.filter(row=>row.p.startsWith('/admin/ledger/')).every(row=>row.query.org_id==='vo_demo'),'organization scope must apply before loading the ledger');}
    if(role!=='user'){
     await page.getByRole('button',{name:msg('Reconcile'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('status').waitFor();assert.equal(await dialog.locator('pre').count(),0);await dialog.getByRole('cell',{name:'0.025',exact:true}).waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    }
    await page.getByRole('button',{name:msg('Summary'),exact:true}).click();await page.getByLabel(msg('Group by'),{exact:true}).selectOption('provider');assert.equal(await page.getByLabel(msg('Group by'),{exact:true}).inputValue(),'provider');await page.getByRole('columnheader',{name:msg('Entry type'),exact:true}).waitFor();await page.getByRole('button',{name:msg('Details'),exact:true}).click();await page.getByRole('button',{name:msg('View details'),exact:true}).first().waitFor();
   }
   if(route==='/pricing'){
    await page.getByRole('button',{name:'demo-model',exact:true}).waitFor();assert.equal(await page.locator('main tbody tr').count(),4);assert.equal(await page.locator('main pre, main textarea').count(),0);
    await page.getByLabel(msg('Billing mode'),{exact:true}).selectOption('characters');assert.equal(await page.locator('main tbody tr').count(),1);await page.getByLabel(msg('Billing mode'),{exact:true}).selectOption('');
    const tokenRow=page.locator('main tbody tr').filter({has:page.getByRole('button',{name:'demo-model',exact:true})});
    await tokenRow.getByRole('button',{name:msg('Edit price'),exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Input price / 1M tokens')+' · Credits',{exact:true}).fill('2.123456');assert.equal(await dialog.getByLabel(msg('Input token threshold')+' · 1',{exact:true}).inputValue(),'200000');await page.screenshot({path:path.join(output,`${locale}-model-price-dialog.png`),fullPage:true});await dialog.getByRole('button',{name:msg('Save price'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.at(-1).body.input_microcredits_per_1m_tokens,'2123456');assert.equal(writes.at(-1).body.billing.token_tiers[0].above_input_tokens,200000);assert.equal(writes.at(-1).body.billing.cache_write_microcredits_per_1m_tokens,'3125000');
    await tokenRow.getByRole('button',{name:msg('Version history'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByText('2.5 / 10 Credits',{exact:true}).waitFor();assert.equal(await dialog.locator('pre').count(),0);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.locator('main tbody tr').filter({has:page.getByRole('button',{name:'image-demo',exact:true})}).getByRole('button',{name:msg('Edit price'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Price per image')+' · 1 · Credits',{exact:true}).fill('0.06');await dialog.getByRole('button',{name:msg('Save price'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.at(-1).body.billing.image_prices[0].charged_microcredits,'60000');
   }
   if(route==='/upstream-pricing'){
    await page.getByRole('cell',{name:'demo upstream-demo'}).waitFor();assert.equal(await page.locator('main tbody tr').count(),3);assert.equal(await page.locator('main pre, main textarea, main input[type="number"]').count(),0);
    await page.getByRole('button',{name:msg('All versions'),exact:true}).click();assert.equal(await page.locator('main tbody tr').count(),4);await page.getByRole('button',{name:msg('Current prices'),exact:true}).click();
    const row=page.locator('main tbody tr').filter({hasText:'upstream-demo'});await row.getByRole('button',{name:msg('Version history'),exact:true}).click();let dialog=page.getByRole('dialog');assert.equal(await dialog.locator('tbody tr').count(),2);assert.equal(await dialog.locator('pre').count(),0);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await row.getByRole('button',{name:msg('Change price'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Input price / 1M tokens')+' · USD',{exact:true}).fill('0.123456');await dialog.getByLabel(msg('Output price / 1M tokens')+' · USD',{exact:true}).fill('0.2');await dialog.getByLabel(msg('Effective from (empty for immediate)'),{exact:true}).fill('2030-12-01T12:00');await dialog.getByLabel(msg('Change reason'),{exact:true}).fill('Update purchase agreement');await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes.at(-1).body.billing.input_micros_per_1m,'123456');assert.ok(writes.at(-1).body.effective_from.endsWith('Z'));await dialog.getByLabel(msg('Input price / 1M tokens')+' · USD',{exact:true}).fill('0.654321');assert.equal(await dialog.getByRole('button',{name:msg('Publish price'),exact:true}).isDisabled(),true);await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();await page.screenshot({path:path.join(output,`${locale}-upstream-price-dialog.png`),fullPage:true});await dialog.getByRole('button',{name:msg('Publish price'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.at(-1).body.dry_run,false);assert.equal(writes.at(-1).body.billing.input_micros_per_1m,'654321');
   }
   if(role!=='user'){
    assert.deepEqual(await page.locator('.nav-group-label').allTextContents(),['Overview','Organization and access','Models and channels','Usage and billing','Audit and integrations'].map(key=>msg(key)));
    const modelMenu=page.locator('#main-navigation .nav-group').filter({has:page.locator('.nav-group-label',{hasText:msg('Models and channels')})});
    assert.deepEqual(await modelMenu.locator('a span').allTextContents(),['Models','Channels','Playground'].map(key=>msg(key)));
   }
   if(route==='/routing'){await page.waitForURL('**/models');assert.equal(await page.locator('.model-row').count(),2);}
   if(route===modelRoute){await page.getByRole('heading',{name:msg('Candidate channels')}).waitFor();assert.equal(await page.getByLabel(msg('Public model'),{exact:true}).count(),0);assert.equal(await page.getByRole('cell',{name:'other-channel',exact:true}).count(),0);await page.getByRole('heading',{name:msg('Current route')}).waitFor();}
   if(route==='/models/anthropic/demo-model/routing'){await page.getByRole('cell',{name:'other-channel',exact:true}).waitFor();assert.equal(await page.getByRole('cell',{name:'demo',exact:true}).count(),0);}
   if(route==='/models'){
    assert.equal(await page.locator('.topbar').getByRole('button',{name:msg('Add model'),exact:true}).count(),1);
    await page.locator('.topbar').getByRole('button',{name:msg('Add model'),exact:true}).click();
    const create=page.getByRole('dialog');await create.getByLabel(msg('Select channel'),{exact:true}).selectOption('demo');
    await create.getByLabel(msg('Public model'),{exact:true}).fill('new-demo');await create.getByLabel(msg('Upstream model'),{exact:true}).fill('upstream-new');await create.getByLabel(msg('Change reason'),{exact:true}).fill('Add a synthetic model');
    assert.equal(await create.getByRole('button',{name:msg('Add model'),exact:true}).isDisabled(),true);
    await create.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await create.getByRole('status').waitFor();
    assert.equal(writes.at(-1).body.dry_run,true);let changed=parseYAML(writes.at(-1).body.yaml);assert.equal(changed.models.length,2);assert.equal(changed.pools[0].accounts[0].api_key,'${secret:account/primary/main}');
    await create.getByLabel(msg('Upstream model'),{exact:true}).fill('upstream-final');assert.equal(await create.getByRole('button',{name:msg('Add model'),exact:true}).isDisabled(),true);
    await create.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await create.getByRole('status').waitFor();await page.screenshot({path:path.join(output,`${locale}-add-model-dialog.png`)});
    await create.getByRole('button',{name:msg('Add model'),exact:true}).click();await create.waitFor({state:'detached'});assert.equal(writes.at(-1).body.dry_run,false);assert.equal(parseYAML(writes.at(-1).body.yaml).models.at(-1).upstream,'upstream-final');
    await page.goto(address+'/models?q=demo');
    await page.getByRole('link',{name:msg('View routes for {model}',{model:model.display_name}),exact:true}).press('Enter');
    await page.waitForURL('**'+modelRoute);await page.getByRole('heading',{name:msg('Candidate channels')}).waitFor();
    await page.getByRole('link',{name:msg('Back to models'),exact:true}).click();await page.waitForURL('**/models?q=demo');
   }
   if(route==='/models/openai/demo-model'){
    assert.equal(await page.locator('.topbar').getByRole('link',{name:msg('Back to models'),exact:true}).count(),1);
    assert.equal(await page.locator('.main-content .back-link').count(),0);
    if(role==='super_admin'&&locale==='zh-CN'){
     await page.setViewportSize({width:1440,height:600});
     const content=page.locator('.main-content'),nav=page.locator('#main-navigation');
     await page.getByRole('heading',{name:msg('Provider YAML'),exact:true}).waitFor();
     assert.ok(await content.evaluate(e=>e.scrollHeight>e.clientHeight));assert.ok(await nav.evaluate(e=>e.scrollHeight>e.clientHeight));
     await content.evaluate(e=>e.scrollTop=120);await nav.evaluate(e=>e.scrollTop=0);
     await nav.hover();await page.mouse.wheel(0,300);await page.waitForFunction(()=>document.querySelector('#main-navigation').scrollTop>0);
     assert.equal(await content.evaluate(e=>e.scrollTop),120);
     await nav.evaluate(e=>e.scrollTop=e.scrollHeight);const navEnd=await nav.evaluate(e=>e.scrollTop);await page.mouse.wheel(0,400);await page.waitForTimeout(100);assert.equal(await content.evaluate(e=>e.scrollTop),120);
     await content.hover({position:{x:4,y:20}});await page.mouse.wheel(0,300);await page.waitForFunction(()=>document.querySelector('.main-content').scrollTop>120);assert.equal(await nav.evaluate(e=>e.scrollTop),navEnd);assert.equal(await page.evaluate(()=>window.scrollY),0);
     assert.equal(await page.locator('.topbar').evaluate(e=>e.getBoundingClientRect().top),0);
     for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:path.join(output,`scroll-${theme}.png`)});}
     await page.setViewportSize({width:1440,height:1000});
    }
await page.getByRole('link',{name:msg('Routing'),exact:true}).click();await page.waitForURL('**'+modelRoute);await page.getByRole('heading',{name:msg('Candidate channels')}).waitFor();}
   if(route==='/providers'){
    await page.getByRole('heading',{name:'demo',exact:true}).waitFor();
    assert.equal(await page.locator('.channel-navigation').count(),0);
    await page.screenshot({path:path.join(output,`${locale}-${role}-channel-status.png`),fullPage:true});
    await page.getByRole('link',{name:msg('Configure {channel}',{channel:'demo'}),exact:true}).click();
    await page.waitForURL('**/providers?tab=configuration&channel=demo');
    await page.getByRole('dialog').waitFor();
    await page.waitForFunction(()=>document.querySelector('dialog input:disabled')?.value==='demo');
    assert.equal(await page.getByLabel(msg('Channel name'),{exact:true}).inputValue(),'demo');
    assert.equal(await page.locator('.channel-navigation').count(),0);
    await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
    await page.locator('.topbar').getByRole('button',{name:msg('New channel'),exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name:msg('New channel'),exact:true}).waitFor();assert.equal(await page.getByRole('dialog').getByLabel(msg('Channel name'),{exact:true}).inputValue(),'');await page.screenshot({path:path.join(output,`${locale}-new-channel-dialog.png`)});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
   }
   if(route==='/provider-configuration'){await page.waitForURL('**/providers?tab=configuration');await page.getByRole('button',{name:'demo · r1'}).click();await page.getByRole('button',{name:msg('Form'),exact:true}).click();await page.getByRole('heading',{name:msg('Model mappings')}).waitFor();await page.getByRole('button',{name:'YAML',exact:true}).click();assert.ok((await page.getByLabel(msg('Channel YAML'),{exact:true}).inputValue()).includes('${secret:'));}
   if(route==='/organizations/vo_demo' && role==='user') {assert.equal(await page.getByRole('button',{name:msg('Confirm archive')}).count(),0);assert.equal(await page.getByLabel(msg('Weekly budget / Credits'),{exact:true}).count(),0);}
   if(route==='/organizations'){
    assert.equal(await page.locator('.main-content > .page > .panel > .panel-heading').count(),0);
    assert.equal(await page.locator('.topbar').getByRole('button',{name:msg('Refresh'),exact:true}).count(),1);
    assert.equal(await page.locator('main input, main textarea, main select').count(),0,'organization list must not contain edit forms');
    if(role==='super_admin'){
     await page.getByRole('button',{name:msg('Create virtual organization'),exact:true}).click();
     let dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByLabel(msg('Code'),{exact:true}).fill('new-team');await dialog.getByLabel(msg('Name'),{exact:true}).fill('New team');await dialog.getByLabel(msg('Change reason'),{exact:true}).fill('Create review team');
     await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes.at(-1).body.dry_run,true);
     await page.screenshot({path:path.join(output,`${locale}-create-organization-dialog.png`),fullPage:true});
     await dialog.getByRole('button',{name:msg('Apply changes'),exact:true}).click();await dialog.waitFor({state:'detached'});
     await page.getByRole('button',{name:msg('Bulk member assignment'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByLabel(msg('CSV file'),{exact:true}).setInputFiles({name:'members.csv',mimeType:'text/csv',buffer:Buffer.from('subject,org_code\nstaff-01,platform\n')});await dialog.getByLabel(msg('Change reason'),{exact:true}).fill('Assign review members');await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes.at(-1).p,'/admin/virtual-orgs/members/import');assert.equal(writes.at(-1).body.dry_run,true);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    }else{assert.equal(await page.getByRole('button',{name:msg('Create virtual organization'),exact:true}).count(),0);}
   }
   if(route==='/users'){
    assert.equal(await page.locator('.topbar').getByRole('button',{name:msg('Add administrator'),exact:true}).count(),1);
    assert.equal(await page.locator('main input[type="password"], main select').count(),0);
    assert.equal(await page.locator('#main-navigation a[href="/users"]').innerText(),msg('Administrators'));
    await page.getByRole('button',{name:msg('Add administrator'),exact:true}).click();let dialog=page.getByRole('dialog');await dialog.waitFor();
    await dialog.getByLabel(msg('Username'),{exact:true}).fill('new-manager');await dialog.getByLabel(msg('Password'),{exact:true}).fill('review-password');await dialog.getByRole('checkbox',{name:org.name,exact:true}).check();
    await dialog.locator('.scope-options label').filter({hasText:'演示员工'}).getByRole('checkbox').check();
    await page.screenshot({path:path.join(output,`${locale}-administrator-dialog.png`),fullPage:true});
    await dialog.getByRole('button',{name:msg('Add administrator'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.deepEqual(writes.at(-1).body.managed_orgs,['vo_demo']);assert.deepEqual(writes.at(-1).body.managed_principals,['key_demo']);assert.equal(writes.at(-1).body.role,'user');
    await page.getByRole('button',{name:msg('Edit authorization'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.getByRole('checkbox',{name:org.name,exact:true}).isChecked(),true);await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   }
   if(route==='/managed-people'){
    await page.getByRole('button',{name:msg('Edit personal policy'),exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('button',{name:msg('Save'),exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(writes.at(-1).p,'/admin/managed-people/key_demo');
   }
   if(route==='/directory'){
    assert.equal(await page.locator('main textarea, main input[type="file"]').count(),0,'directory import must be a dialog');
    await page.getByRole('button',{name:msg('Expand {name}',{name:'示例公司'}),exact:true}).click();await page.getByRole('button',{name:msg('Expand {name}',{name:'研发部'}),exact:true}).click();await page.locator('.tree-label').filter({hasText:'平台组'}).click();
    await page.locator('.organization-tree .tree-employee button').filter({hasText:'演示员工'}).click();let dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:msg('Employee details · {subject}',{subject:'staff-01'})}).waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await page.screenshot({path:path.join(output,`${locale}-${role}-organization-tree.png`),fullPage:true});
    if(role==='super_admin'){
     await page.getByLabel(msg('Select {name}',{name:'演示员工'}),{exact:true}).check();await page.getByRole('button',{name:msg('Assign selected members')+' (1)',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Add to virtual organization'),{exact:true}).selectOption('vo_demo');await dialog.getByLabel(msg('Directory change reason'),{exact:true}).fill('Assign selected staff');await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes.at(-1).body.principal_ids[0],'key_demo');await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
     await page.getByRole('button',{name:msg('Edit department'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Name'),{exact:true}).fill('Platform group');await dialog.getByLabel(msg('Change reason'),{exact:true}).fill('Rename department');await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes.at(-1).p,'/admin/departments/team');await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
     await page.getByRole('button',{name:msg('Import directory'),exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel(msg('Directory file'),{exact:true}).setInputFiles({name:'directory.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({departments:[],employees:[{subject:'staff-02',name:'Imported staff',department_id:'team'}]}))});await dialog.getByLabel(msg('Change reason'),{exact:true}).fill('Import directory file');await dialog.getByRole('button',{name:msg('Preview changes'),exact:true}).click();await dialog.getByRole('status').waitFor();assert.equal(writes.at(-1).p,'/admin/directory/imports');assert.equal(writes.at(-1).body.dry_run,true);await page.screenshot({path:path.join(output,`${locale}-directory-import-dialog.png`),fullPage:true});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    }else{assert.equal(await page.getByLabel(msg('Select {name}',{name:'演示员工'}),{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:msg('Import directory'),exact:true}).count(),0);}
   }
   if(['/audit-logs','/request-trace','/mcp-access','/pricing','/upstream-pricing','/ledger',modelRoute,'/models','/providers','/organizations/vo_demo','/provider-configuration'].includes(route))await page.screenshot({path:path.join(output,`${locale}-${role}-${route.replaceAll('/','_')}.png`),fullPage:true});
   await page.screenshot({path:path.join(output,`${locale}-${role}-review-${route.replaceAll('/','_').replaceAll('?','_')||'dashboard'}.png`)});
   checked++;
  }
  if(role!=='super_admin'){await page.goto(address+'/users');await page.waitForURL('**/organizations');assert.equal(await page.locator('nav a[href="/users"]').count(),0);}
  if(role==='super_admin'){
   await page.goto(address+modelRoute);await page.locator('.topbar').getByRole('button',{name:msg('Candidate channels'),exact:true}).click();await page.getByLabel(msg('Change reason'),{exact:true}).fill('验证预览权限');await page.getByRole('button',{name:msg('Preview disable'),exact:true}).click();await page.getByRole('status').filter({hasText:msg('Preview ready. Review the changes, then apply.')}).waitFor();assert.equal(writes.at(-1).body.dry_run,true);assert.equal(writes.at(-1).body.protocol,'openai');assert.equal(writes.at(-1).body.model,'demo-model');assert.equal(writes.at(-1).body.provider,'demo');await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  }
  if(role==='super_admin'){
   const nextLocale=locale==='zh-CN'?'en-US':'zh-CN';
   await page.locator('.sidebar-user-trigger').click();await page.locator('.sidebar-menu-select select').selectOption(nextLocale);
   await page.waitForFunction(locale=>document.documentElement.lang===locale,nextLocale);
   const nextText=nextLocale==='zh-CN'?messages['Candidate channels']:'Candidate channels';
   await page.locator('.topbar').getByRole('button',{name:nextText,exact:true}).waitFor();
   await page.locator('.sidebar-menu-select select').selectOption(locale);await page.locator('.sidebar-user-trigger').click();
  }
  if(role==='super_admin')await checkCompactUI(page,address,output,locale,msg);
  await page.setViewportSize({width:390,height:844});await page.goto(address+'/organizations/vo_demo');await page.locator('main section.page').waitFor();assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth+2),false,`${role} mobile overflows`);await page.getByRole('button',{name:msg('Open navigation'),exact:true}).click();await page.getByRole('navigation',{name:msg('Main navigation'),exact:true}).waitFor({state:'visible'});assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth+2),false,`${locale}${role} mobile menu overflows`);assert.ok(await page.evaluate(()=>document.scrollingElement.scrollHeight<=innerHeight+1),'mobile document must not scroll');await page.screenshot({path:path.join(output,`${locale}-${role}-mobile.png`),fullPage:true});
  if(role==='user'){
   for(const target of ['/models',modelRoute,'/providers','/provider-configuration','/request-trace']){await page.goto(address+target);await page.waitForURL('**/organizations');}
  }else{
   for(const target of ['/models',modelRoute,'/providers','/providers?tab=configuration&channel=demo','/directory','/organizations','/pricing','/upstream-pricing','/ledger','/audit-logs','/mcp-access','/request-trace',...(role==='super_admin'?['/users']:[])]){
    await page.goto(address+target);await page.locator('main section.page').first().waitFor();
    if(target===modelRoute)await page.getByRole('heading',{name:msg('Candidate channels')}).waitFor();
    if(target==='/models'){await page.locator('.topbar').getByRole('button',{name:msg('Add model'),exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,'model create mobile dialog overflows');await page.screenshot({path:path.join(output,`${locale}-${role}-mobile-model-dialog.png`)});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});}
    if(target==='/ledger')await page.getByRole('button',{name:msg('View details'),exact:true}).first().waitFor();
    if(target==='/providers')await page.getByRole('heading',{name:'demo',exact:true}).waitFor();
    if(role==='super_admin'&&['/users','/organizations','/directory','/pricing','/upstream-pricing','/ledger','/mcp-access'].includes(target)){
     const label=target==='/users'?'Add administrator':target==='/organizations'?'Create virtual organization':target==='/pricing'?'Add price':target==='/upstream-pricing'?'Add upstream price':target==='/ledger'?'Add report adjustment':target==='/mcp-access'?'Create personal token':'Import directory';await page.getByRole('button',{name:msg(label),exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth+2),false,`${target} dialog overflow`);await page.screenshot({path:path.join(output,`${locale}-mobile-dialog-${target.slice(1)}.png`),fullPage:true});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
    }
    assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth+2),false,`${locale} ${role} mobile ${target} overflows`);
    if(role==='super_admin')await page.screenshot({path:path.join(output,`${locale}-mobile-${target.replaceAll('/','_').replaceAll('?','_')}.png`),fullPage:true});
   }
  }
  assert.deepEqual(errors,[],`${role} browser errors`);await context.close();
 }
 console.log(`Enterprise UI smoke passed: ${checked} locale/role/page checks, language switching, menu order, mobile layouts, preview and authorization controls. Screenshots: ${output}`);
}catch(error){if(latestPage&&!latestPage.isClosed()){await latestPage.screenshot({path:path.join(output,"failure.png"),fullPage:true});console.log(await latestPage.locator("dialog").allTextContents());}throw error;}finally{await browser.close();server.close();}
