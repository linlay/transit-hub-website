// Run npm run build and npm run preview first. All admin requests are mocked.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const dir = process.env.QA_OUTPUT_DIR || require('node:path').join(require('node:os').tmpdir(), 'transit-refinement-qa');
const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
fs.mkdirSync(dir,{recursive:true});
const date = '2026-09-25T08:00:00Z';
const user = {id:'preview',username:'Preview Admin',status:'active',created_at:date,updated_at:date};
const key = {id:'preview',name:'Production app',description:'Preview fixture',key_prefix:'th_preview',source:'admin',status:'active',forced_expired:false,request_quota:100000,token_quota:50000000,quota_microcredits:100000000,used_microcredits:38000000,used_requests:18420,used_tokens:12345678,remaining_microcredits:62000000,allowed_models:['gpt-4.1','claude-sonnet'],rate_limits:[],rate_limit_usage:[],created_at:date,updated_at:date,last_used_at:date};
const model = {protocol:'openai',type:'chat',public_model:'gpt-4.1',upstream_model:'gpt-4.1',display_name:'GPT-4.1',owned_by:'openai',created_at:date,provider:'OpenAI',provider_base_url:'https://api.example.com',default_pool:'primary',configured_pool:'primary',effective_pool:'primary',override_valid:true,gateway_path:'/v1/chat/completions',upstream_path:'/chat/completions',upstream_url:'https://api.example.com/chat/completions'};
const providers = {providers:[{name:'OpenAI',protocol:'openai',base_url:'https://api.example.com',default_pool:'primary',models:[{public:'gpt-4.1',upstream:'gpt-4.1',type:'chat',pool:'primary'}],pools:[{name:'primary',accounts:[{name:'Account A',weight:1,circuit:{}}]}]}]};
const items = Array.from({length:7},(_,i)=>({bucket:`09-${19+i}`,requests:1000+i*230,unique_api_keys:10+i,request_tokens:1100000+i*100000,response_tokens:300000,total_tokens:1400000+i*100000,cache_hit_tokens:700000,cache_miss_tokens:400000,cache_total_tokens:1100000,cache_hit_rate:0.64,charged_microcredits:24000000+i*100000,error_requests:3,average_latency_ms:820,models:[{model:'gpt-4.1',requests:600+i*120,total_tokens:1000000+i*90000},{model:'claude-sonnet',requests:400+i*110,total_tokens:400000+i*10000}]}));
const summary = items[6];
const list = (items)=>({items,total:items.length});
const fixtures = {
'/admin/auth/me':{user}, '/admin/overview':{total_requests:18420,total_tokens:12345678,total_microcredits:927074000000,active_devices:24,error_requests:12,api_keys:{active:18,total:20,disabled:2,deleted:0},recent_traffic:items,risk_keys:[]},
'/admin/traffic':list(items), '/admin/traffic/analytics':{items,summary,models:[{id:'gpt-4.1',name:'GPT-4.1',...summary}],keys:[{id:'preview',name:key.name,...summary}],options:{keys:[{id:'preview',name:key.name}],models:[{id:'gpt-4.1',name:'GPT-4.1'}],providers:[{id:'OpenAI',name:'OpenAI'}]}},
'/admin/models':list([model]), '/admin/models/detail':model, '/admin/api-keys':list([key]),'/admin/api-keys/preview':key,'/admin/api-keys/preview/usage':{key,summary,recent_traffic:items,active_devices:3,rate_limit_usage:[]}, '/admin/providers':providers, '/admin/providers/usage':{items:[{provider:'OpenAI',...summary}],account_items:[]}, '/admin/providers/quota':list([]), '/admin/users':list([user]),
'/admin/jwt-grants':list([{jti:'preview',name:'Desktop team',description:'Development devices',status:'active',issue_quota:100,issued_count:12,issue_remaining:88,issue_unlimited:false,request_quota:10000,token_quota:10000000,quota_microcredits:100000000,allowed_models:['gpt-4.1'],rate_limits:[],created_at:date,updated_at:date}]),
'/admin/sessions':list([{api_key_id:'preview',api_key_name:key.name,key_prefix:key.key_prefix,device_id:'MacBook-Pro',source:'admin',first_seen_at:date,last_seen_at:date,active:true,last_status_code:200,request_count:120,token_count:2435000}]),
'/admin/model-prices':list([{id:'preview',protocol:'openai',public_model:'gpt-4.1',input_microcredits_per_1m_tokens:2000000,input_cache_hit_microcredits_per_1m_tokens:500000,output_microcredits_per_1m_tokens:8000000,unit:'CREDITS',created_at:date,updated_at:date}])};
(async()=>{
const assert=require('node:assert/strict');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(()=>{localStorage.setItem('transit-hub.locale','en-US');localStorage.setItem('transit-hub.theme','light');});
let overrides={},queries=[],delay=0;
await context.route('**/admin/**',async route=>{
 const url=new URL(route.request().url()),method=route.request().method(),id=method+' '+url.pathname;
 queries.push({url,method});
 if(delay && method==='GET' && url.pathname==='/admin/api-keys')await new Promise(r=>setTimeout(r,delay));
 const response=overrides[id];
 await route.fulfill({status:response?.status||200,contentType:'application/json',body:JSON.stringify(response?.body??fixtures[url.pathname]??list([]),(k,v)=>k.includes('microcredits')?String(v):v)});
});
const page=await context.newPage(),errors=[];globalThis.qaPage=page;page.on('pageerror',e=>errors.push(e.message));
async function go(path){await page.goto(baseURL + '/');await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new PopStateEvent('popstate'));},path);await page.waitForTimeout(450);}
// Model identity keeps its color when rankings change across ranges.
await go('/');
async function legendColors() { return page.locator('.chart').first().locator('.recharts-legend-item').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.textContent,node.querySelector('svg path')?.getAttribute('fill')]))); }
const colorsBefore = await legendColors();
const trafficBefore = fixtures['/admin/traffic'];
fixtures['/admin/traffic'] = list(items.map(item=>({...item,models:item.models.map((model,index)=>({...model,requests:index===0?1:2000}))})));
await page.getByLabel('Time range',{exact:true}).selectOption('7d');
await page.waitForTimeout(500);
const colorsAfter = await legendColors();
assert(colorsBefore['gpt-4.1']);assert.equal(colorsBefore['gpt-4.1'],colorsAfter['gpt-4.1']);
assert.equal(colorsBefore['claude-sonnet'],colorsAfter['claude-sonnet']);
fixtures['/admin/traffic']=trafficBefore;
// Dense list panels reach the viewport bottom, and every page shares compact outer spacing.
for(const path of ['/api-keys','/jwt-grants','/models','/sessions','/users']){
 await go(path);
 const geometry=await page.locator('.page').evaluate(node=>{
  const panel=node.querySelector('.panel:has(> .data-table-scroll)');
  const table=panel?.querySelector('.data-table-scroll');
  return {padding:getComputedStyle(node).paddingLeft,pageBottom:node.getBoundingClientRect().bottom,panelBottom:panel?.getBoundingClientRect().bottom,tableBottom:table?.getBoundingClientRect().bottom,viewport:innerHeight};
 });
 assert.equal(geometry.padding,'12px',`${path} page padding`);
 assert(Math.abs(geometry.pageBottom-geometry.viewport)<1,`${path} page fills viewport`);
 assert(Math.abs(geometry.panelBottom-(geometry.viewport-12))<1,`${path} panel reaches bottom padding`);
 assert(Math.abs(geometry.tableBottom-(geometry.panelBottom-9))<1,`${path} table reaches panel edge ${JSON.stringify(geometry)}`);
}
await go('/');assert.equal(await page.locator('.page').evaluate(node=>getComputedStyle(node).paddingLeft),'12px','dashboard page padding');
// Input debounce and URL state, keep old rows during a delayed query.
await go('/api-keys');queries=[];delay=500;
const tableTopBefore = await page.locator('.data-table-scroll').evaluate(e=>e.getBoundingClientRect().top);
await page.getByPlaceholder('Search keys').pressSequentially('Production',{delay:15});
await page.waitForTimeout(280);
assert.equal(queries.filter(q=>q.url.pathname==='/admin/api-keys').length,1);
assert.equal(await page.locator('.data-table-scroll').evaluate(e=>e.getBoundingClientRect().top),tableTopBefore);
assert.equal(await page.locator('tbody tr').count(),1);
assert.equal(await page.locator('tbody').textContent().then(x=>x.includes('Production app')),true);
assert.equal(new URL(page.url()).searchParams.get('search'),'Production');
await page.waitForTimeout(550);delay=0;
await page.getByLabel('Status',{exact:true}).selectOption('active');
await page.getByRole('button',{name:'Requests',exact:true}).click();
assert.equal(new URL(page.url()).searchParams.get('sort'),'used_requests');
await page.getByRole('link',{name:'Production app',exact:true}).click();
await page.getByRole('button',{name:'Back to API keys',exact:true}).click();
assert.equal(await page.getByPlaceholder('Search keys').inputValue(),'Production');
assert.equal(await page.getByLabel('Status',{exact:true}).inputValue(),'active');
assert.equal(new URL(page.url()).searchParams.get('sort'),'used_requests');
// Tooltip appears on keyboard focus; modal traps focus and restores it.
const create=page.getByRole('button',{name:'Create key',exact:true});await create.focus();
await page.getByRole('tooltip').waitFor();assert.equal(await page.getByRole('tooltip').textContent(),'Create key');
await create.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
for(let i=0;i<25;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);}
await dialog.getByRole('button',{name:'Close dialog'}).focus();await page.getByRole('tooltip').waitFor();
assert.equal(await page.getByRole('tooltip').evaluate(e=>e.matches(':popover-open')),true);
await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
assert.equal(await create.evaluate(e=>e===document.activeElement),true);
// Failed delete stays in confirm dialog; retry succeeds.
await page.getByRole('button',{name:'Actions for Production app'}).click();await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
overrides['POST /admin/api-keys/batch']={status:500,body:{error:'Delete failed for test'}};
await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
await page.getByRole('dialog').getByRole('alert').waitFor();
assert.equal(await page.getByRole('dialog').getByRole('alert').textContent(),'Delete failed for test');
delete overrides['POST /admin/api-keys/batch'];
await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
// User form is retained on error and reset only after success.
await go('/users');overrides['POST /admin/users']={status:409,body:{error:'User already exists'}};
await page.getByLabel('Username',{exact:true}).fill('Test user');await page.getByLabel('Password',{exact:true}).fill('test-only-password');
await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByRole('alert').waitFor();
assert.equal(await page.getByLabel('Username',{exact:true}).inputValue(),'Test user');
assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'test-only-password');
delete overrides['POST /admin/users'];await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByText('User created.',{exact:true}).waitFor();
assert.equal(await page.getByLabel('Username',{exact:true}).inputValue(),'');
await page.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),1);await page.keyboard.press('Escape');
// Empty vs error, dashboard does not display invented zeroes on failure.
overrides['GET /admin/sessions']={status:500,body:{error:'Sessions unavailable'}};await go('/sessions');
await page.getByRole('alert').waitFor();assert.equal(await page.getByText('No sessions match the current filters.',{exact:true}).count(),0);
overrides['GET /admin/overview']={status:500,body:{error:'Overview unavailable'}};await go('/');
await page.getByRole('alert').waitFor();assert.equal(await page.locator('.metric').count(),0);
// Partial detail/provider failures must not turn unavailable usage into zero metrics.
overrides['GET /admin/api-keys/preview/usage']={status:500,body:{error:'Usage unavailable'}};
overrides['GET /admin/traffic']={status:500,body:{error:'Traffic unavailable'}};
await go('/api-keys/preview');assert.equal(await page.locator('.usage-summary-grid').count(),0);
assert((await page.getByRole('alert').count())>=2);
delete overrides['GET /admin/api-keys/preview/usage'];delete overrides['GET /admin/traffic'];
overrides['GET /admin/providers/usage']={status:500,body:{error:'Provider usage unavailable'}};
await go('/providers');assert.equal(await page.locator('.metric').count(),0);await page.getByRole('alert').waitFor();
delete overrides['GET /admin/providers/usage'];
// Auth outage must not redirect; 401 must redirect.
overrides['GET /admin/auth/me']={status:503,body:{error:'Service unavailable'}};await go('/');
await page.getByRole('button',{name:'Retry',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/');
overrides['GET /admin/auth/me']={status:401,body:{error:'Unauthenticated'}};await page.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForURL('**/login');
overrides={};
// Dense table pins both axes, restores scroll after detail navigation.
fixtures['/admin/api-keys']=list(Array.from({length:40},(_,i)=>({...key,id:i===0?'preview':`key-${i}`,name:i===0?'Production app':`Key ${i}`})));
await go('/api-keys');await page.setViewportSize({width:1024,height:900});
await page.locator('.data-table-scroll').evaluate(e=>{e.scrollTop=250;e.scrollLeft=300;});await page.waitForTimeout(100);
const geometry=await page.locator('.data-table-scroll').evaluate(e=>{const box=e.getBoundingClientRect(),header=e.querySelector('thead th').getBoundingClientRect(),first=e.querySelector('tbody td').getBoundingClientRect(),last=e.querySelector('tbody tr td:last-child').getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,headerTop:header.top,firstLeft:first.left,lastRight:last.right};});
assert(Math.abs(geometry.left-geometry.firstLeft)<2);assert(Math.abs(geometry.top-geometry.headerTop)<2);assert(geometry.lastRight<=geometry.right+1);
assert.equal(await page.locator('.data-table-scroll thead th').first().evaluate(cell=>{const r=cell.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('th')===cell;}),true);
await page.screenshot({path:dir+'/pinned-table.png'});
await page.locator('.data-table-scroll').evaluate(e=>{e.scrollTop=0;e.scrollLeft=200;});await page.waitForTimeout(100);
await page.getByRole('link',{name:'Production app',exact:true}).click();await page.getByRole('button',{name:'Back to API keys',exact:true}).click();
await page.waitForTimeout(150);assert((await page.locator('.data-table-scroll').evaluate(e=>e.scrollLeft))>100);
await page.getByRole('button',{name:'Create key',exact:true}).click();await page.screenshot({path:dir+'/modal-light.png'});await page.keyboard.press('Escape');
assert.deepEqual(errors,[]);console.log('PASS: compact page spacing, full-height lists, stable model colors, debounce, URL/back navigation, retained rows, tooltip, modal focus, delete retry, form errors, query errors, auth outage, sticky table and scroll restoration');
await browser.close();
})().catch(async e=>{if(globalThis.qaPage){await qaPage.screenshot({path:dir+'/failure.png'});console.log('url',qaPage.url());console.log((await qaPage.locator('body').innerText()).slice(-2500));}console.error(e);process.exit(1)});
