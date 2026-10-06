import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('data/treasury/neta-main-accounting.json', root)));
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
  await context.addInitScript(() => localStorage.setItem('neta-governance-selected-dao', 'neta'));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html#treasury`);
  await page.locator('#pnl-year').selectOption('2026');
  await page.locator('#pnl-month').selectOption('10');
  await page.waitForFunction(() => document.querySelector('#pnl-observed').textContent === '$5.00');
  assert.match(await page.locator('#pnl-detail').innerText(), /4.755098 NETA/);
  assert.match(await page.locator('#pnl-coverage').innerText(), /Partial coverage/);
  assert.equal(await page.locator('.allocation-card,.risk-card,.cashflow-card').count(), 0);
  assert.equal(await page.locator('.pnl-kpis strong').allTextContents().then(v => v.every(x => x === 'Unavailable')), true);
  await page.getByRole('button', { name: 'NNS renewals', exact: true }).click();
  assert.match(await page.locator('#pnl-detail').innerText(), /not verified as zero/);
  await page.locator('#pnl-month').selectOption('9');
  assert.equal(await page.locator('#pnl-observed').textContent(), 'Unavailable');
  await page.locator('#pnl-month').selectOption('all');
  assert.equal(await page.locator('#pnl-observed').textContent(), '$5.00');
  await page.locator('#pnl-month').selectOption('10');
  await page.getByRole('button', { name: 'NNS registrations', exact: true }).click();
  const screenshots = process.env.NNS_SCREENSHOT_DIR;
  if (screenshots) await mkdir(screenshots, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#treasury-pnl').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `overflow at ${width}`);
    assert.equal(await page.locator('#pnl-year').evaluate(e => getComputedStyle(e).color === 'rgb(242, 244, 247)'), true);
    if (screenshots) await page.locator('#treasury-pnl').screenshot({ path: `${screenshots}/treasury-pnl-${width}.png` });
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.locator('#pnl-year').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#pnl-month').evaluate(e => e === document.activeElement), true);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('neta:dao-change', { detail: { id: 'juno' } })));
  await page.waitForFunction(() => document.querySelector('#pnl-coverage').textContent.includes('not connected'));
  assert.equal(await page.locator('#pnl-observed').textContent(), 'Unavailable');
  assert.doesNotMatch(await page.locator('#pnl-detail').innerText(), /cristiano/);
  // Foreign accounting source fails closed; a failed fetch is not zero revenue.
  await context.route('**/neta-main-accounting.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...ledger, treasury_address: 'wrong' }) }));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('neta:dao-change', { detail: { id: 'neta' } })));
  await page.waitForFunction(() => document.querySelector('#pnl-coverage').textContent.includes('identity unavailable'));
  assert.equal(await page.locator('#pnl-observed').textContent(), 'Unavailable');
  await context.unroute('**/neta-main-accounting.json*');
  await context.route('**/neta-main-accounting.json*', route => route.abort());
  await page.locator('#treasury-refresh').click();
  await page.waitForFunction(() => !document.querySelector('#treasury-refresh').disabled);
  assert.equal(await page.locator('#pnl-observed').textContent(), 'Unavailable');
  assert.deepEqual(errors, []);
  console.log('Treasury P&L: real archived receipt, periods, category drilldown, identity/fetch failure, DAO isolation, keyboard and 320–1440px passed');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
