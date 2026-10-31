import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { finalizedReview } from '../../juno-community-governance.mjs';
import { readProposalReview } from '../../juno-delegation-review.mjs';
import { reviewNetwork } from '../../juno-review-network.mjs';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { approvedProposal } from '../../tests/fixtures/approved-rules.mjs';
import {
  legacyPolicy as defaultPolicy,
  strictHistoryPolicy,
  collectingPolicy,
  observedCommitPolicy,
  fingerprint
} from '../../juno-delegation-core.mjs';
import {
  fixture,
  activeHistory,
  withParticipation,
  withGovernance
} from '../../tests/fixtures/delegation-planner.mjs';
import { rewardsFixture } from '../../tests/fixtures/claim-rewards.mjs';
import { reviewSizeInput } from '../../tests/fixtures/delegation-review-size.mjs';
import { exerciseReviewFunding } from './exercise-review-funding.mjs';
import { ruleProposal } from '../../planner-proposal-draft.mjs';
import { simulate as simulateRule, amount } from '../../juno-delegation-core.mjs';
import { observed } from '../../tests/fixtures/delegation-planner.mjs';
import { legacyClaimDraft } from '../../tests/fixtures/legacy-claim.mjs';
import { claimValidators, GOVERNANCE, PROGRAMME_CODE_HASH } from '../../juno-governance-core.mjs';
import { PROGRAMME } from '../../juno-delegation-core.mjs';
import { CLAIM_381_EXPLANATION, CLAIM_TITLE } from '../../claim-numbering.mjs';
const failedClaim = JSON.parse(
  await readFile(new URL('../../tests/fixtures/juno-proposal-381.json', import.meta.url))
).proposal;
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
let browser, diagnosticPage;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  const page = await browser.newPage({ serviceWorkers: 'block' }),
    errors = [],
    origin = `http://127.0.0.1:${server.address().port}`;
  diagnosticPage = page;
  page.on('pageerror', (error) => errors.push(error.message));
  // Every external response is synthetic, including early history requests.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { proposals: [] } })
    })
  );
  const approvedPolicy = defaultPolicy();
  approvedPolicy.factorTenths = 18;
  approvedPolicy.commissionMaxBps = 700;
  approvedPolicy.exclusions = [
    {
      chainId: 'juno-1',
      validator: sample.validators[0].address,
      reason: '<script>Public exclusion reason</script>'
    }
  ];
  const approved = await approvedProposal({}, approvedPolicy);
  let approvalState = 'empty',
    publishedRule = null,
    publishedReview = null,
    publishedRevision = null,
    movementState = 'valid';
  const approvalRoute = (route) => {
    const url = new URL(route.request().url()),
      path = url.searchParams.get('path') || url.pathname + url.search;
    let response;
    if (path.endsWith('/blocks/latest'))
      response = {
        block: {
          header: { chain_id: 'juno-1', height: '42500123', time: new Date().toISOString() }
        }
      };
    else if (path.startsWith('/cosmos/gov/v1/proposals?'))
      response = {
        proposals:
          approvalState === 'empty' ||
          (approvalState === 'disagree' && url.searchParams.get('source') === 'juno-stavr')
            ? [failedClaim]
            : [failedClaim, approved, ...(publishedRule ? [publishedRule] : [])],
        pagination: { next_key: null }
      };
    else if (publishedRule && path === '/cosmos/gov/v1/proposals/' + publishedRule.id)
      response = { proposal: publishedRule };
    else if (
      publishedReview &&
      path.includes(`/contract/${reviewNetwork('juno-1').contract}/smart/`)
    ) {
      const query = JSON.parse(atob(decodeURIComponent(path.split('/').at(-1))));
      if (query.proposal?.proposal_id === publishedReview.id) response = { data: publishedReview };
      else if (query.revisions?.proposal_id === publishedReview.id)
        response = { data: [publishedRevision] };
      else if (query.proposals)
        response = { data: query.proposals.start_after ? [] : [publishedReview] };
      else if (query.proposal_summaries)
        response = {
          data: query.proposal_summaries.start_after
            ? []
            : [{ proposal: publishedReview, latest_revision: publishedRevision }]
        };
      else if (query.comments) response = { data: [] };
      else return route.fallback();
    } else if (path === '/cosmos/staking/v1beta1/params')
      response = { params: { bond_denom: 'ujuno', max_entries: 7, unbonding_time: '2419200s' } };
    else if (path.includes('/spendable_balances/' + PROGRAMME))
      response = { balance: { denom: 'ujuno', amount: sample.liquidRaw } };
    else if (path.endsWith('/module_accounts/gov'))
      response = { account: { base_account: { address: GOVERNANCE }, name: 'gov' } };
    else if (path.endsWith('/code/4047'))
      response = { code_info: { data_hash: PROGRAMME_CODE_HASH } };
    else if (path.endsWith('/contract/' + PROGRAMME))
      response = { contract_info: { code_id: 4047 } };
    else if (path.includes('/contract/' + PROGRAMME + '/smart/'))
      response = {
        data: atob(decodeURIComponent(path.split('/').at(-1))).includes('admin')
          ? GOVERNANCE
          : { unpaused: {} }
      };
    else if (path.endsWith('/withdraw_address')) response = { withdraw_address: PROGRAMME };
    else if (path.includes('/staking/v1beta1/delegations/' + PROGRAMME))
      response = {
        delegation_responses: sample.validators.map((v) => ({
          delegation: {
            delegator_address: PROGRAMME,
            validator_address: v.address,
            shares: v.currentRaw + '.000000000000000000'
          },
          balance: { denom: 'ujuno', amount: movementState === 'changed' ? '1' : v.currentRaw }
        })),
        pagination: { next_key: null }
      };
    else if (path.startsWith('/cosmos/base/tendermint/v1beta1/validatorsets/'))
      response = {
        block_height: '42500123',
        validators: sample.validators.map((v, i) => ({
          address: Buffer.from(v.consensusAddress, 'hex').toString('base64'),
          pub_key: { key: 'fixture-key-' + i }
        })),
        pagination: { next_key: null }
      };
    else if (path.startsWith('/cosmos/staking/v1beta1/validators?'))
      response = {
        validators: sample.validators.map((v, i) => ({
          consensus_pubkey: { key: 'fixture-key-' + i },
          commission: { commission_rates: { rate: '0.050000000000000000' } },
          operator_address: v.address,
          jailed: false,
          tokens: v.tokensRaw,
          delegator_shares: v.tokensRaw + '.000000000000000000'
        })),
        pagination: { next_key: null }
      };
    else if (path.includes('/redelegations?'))
      response = { redelegation_responses: [], pagination: { next_key: null } };
    else if (path.includes('/unbonding_delegations?'))
      response = { unbonding_responses: [], pagination: { next_key: null } };
    else return route.fallback();
    return route.fulfill({
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'x-cosmos-block-height': url.searchParams.get('height') || '42500123'
      },
      body: JSON.stringify(response)
    });
  };
  await page.route('**/data/governance-read?*', approvalRoute);
  let state = 'current';
  let historyComplete = true;
  let historyDays = 90;
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
    withGovernance(data);
    if (historyComplete) {
      data.activeSetHistory = withParticipation(activeHistory(data, historyDays));
      data.activeSetHistory.schema = 2;
      data.activeSetHistory.collectionStart = {
        height: data.activeSetHistory.spans[0].firstHeight,
        time: data.activeSetHistory.spans[0].startTime
      };
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  const ready = () => page.waitForFunction(() => !document.getElementById('simulate').disabled);
  const step = async (name) => {
    await page
      .locator(
        name === 'overview' ? '.programme-overview-link' : `.planner-steps [data-step="${name}"]`
      )
      .click();
    assert.equal(await page.locator('#' + name).isVisible(), true);
    assert.equal(
      await page
        .locator(
          name === 'overview' ? '.programme-overview-link' : `.planner-steps [data-step="${name}"]`
        )
        .getAttribute('aria-current'),
      name === 'overview' ? 'page' : 'step'
    );
  };
  const simulate = async () => {
    await step('distribution');
    await page.locator('#simulate').click();
    await page.waitForFunction(() => !document.getElementById('export-json').disabled);
  };
  await page.goto(origin + '/community-tools/juno/delegation/#overview');
  await ready();
  assert.equal(await page.locator('#overview').isVisible(), true);
  assert.equal(
    await page.evaluate(() => scrollY),
    0,
    'Overview deep link keeps the page title visible'
  );
  if (process.env.NNS_SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mkdir(process.env.NNS_SCREENSHOT_DIR, { recursive: true });
    await page
      .locator('.overview-workspace')
      .screenshot({ path: `${process.env.NNS_SCREENSHOT_DIR}/overview-first-adoption.png` });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  }
  await page.locator('.overview-heading [data-step="rules"]').click();
  assert.equal(
    await page.locator('#rules-title').evaluate((el) => el === document.activeElement),
    true
  );
  await step('overview');
  assert.equal(await page.locator('#overview-model').evaluate((el) => el.open), false);
  await page.waitForFunction(
    () => document.getElementById('current-rules-state').textContent === 'Awaiting first approval'
  );
  approvalState = 'approved';
  await page.locator('#refresh').click();
  await ready();
  await page.waitForFunction(() =>
    document.getElementById('current-rules-state').textContent.includes('Rules approved ·')
  );
  assert.match(await page.locator('#current-rules-content').textContent(), /1.8 × 100%/);
  assert.match(await page.locator('#current-rules-content').textContent(), /7%/);
  assert.match(
    await page.locator('#current-rules-content').textContent(),
    /<script>Public exclusion reason<\/script>/
  );
  assert.equal(await page.locator('#current-rules-content script').count(), 0);
  assert.equal(
    await page.locator('#current-rules-content a').getAttribute('href'),
    'https://atomscan.com/juno/proposals/950'
  );
  assert.equal(await page.locator('#factor-number').inputValue(), '1.5');
  assert.equal(await page.locator('#commission').inputValue(), '10');
  // Rebalance uses the exact verified historical approval, independently of editable rules.
  await step('rebalance');
  assert.equal(await page.locator('#rebalance-rule-title').textContent(), 'Proposal #950');
  assert.equal(await page.locator('#rebalance-proposal').isDisabled(), true);
  await page.locator('#rebalance-max').click();
  const rebalanceBudget = await page.locator('#rebalance-amount').inputValue();
  assert.match(rebalanceBudget, /\.\d{6}$/);
  await page.locator('#rebalance-simulate').click();
  await page.waitForFunction(() => !document.getElementById('rebalance-export').disabled);
  assert.ok((await page.locator('#rebalance-rows tr').count()) > 0);
  assert.equal(await page.locator('#rebalance-result script, #rebalance-result img').count(), 0);
  await page.waitForFunction(() => !document.getElementById('rebalance-proposal').disabled);
  assert.match(await page.locator('#rebalance-movements').textContent(), /28 days/);
  const frozenAllocation = await page.locator('#rebalance-identifiers').textContent();
  await step('rules');
  await page.locator('#commission').fill('11');
  await step('rebalance');
  assert.equal(await page.locator('#rebalance-identifiers').textContent(), frozenAllocation);
  assert.equal(await page.locator('#rebalance-result').isVisible(), true);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `Rebalance overflow at ${width}`
    );
  }
  const allocationDownload = page.waitForEvent('download');
  await page.locator('#rebalance-export').click();
  const allocationFile = await allocationDownload;
  const allocation = JSON.parse(await readFile(await allocationFile.path(), 'utf8'));
  assert.equal(allocation.kind, 'ALLOCATION_SIMULATION');
  assert.equal(allocation.executionEnabled, false);
  assert.deepEqual(allocation.messages, []);
  assert.equal(allocation.calculation.rule.schema, 2);
  assert.equal(allocation.calculation.rule.commissionMaxBps, 700);
  // A fresh-state mismatch must prevent a draft even after the earlier check passed.
  movementState = 'changed';
  await page.locator('#rebalance-proposal').click();
  await page.waitForFunction(() =>
    document.getElementById('rebalance-feedback').textContent.includes('holdings changed')
  );
  assert.equal(await page.locator('#rebalance-proposal').isDisabled(), true);
  movementState = 'valid';
  await page.locator('#rebalance-simulate').click();
  await page.waitForFunction(() => !document.getElementById('rebalance-proposal').disabled);
  let rebalanceHandoff = '';
  const handoffRoute = (route) => {
    rebalanceHandoff = route.request().url();
    return route.fulfill({ status: 204 });
  };
  await page.route('**/?chain=juno&dao=juno&subdao=juno-delegation&plannerDraft=*', handoffRoute);
  const handoffRequest = page.waitForRequest((request) => request.url().includes('plannerDraft='));
  await page.locator('#rebalance-proposal').click();
  await page.waitForFunction(() =>
    Object.keys(localStorage).some(
      (k) =>
        k.startsWith('cosmoot:juno:planner-proposal:') &&
        JSON.parse(localStorage.getItem(k)).kind === 'ALLOCATION_EXECUTION'
    )
  );
  const allocationDraft = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cosmoot:juno:planner-proposal:'))
      .map((k) => JSON.parse(localStorage.getItem(k)))
      .find((v) => v.kind === 'ALLOCATION_EXECUTION')
  );
  assert.equal(allocationDraft.kind, 'ALLOCATION_EXECUTION');
  assert.ok(
    JSON.parse(allocationDraft.values.actions_json)[0].msg.execute_admin_msgs.msgs.length > 0
  );
  assert.match(allocationDraft.values.body, /Frozen rebalance execution/);
  await handoffRequest;
  assert.ok(rebalanceHandoff.includes('plannerDraft='));
  await page.unroute('**/?chain=juno&dao=juno&subdao=juno-delegation&plannerDraft=*', handoffRoute);
  await page.locator('#rebalance-amount').fill('0');
  assert.equal(await page.locator('#rebalance-export').isDisabled(), true);
  await page.locator('#rebalance-simulate').click();
  await page.waitForFunction(
    () => document.getElementById('rebalance-feedback').dataset.tone === 'error'
  );
  assert.equal(await page.locator('#rebalance-result').isVisible(), false);
  await step('rules');
  await page.locator('#commission').fill('10');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await step('overview');
  approvalState = 'disagree';
  await page.locator('#refresh').click();
  await ready();
  await page.waitForFunction(
    () => document.getElementById('current-rules-state').textContent === 'Approval unavailable'
  );
  assert.equal(await page.locator('#current-rules-content .approved-settings').count(), 0);
  approvalState = 'approved';
  await page.locator('#refresh').click();
  await ready();
  assert.equal(await page.locator('.programme-notice').count(), 0);
  assert.equal(
    await page
      .locator('.snapshot-bar')
      .evaluate(
        (el) =>
          !!(
            document.querySelector('#proposals').compareDocumentPosition(el) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
      ),
    true
  );
  for (const prefix of ['overview', 'rules']) {
    for (const group of ['eligibility', 'bonus', 'points'])
      assert.equal(
        await page.locator(`#${prefix}-${group}-details`).evaluate((el) => el.open),
        prefix === 'rules' && (group === 'eligibility' || group === 'bonus')
      );
  }
  assert.equal(await page.locator('#overview-points-balance').isVisible(), false);
  await page.locator('#overview-model > summary').click();
  for (const group of ['bonus', 'points']) {
    const toggle = page.locator(`#overview-${group}-details > summary`);
    await toggle.press('Enter');
    assert.equal(await page.locator(`#overview-${group}-details`).evaluate((el) => el.open), true);
    await toggle.press('Enter');
  }
  assert.equal(await page.locator('#overview-base-points').textContent(), '—');
  assert.equal(await page.locator('#overview-points-balance').isDisabled(), true);
  assert.match(
    await page.locator('#overview-points-effect').textContent(),
    /No approved points model/
  );
  await page.locator('#overview-model > summary').click();
  assert.equal(await page.locator('#overview-points-balance').isVisible(), false);
  assert.equal(await page.locator('#rules').isVisible(), false);
  assert.equal(await page.locator('#overview #claim-rewards').isVisible(), true);
  assert.equal(await page.locator('#rules #claim-rewards').count(), 0);
  assert.equal(await page.locator('#current-validator-count').textContent(), '25');
  assert.equal(await page.locator('#current-position-rows tr').count(), 5);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const aligned = await page.locator('.overview-workspace').evaluate((el) => {
    const a = el.querySelector('.current-positions').getBoundingClientRect();
    const b = el.querySelector('.overview-sidebar').getBoundingClientRect();
    return Math.abs(a.top - b.top) < 1 && Math.abs(a.bottom - b.bottom) < 1;
  });
  assert.ok(aligned, 'Overview cards share top and bottom edges');
  if (process.env.NNS_SCREENSHOT_DIR) {
    await mkdir(process.env.NNS_SCREENSHOT_DIR, { recursive: true });
    await page
      .locator('.overview-workspace')
      .screenshot({ path: `${process.env.NNS_SCREENSHOT_DIR}/overview-balanced.png` });
  }
  await page.locator('#current-positions-toggle').click();
  assert.equal(await page.locator('#current-position-rows tr').count(), 25);
  await page.locator('#current-positions-toggle').click();
  for (const prefix of ['overview', 'rules']) {
    assert.equal(
      await page.locator(`#${prefix}-future-policy input:enabled`).count(),
      prefix === 'rules' ? 3 : 0
    );
    assert.equal(await page.locator(`#${prefix}-future-policy .bonus-preview-row`).count(), 4);
  }
  const bonusRows = page.locator('#rules-future-policy .bonus-preview-row');
  assert.match(await bonusRows.nth(0).textContent(), /Governance participation/);
  assert.equal(await bonusRows.nth(0).locator('input').inputValue(), '100');
  assert.equal(await bonusRows.nth(0).locator('input').isEnabled(), true);
  assert.equal(await bonusRows.nth(0).locator('small').textContent(), '100% of bonus');
  for (let index = 1; index < 4; index++) {
    assert.match(await bonusRows.nth(index).textContent(), /\(not live\)/);
    assert.equal(await bonusRows.nth(index).locator('input').inputValue(), '0');
    assert.equal(await bonusRows.nth(index).locator('input').isDisabled(), true);
    assert.equal(await bonusRows.nth(index).locator('small').textContent(), '0% of bonus');
  }
  await page.reload();
  await ready();
  assert.equal(await page.locator('#overview').isVisible(), true);
  assert.match(
    await page.locator('#claim-rewards-amount').textContent(),
    /3,837,025.34 JUNO.*33,896.32/
  );
  assert.match(
    await page.locator('#claim-rewards-observed').textContent(),
    /Exact amount: 3,837,025.339927 JUNO.*25 programme delegations/
  );
  for (const status of ['stale', 'missing', 'no-price']) {
    rewardsState = status;
    await page.locator('#refresh').click();
    await ready();
    assert.equal(await page.locator('#claim-rewards').isDisabled(), status !== 'no-price');
    const text = await page.locator('#claim-rewards-amount').textContent();
    assert.equal(text.includes('$'), false);
    assert.match(text, status === 'no-price' ? /3,837,025.34 JUNO/ : /unavailable/);
  }
  rewardsState = 'current';
  await page.locator('#refresh').click();
  await ready();
  await step('rules');
  assert.equal(await page.locator('#programme-amount').inputValue(), '15000900');
  await page.waitForFunction(() =>
    document.getElementById('draft-parent-note').textContent.includes('#950')
  );
  assert.equal(await page.locator('#factor-number').inputValue(), '1.8');
  assert.equal(await page.locator('#commission').inputValue(), '7');
  assert.equal(await page.locator('#use-current-model').count(), 0);
  assert.equal(await page.locator('#uptime').inputValue(), '97.5');
  await page.locator('#factor-number').fill('1.5');
  await page.locator('#commission').fill('10');
  assert.deepEqual(
    (await page.locator('#rules-eligibility-details > .criterion h4').allTextContents()).map(
      (text) => text.trim()
    ),
    [
      'Minimum uptime',
      'Maximum commission',
      'Active-set history',
      'Voting power',
      'Upgrade participation',
      'Manual exclusions'
    ]
  );
  await page.getByText('Edit exclusions', { exact: true }).click();
  assert.equal(await page.getByLabel('Juno validator', { exact: true }).isVisible(), true);
  assert.equal(await page.getByLabel('Public reason', { exact: true }).isVisible(), true);
  assert.match(await page.locator('#cap-description').textContent(), /6.00%/);
  assert.equal(await page.locator('#rules-eligibility-details').evaluate((el) => el.open), true);
  assert.equal(await page.locator('#draft-budget').textContent(), '15,000,900.00 JUNO');
  await step('distribution');
  await page.locator('#budget-max').click();
  assert.equal(await page.locator('#programme-amount').inputValue(), '15000953.086400');
  await page.locator('#programme-amount').fill('15000900');
  await step('rules');
  await page.waitForFunction(() => document.querySelector('#rules-impact .impact-table tbody tr'));
  assert.deepEqual(
    await page
      .locator('.planner-steps a')
      .allTextContents()
      .then((items) => items.map((t) => t.replace(/\d+/g, '').trim())),
    ['Eligibility', 'Distribution', 'Review', 'Rebalance']
  );
  assert.equal(await page.locator('#rules-impact img, #rules-impact script').count(), 0);
  // Every monetary header toggles numerical order; the full dataset is sorted before slicing.
  for (const [label, column] of [
    ['Current · JUNO', 1],
    ['Target · JUNO', 2],
    ['Change', 3]
  ]) {
    for (const direction of ['descending', 'ascending']) {
      const header = page.locator('#rules-impact th').nth(column);
      if ((await header.getAttribute('aria-sort')) !== direction)
        await header.getByRole('button').click();
      assert.equal(await header.getAttribute('aria-sort'), direction);
      const values = await page
        .locator('#rules-impact tbody tr')
        .evaluateAll(
          (rows, index) =>
            rows.map((row) =>
              Number(row.cells[index].textContent.replaceAll(',', '').replace('−', '-'))
            ),
          column
        );
      assert.ok(
        values.every(
          (value, i) =>
            !i || (direction === 'ascending' ? values[i - 1] <= value : values[i - 1] >= value)
        ),
        label
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await page
    .getByLabel('Sort validator outcomes')
    .filter({ visible: true })
    .selectOption('currentRaw:descending');
  assert.equal(
    await page.locator('#rules-impact th').nth(1).getAttribute('aria-sort'),
    'descending'
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const criterionAlignment = await page
    .locator('#rules-eligibility-details > .criterion .number-unit')
    .evaluateAll((nodes) =>
      nodes.map((el) => ({ x: el.getBoundingClientRect().x, h: el.getBoundingClientRect().height }))
    );
  assert.equal(criterionAlignment.length, 5);
  assert.ok(
    criterionAlignment.every(
      ({ x, h }) =>
        Math.abs(x - criterionAlignment[0].x) < 1 && Math.abs(h - criterionAlignment[0].h) < 1
    ),
    'criterion values share an edge and height'
  );

  await page.locator('#commission').fill('0');
  await page.waitForFunction(() =>
    document.querySelector('#rules-impact .impact-metrics strong').textContent.startsWith('0 /')
  );
  assert.equal(
    await page.locator('#rules-impact th').nth(1).getAttribute('aria-sort'),
    'descending',
    'sorting survives recalculation'
  );
  await page.locator('#commission').fill('10');
  await page.waitForFunction(
    () =>
      !document.querySelector('#rules-impact .impact-metrics strong').textContent.startsWith('0 /')
  );
  const criterionHelp = page.getByRole('button', { name: 'Minimum uptime', exact: true });
  await criterionHelp.focus();
  assert.equal(await page.locator('#uptime-tooltip').isVisible(), true);
  await criterionHelp.press('Escape');
  assert.equal(await page.locator('#uptime-tooltip').isVisible(), false);

  assert.equal(await page.locator('#rules-points-balance').isVisible(), false);
  assert.equal(
    await page
      .locator('.allocation-settings')
      .evaluate(
        (el) =>
          !!(
            document.querySelector('.eligibility-rules').compareDocumentPosition(el) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
      ),
    true
  );
  await page.locator('#factor-number').fill('2');
  assert.match(await page.locator('#cap-description').textContent(), /8.00%/);
  assert.equal(
    await page.locator('#additional-rule-options, #factor, #no-commission-limit').count(),
    0
  );
  await page.locator('#factor-number').fill('3.0');
  assert.equal(await page.locator('#factor-error').isVisible(), false);
  assert.match(await page.locator('#cap-description').textContent(), /12.00%/);
  await page.locator('#save-draft').click();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('cosmoot:juno:delegation:rule-draft:v3')).rule.factorTenths
    ),
    30
  );
  await page.locator('#factor-number').fill('3.1');
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
    assert.equal(await page.locator('#rules-eligibility-details').evaluate((el) => el.open), true);
    assert.equal(
      await page.locator('#commission').evaluate((el) => el === document.activeElement),
      true
    );
    assert.match(await page.locator('#feedback').textContent(), /whole-number commission/);
    await step('distribution');
    await page.locator('#simulate').click();
    assert.equal(await page.locator('#export-json').isDisabled(), true);
    assert.match(await page.locator('#feedback').textContent(), /whole-number commission/);
  }
  await page.locator('#commission').fill('19');
  await simulate();
  assert.equal(await page.locator('#proposals').isVisible(), true);
  assert.equal(await page.locator('#simulation-comparison').count(), 1);
  assert.equal(await page.locator('#simulation').count(), 0);
  assert.equal(await page.locator('#rules').isVisible(), false);
  await page.evaluate(() => {
    location.hash = 'simulation';
  });
  await page.waitForFunction(() => location.hash === '#proposals');
  assert.equal(await page.locator('#proposals').isVisible(), true);
  const comparison = page.locator('#simulation-comparison');
  assert.equal(await comparison.locator('img').count(), 0, 'validator names are rendered as text');
  assert.equal(await page.locator('#rebalance-proposal').isDisabled(), true);
  assert.equal(await comparison.locator('.rr-validator').count(), 10);
  assert.match(await comparison.locator('.rr-pagination').textContent(), /1–10 of 25/);
  await comparison.getByRole('button', { name: 'Next →', exact: true }).click();
  assert.match(await comparison.locator('.rr-pagination').textContent(), /11–20 of 25/);
  await comparison.getByLabel('Sort by', { exact: true }).selectOption('name');
  await comparison
    .getByLabel('Find a validator', { exact: true })
    .fill(sample.validators[0].address);
  assert.equal(await comparison.locator('.rr-validator').count(), 1);
  assert.match(await comparison.locator('.rr-identity').textContent(), /<img src=x/);
  await comparison.locator('.rr-validator > details > summary').click();
  assert.match(
    await comparison.locator('.rr-validator > details').textContent(),
    /600,000.123456 JUNO/
  );
  assert.match(
    await comparison.locator('.rr-validator > details').textContent(),
    /All delegators after allocation:/
  );
  assert.match(
    await comparison.locator('.rr-participation').textContent(),
    /100.0000% commit signatures/
  );
  await comparison.getByRole('button', { name: 'Rule effect only', exact: true }).click();
  assert.equal(
    await comparison
      .getByRole('button', { name: 'Rule effect only', exact: true })
      .getAttribute('aria-pressed'),
    'true'
  );
  assert.match(
    await comparison
      .locator('.rr-note')
      .filter({ hasText: 'same snapshot, evidence and budget' })
      .textContent(),
    /same snapshot, evidence and budget/
  );
  await comparison.getByLabel('Only changes', { exact: true }).check();
  await comparison.getByLabel('Only changes', { exact: true }).uncheck();
  await comparison.getByRole('button', { name: 'Today → proposed', exact: true }).click();
  await comparison.getByLabel('Find a validator', { exact: true }).fill('no-such-validator');
  assert.match(await comparison.locator('.rr-rows').textContent(), /No validators match/);
  await comparison.getByLabel('Find a validator', { exact: true }).fill('');
  await comparison.getByLabel('Show', { exact: true }).selectOption('receiving');
  assert.ok(
    (await comparison.locator('.rr-proposed strong').allTextContents()).every((v) => v !== '0.00')
  );
  await comparison.getByLabel('Show', { exact: true }).selectOption('all');
  for (const sort of ['total', 'total-asc', 'projected', 'projected-asc']) {
    await comparison.getByLabel('Sort by', { exact: true }).selectOption(sort);
    assert.match(await comparison.locator('.rr-pagination').textContent(), /1–10 of 25/);
  }
  const selected = sample.validators.find(
    (v) =>
      v.address !== sample.validators[0].address &&
      history.firstSignatures[v.consensusAddress] &&
      history.firstSignatures[v.consensusAddress].secondsFromHalt < 18000
  );
  const before = Number(
    (await comparison.locator('.rr-stats > div').nth(2).textContent()).match(/→ (\d+)/)[1]
  );
  await step('rules');
  for (const value of ['', '94.99', '100.01', '97.555']) {
    await page.locator('#uptime').fill(value);
    assert.equal(await page.locator('#uptime-error').isVisible(), true);
    assert.equal(await page.locator('#draft-uptime').textContent(), 'Check value');
    await page.locator('#save-draft').click();
    assert.match(await page.locator('#feedback').textContent(), /uptime threshold/);
    await step('distribution');
    await page.locator('#simulate').click();
    assert.equal(await page.locator('#export-json').isDisabled(), true);
    assert.equal(
      await page.locator('#uptime').evaluate((el) => el === document.activeElement),
      true
    );
  }
  for (const value of ['95', '100', '99.01']) {
    await page.locator('#uptime').fill(value);
    assert.equal(await page.locator('#uptime-error').isVisible(), false);
    assert.equal(await page.locator('#draft-uptime').textContent(), value + '%');
  }
  await page.locator('#excluded-validator').fill(selected.name);
  await page.locator('#excluded-reason').fill('Exchange-operated fixture');
  await page.locator('#add-exclusion').click();
  assert.equal(await page.locator('#export-json').isDisabled(), true);
  await simulate();
  assert.equal(
    Number((await comparison.locator('.rr-stats > div').nth(2).textContent()).match(/→ (\d+)/)[1]),
    before - 1
  );
  assert.match(await page.locator('#cap-description').textContent(), /6.00%/);
  await step('rules');
  await page.locator('#save-draft').click();
  await page.reload();
  await ready();
  assert.equal(await page.locator('#exclusions li').count(), 2);
  assert.equal(await page.locator('#commission').inputValue(), '19');
  assert.equal(await page.locator('#uptime').inputValue(), '99.01');
  await simulate();
  assert.equal(await page.locator('#simulation-comparison').isVisible(), true);
  assert.match(
    await page.locator('#simulation-comparison').textContent(),
    /Exchange-operated fixture/
  );
  const pendingDownload = page.waitForEvent('download');
  await page.locator('#export-json').click();
  const download = await pendingDownload;
  const stream = await download.createReadStream(),
    chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const review = JSON.parse(Buffer.concat(chunks));
  assert.equal(review.kind, 'RULE_APPROVAL');
  assert.equal(review.parent.proposalId, '950');
  assert.ok(review.rule.exclusions.some((v) => v.validator === selected.address));
  assert.equal(review.rule.commissionMaxBps, 1900);
  assert.deepEqual(review.messages, []);
  assert.equal(review.rule.schema, 9);
  assert.equal(review.rule.minParticipationBps, 9901);
  assert.equal(review.policyHash.length, 64);
  const shots = process.env.NNS_SCREENSHOT_DIR;
  if (shots) await mkdir(shots, { recursive: true });
  await page.locator('#rules-eligibility-details').evaluate((el) => (el.open = true));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const stage of ['overview', 'rules', 'distribution', 'proposals', 'rebalance']) {
      await step(stage);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${stage} page overflow at ${width}`
      );
      if (stage === 'overview') {
        const id = 'current-total';
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
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await step('distribution');
    assert.equal(await page.locator('#rules-points-balance').isVisible(), true);
    await page.locator('#rules-points-balance').fill('100');
    assert.equal(await page.locator('#rules-base-points').inputValue(), '100');
    assert.equal(await page.locator('#rules-bonus-points').textContent(), '900');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    if (shots)
      await page.screenshot({ path: `${shots}/distribution-light-${width}.png`, fullPage: true });
    await page.locator('#theme-toggle').click();
  }
  await page.locator('#save-distribution-rules').click();
  await page.reload();
  await ready();
  await step('distribution');
  assert.equal(await page.locator('#rules-base-points').inputValue(), '100');
  const savedPoints = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cosmoot:juno:delegation:rule-draft:v3')).rule.points
  );
  assert.deepEqual(savedPoints, {
    base: 100,
    weights: { governance: 100, rpc: 0, testnet: 0, archive: 0 }
  });
  await page.locator('#rules-base-points').fill('');
  await page.locator('#save-distribution-rules').click();
  assert.match(await page.locator('#feedback').textContent(), /Check the base points/);
  await page.locator('#rules-base-points').fill('900');
  await page.locator('#save-distribution-rules').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await step('overview');
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
  assert.equal(await page.locator('#claim-rewards').isDisabled(), false);
  await page.locator('#claim-rewards').click();
  await page.waitForFunction(() => !!document.querySelector('#gov-connect')?.onclick);
  const correctedDraftUrl = page.url();
  assert.equal(await page.locator('#proposal-title').inputValue(), CLAIM_TITLE + ' II');
  assert.ok((await page.locator('#proposal-body').inputValue()).includes(CLAIM_381_EXPLANATION));
  assert.equal(
    claimValidators(JSON.parse(await page.locator('#proposal-actions').inputValue()), {
      allowLegacy: false
    }).length,
    sample.validators.length
  );
  const legacy = legacyClaimDraft(sample);
  const openDraft = async (draft, id) => {
    const url = await page.evaluate(
      async ({ draft, id }) => {
        const { savePlannerProposal } = await import('/planner-proposal-draft.mjs');
        return savePlannerProposal(localStorage, draft, id);
      },
      { draft, id }
    );
    await page.goto(origin + url);
    await page.waitForFunction(() => !!document.querySelector('#gov-connect').onclick);
  };
  await openDraft(legacy, '11111111-1111-4111-8111-111111111111');
  await page.waitForFunction(() =>
    document
      .querySelector('#action-hint')
      .textContent.includes('incompatible format from proposal #381')
  );

  assert.equal(await page.locator('#primary-action').isDisabled(), true);
  assert.match(
    await page.locator('#action-hint').innerText(),
    /incompatible format from proposal #381/
  );
  assert.equal(await page.locator('#proposal-title').inputValue(), legacy.values.title);
  assert.deepEqual(
    JSON.parse(await page.locator('#proposal-actions').inputValue()),
    JSON.parse(legacy.values.actions_json)
  );
  // Text-only rule drafts remain valid. The corrected claim exercises the real UI
  // publication/funding/journal flow; the isolated Juno check proves execution.
  const p = defaultPolicy();
  const rule = ruleProposal({
    proposalType: 'RULE_APPROVAL',
    approval: null,
    rule: p,
    snapshot: sample,
    simulation: simulateRule(p, sample, amount('3000'), observed(sample)),
    policyHash: await fingerprint(p),
    snapshotHash: 'b'.repeat(64),
    evidenceHash: 'c'.repeat(64)
  });
  await openDraft(rule, '22222222-2222-4222-8222-222222222222');
  await page.waitForFunction(
    () => document.querySelector('#primary-action').textContent === 'PUBLISH FOR REVIEW'
  );
  assert.deepEqual(JSON.parse(await page.locator('#proposal-actions').inputValue()), []);
  await page.goto(correctedDraftUrl);
  await page.waitForFunction(() => !!document.querySelector('#gov-connect')?.onclick);
  await exerciseReviewFunding(page, origin, sample);
  await page.locator('#new-draft').click();
  assert.equal(
    await page.locator('#proposal-title').inputValue(),
    '',
    'Mainnet drafts must not overwrite old UNI-7 drafts'
  );
  const archive = new URL(page.url());
  for (const key of ['review', 'reviewContract', 'plannerDraft']) archive.searchParams.delete(key);
  archive.searchParams.set('reviewChain', 'uni-7');
  await page.goto(archive.href);
  await page.waitForFunction(
    () => document.querySelector('#proposal-title').value === 'Preserved draft'
  );
  assert.match(await page.locator('.testnet-pill').textContent(), /UNI-7 REVIEW/);
  // Restore the approved baseline after the rewards-flow fixture's own routes.
  await page.route(/^(https:\/\/|http:\/\/127\.0\.0\.1.*\/data\/governance-read)/, approvalRoute);
  await page.goto(origin + '/community-tools/juno/delegation/');
  await ready();
  await simulate();
  await page.locator('#publish-proposal').click();
  await page.waitForURL((url) => url.hash === '#governance');
  await page.waitForFunction(
    () =>
      document.getElementById('proposal-title').value.includes('allocation rules') &&
      !document.getElementById('proposal-title').disabled
  );
  assert.deepEqual(JSON.parse(await page.locator('#proposal-actions').inputValue()), []);
  assert.match(await page.locator('#proposal-body').inputValue(), /Rule SHA-256:/);
  assert.match(await page.locator('#planner-proposal-context a').getAttribute('href'), /#rules$/);
  await page.waitForFunction(() =>
    document
      .getElementById('proposal-rule-review')
      .textContent.includes('What changes in the distribution?')
  );
  assert.match(await page.locator('#proposal-rule-review').textContent(), /Previously approved/);
  assert.equal(await page.locator('#proposal-rule-review img').count(), 0);
  assert.equal(await page.locator('#primary-action').innerText(), 'PUBLISH FOR REVIEW');
  const frozenValues = await page.evaluate(() => ({
    title: document.getElementById('proposal-title').value,
    summary: document.getElementById('proposal-summary').value,
    body: document.getElementById('proposal-body').value,
    actions_json: document.getElementById('proposal-actions').value
  }));
  assert.match(frozenValues.body, /Native proposal format: cosmoot-rule-reference-1/);
  assert.equal(
    await page.locator('#proposal-details-toggle').getAttribute('aria-expanded'),
    'false'
  );
  // An existing draft only changes format after its author's explicit action.
  const frozen = await readProposalReview(frozenValues);
  const { frozenRuleProposal } = await import('../../planner-proposal-draft.mjs');
  await openDraft(await frozenRuleProposal(frozen), '33333333-3333-4333-8333-333333333333');
  await page.locator('#rule-proposal-convert').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#proposal-body')
      .value.includes('Native proposal format: cosmoot-rule-reference-1')
  );
  const convertedValues = await page.evaluate(() => ({
    title: document.getElementById('proposal-title').value,
    summary: document.getElementById('proposal-summary').value,
    body: document.getElementById('proposal-body').value,
    actions_json: document.getElementById('proposal-actions').value
  }));
  assert.equal((await readProposalReview(convertedValues)).hash, frozen.hash);
  assert.match(convertedValues.summary, /rule|Rule/);
  publishedReview = {
    id: 17,
    latest_version: 1,
    finalized_version: 1,
    finalized_hash: createHash('sha256').update(JSON.stringify(convertedValues)).digest('hex'),
    author: 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57',
    withdrawn: false
  };
  publishedRevision = {
    ...convertedValues,
    proposal_id: 17,
    version: 1,
    author: publishedReview.author
  };
  const final = await finalizedReview(publishedReview, publishedRevision, 'juno-1');
  assert.ok(Buffer.byteLength(final.content.summary) < 2500);
  publishedRule = {
    ...approved,
    ...final.content,
    id: '999',
    status: 'PROPOSAL_STATUS_VOTING_PERIOD',
    voting_end_time: new Date(Date.now() + 86400000).toISOString()
  };
  const publishedUrl = new URL(page.url());
  publishedUrl.searchParams.delete('plannerDraft');
  publishedUrl.searchParams.set('proposal', '999');
  await page.evaluate(() =>
    localStorage.setItem(
      'cosmoot:juno:delegation:rule-draft:v3',
      JSON.stringify({
        schema: 1,
        rule: { schema: 3, factorTenths: 99 },
        parent: null,
        rationale: 'Unrelated local edits must not change a published review'
      })
    )
  );
  await page.goto(publishedUrl.href);
  await page.waitForFunction(() =>
    document.getElementById('proposal-rule-review').textContent.includes('PUBLISHED RULE REVIEW')
  );
  assert.match(await page.locator('#proposal-rule-review').innerText(), /follows proposal #950/);
  assert.doesNotMatch(
    await page.locator('#proposal-rule-review').innerText(),
    /Unrelated local edits/
  );
  assert.equal(await page.locator('#proposal-title').isDisabled(), true);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Published review reflows at ' + width
    );
    if (shots) await page.screenshot({ path: `${shots}/rule-voter-${width}.png`, fullPage: true });
  }
  publishedRule.status = 'PROPOSAL_STATUS_FAILED';
  publishedRule.failed_reason = 'Contract rejected <img src=x onerror=alert(1)> distribution';
  await page.reload();
  await page.locator('#native-execution-failure').waitFor({ state: 'visible' });
  assert.match(
    await page.locator('#native-execution-failure').innerText(),
    /Contract rejected <img/
  );
  assert.equal(await page.locator('#native-execution-failure img').count(), 0);
  assert.equal(await page.locator('#proposal-badge').innerText(), 'EXECUTION FAILED');
  publishedRule.status = 'PROPOSAL_STATUS_VOTING_PERIOD';
  delete publishedRule.failed_reason;
  publishedRule.summary = publishedRule.summary.replace(
    /"contentHash":"[a-f0-9]{64}"/,
    '"contentHash":"' + '0'.repeat(64) + '"'
  );
  await page.reload();
  await page.waitForFunction(() =>
    document
      .getElementById('proposal-rule-review')
      .textContent.includes('Rule comparison unavailable')
  );
  assert.equal(
    await page.locator('#proposal-rule-review .rr-validator').count(),
    0,
    'A corrupt published review must not retain earlier targets'
  );
  await page.locator('#new-draft').click();
  assert.equal(await page.locator('#proposal-rule-review').isVisible(), false);
  publishedRule = null;
  publishedReview = null;
  publishedRevision = null;
  await page.evaluate(() => localStorage.removeItem('cosmoot:juno:delegation:rule-draft:v3'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/community-tools/juno/delegation/');
  await ready();
  await step('rules');
  await page.waitForFunction(() =>
    document.getElementById('current-rules-state').textContent.includes('Rules approved')
  );
  assert.equal(await page.locator('#use-current-model').count(), 0);
  assert.equal(await page.locator('#uptime').inputValue(), '97.5');
  await step('distribution');
  await page.locator('#programme-amount').fill('99999999');
  await page.locator('#simulate').click();
  await page.waitForFunction(() =>
    document.getElementById('feedback').textContent.includes('50 JUNO')
  );
  assert.equal(await page.locator('#export-json').isDisabled(), true);
  await page.locator('#rules-eligibility-details').evaluate((el) => (el.open = true));
  await step('rules');
  await page.locator('#factor-number').fill('3');
  assert.match(await page.locator('#cap-description').textContent(), /12.00%/);
  state = 'stale';
  await page.locator('#refresh').click();
  await ready();
  assert.match(await page.locator('#snapshot-status').textContent(), /historical/);
  assert.equal(await page.locator('#claim-rewards').isDisabled(), true);
  await simulate();
  assert.equal(await page.locator('#publish-proposal').isDisabled(), true);
  state = 'current';
  historyDays = 3;
  await page.locator('#refresh').click();
  await ready();
  await simulate();
  assert.match(
    await page.locator('#simulation-comparison .rr-history').textContent(),
    /3 \/ 90 days checked/
  );
  assert.ok(
    (await page.locator('#simulation-comparison .rr-proposed strong').allTextContents()).some(
      (v) => v !== '—'
    )
  );
  await step('rules');
  assert.match(await page.locator('#draft-history-coverage').textContent(), /3 \/ 90/);
  await step('proposals');
  if (process.env.NNS_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.NNS_SCREENSHOT_DIR}/collecting-history.png`,
      fullPage: true
    });
  historyDays = 90;
  await page.locator('#refresh').click();
  await ready();
  await simulate();
  assert.match(
    await page.locator('#simulation-comparison .rr-history').textContent(),
    /Full history · 90 \/ 90/
  );
  historyComplete = false;
  await page.locator('#refresh').click();
  await ready();
  await simulate();
  assert.match(
    await page.locator('#simulation-comparison .rr-unavailable').textContent(),
    /90-day/
  );
  assert.ok(
    (await page.locator('#simulation-comparison .rr-proposed strong').allTextContents()).every(
      (v) => v === '—'
    )
  );
  assert.equal(
    await page
      .locator('#simulation-comparison')
      .getByLabel('Only changes', { exact: true })
      .isDisabled(),
    true
  );
  assert.equal(await page.locator('#publish-proposal').isEnabled(), true);
  // Old editable drafts migrate immediately and persist without the transition
  // button or a Save click. Their approved baseline remains schema 2.
  historyComplete = true;
  historyDays = 5;
  const preservedParent = {
    proposalId: approved.id,
    votingEndedAt: approved.voting_end_time,
    rule: approvedPolicy,
    hash: await fingerprint(approvedPolicy)
  };
  for (const old of [
    defaultPolicy(),
    strictHistoryPolicy(),
    collectingPolicy(),
    observedCommitPolicy()
  ]) {
    old.factorTenths = 19;
    old.commissionMaxBps = null;
    old.exclusions = structuredClone(approvedPolicy.exclusions);
    await page.evaluate(
      ({ old, parent }) => {
        localStorage.removeItem('cosmoot:juno:delegation:rule-draft:v3');
        if (old.schema === 2)
          localStorage.setItem('cosmoot:juno:delegation:rule-draft:v2', JSON.stringify(old));
        else
          localStorage.setItem(
            'cosmoot:juno:delegation:rule-draft:v3',
            JSON.stringify({
              schema: 1,
              rule: old,
              parent,
              rationale: 'Preserved migration rationale'
            })
          );
      },
      { old, parent: preservedParent }
    );
    // A v2 local draft had no approved parent; test it against first adoption.
    approvalState = old.schema === 2 ? 'empty' : 'approved';
    // A changed query forces a new document; changing only the hash would keep
    // the previous in-memory draft instead of exercising storage restoration.
    await page.goto(origin + `/community-tools/juno/delegation/?migration=${old.schema}#rules`);
    await ready();
    await page.waitForFunction(
      () => !document.getElementById('current-rules-state').textContent.includes('Checking')
    );
    assert.equal(await page.locator('#use-current-model').count(), 0);
    assert.equal(await page.locator('#factor-number').inputValue(), '1.9');
    assert.equal(await page.locator('#commission').inputValue(), '100');
    assert.equal(await page.locator('#commission').isEnabled(), true);
    assert.equal(await page.locator('#exclusions li').count(), 1);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('cosmoot:juno:delegation:rule-draft:v3'))
    );
    assert.equal(stored.rule.schema, 9);
    assert.equal(stored.rule.commissionMaxBps, null);
    assert.equal(stored.rule.minParticipationBps, 9750);
    assert.deepEqual(stored.parent, old.schema === 2 ? null : preservedParent);
    assert.equal(stored.rationale, old.schema === 2 ? '' : 'Preserved migration rationale');
    await simulate();
    assert.match(
      await page.locator('#simulation-comparison .rr-history').textContent(),
      /5 \/ 90 days/
    );
    assert.equal(await page.locator('#simulation-state').textContent(), 'Draft comparison');
    await page.reload();
    await ready();
    assert.equal(await page.locator('#factor-number').inputValue(), '1.9');
  }
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
  // Exercise the browser compressor, local-draft handoff and published reader
  // with realistic identity entropy, all held positions and compact evidence.
  state = 'current';
  approvalState = 'empty';
  const largeInput = reviewSizeInput();
  largeInput.rationale = 'Preserve every held position and the complete signature evidence.';
  const large = await page.evaluate(
    async (input) => {
      const { buildRuleReview, readProposalReview } = await import('/juno-delegation-review.mjs');
      const { frozenRuleProposal, savePlannerProposal } = await import(
        '/planner-proposal-draft.mjs'
      );
      input.evidence.records = new Map(input.evidence.records);
      const review = await buildRuleReview(input),
        proposal = await frozenRuleProposal(review),
        decoded = await readProposalReview(proposal.values);
      return {
        url: savePlannerProposal(localStorage, proposal),
        values: proposal.values,
        bytes: new TextEncoder().encode(proposal.values.summary + '\n\n' + proposal.values.body)
          .length,
        hash: review.hash,
        decodedHash: decoded.hash,
        validators: decoded.value.snapshot.validators.length
      };
    },
    {
      ...largeInput,
      evidence: { ...largeInput.evidence, records: [...largeInput.evidence.records] }
    }
  );
  assert.equal(large.hash, large.decodedHash);
  assert.equal(large.validators, 46);
  assert.ok(large.bytes <= 10000);
  assert.match(large.values.body, /cosmoot-allocation-review-2\+gzip/);
  await page.goto(origin + large.url);
  await page.waitForFunction(() => document.querySelector('#proposal-rule-review .rr-pagination'));
  assert.match(await page.locator('#proposal-rule-review .rr-pagination').innerText(), /of 46/);
  assert.match(
    await page.locator('#proposal-rule-review .rr-rationale').innerText(),
    /Preserve every held position/
  );
  assert.equal(await page.locator('#primary-action').innerText(), 'PUBLISH FOR REVIEW');
  publishedRule = {
    ...approved,
    id: '999',
    title: large.values.title,
    summary: large.values.summary + '\n\n' + large.values.body,
    status: 'PROPOSAL_STATUS_VOTING_PERIOD',
    voting_end_time: new Date(Date.now() + 86400000).toISOString()
  };
  approvalState = 'approved';
  const largePublished = new URL(page.url());
  largePublished.searchParams.delete('plannerDraft');
  largePublished.searchParams.set('proposal', '999');
  await page.goto(largePublished.href);
  await page.waitForFunction(() =>
    document.getElementById('proposal-rule-review').textContent.includes('PUBLISHED RULE REVIEW')
  );
  assert.match(await page.locator('#proposal-rule-review .rr-pagination').innerText(), /of 46/);
  assert.match(
    await page.locator('#proposal-rule-review .rr-rationale').innerText(),
    /Preserve every held position/
  );
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (shots)
      await page.screenshot({ path: `${shots}/rule-compact-voter-${width}.png`, fullPage: true });
  }
  // Complete the lifecycle: native passage must activate this exact compact
  // rulebook for the planner, including immutable older compact envelopes.
  publishedRule.status = 'PROPOSAL_STATUS_PASSED';
  publishedRule.voting_end_time = new Date(Date.now() - 1000).toISOString();
  for (const legacy of [false, true]) {
    if (legacy)
      publishedRule.summary = publishedRule.summary.replace(
        /^Chain: juno-1\nProgramme: [^\n]+\n\n/m,
        ''
      );
    await page.goto(origin + '/community-tools/juno/delegation/#rebalance');
    await page.waitForFunction(
      () => document.getElementById('rebalance-rule-title').textContent === 'Proposal #999'
    );
    assert.match(
      await page.locator('#rebalance-approval-note').textContent(),
      /These rules are fixed/
    );
  }

  // Fixed allocations: authoring, failures, local persistence, frozen review and approved isolation.
  state = 'current';
  historyComplete = true;
  historyDays = 5;
  approvalState = 'empty';
  publishedRule = null;
  await page.evaluate(() => localStorage.removeItem('cosmoot:juno:delegation:rule-draft:v3'));
  await page.goto(origin + '/community-tools/juno/delegation/?fixed-test=1#distribution');
  await ready();
  await page.waitForFunction(
    () => document.getElementById('current-rules-state').textContent === 'Awaiting first approval'
  );
  assert.match(await page.locator('#fixed-allocations').innerText(), /No fixed allocations/);
  await page.getByRole('button', { name: 'Add allocation', exact: true }).click();
  await page.locator('#fixed-validator').fill(sample.validators[0].address);
  await page.locator('#fixed-amount').fill('500000.000001');
  await page
    .locator('#fixed-purpose')
    .fill(
      'Operate archive. Monthly evidence reviewed by the programme. <script>text only</script>'
    );
  const day = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  await page.locator('#fixed-startDate').fill(day);
  await page.locator('#fixed-endDate').fill(end);
  await page.locator('#fixed-documentation').fill('https://example.org/mandate');
  await page.locator('#save-distribution-rules').click();
  assert.match(await page.locator('#feedback').textContent(), /Apply or cancel/);
  await page.getByRole('button', { name: 'Apply allocation', exact: true }).click();
  await page.waitForFunction(() =>
    document.getElementById('distribution-impact').textContent.includes('500,000.00 fixed')
  );
  assert.equal(await page.locator('#fixed-allocations script').count(), 0);
  await page.locator('#programme-amount').fill('1');
  await page.waitForFunction(() =>
    document.getElementById('distribution-impact').textContent.includes('exceed the budget')
  );
  await page.locator('#budget-max').click();
  await step('rules');
  await page.getByText('Edit exclusions', { exact: true }).click();
  await page.locator('#excluded-validator').fill(sample.validators[0].address);
  await page.locator('#excluded-reason').fill('Regular exclusion fixture');
  await page.locator('#add-exclusion').click();
  await step('distribution');
  await page.locator('#save-distribution-rules').click();
  await page.reload();
  await ready();
  const savedFixed = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('cosmoot:juno:delegation:rule-draft:v3')).rule
        .fixedAllocations
  );
  assert.equal(savedFixed.length, 1);
  assert.equal(savedFixed[0].amountRaw, '500000000001');
  await page.locator('#distribution-impact .fixed-filter input').check();
  await page.waitForFunction(
    () => document.querySelectorAll('#distribution-impact tbody tr').length === 1
  );
  assert.match(await page.locator('#distribution-impact tbody').innerText(), /Fixed only/);
  assert.match(await page.locator('#distribution-impact tbody').innerText(), /0.00 regular/);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Fixed allocation overflow'
    );
    if (shots)
      await page.screenshot({ path: `${shots}/fixed-allocation-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#fixed-purpose').fill('Changed obligations');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await simulate();
  assert.match(
    await page.locator('#simulation-comparison').innerText(),
    /Fixed allocation · exempt/
  );
  const fixedDownload = page.waitForEvent('download');
  await page.locator('#export-json').click();
  const fixedChunks = [];
  for await (const chunk of await (await fixedDownload).createReadStream()) fixedChunks.push(chunk);
  const fixedReview = JSON.parse(Buffer.concat(fixedChunks));
  assert.equal(fixedReview.rule.fixedAllocations[0].amountRaw, '500000000001');
  assert.match(fixedReview.rule.fixedAllocations[0].purpose, /Operate archive/);
  assert.equal(
    fixedReview.proposed.targets[
      fixedReview.snapshot.validators.findIndex((v) => v.address === sample.validators[0].address)
    ],
    '500000000001'
  );
  await page.locator('#publish-proposal').click();
  await page.waitForFunction(() => document.querySelector('#proposal-rule-review .fixed-mandate'));
  assert.match(await page.locator('#proposal-rule-review').innerText(), /Operate archive/);
  // Read the planner's frozen draft through its existing local storage envelope.
  const packet = await page.evaluate(async () => {
    const { readPlannerProposal } = await import('/planner-proposal-draft.mjs');
    return readPlannerProposal(
      localStorage,
      new URL(location.href).searchParams,
      'juno-delegation'
    );
  });
  publishedRule = {
    ...approved,
    id: '1001',
    title: packet.values.title,
    summary: packet.values.summary + '\n\n' + packet.values.body,
    status: 'PROPOSAL_STATUS_PASSED',
    voting_end_time: new Date(Date.now() - 1000).toISOString()
  };
  approvalState = 'approved';
  await page.goto(origin + '/community-tools/juno/delegation/?fixed-approved=1#rebalance');
  await page.waitForFunction(
    () => document.getElementById('rebalance-rule-title').textContent === 'Proposal #1001'
  );
  await page.locator('#rebalance-max').click();
  await page.locator('#rebalance-simulate').click();
  await page.waitForFunction(() => !document.getElementById('rebalance-proposal').disabled);
  assert.match(await page.locator('#rebalance-fixed').innerText(), /500,000.00/);
  const fixedFrozen = await page.locator('#rebalance-identifiers').innerText();
  await step('distribution');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await step('rebalance');
  assert.equal(await page.locator('#rebalance-identifiers').innerText(), fixedFrozen);
  assert.match(await page.locator('#rebalance-fixed').innerText(), /500,000.00/);
  await page.locator('#rebalance-proposal').click();
  await page.waitForFunction(() => document.querySelector('#proposal-rule-review .fixed-mandate'));
  await page.locator('#proposal-rule-review .fixed-mandate summary').click();
  assert.match(await page.locator('#proposal-rule-review').innerText(), /Operate archive/);
  assert.match(await page.locator('#proposal-rule-review').innerText(), /500,000.000001/);
  assert.match(await page.locator('#proposal-rule-review').innerText(), /0.00 regular/);

  assert.deepEqual(errors, []);
  console.log(
    'Juno delegation browser: overview/current holdings, approved points settings and draft isolation and approved-rule Rebalance, claim placement, stage navigation, exact controls, integer commission limits, search, filters, pagination, details, exclusions, persistence, export, stale/error states and all four planning views and the programme overview at four viewports passed.'
  );
} catch (error) {
  if (diagnosticPage && !diagnosticPage.isClosed()) {
    console.error('Browser failure state:', await diagnosticPage.locator('body').innerText());
    if (process.env.NNS_SCREENSHOT_DIR)
      await diagnosticPage.screenshot({
        path: `${process.env.NNS_SCREENSHOT_DIR}/juno-delegation-failure.png`,
        fullPage: true
      });
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
