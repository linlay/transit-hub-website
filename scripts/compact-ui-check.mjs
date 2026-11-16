import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkCompactUI(page, address, output, locale, msg) {
  await page.setViewportSize({width:1280,height:900});
  await page.goto(address+'/audit-logs');
  const source=page.getByRole('combobox',{name:msg('Source'),exact:true});
  await source.click();
  await page.getByRole('listbox').waitFor({state:'visible'});
  await page.getByRole('listbox').getByRole('option',{name:'MCP',exact:true}).click();
  assert.equal(await source.inputValue(),'mcp','pointer select commits original value');
  await source.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Enter');
  assert.equal(await source.inputValue(),'','keyboard Home/Enter selects first option');
  await source.click();await page.keyboard.press('Tab');assert.equal(await page.getByRole('listbox').count(),0);
  await source.focus();await page.keyboard.press('Tab');
  const focus=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle);
  assert.equal(focus,'solid','Tab focus visible');
  await page.goto(address+'/upstream-pricing');
  await page.getByRole('button',{name:msg('Add upstream price'),exact:true}).click();
  const dialog=page.locator('dialog.dialog');
  await dialog.locator('select').first().click();
  assert.ok(await page.getByRole('listbox').evaluate(e=>e.matches(':popover-open')),'select top layer in dialog');
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),1,'first Escape only dismisses select');
  await dialog.locator('.date-trigger').click();
  assert.ok(await page.locator('.calendar-popover').evaluate(e=>e.matches(':popover-open')),'calendar top layer in dialog');
  await page.locator('.calendar-today').click();
  assert.match(await dialog.locator('.date-control input').inputValue(),/^2026-11-16T00:00$/,'local datetime preserved');
  const input=dialog.locator('.date-control input');
  await input.fill('invalid');await input.blur();await page.waitForFunction(()=>document.querySelector('.date-control input')?.getAttribute('aria-invalid')==='true');assert.equal(await input.evaluate(e=>e.checkValidity()),false,'invalid date rejected');
  await page.keyboard.press('Escape');
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
  await page.goto(address+'/users');
  assert.ok(await page.locator('main input').first().evaluate(e=>e.getBoundingClientRect().height>=44),'coarse input target');
  assert.ok(await page.locator('.topbar .primary').evaluate(e=>e.getBoundingClientRect().height>=44),'coarse button target');
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
  await page.evaluate(()=>localStorage.setItem('transit-hub.theme','light'));
  for (const width of [320, 390, 760, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    console.log(`Compact matrix ${locale} ${width}`);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { localStorage.setItem('transit-hub.theme', theme); document.documentElement.dataset.theme = theme; }, theme);
      for (const route of ['/employee-keys', '/traffic', '/users', '/directory', '/pricing', '/ledger', '/audit-logs', '/request-trace', '/mcp-access']) {
        await page.goto(address + route);
        await page.locator('main section.page').first().waitFor();
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        assert.equal(await page.evaluate(() => document.body.scrollWidth > innerWidth + 2), false, `${width} ${theme} ${route} overflow`);
        assert.ok(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1), `${width} ${route} document scroll`);
        if(route==='/request-trace'){
          const ref=page.locator('td .request-reference').first();await ref.waitFor();
          await ref.evaluate(e=>{e.textContent='request_'+ 'long_identifier_'.repeat(20);e.title=e.textContent;});
          assert.equal(await page.evaluate(()=>document.body.scrollWidth>innerWidth+2),false,'long request ID overflow');
        }
        if(theme==='dark'&&((width===1280&&route==='/traffic')||(width===320&&route==='/employee-keys')))await page.screenshot({path:path.join(output,`${locale}-compact-${width}-dark-${route.slice(1)}.png`)});
        if (route === '/audit-logs') {
          if(width<=760)await page.locator('.mobile-filter-trigger').click();
          assert.equal(await page.locator('.date-control input').first().evaluate(e => e.getBoundingClientRect().height), width <= 760 ? 44 : 32);
          const calendar = page.locator('.date-trigger').first();
          await calendar.click();
          const popup = page.locator('.calendar-popover');
          await popup.waitFor({state:'visible'});
          assert.ok(await popup.evaluate(e => { const r=e.getBoundingClientRect(); return e.matches(':popover-open') && r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight; }), 'calendar top-layer bounds');
          await page.screenshot({ path: path.join(output, `${locale}-compact-${width}-${theme}.png`) });
          await page.keyboard.press('ArrowRight');
          await page.keyboard.press('Escape');
          await popup.waitFor({state:'detached'});
          if(width<=760){await page.keyboard.press('Escape');await page.locator('dialog.dialog').waitFor({state:'detached'});}
        }
      }
    }
  }
  console.log(`Compact UI passed: ${locale}, 90 theme/viewport/route checks, themed select/calendar, modal top layer, keyboard and date validation.`);
}
