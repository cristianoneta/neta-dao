import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('data/treasury/neta-main-accounting.json', root)));
// Pin the archived first purchase; later live sales must not change fixture totals.
ledger.entries = ledger.entries.filter(row => row.tx_hash === '85689A2C75DE86829D4116FA0AABBA5062D269679CA139984E169E8E2ACF8DC1');
assert.equal(ledger.entries.length, 1);
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
  await context.addInitScript(() => { if (!localStorage.getItem('neta-governance-selected-dao')) localStorage.setItem('neta-governance-selected-dao', 'neta'); });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html#treasury`);
  await page.locator('#pnl-year').selectOption('2026');
  await page.locator('#pnl-month').selectOption('10');
  await page.waitForFunction(() => document.querySelector('#pnl-rows').textContent.includes('$5.00'));
  assert.deepEqual(await page.locator('#pnl-year option').allTextContents(), ['2026','2027','2028']);
  assert.match(await page.locator('#pnl-coverage').innerText(), /Partial coverage/);
  assert.equal(await page.locator('.allocation-card,.risk-card,.cashflow-card,.pnl-observed,#pnl-detail,.pnl-kpis').count(), 0);
  assert.equal(await page.locator('#pnl-account-nns_registration').isVisible(), false);
  await page.getByRole('button', { name: '+ Income', exact: true }).click();
  assert.equal(await page.locator('[data-section="income"]').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('[data-section="income"]').evaluate(e => e === document.activeElement), true);
  const detailLink = await page.locator('#pnl-account-nns_registration th a').getAttribute('href');
  assert.match(detailLink, /year=2026&month=10&type=nns_registration/);
  await page.locator('#pnl-month').selectOption('9');
  assert.doesNotMatch(await page.locator('#pnl-rows').innerText(), /\$5.00/);
  await page.locator('#pnl-month').selectOption('all');
  assert.match(await page.locator('#pnl-rows').innerText(), /\$5.00/);
  await page.locator('#pnl-year').selectOption('2027');
  assert.match(await page.locator('#pnl-coverage').innerText(), /Future period/);
  await page.locator('#pnl-year').selectOption('2026');
  await page.locator('#pnl-month').selectOption('10');
  const screenshots = process.env.NNS_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#treasury-pnl').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `overflow at ${width}`);
    assert.equal(await page.locator('#pnl-year').evaluate(e => getComputedStyle(e).color === 'rgb(242, 244, 247)'), true);
    if (screenshots) await page.locator('#treasury-pnl').screenshot({ path: `${screenshots}/treasury-pnl-${width}.png`, style: ".gov-header { visibility:hidden !important; }" });
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.locator('#pnl-year').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#pnl-month').evaluate(e => e === document.activeElement), true);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('neta:dao-change', { detail: { id: 'juno' } })));
  await page.waitForFunction(() => document.querySelector('#pnl-coverage').textContent.includes('not connected'));
  assert.doesNotMatch(await page.locator('#pnl-rows').textContent(), /NNS|cristiano|\$5.00/);
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
  await page.locator('#nns-month').selectOption('9');
  assert.equal(await page.locator('#nns-payments tr').count(), 0);
  assert.match(await page.locator('#nns-empty').innerText(), /No matched payments/);
  await page.locator('#nns-year').selectOption('2028');
  assert.match(await page.locator('#nns-empty').innerText(), /not started/);
  await page.locator('#nns-year').selectOption('2026');
  await page.locator('#nns-month').selectOption('10');
  await page.locator('#nns-type').selectOption('all');
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1000});
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
