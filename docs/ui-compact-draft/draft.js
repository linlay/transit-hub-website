const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const records = [
 {at:'2026-11-16 09:42',actor:'admin.demo',org:'研发组织',action:'调整成员额度',via:'控制台',result:'成功',reason:'季度预算调整'},
 {at:'2026-11-15 16:20',actor:'ops.demo',org:'产品组织',action:'编辑组织',via:'API',result:'成功',reason:'更新组织名称'},
 {at:'2026-11-14 11:05',actor:'reader.demo',org:'研发组织',action:'更新价格',via:'MCP',result:'拒绝',reason:'权限范围不足'},
 {at:'2026-11-12 10:18',actor:'admin.demo',org:'研发组织',action:'创建组织',via:'控制台',result:'成功',reason:'建立研发预算组'}
];
let theme = 'light';
$('#theme').onclick = () => {
 theme = theme === 'light' ? 'dark' : 'light';
 document.documentElement.dataset.theme = theme;
 $('#theme').textContent = theme === 'dark' ? '切换浅色' : '切换深色';
 $('#theme').setAttribute('aria-pressed', String(theme === 'dark'));
 $('#baseline').contentWindow.postMessage(theme, '*');
};
$('#baseline').onload = () => $('#baseline').contentWindow.postMessage(theme, '*');
$$('[data-open]').forEach(b => b.onclick = () => $('#create-dialog').showModal());
$$('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#save-example').onclick = () => {
 const input = $('#org-name'); const invalid = !input.value.trim();
 input.setAttribute('aria-invalid', String(invalid));
 input.setAttribute('aria-describedby', 'org-error');
 $('#org-error').hidden = !invalid;
 if (invalid) { input.focus(); return; }
 $('#create-dialog').close();
 $('#button-status').textContent = '已保存演示状态：' + input.value.trim() + '（未写入后端）';
};
$('#org-name').oninput = e => { if(e.target.value.trim()) { e.target.removeAttribute('aria-invalid'); $('#org-error').hidden=true; } };
function field(name) { return document.querySelector(`[name="${name}"]`); }
function render() {
 const q=field('q').value.trim().toLowerCase(),org=field('org').value,via=field('via').value,result=field('result').value,from=field('from').value,to=field('to').value;
 const valid=!!from && !!to && from<=to;
 const filtered=valid ? records.filter(r=>(!q||Object.values(r).join(' ').toLowerCase().includes(q))&&(!org||r.org===org)&&(!via||r.via===via)&&(!result||r.result===result)&&r.at.slice(0,10)>=from&&r.at.slice(0,10)<=to) : [];
 const body=$('#audit-rows'); body.replaceChildren();
 filtered.forEach(r=>{
  const tr=document.createElement('tr');
  [r.at,r.actor,r.org,r.action,r.via].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});
  const resultCell=document.createElement('td'),pill=document.createElement('span');pill.className='pill'+(r.result==='拒绝'?' danger':'');pill.textContent=r.result;resultCell.append(pill);tr.append(resultCell);
  const action=document.createElement('td'),button=document.createElement('button');button.className='btn ghost icon'; const icon=document.createElement('img');icon.className='dark-icon';icon.src='icons/eye.svg';icon.alt='';button.append(icon);button.title='查看详情';button.setAttribute('aria-label',`查看 ${r.at} ${r.action} 详情`);button.onclick=()=>{
   $('#detail-body').replaceChildren(); const table=document.createElement('table');table.className='rule-table';
   [['时间',r.at],['管理员',r.actor],['组织',r.org],['操作',r.action],['来源',r.via],['结果',r.result],['原因',r.reason]].forEach(([k,v])=>{const row=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.textContent=k;td.textContent=v;row.append(th,td);table.append(row);});
   $('#detail-body').append(table);$('#detail-dialog').showModal();
  };action.append(button);tr.append(action);body.append(tr);
 });
 if(!filtered.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent=valid?'暂无符合条件的示例记录':'请选择有效的开始和结束日期。';tr.append(td);body.append(tr);}
 const active=[org,via,result].filter(Boolean).length+Number(from!=='2026-11-10'||to!=='2026-11-16');
 $('#open-filters').textContent=`筛选 (${active})`;
 $('#result-status').textContent=valid?`显示 ${filtered.length} / ${records.length} 条示例记录 · ${active} 组筛选生效`:'日期范围无效：开始日期不得晚于结束日期。';
 $('#result-status').style.color=valid?'':'var(--color-danger)';
 field('from').setAttribute('aria-invalid',String(!valid));field('to').setAttribute('aria-invalid',String(!valid));
}
$('#audit-form').onsubmit=e=>{e.preventDefault();render();};
function reset(){['q','org','via','result'].forEach(n=>field(n).value='');field('from').value='2026-11-10';field('to').value='2026-11-16';render();}
$('#audit-form').onreset=e=>{e.preventDefault();reset();};
$('#filter-fields').addEventListener('change',render);
$('#reset-mobile').onclick=reset;
$('#open-filters').onclick=()=>$('#filters-dialog').showModal();
const mq=matchMedia('(max-width:760px)');
function arrange(){if($('#filters-dialog').open)$('#filters-dialog').close();(mq.matches?$('#mobile-filter-slot'):$('#filter-slot')).append($('#filter-fields'));$('#filter-fields details').open=mq.matches;}
mq.addEventListener('change',arrange);arrange();render();
$('#query-jump').onclick=()=>{$('#query-demo').scrollIntoView();field('q').focus();};
$('#reset-sample').onclick=()=>{reset();$('#button-status').textContent='示例条件已重置。';};
$('#refresh-sample').onclick=()=>$('#button-status').textContent='示例已刷新，合成记录共4条。';
$('#danger-sample').onclick=()=>$('#button-status').textContent='危险按钮样式示例；没有执行任何撤销操作。';
// Keep helper/error text out of the accessible field name.
$$('label.field').forEach(label=>{const ctl=label.querySelector('input,select,textarea');const title=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(ctl&&title)ctl.setAttribute('aria-label',title.textContent.trim());});

document.addEventListener('pointerdown',()=>document.documentElement.dataset.input='pointer',true);
document.addEventListener('keydown',e=>{if(e.key==='Tab')document.documentElement.dataset.input='keyboard';},true);
// Draft-only unified select. Native values remain the single source for mock filters.
const selectEntries=[];let openedSelect=null;let activeOption=0;
function syncSelects(){selectEntries.forEach(({native,button})=>{button.querySelector('span').textContent=native.selectedOptions[0]?.textContent||'请选择';button.setAttribute('aria-invalid',native.getAttribute('aria-invalid')||'false');});}
function closeSelect(){if(!openedSelect)return;openedSelect.menu.remove();openedSelect.button.setAttribute('aria-expanded','false');openedSelect.button.removeAttribute('aria-activedescendant');openedSelect=null;}
function openSelect(entry){closeSelect();if(entry.native.disabled)return;const menu=document.createElement('div');menu.className='select-menu';menu.setAttribute('popover','manual');menu.id=entry.button.id+'-options';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',entry.button.getAttribute('aria-label'));entry.menu=menu;openedSelect=entry;activeOption=Math.max(0,entry.native.selectedIndex);
 [...entry.native.options].forEach((o,index)=>{const item=document.createElement('div');item.className='select-option';item.id=menu.id+'-'+index;item.setAttribute('role','option');item.setAttribute('aria-selected',String(o.selected));item.setAttribute('aria-disabled',String(o.disabled));const text=document.createElement('span');text.textContent=o.textContent;item.append(text);if(o.selected){const dot=document.createElement('span');dot.className='chosen';item.append(dot);}item.onclick=e=>{e.preventDefault();chooseOption(index);};menu.append(item);});
 (entry.button.closest('dialog')||document.body).append(menu);menu.showPopover();entry.button.setAttribute('aria-expanded','true');entry.button.setAttribute('aria-controls',menu.id);const r=entry.button.getBoundingClientRect(),height=Math.min(menu.scrollHeight,innerWidth<=760?280:240);menu.style.width=Math.max(r.width,160)+'px';menu.style.left=Math.max(8,Math.min(r.left,innerWidth-Math.max(r.width,160)-8))+'px';menu.style.top=(r.bottom+4+height<innerHeight?r.bottom+4:Math.max(8,r.top-height-4))+'px';highlightOption();}
function highlightOption(){if(!openedSelect)return;[...openedSelect.menu.children].forEach((item,i)=>item.classList.toggle('is-active',i===activeOption));openedSelect.button.setAttribute('aria-activedescendant',openedSelect.menu.children[activeOption]?.id||'');const item=openedSelect.menu.children[activeOption];if(item){const menu=openedSelect.menu;if(item.offsetTop<menu.scrollTop)menu.scrollTop=item.offsetTop;else if(item.offsetTop+item.offsetHeight>menu.scrollTop+menu.clientHeight)menu.scrollTop=item.offsetTop+item.offsetHeight-menu.clientHeight;}}
function chooseOption(index){if(!openedSelect||openedSelect.native.options[index]?.disabled)return;const entry=openedSelect;entry.native.selectedIndex=index;entry.native.dispatchEvent(new Event('change',{bubbles:true}));syncSelects();closeSelect();entry.button.focus();}
$$('select').forEach((native,i)=>{const button=document.createElement('button');button.type='button';button.id='draft-select-'+i;button.className='custom-select';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',native.getAttribute('aria-label')||native.closest('label')?.querySelector('span')?.textContent||[...native.closest('label').childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())?.textContent.trim()||'选择');button.disabled=native.disabled;const text=document.createElement('span'),chevron=document.createElement('img');chevron.src='icons/chevron-down.svg';chevron.alt='';button.append(text,chevron);native.hidden=true;native.after(button);const entry={native,button};selectEntries.push(entry);button.onclick=e=>{e.preventDefault();openedSelect?.button===button?closeSelect():openSelect(entry);};button.onkeydown=e=>{
 if(['ArrowDown','ArrowUp','Enter',' ','Escape','Home','End','Tab'].includes(e.key)){
  if(e.key==='Tab'){closeSelect();return;}e.preventDefault();if(e.key==='Escape'){closeSelect();return;}if(!openedSelect){openSelect(entry);return;}if(e.key==='Enter'||e.key===' '){chooseOption(activeOption);return;}activeOption=e.key==='Home'?0:e.key==='End'?native.options.length-1:(activeOption+(e.key==='ArrowUp'?-1:1)+native.options.length)%native.options.length;highlightOption();
 }else if(e.key.length===1){const found=[...native.options].findIndex(o=>o.textContent.toLowerCase().startsWith(e.key.toLowerCase()));if(found>=0){if(!openedSelect)openSelect(entry);activeOption=found;highlightOption();}}
 };native.addEventListener('change',syncSelects);});
syncSelects();document.addEventListener('pointerdown',e=>{if(openedSelect&&!openedSelect.menu.contains(e.target)&&!openedSelect.button.contains(e.target))closeSelect();},true);document.addEventListener('wheel',e=>{if(openedSelect&&!openedSelect.menu.contains(e.target))closeSelect();},true);window.addEventListener('resize',closeSelect);$$('dialog').forEach(d=>d.addEventListener('close',closeSelect));$('#audit-form').addEventListener('reset',()=>queueMicrotask(syncSelects));$('#reset-mobile').addEventListener('click',syncSelects);$('#reset-sample').addEventListener('click',syncSelects);
const dateEntries=[];let activeCalendar=null;const todayISO='2026-11-16';
function syncDates(){dateEntries.forEach(({native,button})=>{button.querySelector('span').textContent=native.value?native.value.replaceAll('-',' / '):'选择日期';button.setAttribute('aria-invalid',native.getAttribute('aria-invalid')||'false');});}
function closeCalendar(){if(!activeCalendar)return;activeCalendar.popup.remove();activeCalendar.button.setAttribute('aria-expanded','false');activeCalendar=null;}
function isoDate(year,month,day){return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function showCalendar(entry){closeCalendar();closeSelect();const base=entry.native.value||todayISO,[y,m]=base.split('-').map(Number);activeCalendar={...entry,year:y,month:m-1};const popup=document.createElement('div');popup.className='calendar';popup.setAttribute('popover','manual');popup.setAttribute('role','dialog');popup.setAttribute('aria-label','选择'+entry.button.getAttribute('aria-label'));activeCalendar.popup=popup;(entry.button.closest('dialog')||document.body).append(popup);popup.showPopover();entry.button.setAttribute('aria-expanded','true');drawCalendar();const r=entry.button.getBoundingClientRect(),h=popup.getBoundingClientRect().height,w=popup.getBoundingClientRect().width;popup.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';popup.style.top=(r.bottom+h+4<innerHeight?r.bottom+4:Math.max(8,r.top-h-4))+'px';popup.querySelector('[aria-pressed=true]')?.focus();}
function drawCalendar(focusDate){const c=activeCalendar;if(!c)return;const p=c.popup;p.replaceChildren();const head=document.createElement('div');head.className='calendar-head';const title=document.createElement('strong');title.textContent=`${c.year}年 ${c.month+1}月`;
 function nav(name,icon,delta){const b=document.createElement('button');b.className='btn icon';b.setAttribute('aria-label',name);const img=document.createElement('img');img.src=`icons/${icon}.svg`;img.alt='';b.append(img);b.onclick=()=>{const d=new Date(c.year,c.month+delta,1);c.year=d.getFullYear();c.month=d.getMonth();drawCalendar();p.querySelector(`[aria-label="${name}"]`).focus();};return b;}
 head.append(nav('上个月','chevron-left',-1),title,nav('下个月','chevron-right',1));p.append(head);const grid=document.createElement('div');grid.className='calendar-grid';['一','二','三','四','五','六','日'].forEach(text=>{const el=document.createElement('span');el.className='weekday';el.textContent=text;grid.append(el);});const offset=(new Date(c.year,c.month,1).getDay()+6)%7;for(let i=0;i<offset;i++)grid.append(document.createElement('span'));const count=new Date(c.year,c.month+1,0).getDate();
 for(let day=1;day<=count;day++){const iso=isoDate(c.year,c.month,day),b=document.createElement('button');b.className='calendar-day'+(iso===todayISO?' today':'');b.textContent=day;b.dataset.date=iso;b.setAttribute('aria-label',iso);b.setAttribute('aria-pressed',String(iso===c.native.value));b.onclick=()=>{c.native.value=iso;c.native.dispatchEvent(new Event('change',{bubbles:true}));syncDates();closeCalendar();c.button.focus();};b.onkeydown=e=>{const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(step){e.preventDefault();const d=new Date(c.year,c.month,day+step);c.year=d.getFullYear();c.month=d.getMonth();drawCalendar(isoDate(c.year,c.month,d.getDate()));}};grid.append(b);}p.append(grid);
 const foot=document.createElement('div');foot.className='calendar-footer';const current=document.createElement('button');current.className='btn ghost';current.textContent='今天';current.onclick=()=>{c.native.value=todayISO;c.native.dispatchEvent(new Event('change',{bubbles:true}));syncDates();closeCalendar();c.button.focus();};const close=document.createElement('button');close.className='btn ghost';close.textContent='关闭';close.onclick=()=>{closeCalendar();c.button.focus();};foot.append(current,close);p.append(foot);p.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeCalendar();c.button.focus();}};if(focusDate)p.querySelector(`[data-date="${focusDate}"]`)?.focus();}
$$('input[type=date]').forEach(native=>{const button=document.createElement('button');button.type='button';button.className='custom-date';button.setAttribute('aria-label',native.getAttribute('aria-label')||native.closest('label')?.querySelector('span')?.textContent||'日期');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');const span=document.createElement('span'),icon=document.createElement('img');icon.src='icons/calendar.svg';icon.alt='';button.append(span,icon);native.hidden=true;native.after(button);const entry={native,button};dateEntries.push(entry);button.onclick=e=>{e.preventDefault();activeCalendar?.button===button?closeCalendar():showCalendar(entry);};native.addEventListener('change',syncDates);});syncDates();
document.addEventListener('pointerdown',e=>{if(activeCalendar&&!activeCalendar.popup.contains(e.target)&&!activeCalendar.button.contains(e.target))closeCalendar();},true);document.addEventListener('wheel',e=>{if(activeCalendar&&!activeCalendar.popup.contains(e.target))closeCalendar();},true);window.addEventListener('resize',closeCalendar);$$('dialog').forEach(d=>d.addEventListener('close',closeCalendar));$('#audit-form').addEventListener('reset',()=>queueMicrotask(syncDates));$('#reset-mobile').addEventListener('click',syncDates);$('#reset-sample').addEventListener('click',syncDates);
