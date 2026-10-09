import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fixture } from '../../tests/fixtures/delegation-planner.mjs';
const root = new URL('../../', import.meta.url),
  history = JSON.parse(await readFile(new URL('data/validator-upgrades/juno-v31.json', root)));
const sample = fixture();
sample.validators.forEach((v, i) => {
  v.consensusAddress = history.validators[i].address;
});
sample.validators[0].name = '<img src=x onerror=alert(1)> Fixture';
const server = http.createServer(async (req, res) => {
  try {
    let path = new URL(req.url, 'http://localhost').pathname;
    if (path.endsWith('/')) path += 'index.html';
    const body = await readFile(new URL('.' + path, root));
    res
      .writeHead(200, {
        'content-type': /\.m?js$/.test(path)
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : path.endsWith('.json')
              ? 'application/json'
              : path.endsWith('.webp')
                ? 'image/webp'
                : path.endsWith('.png')
                  ? 'image/png'
                  : 'text/html'
      })
      .end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  const page = await browser.newPage(),
    errors = [],
    origin = `http://127.0.0.1:${server.address().port}`;
  page.on('pageerror', (error) => errors.push(error.message));
  let state = 'current';
  await page.route('**/data/daos/juno-delegation-planner.json', (route) => {
    if (state === 'missing') return route.fulfill({ status: 503, body: 'unavailable' });
    const data = structuredClone(sample);
    if (state === 'stale') data.blockTime = new Date(Date.now() - 7200000).toISOString();
    if (state === 'wrong-chain') data.chainId = 'uni-7';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  const ready = () => page.waitForFunction(() => !document.getElementById('simulate').disabled);
  const simulate = async () => {
    await page.locator('#simulate').click();
    await page.waitForFunction(() => !document.getElementById('export-json').disabled);
  };
  await page.goto(origin + '/community-tools/juno/delegation/');
  await ready();
  assert.match(await page.locator('#cap-description').textContent(), /6.00%/);
  await simulate();
  assert.ok(Number(await page.locator('#eligible-total').textContent()) >= 22);
  assert.equal(
    await page.locator('#allocation-rows img').count(),
    0,
    'validator names are rendered as text'
  );
  assert.equal(
    await page.getByRole('button', { name: 'Prepare execution proposal' }).isDisabled(),
    true
  );
  const selected = sample.validators.find(
    (v) =>
      history.firstSignatures[v.consensusAddress] &&
      history.firstSignatures[v.consensusAddress].secondsFromHalt < 18000
  );
  const before = Number(await page.locator('#eligible-total').textContent());
  await page.locator('#excluded-validator').fill(selected.address);
  await page.locator('#excluded-reason').fill('Exchange-operated fixture');
  await page.locator('#add-exclusion').click();
  assert.equal(await page.locator('#export-json').isDisabled(), true);
  await simulate();
  assert.equal(Number(await page.locator('#eligible-total').textContent()), before - 1);
  assert.match(await page.locator('#cap-description').textContent(), /6.00%/);
  await page.locator('#save-draft').click();
  await page.reload();
  await ready();
  assert.equal(await page.locator('#exclusions li').count(), 1);
  await simulate();
  const pendingDownload = page.waitForEvent('download');
  await page.locator('#export-json').click();
  const download = await pendingDownload;
  const stream = await download.createReadStream(),
    chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const review = JSON.parse(Buffer.concat(chunks));
  assert.equal(review.proposalType, 'RULE_APPROVAL');
  assert.equal(review.status, 'DRAFT_NOT_SUBMITTED');
  assert.equal(review.rule.exclusions[0].validator, selected.address);
  assert.equal(review.approval, null);
  assert.equal(review.execution.enabled, false);
  assert.deepEqual(review.execution.messages, []);
  assert.equal(review.policyHash.length, 64);
  const shots = process.env.NNS_SCREENSHOT_DIR;
  if (shots) await mkdir(shots, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `page overflow at ${width}`
    );
    if (shots)
      await page.screenshot({ path: `${shots}/juno-delegation-${width}.png`, fullPage: true });
  }
  await page.locator('#programme-amount').fill('99999999');
  await page.locator('#simulate').click();
  await page.waitForFunction(() =>
    document.getElementById('feedback').textContent.includes('covered')
  );
  assert.equal(await page.locator('#export-json').isDisabled(), true);
  await page.locator('#factor').press('End');
  assert.match(await page.locator('#cap-description').textContent(), /8.00%/);
  state = 'stale';
  await page.locator('#refresh').click();
  await ready();
  assert.match(await page.locator('#snapshot-status').textContent(), /historical/);
  await simulate();
  assert.match(await page.locator('#simulation-note').textContent(), /Historical/);
  for (state of ['wrong-chain', 'missing']) {
    await page.locator('#refresh').click();
    await page.waitForFunction(
      () =>
        document.getElementById('snapshot-status').textContent === 'Programme snapshot unavailable'
    );
    assert.equal(await page.locator('#simulate').isDisabled(), true);
    assert.equal(await page.locator('#export-json').isDisabled(), true);
  }
  assert.deepEqual(errors, []);
  console.log(
    'Juno delegation browser: review, exclusions, persistence, export, stale/error states and four viewports passed.'
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
