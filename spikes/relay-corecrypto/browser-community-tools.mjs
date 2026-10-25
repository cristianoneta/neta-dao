import { ASSETS, POOLS } from '../../wynd-swap-core.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const root = new URL('../../', import.meta.url);
const pair = 'juno1h6x5jlvn6jhpnu63ufe4sgv4utyk8hsfl5rqnrpg2cvp6ccuq4lqwqnzra';
const neta = 'juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr';
const wallet = 'juno1d0g7f97v87xwe6r4vr4jj3jfhzcv4vvfhamy8w';
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
              : path.endsWith('.png')
                ? 'image/png'
                : path.endsWith('.webp')
                  ? 'image/webp'
                  : path.endsWith('.svg')
                    ? 'image/svg+xml'
                    : 'text/html'
      })
      .end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  const page = await browser.newPage(),
    errors = [],
    origin = `http://127.0.0.1:${server.address().port}`;
  page.on('pageerror', (e) => errors.push(e.message));
  let stale = false,
    badCode = false,
    returned = '10094',
    poolJuno = '100000000000',
    badToken = false,
    holdQuote = false,
    quoteStarted = () => {};
  const heldQuotes = [];
  const samplePools = Object.fromEntries(
    POOLS.map((p) => [
      p.id,
      {
        assets: p.assets.map((symbol, i) => ({
          info: ASSETS[symbol].info,
          amount:
            symbol === 'WYND'
              ? '4000000000000'
              : symbol === 'NETA'
                ? '1000000000'
                : symbol === 'JUNO'
                  ? '100000000000'
                  : i === 1
                    ? '1500000000'
                    : '100000000000'
        }))
      }
    ])
  );
  await page.route('https://**/*', async (route) => {
    const url = new URL(route.request().url());
    assert.equal(route.request().method(), 'GET', 'Fixtures never submit a real transaction');
    if (
      !['juno.api.m.stavr.tech', 'juno-api.polkachu.com', 'juno-rest.publicnode.com'].includes(
        url.hostname
      )
    )
      return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    let response;
    const contract = url.pathname.split('/contract/')[1]?.split('/')[0];
    const selected = POOLS.find((p) => p.address === contract);
    if (url.pathname.includes('/balances/'))
      response = { balance: { denom: url.searchParams.get('denom'), amount: '100000000' } };
    else if (!url.pathname.includes('/smart/'))
      response = { contract_info: { code_id: badCode ? '999' : '2289' } };
    else {
      const query = JSON.parse(
        Buffer.from(decodeURIComponent(url.pathname.split('/smart/')[1]), 'base64').toString('utf8')
      );
      let data = {};
      if (query.token_info)
        data = {
          symbol: Object.values(ASSETS).find((a) => a.info.token === contract)?.symbol,
          decimals: badToken ? 18 : 6
        };
      if (query.pair)
        data = {
          contract_addr: contract,
          asset_infos: selected.assets.map((s) => ASSETS[s].info),
          pair_type: { xyk: {} },
          fee_config: { total_fee_bps: 30 }
        };
      if (query.pool) {
        data = structuredClone(samplePools[selected.id]);
        if (selected.id === 'juno-neta')
          data.assets.find((a) => a.info.native === 'ujuno').amount = poolJuno;
      }
      if (query.balance) data = { balance: '100000000' };
      if (query.simulation) {
        if (holdQuote && selected.id === 'juno-neta') {
          quoteStarted();
          await new Promise((resolve) => heldQuotes.push(resolve));
        }
        if (selected.id === 'juno-neta')
          data = {
            return_amount: query.simulation.offer_asset.info.token ? '983732' : returned,
            commission_amount: '30',
            spread_amount: '0'
          };
        else {
          const reserves = samplePools[selected.id].assets;
          const source = reserves.find(
            (a) => JSON.stringify(a.info) === JSON.stringify(query.simulation.offer_asset.info)
          );
          const target = reserves.find((a) => a !== source);
          const gross =
            (BigInt(query.simulation.offer_asset.amount) * BigInt(target.amount)) /
            BigInt(source.amount);
          const fee = (gross * 30n) / 10000n;
          data = {
            return_amount: String(gross - fee),
            commission_amount: String(fee),
            spread_amount: '0'
          };
        }
      }
      response = { data };
    }
    await route.fulfill({ headers, body: JSON.stringify(response) });
  });
  await page.route('**/data/treasury/juno-delegation.json', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        chain_id: 'juno-1',
        dao_id: 'juno-delegation',
        status: 'LIVE',
        generated_at: new Date(Date.now() - (stale ? 48 * 3600000 : 0)).toISOString(),
        assets: ['JUNO', 'ATOM', 'USDC', 'OSMO'].map((symbol) => ({
          key: 'juno:native:' + ASSETS[symbol].info.native,
          source_chain: 'juno',
          decimals: 6,
          usd_price: { JUNO: 0.03, ATOM: 2, USDC: 1, OSMO: 0.03 }[symbol]
        }))
      })
    })
  );
  await page.route('**/assets/wynd-swap-signing.js*', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.NetaSwapSigning={fixedFee:()=>({gas:'210000',amount:[{denom:'ujuno',amount:'15750'}]}),connect:async()=>({client:{getChainId:async()=>'juno-1',disconnect(){}}}),simulate:async()=>150000,execute:async(...args)=>{await args[7].assertWallet();window.__executes=(window.__executes||0)+1;window.__executed=args.slice(1,7);if(window.__reject)throw Error('User rejected');return window.__result;}};`
    })
  );
  await page.addInitScript((address) => {
    window.keplr = {
      enable: async () => {},
      getKey: async () => ({ bech32Address: address }),
      getOfflineSignerAuto: async () => ({ getAccounts: async () => [{ address }] })
    };
  }, wallet);
  const textIs = (selector, text) =>
    page.waitForFunction(
      ([s, t]) => document.querySelector(s)?.textContent === t,
      [selector, text]
    );
  const ready = () => page.waitForFunction(() => !document.querySelector('#swap-action').disabled);
  const shots = process.env.NNS_SCREENSHOT_DIR;
  if (shots) await mkdir(shots, { recursive: true });
  const screenshot = async (name) => {
    if (shots) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${shots}/${name}.png`, fullPage: !name.includes('review') });
    }
  };
  await page.goto(origin + '/community-tools/');
  assert.equal(await page.locator('.tool-card:visible').count(), 5);
  assert.deepEqual(
    await page
      .locator('[data-project-link]')
      .evaluateAll((links) => links.map((link) => link.dataset.projectLink)),
    ['all', 'interchain', 'juno', 'neta']
  );
  await page.locator('[data-project-link="interchain"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-project-link="interchain"]').getAttribute('aria-current') ===
      'true'
  );
  assert.deepEqual(await page.locator('.tool-card:visible h3').allTextContents(), [
    'Delegation Programme',
    'Neta Naming Service'
  ]);
  await page.reload();
  assert.equal(
    await page.locator('[data-project-link="interchain"]').getAttribute('aria-current'),
    'true'
  );
  const namesLink = page.getByRole('link', { name: /Neta Naming Service/ });
  await namesLink.click();
  await page.waitForFunction(() => document.body.dataset.relayPanel === 'register');
  assert.equal(
    await page.locator('button[data-relay-panel="register"]').getAttribute('aria-pressed'),
    'true'
  );
  assert.equal(await page.locator('#names-view').isVisible(), true);
  await page.goBack();
  await page.getByRole('link', { name: /Delegation Programme/ }).click();
  assert.equal(new URL(page.url()).pathname, '/community-tools/delegation/');
  assert.deepEqual(await page.locator('.tool-card h2').allTextContents(), ['Juno']);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await screenshot(`delegation-chains-${width}`);
  }
  await page.getByRole('link', { name: /Open Juno programme/ }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('**/community-tools/juno/delegation/');
  await page.getByRole('link', { name: 'JUNO MAINNET', exact: true }).click();
  assert.equal(new URL(page.url()).pathname, '/community-tools/delegation/');
  await page.locator('.tool-breadcrumb a[href="/community-tools/#interchain"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-project-link="interchain"]').getAttribute('aria-current') ===
      'true'
  );
  await page.locator('[data-project-link="juno"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-project-link="juno"]').getAttribute('aria-current') === 'true'
  );
  assert.equal(await page.locator('.tool-card:visible').count(), 2);
  assert.deepEqual(await page.locator('.tool-card:visible h3').allTextContents(), [
    'Juno Faucet',
    'Validator Upgrade Status'
  ]);
  await page.locator('[data-project-link="neta"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-project-link="neta"]').getAttribute('aria-current') === 'true'
  );
  assert.equal(await page.locator('.tool-card:visible').count(), 1);
  await page.reload();
  assert.equal(
    await page.locator('[data-project-link="neta"]').getAttribute('aria-current'),
    'true'
  );
  await page.locator('[data-project-link="all"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-project-link="all"]').getAttribute('aria-current') === 'true'
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await screenshot(`community-tools-${width}`);
  }
  await page.goto(origin + '/community-tools/neta/buy/');
  await textIs('#contract-state', 'Verified');
  assert.equal(await page.locator('.pool-row').count(), 5);
  assert.equal(await page.locator('[data-reserve="JUNO"]').textContent(), '100,000');
  assert.equal(await page.locator('[data-reserve="NETA"]').textContent(), '1,000');
  assert.equal(
    await page.locator('[data-pool="juno-neta"] .pool-liquidity').textContent(),
    '≈ $6,000'
  );
  assert.match(await page.locator('#price-observed').textContent(), /USD snapshot:/);
  assert.match(await page.locator('.swap-limit').textContent(), /\$50 per swap/);
  assert.equal(
    await page.locator('#wynd-offline-ghost img').getAttribute('src'),
    '/assets/wynd-offline-mascot.png'
  );
  poolJuno = '200000123456';
  await page.locator('#refresh-pool').click();
  await textIs('[data-reserve="JUNO"]', '200,000.123456');
  assert.equal(
    await page.locator('[data-pool="juno-neta"] .pool-liquidity').textContent(),
    '≈ $12,000'
  );
  await page.locator('#settings-toggle').click();
  await page.locator('#custom-slippage').fill('0.125');
  await textIs('#slippage-summary', '0.13%');
  await page.locator('[data-slippage="5"]').click();
  await page.locator('#settings-toggle').click();
  await page.locator('#offer-amount').fill('1');
  await textIs('#receive-amount', '0.010094');
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  await page.locator('#connect-wallet').click();
  await ready();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `Buy overflow ${width}`
    );
    await screenshot(`buy-neta-${width}`);
  }
  await page.locator('#swap-action').click();
  assert.equal(await page.locator('#swap-modal').isVisible(), true);
  assert.equal(await page.locator('#review-minimum').textContent(), '0.009589 NETA');
  const nativePreview = JSON.parse(await page.locator('#swap-preview').textContent());
  assert.equal(
    nativePreview.message.swap.belief_price,
    '98.775187672856578427',
    'WYND spread uses the pre-commission return'
  );
  // Contract spread is measured before its 30-bps commission. Every execution
  // below the displayed net minimum must fail that on-chain constraint.
  const scale = 10n ** 18n,
    belief = BigInt(nativePreview.message.swap.belief_price.replace('.', ''));
  const expected = (1000000n * ((scale * scale) / belief)) / scale;
  for (let gross = 1n; gross <= 10124n; gross++) {
    const net = gross - (gross * 30n) / 10000n;
    if (net < 9589n)
      assert.ok(
        ((expected - gross) * scale) / expected > scale / 20n,
        'under-minimum net return must exceed max_spread'
      );
  }
  await screenshot('buy-neta-review-320');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#swap-modal').isVisible(), false);
  assert.equal(
    await page.locator('#swap-action').evaluate((e) => e === document.activeElement),
    true
  );
  await page.locator('#offer-amount').fill('1000');
  await page.waitForFunction(
    () => document.querySelector('#quote-error').textContent === 'Quote ready to review'
  );
  assert.match(await page.locator('#offer-usd').textContent(), /30.00/);
  await page.locator('#offer-amount').fill('2000');
  await page.waitForFunction(() =>
    document.querySelector('#quote-error').textContent.includes('$50 LIMIT')
  );
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  await page.locator('#offer-amount').fill('1');
  await ready();
  await page.locator('#swap-action').click();
  returned = '9000';
  await page.locator('#confirm-swap').click();
  await page.waitForFunction(() =>
    document.querySelector('#swap-modal-message').textContent.includes('REVIEWED MINIMUM')
  );
  assert.equal(await page.evaluate(() => window.__executes || 0), 0);
  returned = '10094';
  await page.locator('#close-swap').click();
  await page.locator('#swap-action').click();
  await page.evaluate(
    ({ wallet, neta }) => {
      window.__result = {
        transactionHash: 'A'.repeat(64),
        events: [
          {
            type: 'wasm',
            attributes: [
              { key: '_contract_address', value: neta },
              { key: 'action', value: 'transfer' },
              { key: 'to', value: wallet },
              { key: 'amount', value: '10094' }
            ]
          }
        ]
      };
    },
    { wallet, neta }
  );
  await page.locator('#confirm-swap').click();
  await page.waitForFunction(() =>
    document.querySelector('#swap-modal-state').textContent.includes('Transaction confirmed')
  );
  assert.equal(await page.locator('#swap-result-hash').textContent(), 'A'.repeat(64));
  await page.locator('#close-swap').click();
  await page.locator('#reverse-swap').click();
  await page.locator('#offer-amount').fill('0.01');
  await ready();
  await page.locator('#swap-action').click();
  const preview = JSON.parse(await page.locator('#swap-preview').textContent());
  assert.equal(preview.contract, neta);
  assert.deepEqual(preview.funds, []);
  assert.equal(preview.message.send.amount, '10000');
  assert.equal(preview.message.send.contract, pair);
  await page.evaluate(() => (window.__reject = true));
  await page.locator('#confirm-swap').click();
  await textIs('#swap-modal-message', 'USER REJECTED');
  await page.locator('#close-swap').click();
  await page.locator('#disconnect-wallet').click();
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  await page.locator('#connect-wallet').click();
  await ready();
  await page.evaluate(() => dispatchEvent(new Event('keplr_keystorechange')));
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  await page.locator('#connect-wallet').click();
  // Pay offers all six assets, with loaded logos. Receive is constrained by pay.
  await page.evaluate(() => document.querySelector('#wynd-offline-ghost').classList.add('visible'));
  await page.locator('#offer-asset').click();
  assert.equal(
    await page.locator('#wynd-offline-ghost').evaluate((e) => e.classList.contains('visible')),
    false
  );
  assert.equal(await page.getByRole('option').count(), 6);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('#asset-options img')].length === 6 &&
      [...document.querySelectorAll('#asset-options img')].every(
        (img) => img.complete && img.naturalWidth > 0
      )
  );
  await page.keyboard.press('Escape');
  assert.equal(
    await page.locator('#offer-asset').evaluate((e) => e === document.activeElement),
    true
  );
  await page.locator('#offer-asset').click();
  await page.locator('[data-asset="WYND"]').click();
  await textIs('#contract-state', 'Verified');
  await textIs('#receive-symbol', 'USDC');
  assert.equal(await page.locator('#offer-amount').inputValue(), '');
  await page.locator('#receive-asset').click();
  assert.deepEqual(
    await page.getByRole('option').evaluateAll((items) => items.map((e) => e.dataset.asset)),
    ['USDC']
  );
  await page.keyboard.press('Escape');
  await page.locator('#offer-asset').click();
  await page.locator('[data-asset="USDC"]').click();
  await textIs('#contract-state', 'Verified');
  await textIs('#receive-symbol', 'JUNO');
  await page.locator('#offer-amount').fill('1');
  await ready();
  await page.locator('#receive-asset').click();
  assert.deepEqual(
    await page.getByRole('option').evaluateAll((items) => items.map((e) => e.dataset.asset)),
    ['JUNO', 'WYND']
  );
  await page.locator('[data-asset="WYND"]').click();
  await textIs('#contract-state', 'Verified');
  await textIs('#offer-symbol', 'USDC');
  await textIs('#receive-symbol', 'WYND');
  assert.equal(await page.locator('#offer-amount').inputValue(), '');
  assert.equal(await page.locator('#receive-amount').textContent(), '0.0');
  assert.equal(await page.locator('[data-price="USDC"]').textContent(), '≈ $1.00');
  assert.equal(await page.locator('[data-price="WYND"]').textContent(), '≈ $0.000375Pool estimate');
  const expectedReceivers = {
    JUNO: ['ATOM', 'USDC', 'OSMO', 'NETA'],
    ATOM: ['JUNO'],
    USDC: ['JUNO', 'WYND'],
    OSMO: ['JUNO'],
    WYND: ['USDC'],
    NETA: ['JUNO']
  };
  for (const target of POOLS) {
    await page.locator('[data-pool="' + target.id + '"]').focus();
    await page.keyboard.press('Enter');
    await textIs('#contract-state', 'Verified');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.pool), target.id);
    for (let direction = 0; direction < 2; direction++) {
      if (direction) await page.locator('#reverse-swap').click();
      const pay = direction ? target.assets[1] : target.assets[0];
      await page.locator('#receive-asset').click();
      assert.deepEqual(
        await page.getByRole('option').evaluateAll((items) => items.map((e) => e.dataset.asset)),
        expectedReceivers[pay]
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(() =>
        ['offer', 'receive'].every((side) => {
          const img = document.querySelector('#' + side + '-logo');
          return !img.hidden && img.complete && img.naturalWidth > 0;
        })
      );
      assert.deepEqual(
        await page
          .locator('[data-price]')
          .evaluateAll((items) => items.map((e) => e.dataset.price)),
        target.assets
      );
      await page.locator('#offer-amount').fill('1');
      await ready();
      await page.locator('#swap-action').click();
      const p = JSON.parse(await page.locator('#swap-preview').textContent());
      const source = ASSETS[direction ? target.assets[1] : target.assets[0]];
      const destination = ASSETS[direction ? target.assets[0] : target.assets[1]];
      if (source.info.native) {
        assert.equal(p.contract, target.address);
        assert.deepEqual(p.funds, [{ denom: source.info.native, amount: '1000000' }]);
        assert.deepEqual(p.message.swap.ask_asset_info, destination.info);
      } else {
        assert.equal(p.contract, source.info.token);
        assert.deepEqual(p.funds, []);
        assert.equal(p.message.send.contract, target.address);
        assert.deepEqual(
          JSON.parse(Buffer.from(p.message.send.msg, 'base64').toString()).swap.ask_asset_info,
          destination.info
        );
      }
      assert.equal(p.per_swap_limit_usd, 50);
      await page.locator('#close-swap').click();
    }
  }
  // A delayed quote for the previous pair cannot replace the new asset/quote.
  await page.locator('[data-pool="juno-neta"]').click();
  await textIs('#contract-state', 'Verified');
  holdQuote = true;
  const started = new Promise((resolve) => {
    quoteStarted = resolve;
  });
  await page.locator('#offer-amount').fill('2');
  await started;
  await page.locator('[data-pool="juno-atom"]').click();
  await textIs('#contract-state', 'Verified');
  assert.equal(await page.locator('#offer-amount').inputValue(), '');
  await page.locator('#offer-amount').fill('1');
  await ready();
  holdQuote = false;
  heldQuotes.splice(0).forEach((resolve) => resolve());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#receive-symbol').textContent(), 'ATOM');
  assert.match(await page.locator('#quote-rate').textContent(), /ATOM$/);
  // Max and exact $50 boundary for the explicitly labelled Axelar USDC.
  await page.locator('[data-pool="juno-usdc"]').click();
  await textIs('#contract-state', 'Verified');
  await page.locator('#reverse-swap').click();
  await page.waitForFunction(() => !document.querySelector('#max-button').disabled);
  await page.locator('#max-button').click();
  assert.equal(await page.locator('#offer-amount').inputValue(), '50');
  await ready();
  await page.locator('#offer-amount').fill('50.01');
  await page.waitForFunction(() =>
    document.querySelector('#quote-error').textContent.includes('$50 LIMIT')
  );
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  await page.locator('[data-pool="juno-neta"]').click();
  await textIs('#contract-state', 'Verified');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#offer-asset').click();
  await screenshot('wynd-asset-menu-1440');
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(
    await page.locator('#wynd-offline-ghost').evaluate((e) => getComputedStyle(e).animationName),
    'none'
  );
  await screenshot('wynd-five-pools-1440');
  assert.ok(
    (await page.locator('#wynd-offline-ghost').evaluate((e) => e.getBoundingClientRect().width)) >=
      170
  );
  await page.locator('[data-pool="wynd-usdc"]').click();
  await textIs('#contract-state', 'Verified');
  await page.locator('#reverse-swap').click();
  await page.locator('.pool-overview summary').click();
  await screenshot('wynd-token-prices-1440');
  await page.locator('#receive-asset').click();
  await screenshot('wynd-usdc-receive-menu-1440');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 1100 });
  await page.locator('#receive-asset').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await screenshot('wynd-asset-menu-320');
  await page.keyboard.press('Escape');
  await screenshot('wynd-token-prices-320');
  await page.locator('[data-pool="juno-neta"]').click();
  await textIs('#contract-state', 'Verified');
  badToken = true;
  await page.locator('#refresh-pool').click();
  await textIs('#contract-state', 'Unavailable');
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  badToken = false;
  stale = true;
  await page.reload();
  await textIs('#contract-state', 'Unavailable');
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  assert.deepEqual(await page.locator('#pool-reserves dd').allTextContents(), ['—', '—', '—', '—']);
  assert.equal(await page.locator('.pool-liquidity').filter({ hasText: '≈ $' }).count(), 0);
  stale = false;
  badCode = true;
  await page.locator('#refresh-pool').click();
  await page.waitForFunction(() =>
    document.querySelector('#quote-error').textContent.includes('CODE ID')
  );
  assert.equal(await page.locator('#swap-action').isDisabled(), true);
  await screenshot('buy-neta-unavailable-320');
  assert.deepEqual(errors, []);
  console.log(
    'Community project navigation and WYND swap: four viewports, wallet review, quote minimum, limits, stale source and contract checks passed (synthetic transactions only).'
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
