import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const artifactDir =
  process.env.HOME_BROWSER_ARTIFACTS ||
  process.env.NNS_SCREENSHOT_DIR ||
  '/tmp/cosmoot-home-browser';
const server = http.createServer(async (request, response) => {
  try {
    let path = new URL(request.url, 'http://localhost').pathname;
    if (path.endsWith('/')) path += 'index.html';
    const body = await readFile(new URL(`.${path}`, root));
    const type = /\.m?js$/.test(path)
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.json')
          ? 'application/json'
          : path.endsWith('.svg')
            ? 'image/svg+xml'
            : path.endsWith('.webp')
              ? 'image/webp'
              : path.endsWith('.png')
                ? 'image/png'
                : 'text/html';
    response.writeHead(200, { 'content-type': type }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // The homepage has no live metrics. Tests do not contact providers or a wallet.
  await context.route('https://**/*', (route) => route.abort());
  // Seed once: an init script on every navigation could hide accidental journal deletion.
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('neta-workspace-active-view', 'governance');
    localStorage.setItem('homepage-acceptance-pending-journal', 'preserved');
  });
  await mkdir(artifactDir, { recursive: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    // The saved workspace must not replace the public introduction on a bare URL.
    await page.evaluate(() => localStorage.setItem('neta-workspace-active-view', 'governance'));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.workspaceView === 'home');
    assert.equal(await page.locator('#home-view').isVisible(), true);
    assert.equal(await page.locator('body > .gov-header').isVisible(), false);
    const cta = page.locator('.ch-hero-actions a');
    assert.equal(await cta.getAttribute('href'), '/community-tools/delegation/');
    assert.match(await cta.textContent(), /Open Delegation Programme/);
    for (const name of ['governance', 'treasury', 'delegation']) {
      await page.locator(`#home-tab-${name}`).click();
      assert.equal(await page.locator(`#home-preview-${name}`).isVisible(), true);
      assert.equal(
        await page.locator('#home-panel-open').getAttribute('href'),
        name === 'delegation' ? '/community-tools/delegation/' : `#${name}`
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `No page-wide overflow at ${width}px on the ${name} preview`
      );
    }
    await page.locator('#home-tab-governance').click();
    await page.locator('#home-tab-governance').press('ArrowLeft');
    assert.equal(await page.locator('#home-tab-delegation').getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'home-tab-delegation');
    const before = page.url();
    await page.locator('.ch-site-header [data-home-scroll="home-community"]').click();
    assert.equal(page.url(), before, 'Local sections do not replace a workspace route');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'home-community');
    await page.locator('#home-tab-governance').click();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(artifactDir, `home-${width}.png`), fullPage: true });
  }
  for (const view of ['governance', 'treasury']) {
    await page.goto(`${origin}/#${view}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (expected) => document.body.dataset.workspaceView === expected,
      view
    );
    assert.equal(await page.locator('#home-view').isVisible(), false);
    assert.equal(await page.locator('body > .gov-header').isVisible(), true);
    await page.locator('[data-workspace-view="home"]').click();
    await page.locator(`.ch-context-links a[href="#${view}"]`).click();
    await page.waitForFunction(
      (expected) => document.body.dataset.workspaceView === expected,
      view
    );
  }
  for (const key of ['review', 'proposal', 'plannerDraft', 'proposalTemplate']) {
    await page.goto(`${origin}/?chain=juno&dao=juno&${key}=4`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.workspaceView === 'governance');
    assert.equal(await page.locator('#home-view').isVisible(), false);
  }
  assert.equal(
    await page.evaluate(() => localStorage.getItem('homepage-acceptance-pending-journal')),
    'preserved'
  );
  assert.deepEqual(errors, []);
  console.log(
    'Cosmoot homepage: responsive previews, keyboard navigation, deep links and journal preservation passed.'
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
