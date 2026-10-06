import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('data/treasury/neta-main-accounting.json', root)));
// Pin the archived first purchase; later live sales must not change fixture totals.
ledger.entries = ledger.entries.filter(row => row.tx_hash === '85689A2C75DE86829D4116FA0AABBA5062D269679CA139984E169E8E2ACF8DC1');
assert.equal(ledger.entries.length, 1);
ledger.refresh_status = 'completed'; ledger.last_success_at = new Date().toISOString();
const receipt = ledger.entries[0];
ledger.movement_review = { status:'PARTIAL',event_refresh_status:'PARTIAL',accounting_start:'2026-10-01T00:00:00Z',matched_receipts:1,unmatched_receipt_ids:[],unreviewed_movements:0,
  movements:[{id:receipt.id,tx_hash:receipt.tx_hash,timestamp:receipt.timestamp,denom:`cw20:${receipt.token}`,direction:'in',raw_amount:receipt.raw_amount,counterparty:receipt.registry,classification:receipt.category,usd_value:receipt.usd_value,receipt_id:receipt.id}]};
const eventFixture = {scope:ledger.scope,status:'PARTIAL',warnings:[],treasuries:[{chain_id:ledger.chain_id,address:ledger.treasury_address}],events:[{...receipt,type:'inflow',title:'4.755098 NETA received',explorer_url:'https://atomscan.com/juno/transactions/'+receipt.tx_hash,movements:[{...ledger.movement_review.movements[0],message_index:receipt.message_index,amount:'4.755098',symbol:'NETA'}]}]};

const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const body = await readFile(new URL('.' + path, root));
    res.writeHead(200, { 'content-type': /\.m?js$/.test(path) ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : path.endsWith('.webp') ? 'image/webp' : 'text/html' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext();
  await context.route('https://**/*', route => route.abort());
  await context.route('**/neta-main-accounting.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ledger) }));
  await context.route('**/neta-main-events.json*', route => route.fulfill({ contentType:'application/json', body:JSON.stringify(eventFixture) }));
  const daos = JSON.parse(await readFile(new URL('data/dao-directory.json', root))).daos;
  const genericFixture = dao => ({schema_version:2,dao_id:dao.id,chain_id:dao.network,...dao.accountingSource,
    accounting_start:'2026-10-01T00:00:00Z',refresh_status:'completed',last_success_at:new Date().toISOString(),
    entries:[],coverage_gaps:dao.id==='juno'?['Block allocations and module payouts remain incomplete.']:[],
    sources:dao.accountingSource.treasuries.map(t=>({...t,adapter:'cosmos-rest-receipts',accounting_start:'2026-10-01T00:00:00Z',last_scanned_height:100,anchor_hash:'A'.repeat(64)})),
    movement_review:{status:'PARTIAL',event_refresh_status:'PARTIAL',accounting_start:'2026-10-01T00:00:00Z',movements:[],unmatched_receipt_ids:[],matched_receipts:0,unreviewed_movements:0}});
  for (const dao of daos.filter(d=>d.id!=='neta')) {
    await context.route(`**/${dao.accountingSource.file}*`, route=>route.fulfill({contentType:'application/json',body:JSON.stringify(genericFixture(dao))}));
    await context.route(`**/${dao.events}*`,route=>route.fulfill({contentType:'application/json',body:JSON.stringify({scope:dao.accountingSource.scope,treasuries:dao.accountingSource.treasuries,status:'PARTIAL',events:[],warnings:[]})}));
  }
  await context.addInitScript(() => { if (!localStorage.getItem('neta-governance-selected-dao')) localStorage.setItem('neta-governance-selected-dao', 'neta'); });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html#treasury`);
  await page.locator('#pnl-year').selectOption('2026');
  await page.locator('#pnl-month').selectOption('10');
  await page.waitForFunction(() => document.querySelector('#pnl-rows').textContent.includes('$5.00'));
  assert.deepEqual(await page.locator('#pnl-year option').allTextContents(), ['2026','2027','2028']);
  assert.match(await page.locator('#pnl-coverage').innerText(), /Provisional · recorded transactions/);
  assert.equal(await page.locator('.allocation-card,.risk-card,.cashflow-card,.pnl-observed,#pnl-detail,.pnl-kpis').count(), 0);
  assert.equal(await page.locator('#pnl-account-nns_registration').isVisible(), false);
  await page.getByRole('button', { name: '+ Income', exact: true }).click();
  assert.equal(await page.locator('[data-section="income"]').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('[data-section="income"]').evaluate(e => e === document.activeElement), true);
  const detailLink = await page.locator('#pnl-account-nns_registration th a').getAttribute('href');
  assert.match(detailLink, /year=2026&month=10&type=nns_registration/);
  assert.equal(await page.locator('#pnl-month option[value="9"]').evaluate(e => e.disabled), true);
  await page.locator('#pnl-month').selectOption('11');
  assert.doesNotMatch(await page.locator('#pnl-rows').innerText(), /\$5.00/);
  await page.locator('#pnl-month').selectOption('all');
  assert.match(await page.locator('#pnl-rows').innerText(), /\$5.00/);
  await page.locator('#pnl-year').selectOption('2027');
  assert.match(await page.locator('#pnl-coverage').innerText(), /Future period/);
  await page.locator('#pnl-year').selectOption('2026');
  await page.locator('#pnl-month').selectOption('10');
  assert.match(await page.locator('.pnl-result').innerText(), /\$5.00/);
  await page.getByRole('button', { name:'+ Expenses', exact:true }).click();
  assert.match(await page.locator('#pnl-account-development').innerText(), /\$0.00/);
  assert.match(await page.locator('#treasury-events').innerText(), /Income · NNS registrations/);
  const screenshots = process.env.NNS_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1800 });
    await page.locator('#treasury-pnl').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `overflow at ${width}`);
    assert.equal(await page.locator('#treasury-pnl .pnl-table-wrap').evaluate(e => e.scrollWidth <= e.clientWidth+1), true, `statement needs horizontal scroll at ${width}`);
    assert.equal(await page.locator('#pnl-year').evaluate(e => getComputedStyle(e).color === 'rgb(242, 244, 247)'), true);
    if (screenshots) await page.locator('#treasury-events').screenshot({ path: `${screenshots}/treasury-events-${width}.png`, style: ".gov-header { visibility:hidden !important; }" });
    if (screenshots) await page.locator('#treasury-pnl').screenshot({ path: `${screenshots}/treasury-pnl-${width}.png`, style: ".gov-header { visibility:hidden !important; }" });
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.locator('#pnl-year').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#pnl-month').evaluate(e => e === document.activeElement), true);
  // Categories persist per action and DAO; editing a payment invalidates its binding.
  await page.locator('[data-workspace-view=governance]').click();
  await page.locator('#new-draft').click();
  await page.locator('#proposal-title').fill('Community grant');
  await page.locator('#proposal-summary').fill('Fund a community project');
  await page.locator('#proposal-body').fill('A reviewed grant, paid only after execution.');
  const payment = {bank:{send:{to_address:'juno1recipient',amount:[{denom:'ujuno',amount:'1000000'}]}}};
  await page.locator('#proposal-actions').fill(JSON.stringify([payment]));
  await page.locator('#save-local').click();
  assert.match(await page.locator('#gov-status').innerText(),/SELECT A SPENDING CATEGORY FOR ACTION 1/);
  await page.getByLabel('Action 1 spending category',{exact:true}).selectOption('grants');
  await page.locator('#save-local').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('neta-governance-local-draft:neta')));
  assert.equal(JSON.parse(saved.actions_json).find(a=>a.type==='dao_accounting_v1').allocations[0].category,'grants');
  await page.locator('#new-draft').click();
  assert.equal(await page.getByLabel('Action 1 spending category',{exact:true}).inputValue(),'grants');
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1400});
    await page.locator('#proposal-accounting').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`proposal overflow at ${width}`);
    if(screenshots)await page.locator('.actions-panel').screenshot({path:`${screenshots}/proposal-categories-${width}.png`,style:'.gov-header { visibility:hidden !important; }'});
  }
  payment.bank.send.amount[0].amount='2000000';
  await page.locator('#proposal-actions').fill(JSON.stringify([payment]));
  assert.equal(await page.getByLabel('Action 1 spending category',{exact:true}).inputValue(),'');
  await page.locator('#save-local').click();
  assert.match(await page.locator('#gov-status').innerText(),/SELECT A SPENDING CATEGORY/);
  await page.locator('[data-workspace-view=treasury]').click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('neta:dao-change', { detail: { id: 'juno' } })));
  await page.waitForFunction(() => document.querySelector('#pnl-coverage').textContent.includes('Connected · module coverage incomplete'));
  assert.doesNotMatch(await page.locator('.pnl-result').innerText(), /\$0.00/);
  assert.doesNotMatch(await page.locator('#pnl-rows').textContent(), /NNS|cristiano|\$5.00/);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('neta:dao-change', { detail: { id: 'neta-operations' } })));
  await page.waitForFunction(() => document.querySelector('#pnl-coverage').textContent.includes('Provisional'));
  assert.match(await page.locator('.pnl-result').innerText(), /\$0.00/);
  assert.doesNotMatch(await page.locator('#pnl-rows').innerText(), /NNS|\$5.00/);
  for (const daoId of ['neta-operations', 'juno']) {
    await page.evaluate(id=>window.dispatchEvent(new CustomEvent('neta:dao-change',{detail:{id}})),daoId);
    await page.waitForFunction(()=>!document.querySelector('#treasury-refresh').disabled);
    for (const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:1200});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${daoId} overflow at ${width}`);
      if(screenshots)await page.locator('#treasury-pnl').screenshot({path:`${screenshots}/${daoId}-accounting-${width}.png`,style:'.gov-header { visibility:hidden !important; }'});
    }
  }
  const ops=daos.find(d=>d.id==='neta-operations');
  await context.route('**/neta-operations-accounting.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({...genericFixture(ops),treasuries:[]})}));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('neta:dao-change',{detail:{id:'neta-operations'}})));
  await page.waitForFunction(()=>document.querySelector('#pnl-coverage').textContent.includes('identity unavailable'));
  assert.doesNotMatch(await page.locator('.pnl-result').innerText(),/\$0.00/);
  // Foreign accounting source fails closed; a failed fetch is not zero revenue.
  await context.route('**/neta-main-accounting.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...ledger, treasury_address: 'wrong' }) }));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('neta:dao-change', { detail: { id: 'neta' } })));
  await page.waitForFunction(() => document.querySelector('#pnl-coverage').textContent.includes('identity unavailable'));
  assert.doesNotMatch(await page.locator('#pnl-rows').textContent(), /\$5.00/);
  await context.unroute('**/neta-main-accounting.json*');
  await context.route('**/neta-main-accounting.json*', route => route.abort());
  await page.locator('#treasury-refresh').click();
  await page.waitForFunction(() => !document.querySelector('#treasury-refresh').disabled);
  assert.doesNotMatch(await page.locator('#pnl-rows').textContent(), /\$5.00/);
  // Dedicated register keeps period/type deep links, validates identity and lists every matching receipt.
  await context.unroute('**/neta-main-accounting.json*');
  const renewal = structuredClone(ledger.entries[0]);
  renewal.tx_hash = 'B'.repeat(64); renewal.id = `juno-1:${renewal.tx_hash}:0`; renewal.category = 'nns_renewal';
  await context.route('**/neta-main-accounting.json*', route => route.fulfill({ contentType:'application/json', body:JSON.stringify({...ledger, entries:[...ledger.entries,renewal]}) }));
  await page.goto(`http://127.0.0.1:${server.address().port}/${detailLink}`);
  await page.waitForFunction(() => document.querySelector('#nns-summary').textContent.includes('1 matched payment'));
  assert.match(await page.locator('#nns-payments').innerText(), /cristiano.neta/);
  assert.match(await page.locator('#nns-payments').innerText(), /4.755098/);
  await page.locator('#nns-type').selectOption('all');
  assert.equal(await page.locator('#nns-payments tr').count(), 2);
  assert.match(await page.locator('#nns-total').innerText(), /\$10.00/);
  await page.locator('#nns-type').selectOption('nns_renewal');
  assert.equal(await page.locator('#nns-payments tr').count(), 1);
  assert.equal(await page.locator('#nns-month option[value="9"]').evaluate(e => e.disabled), true);
  await page.locator('#nns-month').selectOption('11');
  assert.equal(await page.locator('#nns-payments tr').count(), 0);
  assert.match(await page.locator('#nns-empty').innerText(), /not started/);
  await page.locator('#nns-year').selectOption('2028');
  assert.match(await page.locator('#nns-empty').innerText(), /not started/);
  await page.locator('#nns-year').selectOption('2026');
  await page.locator('#nns-month').selectOption('10');
  await page.locator('#nns-type').selectOption('all');
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1400});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), true, `register overflow ${width}`);
    if(screenshots) await page.screenshot({path:`${screenshots}/nns-transactions-${width}.png`,fullPage:true});
  }
  await page.evaluate(() => localStorage.setItem('neta-governance-selected-dao','juno'));
  await page.locator('#nns-back').click();
  await page.waitForFunction(() => document.querySelector('#pnl-year')?.value === '2026');
  assert.equal(await page.evaluate(() => window.NETA_SELECTED_DAO),'neta');
  assert.equal(await page.locator('#pnl-year').inputValue(),'2026');
  assert.equal(await page.locator('#pnl-month').inputValue(),'10');
  await page.goBack();
  await context.unroute('**/neta-main-accounting.json*');
  await context.route('**/neta-main-accounting.json*', route => route.fulfill({contentType:'application/json',body:JSON.stringify({...ledger,treasury_address:'wrong'})}));
  await page.locator('#nns-refresh').click();
  await page.waitForFunction(() => document.querySelector('#nns-summary').textContent.includes('identity unavailable'));
  assert.equal(await page.locator('#nns-payments tr').count(),0);
  await context.unroute('**/neta-main-accounting.json*');
  await context.route('**/neta-main-accounting.json*', route => route.abort());
  await page.locator('#nns-refresh').click();
  await page.waitForFunction(() => !document.querySelector('#nns-refresh').disabled);
  assert.match(await page.locator('#nns-empty').innerText(), /could not be loaded/);
  assert.deepEqual(errors, []);
  console.log('Treasury P&L: real archived receipt, periods, category drilldown, identity/fetch failure, DAO isolation, keyboard and 320–1440px passed');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
