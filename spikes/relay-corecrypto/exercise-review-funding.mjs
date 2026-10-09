import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { REVIEW_CONTRACT } from '../../juno-community-governance.mjs';

// All external reads and wallet writes are synthetic. This exercises the actual
// composer, shared-review deep link, sponsor handoff and deposit controls.
export async function exerciseReviewFunding(page, origin, sample, govMessages) {
  const author = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
  const sponsor = 'juno1d0g7f97v87xwe6r4vr4jj3jfhzcv4vvfhamy8w';
  const params = {
    min_deposit: [{ denom: 'ujuno', amount: '5000000000' }],
    min_initial_deposit_ratio: '0.2',
    min_deposit_ratio: '0.01',
    max_deposit_period: '864000s',
    voting_period: '432000s',
    burn_vote_veto: true,
    burn_vote_quorum: false,
    burn_proposal_deposit_prevote: false
  };
  let proposal = null,
    revision = null,
    native = null,
    pauseProgramme = false,
    submits = 0,
    contributions = 0,
    contributionMode = 'ok',
    txKnown = false;
  const reviewHash = () =>
    createHash('sha256')
      .update(
        JSON.stringify(
          Object.fromEntries(
            ['title', 'summary', 'body', 'actions_json'].map((k) => [k, revision[k]])
          )
        )
      )
      .digest('hex');
  await page.route(/^https:\/\//, async (route) => {
    const url = new URL(route.request().url());
    assert.ok(['GET', 'OPTIONS'].includes(route.request().method()), 'No real writes');
    const testnet = /\.test\.|\.t\./.test(url.hostname);
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'x-cosmos-block-height, content-type',
      'access-control-allow-methods': 'GET, OPTIONS',
      'x-cosmos-block-height': '42500123'
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ headers, body: '' });
    let body = { data: {} };
    if (url.pathname.endsWith('/latest'))
      body = {
        block: {
          header: {
            chain_id: testnet ? 'uni-7' : 'juno-1',
            height: '42500123',
            time: new Date().toISOString()
          }
        }
      };
    else if (url.pathname.includes('/params/')) body = { params };
    else if (url.pathname.includes('/spendable_balances/'))
      body = { balance: { denom: 'ujuno', amount: '10000000000' } };
    else if (url.pathname.includes('/module_accounts/gov'))
      body = { account: { name: 'gov', base_account: { address: govMessages[0].sender } } };
    else if (url.pathname.includes('/smart/')) {
      const q = JSON.parse(
        Buffer.from(decodeURIComponent(url.pathname.split('/smart/')[1]), 'base64')
      );
      let data;
      if (url.pathname.includes(REVIEW_CONTRACT)) {
        if (q.config) data = { owner: author, minimum_comment_stake: '1000000' };
        else if (q.access)
          data = {
            can_publish: true,
            can_comment: true,
            active_native_stake: '1000000',
            active_neta_stake: '1000000'
          };
        else if (q.proposal_summaries)
          data = proposal ? [{ proposal, latest_revision: revision }] : [];
        else if (q.proposals) data = proposal ? [proposal] : [];
        else if (q.proposal) data = proposal;
        else if (q.revisions) data = revision ? [revision] : [];
        else data = [];
      } else
        data = q.pause_info
          ? pauseProgramme
            ? { paused: { expiration: { at_height: 99999999 } } }
            : { unpaused: {} }
          : govMessages[0].sender;
      body = { data };
    } else if (url.pathname.includes('/contract/')) body = { contract_info: { code_id: '4047' } };
    else if (url.pathname.includes('/withdraw_address'))
      body = { withdraw_address: sample.programme };
    else if (url.pathname.includes('/delegations/'))
      body = {
        delegation_responses: sample.validators.map((v) => ({
          delegation: { delegator_address: sample.programme, validator_address: v.address },
          balance: { denom: 'ujuno', amount: v.currentRaw }
        })),
        pagination: {}
      };
    else if (url.pathname.includes('/txs/')) {
      if (!txKnown) return route.fulfill({ status: 404, headers, body: 'not found' });
      body = { tx_response: { txhash: 'B'.repeat(64), height: '42500125', code: 0 } };
    } else if (url.pathname === '/cosmos/gov/v1/proposals/900') body = { proposal: native };
    else if (url.pathname === '/cosmos/gov/v1/proposals')
      body = { proposals: native ? [native] : [], pagination: {} };
    return route.fulfill({ contentType: 'application/json', headers, body: JSON.stringify(body) });
  });
  await page.exposeFunction('__reviewWrite', async (sender, msg) => {
    assert.equal(sender, author);
    if (msg.publish_proposal) {
      const content = msg.publish_proposal.content;
      revision = {
        ...content,
        proposal_id: 77,
        version: 1,
        author,
        created_time: Math.floor(Date.now() / 1000)
      };
      proposal = {
        id: 77,
        author,
        latest_version: 1,
        finalized_version: null,
        finalized_hash: null,
        withdrawn: false,
        created_time: revision.created_time
      };
    } else if (msg.finalize) {
      assert.equal(msg.finalize.proposal_id, 77);
      proposal.finalized_version = 1;
      proposal.finalized_hash = reviewHash();
    } else throw Error('Unexpected review write');
    return { transactionHash: 'C'.repeat(64) };
  });
  await page.exposeFunction('__nativeSubmit', async (content, sender, deposit) => {
    submits++;
    assert.equal(sender, sponsor, 'The sponsor, not the draft author, pays the initial deposit');
    assert.equal(deposit, '1000000000');
    native = {
      ...content,
      id: '900',
      status: 'PROPOSAL_STATUS_DEPOSIT_PERIOD',
      proposer: sender,
      total_deposit: [{ denom: 'ujuno', amount: deposit }],
      deposit_end_time: new Date(Date.now() + 864000000).toISOString(),
      voting_end_time: null
    };
    return { transactionHash: 'A'.repeat(64), height: 42500124, code: 0 };
  });
  await page.exposeFunction('__nativeContribute', async (id, sender, amount) => {
    assert.equal(id, '900');
    assert.equal(sender, author);
    contributions++;
    native.total_deposit[0].amount = String(
      BigInt(native.total_deposit[0].amount) + BigInt(amount)
    );
    if (BigInt(native.total_deposit[0].amount) >= 5000000000n)
      native.status = 'PROPOSAL_STATUS_VOTING_PERIOD';
    if (contributionMode === 'lost') throw Error('Synthetic lost response');
    return { transactionHash: 'B'.repeat(64), height: 42500125, code: 0 };
  });
  const wallet = async (address) =>
    page.evaluate((address) => {
      window.__walletChains = [];
      window.keplr = {
        experimentalSuggestChain: async () => {},
        enable: async (chain) => window.__walletChains.push(chain),
        getOfflineSigner: () => ({
          getAccounts: async () => [{ address }],
          signDirect: async () => {
            throw Error('Real signing forbidden');
          }
        }),
        signDirect: async () => {
          throw Error('Real signing forbidden');
        }
      };
      window.NetaSocialsTestnet = {
        connect: async () => ({ disconnect() {} }),
        execute: async (_client, sender, _contract, msg) => window.__reviewWrite(sender, msg)
      };
      window.NetaJunoGovernance = {
        connect: async () => ({ disconnect() {} }),
        simulate: async () => 100000,
        simulateDeposit: async () => 100000,
        fixedFee: () => ({ gas: '140000', amount: [{ denom: 'ujuno', amount: '10500' }] }),
        submit: async (_client, content, sender, deposit, _fee, guards) => {
          await guards.beforeSign();
          await guards.assertWallet();
          await guards.beforeBroadcast('A'.repeat(64));
          return window.__nativeSubmit(content, sender, deposit);
        },
        contribute: async (_client, id, sender, amount, _fee, guards) => {
          await guards.beforeSign();
          await guards.assertWallet();
          await guards.beforeBroadcast('B'.repeat(64));
          return window.__nativeContribute(id, sender, amount);
        }
      };
    }, address);
  const primary = (text) =>
    page.waitForFunction(
      (text) => document.querySelector('#primary-action').textContent === text,
      text
    );
  const shot = async (name) => {
    if (process.env.NNS_SCREENSHOT_DIR) {
      await mkdir(process.env.NNS_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: `${process.env.NNS_SCREENSHOT_DIR}/${name}.png`,
        fullPage: true
      });
    }
  };
  await page.reload();
  await primary('PUBLISH FOR REVIEW');
  assert.equal(await page.locator('#planner-native-panel').isVisible(), false);
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page.waitForFunction(() => !document.querySelector('#primary-action').disabled);
  assert.deepEqual(await page.evaluate(() => window.__walletChains), ['uni-7']);
  await page.locator('#primary-action').click();
  await primary('FINALIZE REVIEW');
  assert.equal(await page.locator('#planner-native-panel').isVisible(), false);
  assert.equal(await page.locator('#discussion-panel').isVisible(), true);
  assert.match(await page.locator('#shared-review-url').getAttribute('href'), /review=77/);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`claim-community-review-${width}`);
  }
  await page.locator('#primary-action').click();
  await primary('CONNECT KEPLR · JUNO');
  assert.equal(await page.locator('#proposal-title').isDisabled(), true);
  const sharedUrl = page.url();
  assert.match(sharedUrl, /review=77/);
  assert.ok(!sharedUrl.includes('plannerDraft'));
  // Reloading the shared URL does not rely on the creator's private handoff.
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage))
      if (k.startsWith('cosmoot:juno:planner-proposal:')) localStorage.removeItem(k);
  });
  await page.goto(sharedUrl);
  await primary('CONNECT KEPLR · JUNO');
  await wallet(sponsor);
  await page.locator('#primary-action').click();
  await primary('REVIEW JUNO PROPOSAL');
  assert.deepEqual(await page.evaluate(() => window.__walletChains), ['juno-1']);
  pauseProgramme = true;
  await page.locator('#primary-action').click();
  await page.waitForFunction(() => document.querySelector('#gov-status').dataset.state === 'error');
  assert.match(await page.locator('#gov-status').innerText(), /pause state/);
  assert.equal(submits, 0);
  pauseProgramme = false;
  await page.locator('#primary-action').click();
  await page.waitForFunction(() => !document.querySelector('#planner-native-review').hidden);
  assert.equal(await page.locator('#planner-native-deposit').inputValue(), '1000');
  assert.equal(await page.locator('#primary-action').isDisabled(), true);
  await page.locator('#planner-native-confirm').check();
  // A changed account invalidates the review without submitting anything.
  await page.evaluate(() => dispatchEvent(new Event('keplr_keystorechange')));
  await primary('CONNECT KEPLR · JUNO');
  assert.equal(await page.locator('#planner-native-review').isVisible(), false);
  await page.locator('#primary-action').click();
  await primary('REVIEW JUNO PROPOSAL');
  await page.locator('#primary-action').click();
  await page.waitForFunction(() => !document.querySelector('#planner-native-review').hidden);
  await page.locator('#planner-native-confirm').check();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`claim-sponsor-submit-${width}`);
  }
  await page.locator('#primary-action').click();
  await page.waitForFunction(() =>
    document.querySelector('#proposal-funding-total').textContent.includes('1000 / 5000')
  );
  assert.equal(submits, 1);
  assert.match(page.url(), /proposal=900/);
  // Opening the finalized review on another visit discovers the existing proposal.
  await page.goto(sharedUrl);
  await page.waitForFunction(() =>
    document.querySelector('#proposal-funding-total').textContent.includes('1000 / 5000')
  );
  assert.equal(await page.locator('#planner-native-panel').isVisible(), false);
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page.locator('#proposal-funding-amount').fill('50');
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() => !document.querySelector('#proposal-funding-review').hidden);
  assert.equal(await page.locator('#proposal-funding-action').isDisabled(), true);
  await page.locator('#proposal-funding-confirm').check();
  // A contribution by somebody else between review and confirmation stops ours.
  native.total_deposit[0].amount = '1100000000';
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() =>
    document.querySelector('#gov-status').textContent.includes('changed')
  );
  assert.equal(contributions, 0);
  await page.locator('#proposal-funding-refresh').click();
  await page.waitForFunction(() =>
    document.querySelector('#proposal-funding-total').textContent.includes('1100 / 5000')
  );
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() => !document.querySelector('#proposal-funding-review').hidden);
  await page.locator('#proposal-funding-confirm').check();
  contributionMode = 'lost';
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#proposal-funding-action').textContent === 'CHECK CONTRIBUTION STATUS'
  );
  assert.equal(contributions, 1);
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() =>
    document.querySelector('#gov-status').textContent.includes('still unconfirmed')
  );
  assert.equal(contributions, 1);
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector('#proposal-funding-total').textContent.includes('1150 / 5000')
  );
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#proposal-funding-action').textContent === 'CHECK CONTRIBUTION STATUS'
  );
  txKnown = true;
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#proposal-funding-receipt')
      .textContent.includes('Previous contribution confirmed')
  );
  assert.equal(contributions, 1);
  await page.locator('#proposal-funding-refresh').click();
  await page.waitForFunction(() =>
    document.querySelector('#proposal-funding-total').textContent.includes('1150 / 5000')
  );
  await page.locator('#proposal-funding-remaining').click();
  assert.equal(await page.locator('#proposal-funding-amount').inputValue(), '3850');
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() => !document.querySelector('#proposal-funding-review').hidden);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`claim-community-funding-${width}`);
  }
  contributionMode = 'ok';
  await page.locator('#proposal-funding-confirm').check();
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() =>
    document.querySelector('#gov-status').textContent.includes('CONTRIBUTION CONFIRMED')
  );
  await page.locator('#proposal-funding-refresh').click();
  await page.waitForFunction(() =>
    document.querySelector('#proposal-funding-deadline').textContent.includes('Funding is closed')
  );
  assert.equal(contributions, 2);
  assert.equal(await page.locator('#proposal-funding-action').isDisabled(), true);
  assert.equal(submits, 1);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('neta-governance-local-draft:juno-delegation')).title
    ),
    'Preserved draft'
  );
}
