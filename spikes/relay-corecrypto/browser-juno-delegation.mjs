import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fixture } from '../../tests/fixtures/delegation-planner.mjs';
import { rewardsFixture } from '../../tests/fixtures/claim-rewards.mjs';
const root = new URL('../../', import.meta.url),
  history = JSON.parse(await readFile(new URL('data/validator-upgrades/juno-v31.json', root)));
const sample = fixture();
sample.validators[0].address =
  'junovaloper185hgkqs8q8ysnc8cvkgd8j2knnq2m0ah6ae73gntv9ampgwpmrxqlfzywn';
sample.validators[1].address =
  'junovaloper1pvuxgpct3n8pk4dk2vsvuz2y9tav62ug2c8n093dhzh5qqqe3w3qzgq2d7';
sample.validators.forEach((v, i) => {
  v.consensusAddress = history.validators[i].address;
  // Exercise programme-sized numbers, including micro-unit precision.
  v.tokensRaw = String(BigInt(v.tokensRaw) * 6000n);
  v.currentRaw = String(BigInt(v.currentRaw) * 6000n + 123456n);
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
  const page = await browser.newPage({ serviceWorkers: 'block' }),
    errors = [],
    origin = `http://127.0.0.1:${server.address().port}`;
  page.on('pageerror', (error) => errors.push(error.message));
  // Every external response is synthetic, including early history requests.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { proposals: [] } })
    })
  );
  let state = 'current';
  let rewardsState = 'current';
  await page.route('**/data/treasury/juno-delegation.json', (route) => {
    if (rewardsState === 'missing') return route.fulfill({ status: 503, body: 'unavailable' });
    const data = rewardsFixture(sample);
    if (rewardsState === 'stale') data.generated_at = new Date(Date.now() - 7200000).toISOString();
    if (rewardsState === 'no-price') {
      data.assets[0].usd_price = null;
      data.status = 'PARTIAL';
      data.price_source = 'Unavailable';
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route('**/data/daos/juno-delegation-planner.json', (route) => {
    if (state === 'missing') return route.fulfill({ status: 503, body: 'unavailable' });
    const data = structuredClone(sample);
    if (state === 'stale') data.blockTime = new Date(Date.now() - 7200000).toISOString();
    if (state === 'wrong-chain') data.chainId = 'uni-7';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  const ready = () => page.waitForFunction(() => !document.getElementById('simulate').disabled);
  const step = async (name) => {
    await page.locator(`.planner-steps [data-step="${name}"]`).click();
    assert.equal(await page.locator('#' + name).isVisible(), true);
    assert.equal(
      await page.locator(`.planner-steps [data-step="${name}"]`).getAttribute('aria-current'),
      'step'
    );
  };
  const simulate = async () => {
    await step('rules');
    await page.locator('#simulate').click();
    await page.waitForFunction(() => !document.getElementById('export-json').disabled);
  };
  await page.goto(origin + '/community-tools/juno/delegation/');
  await ready();
  assert.match(
    await page.locator('#claim-rewards-amount').textContent(),
    /3,837,025.339927 JUNO.*33,896.32/
  );
  assert.match(
    await page.locator('#claim-rewards-observed').textContent(),
    /25 programme delegations/
  );
  for (const status of ['stale', 'missing', 'no-price']) {
    rewardsState = status;
    await page.locator('#refresh').click();
    await ready();
    assert.equal(await page.locator('#claim-rewards').isEnabled(), true);
    const text = await page.locator('#claim-rewards-amount').textContent();
    assert.equal(text.includes('$'), false);
    assert.match(text, status === 'no-price' ? /3,837,025.339927 JUNO/ : /unavailable/);
  }
  rewardsState = 'current';
  await page.locator('#refresh').click();
  await ready();
  assert.equal(await page.locator('#programme-amount').inputValue(), '15000900');
  assert.equal(await page.locator('.criterion h4').count(), 4);
  assert.match(await page.locator('#cap-description').textContent(), /6.00%/);
  await page.locator('#factor-number').fill('2');
  assert.equal(await page.locator('#factor').inputValue(), '20');
  assert.match(await page.locator('#cap-description').textContent(), /8.00%/);
  await page.locator('#factor').press('Home');
  assert.equal(await page.locator('#factor-number').inputValue(), '1.0');
  await page.locator('#factor-number').fill('2.1');
  assert.equal(await page.locator('#factor-error').isVisible(), true);
  await page.locator('#save-draft').click();
  assert.match(await page.locator('#feedback').textContent(), /before saving/);
  await page.locator('#factor-number').fill('1.5');
  assert.equal(await page.locator('#commission').inputValue(), '10');
  for (const value of ['0', '13', '100']) {
    await page.locator('#commission').fill(value);
    assert.equal(await page.locator('#commission-error').isVisible(), false);
    assert.ok(
      (await page.locator('#rule-summary').textContent()).includes(`commission ≤${value}%`)
    );
  }
  for (const value of ['13.5', '-1', '101', '']) {
    await page.locator('#commission').fill(value);
    assert.equal(await page.locator('#commission-error').isVisible(), true);
    await page.locator('#save-draft').click();
    assert.match(await page.locator('#feedback').textContent(), /whole-number commission/);
    await page.locator('#simulate').click();
    assert.equal(await page.locator('#export-json').isDisabled(), true);
    assert.match(await page.locator('#feedback').textContent(), /whole-number commission/);
  }
  await page.locator('#commission').fill('13');
  await page.locator('#no-commission-limit').check();
  assert.equal(await page.locator('#commission').isDisabled(), true);
  assert.match(await page.locator('#rule-summary').textContent(), /no commission filter/);
  await page.locator('#no-commission-limit').uncheck();
  assert.equal(await page.locator('#commission').inputValue(), '13');
  assert.equal(await page.locator('#commission').isEnabled(), true);
  await page.locator('#commission').fill('19');
  await simulate();
  assert.equal(await page.locator('#simulation').isVisible(), true);
  assert.equal(await page.locator('#rules').isVisible(), false);
  assert.ok(Number(await page.locator('#eligible-total').textContent()) >= 22);
  assert.equal(
    await page.locator('#allocation-rows img').count(),
    0,
    'validator names are rendered as text'
  );
  assert.equal(await page.locator('.execution-details button').isDisabled(), true);
  assert.equal(await page.locator('#allocation-rows .allocation-row').count(), 10);
  assert.match(await page.locator('#table-count').textContent(), /1–10 of 25/);
  await page.locator('#next-page').click();
  assert.match(await page.locator('#table-count').textContent(), /11–20 of 25/);
  await page.locator('#validator-sort').selectOption('name');
  assert.match(await page.locator('#table-count').textContent(), /1–10 of 25/);
  await page.locator('#validator-search').fill(sample.validators[0].address);
  assert.equal(await page.locator('#allocation-rows .allocation-row').count(), 1);
  assert.match(await page.locator('#allocation-rows .validator-name').textContent(), /<img src=x/);
  await page.locator('.row-toggle').click();
  assert.equal(await page.locator('.row-toggle').getAttribute('aria-expanded'), 'true');
  assert.match(await page.locator('.row-detail').textContent(), /600,000.123456 JUNO/);
  assert.match(await page.locator('.row-detail').textContent(), /Total after allocation:/);
  assert.equal(await page.locator('.allocation-row td').count(), 6);
  assert.equal(await page.locator('.projected-total').count(), 1);
  await page.locator('#validator-search').fill('no-such-validator');
  assert.match(await page.locator('#allocation-rows').textContent(), /No validators match/);
  await page.locator('#validator-search').fill('');
  await page.locator('#validator-filter').selectOption('receiving');
  assert.equal(
    await page
      .locator('.allocation-row .target-amount')
      .evaluateAll((nodes) => nodes.every((el) => el.textContent !== '0.00')),
    true
  );
  await page.locator('#validator-filter').selectOption('all');
  for (const sort of ['total', 'total-asc', 'projected', 'projected-asc']) {
    await page.locator('#validator-sort').selectOption(sort);
    const totals = await page.locator('.projected-total').allTextContents();
    const amounts = totals.map((value) => Number(value.replaceAll(',', '')));
    const ascending = sort.endsWith('-asc');
    assert.ok(
      amounts.every(
        (value, index) =>
          index === 0 || (ascending ? value >= amounts[index - 1] : value <= amounts[index - 1])
      )
    );
    assert.match(await page.locator('#table-count').textContent(), /1–10 of 25/);
  }
  if (await page.locator('#evidence-review').isVisible()) {
    await page.locator('#show-evidence-review').click();
    assert.equal(await page.locator('#validator-filter').inputValue(), 'review');
    assert.equal(
      await page.locator('#validator-filter').evaluate((el) => el === document.activeElement),
      true
    );
    await page.locator('#validator-filter').selectOption('all');
  }
  const selected = sample.validators.find(
    (v) =>
      history.firstSignatures[v.consensusAddress] &&
      history.firstSignatures[v.consensusAddress].secondsFromHalt < 18000
  );
  const before = Number(await page.locator('#eligible-total').textContent());
  await step('rules');
  await page.locator('#manual-exclusions summary').click();
  await page.locator('#excluded-validator').fill(selected.name);
  await page.locator('#excluded-reason').fill('Exchange-operated fixture');
  await page.locator('#add-exclusion').click();
  assert.equal(await page.locator('#export-json').isDisabled(), true);
  await simulate();
  assert.equal(Number(await page.locator('#eligible-total').textContent()), before - 1);
  assert.match(await page.locator('#cap-description').textContent(), /6.00%/);
  await step('rules');
  await page.locator('#save-draft').click();
  await page.reload();
  await ready();
  assert.equal(await page.locator('#exclusions li').count(), 1);
  assert.equal(await page.locator('#commission').inputValue(), '19');
  await simulate();
  await page.locator('#review-proposal').click();
  assert.equal(await page.locator('#proposal-review').isVisible(), true);
  assert.match(await page.locator('#proposal-rules').textContent(), /Exchange-operated fixture/);
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
  assert.equal(review.rule.commissionMaxBps, 1900);
  assert.equal(review.approval, null);
  assert.equal(review.execution.enabled, false);
  assert.deepEqual(review.execution.messages, []);
  assert.equal(review.policyHash.length, 64);
  const shots = process.env.NNS_SCREENSHOT_DIR;
  if (shots) await mkdir(shots, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const stage of ['rules', 'simulation', 'proposals']) {
      await step(stage);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${stage} page overflow at ${width}`
      );
      if (stage !== 'proposals') {
        const id = stage === 'rules' ? 'current-total' : 'allocated-total';
        assert.equal(
          await page.locator('#' + id).evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getClientRects().length;
          }),
          1,
          `${id} wraps at ${width}`
        );
      }
      if (shots)
        await page.screenshot({
          path: `${shots}/juno-delegation-${stage}-${width}.png`,
          fullPage: true
        });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await step('rules');
  // Exercise both actual links into the existing proposal workspace.
  await page.route(/^https:\/\//, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { proposals: [] } })
    })
  );
  await page.evaluate(() =>
    localStorage.setItem(
      'neta-governance-local-draft:juno-delegation',
      JSON.stringify({
        title: 'Preserved draft',
        summary: 'Original summary',
        body: 'Original body',
        actions_json: '[]'
      })
    )
  );
  // A storage failure must be visible beside the real button and preserve drafts.
  await page.evaluate(() => {
    window.originalPlannerSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('cosmoot:juno:planner-proposal:')) throw Error('quota');
      return window.originalPlannerSetItem.call(this, key, value);
    };
  });
  await page.locator('#claim-rewards').click();
  assert.match(await page.locator('#claim-rewards-feedback').innerText(), /could not save/);
  assert.equal(await page.locator('#claim-rewards-feedback').isVisible(), true);
  assert.equal(await page.locator('#claim-rewards').isEnabled(), true);
  assert.ok(page.url().includes('/community-tools/juno/delegation/'));
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalPlannerSetItem;
  });
  await page.locator('#claim-rewards').press('Enter');
  await page.waitForURL((url) => url.hash === '#governance');
  await page.waitForFunction(() =>
    document.getElementById('proposal-title').value.includes('claim staking rewards')
  );
  assert.equal(await page.locator('#governance-view').isVisible(), true);
  assert.match(await page.locator('#proposal-summary').inputValue(), /3837025.339927 JUNO/);
  assert.equal(await page.locator('#subdao-select').inputValue(), 'juno-delegation');
  const govMessages = JSON.parse(await page.locator('#proposal-actions').inputValue());
  assert.equal(govMessages.length, 1);
  assert.equal(govMessages[0]['@type'], '/cosmwasm.wasm.v1.MsgExecuteContract');
  assert.equal(govMessages[0].msg.execute_admin_msgs.msgs.length, 25);
  assert.deepEqual(
    govMessages[0].msg.execute_admin_msgs.msgs.map(
      (v) => v.distribution.withdraw_delegator_reward.validator
    ),
    sample.validators.map((v) => v.address).sort(),
    'Prepared reward validators must match the programme snapshot'
  );
  assert.match(
    await page.locator('#planner-proposal-context-text').innerText(),
    /Juno native governance/
  );
  assert.match(await page.locator('.testnet-pill').innerText(), /JUNO MAINNET · GOVERNANCE/);
  assert.equal(await page.locator('#planner-native-panel').isVisible(), true);
  assert.equal(await page.locator('#native-funding-panel').isVisible(), false);
  assert.equal(await page.locator('#primary-action').innerText(), 'CONNECT KEPLR · JUNO');
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('neta-governance-local-draft:juno-delegation')).title
    ),
    'Preserved draft'
  );
  // A mainnet wallet and the native proposal adapter are mocked: never sign or broadcast.
  const proposer = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
  const preflightQueries = [];
  let pauseProgramme = false,
    txStatus = 'unknown';
  const testHash = 'A'.repeat(64);
  await page.route(/^https:\/\//, (route) => {
    const url = route.request().url();
    preflightQueries.push(new URL(url).pathname);
    let body = { data: { proposals: [] } };
    if (url.endsWith('/latest'))
      body = {
        block: {
          header: { chain_id: 'juno-1', height: '42500123', time: new Date().toISOString() }
        }
      };
    else if (url.includes('/params/'))
      body = {
        params: {
          min_deposit: [{ denom: 'ujuno', amount: '1000000000' }],
          min_initial_deposit_ratio: '0.1'
        }
      };
    else if (url.includes('/spendable_balances/'))
      body = { balance: { denom: 'ujuno', amount: '2000000000' } };
    else if (url.includes('/module_accounts/gov'))
      body = { account: { name: 'gov', base_account: { address: govMessages[0].sender } } };
    else if (url.includes('/smart/'))
      body = {
        data: url.endsWith(btoa('{"pause_info":{}}'))
          ? pauseProgramme
            ? { paused: { expiration: { at_height: 99999999 } } }
            : { unpaused: {} }
          : govMessages[0].sender
      };
    else if (url.includes('/contract/')) body = { contract_info: { code_id: '4047' } };
    else if (url.includes('/withdraw_address')) body = { withdraw_address: sample.programme };
    else if (url.includes('/txs/')) {
      if (txStatus === 'unknown') return route.fulfill({ status: 404, body: 'not found' });
      body = { tx_response: { txhash: testHash, height: '42500124', code: 0 } };
    } else if (url.includes('/delegations/'))
      body = {
        delegation_responses: sample.validators.map((v) => ({
          delegation: { delegator_address: sample.programme, validator_address: v.address },
          balance: { denom: 'ujuno', amount: v.currentRaw }
        })),
        pagination: {}
      };
    return route.fulfill({
      contentType: 'application/json',
      headers: {
        'x-cosmos-block-height': '42500123',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'x-cosmos-block-height, content-type',
        'access-control-allow-methods': 'GET, OPTIONS'
      },
      body: JSON.stringify(body)
    });
  });
  const mockWallet = (proposer) => {
    window.__plannerEnabledChains = [];
    window.__plannerSubmitCount = 0;
    window.__plannerSubmitMode = 'unexpected';
    window.keplr = {
      enable: async (chain) => window.__plannerEnabledChains.push(chain),
      getOfflineSigner: () => ({
        getAccounts: async () => [{ address: proposer }],
        signDirect: async () => {
          throw Error('unexpected signature');
        }
      }),
      signDirect: async () => {
        throw Error('unexpected signature');
      }
    };
    window.NetaJunoGovernance = {
      connect: async () => ({ disconnect() {} }),
      simulate: async () => 100000,
      fixedFee: () => ({ gas: '140000', amount: [{ denom: 'ujuno', amount: '10500' }] }),
      submit: async (_client, _content, _sender, _deposit, _fee, guards) => {
        window.__plannerSubmitCount++;
        if (window.__plannerSubmitMode !== 'lost') throw Error('unexpected submission');
        await guards.beforeSign();
        await guards.assertWallet();
        await guards.beforeBroadcast('A'.repeat(64));
        throw Error('Synthetic lost response; outcome unknown');
      }
    };
  };
  await page.evaluate(mockWallet, proposer);
  await page.locator('#primary-action').click();
  await page.waitForFunction(
    () => document.getElementById('primary-action').textContent === 'REVIEW JUNO PROPOSAL'
  );
  assert.deepEqual(await page.evaluate(() => window.__plannerEnabledChains), ['juno-1']);
  pauseProgramme = true;
  await page.locator('#primary-action').click();
  await page.waitForFunction(() => document.getElementById('gov-status').dataset.state === 'error');
  assert.match(await page.locator('#gov-status').innerText(), /pause state requires review/);
  assert.equal(await page.locator('#planner-native-review').isVisible(), false);
  pauseProgramme = false;
  await page.locator('#primary-action').click();
  await page.waitForFunction(
    () =>
      !document.getElementById('planner-native-review').hidden ||
      document.getElementById('gov-status').dataset.state === 'error'
  );
  assert.equal(
    await page.locator('#planner-native-review').isVisible(),
    true,
    await page.locator('#gov-status').innerText()
  );
  assert.ok(
    preflightQueries.some((path) => path.includes('/delegations/')),
    'Live preflight must be served by the synthetic API'
  );
  assert.equal(await page.locator('#planner-native-deposit').inputValue(), '100');
  assert.match(
    await page.locator('#planner-native-review-text').innerText(),
    /Estimated fee: 0.0105 JUNO/
  );
  assert.equal(await page.locator('#primary-action').isDisabled(), true);
  await page.locator('#planner-native-confirm').check();
  assert.equal(await page.locator('#primary-action').isDisabled(), false);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true
    );
    assert.equal(
      await page.locator('#proposal-title').inputValue(),
      'Juno Delegation Programme — claim staking rewards'
    );
    if (process.env.NNS_SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.NNS_SCREENSHOT_DIR}/juno-native-claim-${width}.png`,
        fullPage: true
      });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#proposal-title').fill('Edited claim draft');
  assert.equal(await page.locator('#planner-native-review').isVisible(), false);
  assert.equal(await page.locator('#primary-action').innerText(), 'REVIEW JUNO PROPOSAL');
  await page.evaluate(() => window.dispatchEvent(new Event('keplr_keystorechange')));
  assert.equal(await page.locator('#primary-action').innerText(), 'CONNECT KEPLR · JUNO');
  await page.locator('#save-local').click();
  await page.reload();
  await page.waitForFunction(
    () => document.getElementById('proposal-title').value === 'Edited claim draft'
  );
  await page.evaluate(mockWallet, proposer);
  await page.locator('#primary-action').click();
  await page.waitForFunction(
    () => document.getElementById('primary-action').textContent === 'REVIEW JUNO PROPOSAL'
  );
  await page.locator('#primary-action').click();
  await page.waitForFunction(() => !document.getElementById('planner-native-review').hidden);
  await page.locator('#planner-native-confirm').check();
  await page.evaluate(() => (window.__plannerSubmitMode = 'lost'));
  await page.locator('#primary-action').click();
  await page.waitForFunction(
    () => document.getElementById('primary-action').textContent === 'CHECK SUBMISSION STATUS'
  );
  assert.equal(await page.evaluate(() => window.__plannerSubmitCount), 1);
  await page.locator('#primary-action').click();
  await page.waitForFunction(() =>
    document.getElementById('gov-status').textContent.includes('still unconfirmed')
  );
  assert.equal(await page.evaluate(() => window.__plannerSubmitCount), 1);
  await page.reload();
  await page.waitForFunction(
    () => document.getElementById('primary-action').textContent === 'CHECK SUBMISSION STATUS'
  );
  txStatus = 'included';
  await page.locator('#primary-action').click();
  await page.waitForFunction(
    () => document.getElementById('primary-action').textContent === 'SUBMISSION CONFIRMED'
  );
  assert.equal(await page.locator('#primary-action').isDisabled(), true);
  assert.match(await page.locator('#action-hint').innerText(), /does not mean the proposal passed/);
  await page.reload();
  await page.waitForFunction(
    () => document.getElementById('primary-action').textContent === 'SUBMISSION CONFIRMED'
  );
  await page.locator('#new-draft').click();
  assert.equal(await page.locator('#proposal-title').inputValue(), 'Preserved draft');
  await page.goto(origin + '/community-tools/juno/delegation/');
  await ready();
  await simulate();
  await page.locator('#review-proposal').click();
  await page.locator('#publish-proposal').click();
  await page.waitForURL((url) => url.hash === '#governance');
  await page.waitForFunction(() =>
    document.getElementById('proposal-title').value.includes('allocation rules')
  );
  assert.deepEqual(JSON.parse(await page.locator('#proposal-actions').inputValue()), []);
  assert.match(await page.locator('#proposal-body').inputValue(), /Rule SHA-256:/);
  assert.equal(await page.locator('#primary-action').innerText(), 'CONNECT KEPLR · JUNO');
  await page.goto(origin + '/community-tools/juno/delegation/');
  await ready();
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
  assert.equal(await page.locator('#claim-rewards').isDisabled(), true);
  await simulate();
  assert.match(await page.locator('#simulation-note').textContent(), /Historical/);
  for (state of ['wrong-chain', 'missing']) {
    await page.locator('#refresh').click();
    await page.waitForFunction(
      () =>
        document.getElementById('snapshot-status').textContent === 'Programme snapshot unavailable'
    );
    assert.equal(await page.locator('#simulate').isDisabled(), true);
    assert.equal(await page.locator('#claim-rewards').isDisabled(), true);
    assert.equal(await page.locator('#export-json').isDisabled(), true);
  }
  assert.deepEqual(errors, []);
  console.log(
    'Juno delegation browser: stage navigation, exact controls, integer commission limits, search, filters, pagination, details, exclusions, persistence, export, stale/error states and all three stages at four viewports passed.'
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
