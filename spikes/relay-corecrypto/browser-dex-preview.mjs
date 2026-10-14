import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const root = new URL('../../', import.meta.url);
const server = http.createServer(async (req, res) => {
  try {
    let path = new URL(req.url, 'http://localhost').pathname;
    if (path.endsWith('/')) path += 'index.html';
    const bytes = await readFile(new URL(`.${path}`, root));
    res.writeHead(200, { 'content-type': /\.m?js$/.test(path) ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.webp') ? 'image/webp' : path.endsWith('.png') ? 'image/png' : 'text/html' }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage(), errors = [], external = [];
  const shots = process.env.NNS_SCREENSHOT_DIR;
  if (shots) await mkdir(shots, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const origin = `http://127.0.0.1:${server.address().port}`;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', req => { if (!req.url().startsWith(origin)) external.push(req.url()); });
  await page.addInitScript(() => { window.keplr = new Proxy({}, { get() { throw Error('Preview must not access a wallet'); } }); });
  await page.goto(origin + '/community-tools/neta/dex/');
  await page.waitForFunction(() => document.querySelector('#swap-output').textContent !== '—');
  assert.equal(await page.locator('#swap-output').textContent(), '2.49001');
  assert.equal(await page.locator('#total-liquidity').textContent(), '$61,200');
  assert.equal(await page.locator('#neta-reference').textContent(), '$4.00');
  assert.equal(await page.locator('#pay-usd').textContent(), '(≈ $10.00 · demo)');
  assert.equal(await page.locator('#receive-usd').textContent(), '(≈ $9.96 · demo)');
  // The whole map and trade column must fit together, not only the submit button.
  for (const [width, height] of [[1920, 900], [1440, 900], [1366, 768], [1280, 720], [1536, 864]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
      };
      return { map: rect('#cosmos'), trade: rect('.trade-column'), title: rect('#cosmos-title'),
        titleLine: parseFloat(getComputedStyle(document.querySelector('#cosmos-title')).lineHeight),
        header: rect('.dex-header'), scroll: scrollY };
    });
    assert.equal(layout.scroll, 0, 'Layout fits without scrolling');
    assert.ok(layout.map.right <= layout.trade.left, `Map and swap are adjacent at ${width}`);
    assert.ok(layout.map.top >= layout.header.bottom && layout.trade.top >= layout.header.bottom, 'No header overlap');
    assert.ok(Math.max(layout.map.bottom, layout.trade.bottom) <= height, `Entire map and swap fit ${width}x${height}: ${JSON.stringify(layout)}`);
    assert.ok(layout.title.height < layout.titleLine * 1.5, `Desktop heading stays on one line at ${width}`);
    if (shots) await page.screenshot({ path: `${shots}/dex-viewport-${width}-${height}.png` });
  }
  assert.equal(await page.locator('.explore-strip, details.preview-note').count(), 0);
  await page.setViewportSize({ width: 1440, height: 900 });
  const initialOrbit = await page.locator('.orbit-juno').evaluate(el => el.style.left);
  await page.waitForFunction(left => document.querySelector('.orbit-juno').style.left !== left, initialOrbit);
  await page.locator('#motion').click();
  const frozenOrbit = await page.locator('.orbit-juno').evaluate(el => el.style.left);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.orbit-juno').evaluate(el => el.style.left), frozenOrbit);
  assert.ok(await page.locator('#swap-submit').evaluate(el => el.getBoundingClientRect().bottom < 768), 'Compact desktop swap action fits a 768px-high viewport');
  if (shots) await page.screenshot({ path: `${shots}/dex-compact-initial-1440.png` });
  await page.locator('#motion').click();
  await page.waitForFunction(left => document.querySelector('.orbit-juno').style.left !== left, frozenOrbit);
  assert.equal(await page.locator('#orbit-pools button').count(), 3);
  const mapBox = await page.locator('#cosmos').boundingBox();
  await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
  const hoveredOrbit = await page.locator('.orbit-juno').evaluate(el => el.style.left);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('.orbit-juno').evaluate(el => el.style.left), hoveredOrbit);
  await page.locator('#orbit-pools [data-pool-select="USDC"]').click();
  assert.equal(await page.locator('#swap-pair').inputValue(), 'USDC');
  assert.equal(await page.locator('#pay-token').textContent(), 'USDC');
  await page.locator('#show-small').check();
  await page.locator('#list-mode').click();
  await page.locator('#orbit-pools [data-pool-select="ATOM"]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#swap-pair').inputValue(), 'ATOM');
  assert.equal(await page.locator('#pay-usd').textContent(), '(≈ $200.00 · demo)');
  assert.equal(await page.locator('#orbit-pools [data-pool-select="ATOM"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#selected-liquidity').click();
  assert.match(await page.locator('#liquidity-title').textContent(), /ATOM/); await page.keyboard.press('Escape');
  await page.locator('#show-small').uncheck();
  assert.equal(await page.locator('#orbit-pools [data-pool-select="ATOM"]').count(), 0);
  await page.locator('#swap-pair').selectOption('ATOM');
  assert.equal(await page.locator('#show-small').isChecked(), true);
  await page.locator('#swap-pair').selectOption('JUNO'); await page.locator('#show-small').uncheck();
  await page.locator('#map-mode').click();
  await page.locator('#motion').click();
  assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#motion').disabled);
  assert.equal(await page.locator('#motion').isDisabled(), true);
  assert.equal(await page.locator('#cosmos').evaluate(el => getComputedStyle(el, '::after').animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.locator('#swap-input').fill('10001');
  assert.equal(await page.locator('#swap-submit').isDisabled(), true);
  await page.locator('#swap-input').fill('invalid');
  assert.equal(await page.locator('#pay-usd').textContent(), '—');
  await page.locator('#swap-input').fill('100');
  await page.locator('#swap-submit').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#swap-submit').evaluate(el => el === document.activeElement), true);
  await page.locator('#swap-submit').click(); await page.locator('#confirm').click();
  assert.match(await page.locator('#notice').textContent(), /Demo swap completed/);
  await page.locator('[data-view="dao"]').click();
  assert.equal(await page.locator('#swap-count').textContent(), '1');
  await page.locator('#buyback').click(); await page.locator('#confirm').click();
  assert.notEqual(await page.locator('#burned').textContent(), '0');
  await page.locator('[data-view="pools"]').click();
  assert.equal(await page.locator('#featured-pools .pool-row').count(), 3);
  assert.equal(await page.locator('#small-pools').isVisible(), false);
  const beforeDeposit = await page.locator('#total-liquidity').textContent();
  await page.locator('#featured-pools .pool-row').first().getByRole('button', { name: 'Add liquidity' }).click();
  await page.locator('#liquidity-input').fill('999999');
  await page.getByRole('button', { name: 'Simulate deposit' }).click();
  assert.match(await page.locator('#liquidity-error').textContent(), /Not enough/);
  await page.locator('#liquidity-input').fill('100');
  await page.getByRole('button', { name: 'Simulate deposit' }).click();
  assert.equal(await page.locator('#positions .pool-row').count(), 1);
  assert.notEqual(await page.locator('#total-liquidity').textContent(), beforeDeposit);
  await page.getByRole('button', { name: 'Remove liquidity' }).click(); await page.locator('#confirm').click();
  assert.equal(await page.locator('#positions .pool-row').count(), 0);
  await page.locator('#new-pool').click();
  await page.locator('#create-neta').fill('0'); await page.locator('#create-submit').click();
  assert.match(await page.locator('#create-error').textContent(), /greater than zero/);
  await page.locator('#create-neta').fill('10'); await page.locator('#create-submit').click();
  assert.equal(await page.locator('#small-pools .pool-row').count(), 2);
  assert.match(await page.locator('#small-pools').textContent(), /OSMO/);
  await page.locator('#featured-pools .pool-row').first().getByRole('button', { name: 'Plan incentives' }).click();
  await page.locator('#incentive-total').fill('0');
  await page.getByRole('button', { name: 'Save demo plan' }).click();
  assert.match(await page.locator('#incentive-error').textContent(), /greater than zero/);
  await page.locator('#incentive-total').fill('1200');
  await page.getByRole('button', { name: 'Save demo plan' }).click();
  assert.match(await page.locator('#incentive-plans').textContent(), /12 weeks \/ 84 days/);
  assert.match(await page.locator('#incentive-plans').textContent(), /Not funded/);
  await page.locator('#new-incentive').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#incentive-pool option').count(), 5);
  await page.locator('#incentive-pool').selectOption('OSMO');
  await page.getByRole('button', { name: 'Save demo plan' }).click();
  assert.match(await page.locator('#incentive-plans .campaign').last().textContent(), /OSMO \/ NETA/);
  await page.locator('#new-incentive').click(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('#new-incentive').evaluate(el => el === document.activeElement), true);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const view of ['swap', 'pools', 'dao']) {
      await page.locator(`[data-view="${view}"]`).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${view} overflow at ${width}`);
      await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
      if (shots) await page.screenshot({ path: `${shots}/dex-${view}-${width}.png`, fullPage: true });
      if (view === 'swap') {
        await page.locator('#show-small').check();
        assert.equal(await page.locator('#orbit-pools button').count(), 5);
        if (shots) await page.screenshot({ path: `${shots}/dex-map-all-${width}.png`, fullPage: true });
        await page.locator('#list-mode').click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `list overflow at ${width}`);
        if (shots) await page.screenshot({ path: `${shots}/dex-list-${width}.png`, fullPage: true });
        await page.locator('#map-mode').click(); await page.locator('#show-small').uncheck();
      }
    }
  }
  await page.locator('[data-view="swap"]').click();
  await page.locator('#reverse').click();
  assert.equal(await page.locator('#pay-token').textContent(), 'NETA');
  assert.equal(await page.locator('#pay-usd').textContent(), '(≈ $400.00 · demo)');
  await page.locator('#swap-submit').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#review').isVisible(), true);
  if (shots) await page.screenshot({ path: `${shots}/dex-review-320.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.locator('#reset').click(); await page.locator('#confirm').click();
  assert.equal(await page.locator('#swap-output').textContent(), '2.49001');
  assert.equal(await page.locator('#positions .pool-row').count(), 0);
  assert.equal(await page.locator('#incentive-plans .campaign').count(), 0);
  assert.equal(await page.locator('#total-liquidity').textContent(), '$61,200');
  await page.goto(origin + '/community-tools/neta/dex/#dao');
  assert.equal(await page.locator('#view-dao').isVisible(), true);
  assert.equal(await page.locator('#swap-count').textContent(), '0');
  assert.equal(await page.locator('#buyback').isDisabled(), true);
  await page.locator('[data-view="pools"]').click();
  await page.locator('#featured-pools .pool-row').first().getByRole('button', { name: 'Plan incentives' }).click();
  if (shots) await page.screenshot({ path: `${shots}/dex-incentives-320.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 768, height: 1100 });
  await page.evaluate(() => { document.body.style.zoom = '2'; });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '200% zoom reflows without horizontal overflow');
  await page.evaluate(() => { document.body.style.zoom = ''; });
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('DEX preview: swap/review, fees, buyback, LP deposit/withdrawal, pool creation, 84-day incentive plans, reset, direct routes, wallet isolation and four responsive widths passed.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
