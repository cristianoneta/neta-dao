import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { GOVERNANCE_SOURCES, CHAIN_READ_PATH } from '../../governance-chain-read.mjs';
import { REVIEW_CONTRACT } from '../../juno-community-governance.mjs';

// All external reads and wallet writes are synthetic. This exercises the actual
// composer, shared-review deep link, sponsor handoff and deposit controls.
export async function exerciseReviewFunding(page, origin, sample, govMessages) {
  const manifest = JSON.parse(
    await readFile(new URL('../../docs/deployments/nns-mainnet.json', import.meta.url))
  );
  const reviewBytes = Buffer.from('synthetic signed review');
  const reviewTxHash = createHash('sha256').update(reviewBytes).digest('hex').toUpperCase();
  const reviewEvents = [
    {
      type: 'wasm',
      attributes: [
        { key: '_contract_address', value: REVIEW_CONTRACT },
        { key: 'proposal_id', value: '77' }
      ]
    }
  ];
  let reviewWrites = 0,
    comments = [],
    failReviewReads = false;
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
    txKnown = false,
    wrongDisplayed = false;
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
  await page.route(
    /^(https:\/\/|http:\/\/127\.0\.0\.1.*\/data\/governance-read)/,
    async (route) => {
      let url = new URL(route.request().url());
      const verifiedRead = url.pathname === CHAIN_READ_PATH;
      if (verifiedRead) {
        assert.equal(route.request().headers()['x-cosmos-block-height'], undefined);
        url = new URL(
          GOVERNANCE_SOURCES[url.searchParams.get('source')] + url.searchParams.get('path')
        );
      }
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
      if (url.pathname.endsWith('/node_info')) body = { default_node_info: { network: 'juno-1' } };
      else if (url.pathname.includes('/code/')) {
        const pin = Object.values(manifest.contracts).find(
          (p) => String(p.code_id) === url.pathname.split('/').at(-1)
        );
        body = { code_info: { data_hash: pin.sha256 } };
      } else if (url.pathname.endsWith('/latest'))
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
          else if (q.proposal_summaries) {
            if (failReviewReads)
              return route.fulfill({ status: 503, headers, body: 'Temporary review read failure' });
            data = proposal ? [{ proposal, latest_revision: revision }] : [];
          } else if (q.proposals) data = proposal ? [proposal] : [];
          else if (q.proposal) data = proposal;
          else if (q.revisions) data = revision ? [revision] : [];
          else if (q.comments) data = comments;
          else data = [];
        } else if (url.pathname.includes(manifest.registry)) {
          if (q.config)
            data = {
              ...manifest,
              purchases_paused: false,
              tariff_version: 1,
              tariff: { three_cents: 9900, four_cents: 1900, standard_cents: 500 }
            };
          else if (q.name_of) data = { address: q.name_of.address, name: 'cristiano.neta' };
          else if (q.identity)
            data = {
              name: 'cristiano.neta',
              owner: author,
              expires_at: Math.floor(Date.now() / 1000) + 86400
            };
        } else if (url.pathname.includes(manifest.profile_contract))
          data = { registry: manifest.registry };
        else if (url.pathname.includes(manifest.token)) data = { decimals: 6 };
        else
          data = q.pause_info
            ? pauseProgramme
              ? { paused: { expiration: { at_height: 99999999 } } }
              : { unpaused: {} }
            : govMessages[0].sender;
        body = { data };
      } else if (url.pathname.includes('/contract/')) {
        const pin = url.pathname.endsWith(manifest.registry)
          ? manifest.contracts.registry
          : url.pathname.endsWith(manifest.profile_contract)
            ? manifest.contracts.profiles
            : { code_id: '4047' };
        body = { contract_info: pin };
      } else if (url.pathname.includes('/withdraw_address'))
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
        if (url.pathname.endsWith(reviewTxHash)) {
          if (url.hostname.includes('nodeshub'))
            return route.fulfill({ status: 503, headers, body: 'Primary unavailable' });
          return route.fulfill({
            contentType: 'application/json',
            headers,
            body: JSON.stringify({
              tx_response: {
                txhash: reviewTxHash,
                height: '42500126',
                code: 0,
                events: reviewEvents
              }
            })
          });
        }
        if (!txKnown) return route.fulfill({ status: 404, headers, body: 'not found' });
        body = { tx_response: { txhash: 'B'.repeat(64), height: '42500125', code: 0 } };
      } else if (url.pathname === '/cosmos/gov/v1/proposals/900') body = { proposal: native };
      else if (url.pathname === '/cosmos/gov/v1/proposals') {
        // Reproduce the live Juno reverse-pagination failure. Forward reads
        // must exhaust both pages before submission, withdrawal or recovery.
        if (verifiedRead && url.searchParams.has('pagination.reverse'))
          return route.fulfill({ status: 502, headers, body: 'Chain source returned HTTP 500.' });
        const last = !verifiedRead || url.searchParams.has('pagination.key');
        if (verifiedRead && last) assert.equal(url.searchParams.get('pagination.key'), 'older+/=');
        body = {
          proposals:
            last && native
              ? [
                  {
                    ...native,
                    ...(wrongDisplayed ? { title: 'Incorrect cached proposal title' } : {})
                  }
                ]
              : [],
          pagination: { next_key: last ? null : 'older+/=' }
        };
      }
      return route.fulfill({
        contentType: 'application/json',
        headers,
        body: JSON.stringify(body)
      });
    }
  );
  await page.exposeFunction('__reviewWrite', async (sender, msg) => {
    assert.equal(sender, author);
    reviewWrites++;
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
    } else if (msg.add_comment) {
      comments.push({
        id: comments.length + 1,
        author,
        created_time: Math.floor(Date.now() / 1000),
        verified_stake: '1000000',
        ...msg.add_comment
      });
    } else if (msg.withdraw) {
      proposal.withdrawn = true;
    } else if (msg.finalize) {
      assert.equal(msg.finalize.proposal_id, 77);
      proposal.finalized_version = 1;
      proposal.finalized_hash = reviewHash();
    } else throw Error('Unexpected review write');
    return { transactionHash: reviewTxHash, height: 42500126, code: 0, events: reviewEvents };
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
        execute: async (_client, sender, _contract, msg) => {
          if (window.__rejectReview) throw Error('Signature rejected');
          if (msg.publish_proposal && window.__holdReviewPublish)
            await new Promise((resolve) => (window.__releaseReviewPublish = resolve));
          const result = await window.__reviewWrite(sender, msg);
          if (msg.publish_proposal && window.__loseReviewResponse) {
            const bytes = new TextEncoder().encode('synthetic signed review');
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
              .map((x) => x.toString(16).padStart(2, '0'))
              .join('')
              .toUpperCase();
            localStorage.setItem(
              `neta-pending-tx-v1:uni-7:${sender}`,
              JSON.stringify({
                version: 1,
                status: 'pending',
                chain: 'uni-7',
                sender,
                hash,
                bytes: btoa(String.fromCharCode(...bytes))
              })
            );
            throw Error('TRANSACTION OUTCOME UNKNOWN', {
              cause: Error('transaction indexing is disabled')
            });
          }
          return result;
        }
      };
      window.NetaJunoGovernance = {
        connect: async () => ({ disconnect() {} }),
        simulate: async (_client, _content, _sender, deposit) => {
          window.__selectedDeposit = deposit;
          if (window.__holdNativeSimulation)
            await new Promise((resolve) => (window.__releaseNativeSimulation = resolve));
          return 100000;
        },
        simulateDeposit: async () => 100000,
        fixedFee: () => ({ gas: '140000', amount: [{ denom: 'ujuno', amount: '10500' }] }),
        submit: async (_client, content, sender, deposit, _fee, guards) => {
          await guards.beforeSign();
          await guards.assertWallet();
          if (window.__rejectNative) throw Error('Signature rejected');
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
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `${process.env.NNS_SCREENSHOT_DIR}/${name}.png`,
        fullPage: true
      });
    }
  };
  // Old direct-submit attempts remain status-only after upgrading the UI.
  const originalDraftUrl = page.url();
  const legacyId = new URL(page.url()).searchParams.get('plannerDraft');
  const originalDraft = await page.evaluate(
    (id) => localStorage.getItem('cosmoot:juno:planner-proposal:' + id),
    legacyId
  );
  assert.ok(legacyId);
  const legacyKey = `cosmoot:juno:planner-proposal:${legacyId}:submission`;
  await page.evaluate(
    (key) =>
      localStorage.setItem(key, JSON.stringify({ state: 'broadcast', hash: 'B'.repeat(64) })),
    legacyKey
  );
  await page.reload();
  await primary('CHECK SUBMISSION STATUS');
  assert.equal(await page.locator('#planner-native-inputs').isVisible(), false);
  await page.locator('#primary-action').click();
  await page.waitForFunction(() =>
    document.querySelector('#gov-status').textContent.includes('still unconfirmed')
  );
  await page.reload();
  await primary('CHECK SUBMISSION STATUS');
  txKnown = true;
  await page.locator('#primary-action').click();
  await primary('SUBMISSION CONFIRMED');
  assert.equal(await page.locator('#primary-action').isDisabled(), true);
  assert.equal(submits, 0);
  // Remove only this test's fabricated legacy record to exercise a fresh draft.
  await page.evaluate((key) => localStorage.removeItem(key), legacyKey);
  txKnown = false;
  await page.reload();
  await primary('PUBLISH FOR REVIEW');
  assert.equal(await page.locator('#planner-native-panel').isVisible(), false);
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page.waitForFunction(() => !document.querySelector('#primary-action').disabled);
  assert.deepEqual(await page.evaluate(() => window.__walletChains), ['uni-7']);
  await page.evaluate(() => (window.__rejectReview = true));
  await page.locator('#primary-action').click();
  await page.waitForFunction(
    () => document.querySelector('#gov-status').textContent === 'Signature rejected'
  );
  assert.equal(reviewWrites, 0);
  assert.equal(await page.locator('#primary-action').isDisabled(), false);
  assert.match(
    await page.locator('#proposal-body').inputValue(),
    /This proposal was created on cosmoot.com/
  );
  await page.evaluate(() => {
    window.__rejectReview = false;
    window.__loseReviewResponse = true;
    window.__holdReviewPublish = true;
  });
  await page.locator('#primary-action').click();
  await page.waitForFunction(() => typeof window.__releaseReviewPublish === 'function');
  assert.equal(await page.locator('.proposal-workspace').getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('#primary-action').isDisabled(), true);
  await page.evaluate(() => window.__releaseReviewPublish());
  await primary('FINALIZE REVIEW');
  assert.equal(reviewWrites, 1);
  assert.match(revision.title, / rewards I$/);
  assert.match(revision.body, /This proposal was created on cosmoot.com\./);
  await page.waitForFunction(() =>
    document.querySelector('#shared-review-author').textContent.includes('cristiano.neta')
  );
  assert.equal(await page.locator('#discard-action').isVisible(), true);
  assert.equal(await page.locator('#discard-action').isDisabled(), false);
  await page.locator('#shared-review-copy').click();
  await page.waitForFunction(
    () => document.querySelector('#shared-review-copy-status').textContent.length > 0
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error('denied');
        }
      }
    })
  );
  await page.locator('#shared-review-copy').click();
  assert.equal(await page.locator('#shared-review-copy-fallback').isVisible(), true);
  assert.match(await page.locator('#shared-review-copy-fallback').inputValue(), /review=77/);
  await page.locator('#comment-title').fill('A useful discussion');
  await page.locator('#comment-body').fill('Review comment survives publication without a reload.');
  await page.locator('#publish-comment').click();
  await page.waitForFunction(() =>
    document.querySelector('#gov-status').textContent.includes('Discussion thread published')
  );
  assert.equal(comments.length, 1);
  assert.match(
    await page.locator('#discussion-panel').innerText(),
    /Review comment survives publication/
  );

  assert.equal(await page.locator('#planner-native-panel').isVisible(), false);
  assert.equal(await page.locator('#discussion-panel').isVisible(), true);
  assert.match(await page.locator('#shared-review-url').getAttribute('href'), /review=77/);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`claim-community-review-${width}`);
  }
  await page.locator('#primary-action').click();
  await page.locator('#planner-native-panel').waitFor({ state: 'visible' });
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
  await page.reload();
  await page.locator('#planner-native-panel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#planner-proposal-context').isVisible(), false);
  assert.equal(await page.locator('#discussion-panel').isVisible(), true);
  assert.equal(await page.locator('#comment-form').isVisible(), false);
  await wallet(sponsor);
  await page.locator('#gov-connect').click();
  const minimum = page.locator('#planner-native-minimum'),
    full = page.locator('#planner-native-full');
  await page.waitForFunction(() => !document.querySelector('#planner-native-minimum').disabled);
  assert.equal(await minimum.textContent(), 'Submit with 1000 JUNO');
  assert.equal(await full.textContent(), 'Submit with 5000 JUNO');
  assert.equal(await page.locator('#primary-action').isVisible(), false);
  assert.equal(await page.locator('#discard-action').isVisible(), true);
  assert.equal(await page.locator('#discard-action').isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => window.__walletChains), ['juno-1']);
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector('.next-actions')
        .contains(document.querySelector('#planner-native-panel'))
    )
  );
  pauseProgramme = true;
  await minimum.click();
  await page.waitForFunction(
    () => document.querySelector('#planner-native-status').dataset.state === 'error'
  );
  assert.match(await page.locator('#planner-native-status').innerText(), /pause state/);
  assert.equal(submits, 0);
  pauseProgramme = false;
  // Rejecting a full-deposit wallet prompt never broadcasts and retains both choices.
  await page.evaluate(() => (window.__rejectNative = true));
  await full.click();
  await page.waitForFunction(() =>
    document.querySelector('#planner-native-status').textContent.includes('Signature rejected')
  );
  assert.equal(await page.evaluate(() => window.__selectedDeposit), '5000000000');
  assert.equal(submits, 0);
  await page.evaluate(() => {
    window.__rejectNative = false;
    window.__holdNativeSimulation = true;
  });
  await minimum.click();
  await page.waitForFunction(() => !!window.__releaseNativeSimulation);
  await page.evaluate(() => dispatchEvent(new Event('keplr_keystorechange')));
  await page.evaluate(() => {
    window.__holdNativeSimulation = false;
    window.__releaseNativeSimulation();
  });
  await page.waitForFunction(() =>
    document.querySelector('#planner-native-status').textContent.includes('changed')
  );
  assert.equal(submits, 0);
  await wallet(sponsor);
  await page.locator('#gov-connect').click();
  await page.waitForFunction(() => !document.querySelector('#planner-native-minimum').disabled);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`claim-sponsor-submit-${width}`);
  }
  await minimum.click();
  await page.waitForFunction(() =>
    document.querySelector('#proposal-funding-total').textContent.includes('1000 / 5000')
  );
  assert.equal(submits, 1);
  assert.match(page.url(), /proposal=900/);
  assert.match(await page.locator('#action-hint').innerText(), /FUNDING/);
  assert.doesNotMatch(await page.locator('body').innerText(), /UNDEFINED/);
  // The verified deposit target must also match the proposal shown in the page.
  wrongDisplayed = true;
  await page.reload();
  await page.waitForFunction(() =>
    document
      .querySelector('#gov-status')
      .textContent.includes('differs from the displayed proposal')
  );
  assert.equal(await page.locator('#proposal-funding-action').isDisabled(), true);
  assert.equal(contributions, 0);
  wrongDisplayed = false;
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
  // Confirmed publication + failed view read survives reload, and withdrawal
  // stays discoverable to visitors while only the author can execute it.
  proposal = null;
  revision = null;
  native = null;
  comments = [];
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('cosmoot:juno:planner-proposal:') && key.endsWith(':submission'))
        localStorage.removeItem(key);
  });
  await page.evaluate(
    ({ id, value }) => localStorage.setItem('cosmoot:juno:planner-proposal:' + id, value),
    { id: legacyId, value: originalDraft }
  );
  await page.goto(originalDraftUrl);
  await primary('PUBLISH FOR REVIEW');
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page.waitForFunction(() => !document.querySelector('#primary-action').disabled);
  // Let the pre-publication summaries succeed; fail only after confirmed write.
  await page.exposeFunction('__failReviewReads', () => {
    failReviewReads = true;
  });
  await page.evaluate(() => {
    const execute = window.NetaSocialsTestnet.execute;
    window.NetaSocialsTestnet.execute = async (...args) => {
      const r = await execute(...args);
      await window.__failReviewReads();
      return r;
    };
  });
  const previousWrites = reviewWrites;
  await page.locator('#primary-action').click();
  await page.waitForFunction(() => document.querySelector('#gov-status').dataset.state === 'error');
  assert.equal(await page.locator('#primary-action').isDisabled(), true);
  assert.equal(reviewWrites, previousWrites + 1);
  failReviewReads = false;
  await page.reload();
  await primary('PUBLISH FOR REVIEW');
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page
    .locator('.review-transaction-feedback [data-review-check]')
    .waitFor({ state: 'visible' });
  await page.locator('.review-transaction-feedback [data-review-check]').click();
  await primary('FINALIZE REVIEW');
  assert.equal(reviewWrites, previousWrites + 1, 'Read-only status lookup must not republish');
  await page.locator('#gov-disconnect').click();
  assert.equal(await page.locator('#discard-action').isVisible(), true);
  assert.equal(await page.locator('#discard-action').isDisabled(), true);
  await page.waitForFunction(() =>
    document.querySelector('#shared-review-author').textContent.includes('cristiano.neta')
  );
  await wallet(sponsor);
  await page.locator('#gov-connect').click();
  assert.equal(await page.locator('#discard-action').isDisabled(), true);
  await page.locator('#gov-disconnect').click();
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page.waitForFunction(() => !document.querySelector('#discard-action').disabled);
  await page.locator('#primary-action').click();
  await page.locator('#planner-native-panel').waitFor({ state: 'visible' });
  await page.locator('#gov-connect').click();
  await page.waitForFunction(() => !document.querySelector('#discard-action').disabled);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#discard-action').click();
  await page.waitForFunction(
    () => document.querySelector('#proposal-badge').textContent === 'WITHDRAWN'
  );
  assert.equal(proposal.withdrawn, true);
  assert.equal(await page.locator('.workflow .active').count(), 0);
  assert.equal(await page.locator('#comment-form').isVisible(), false);
  assert.equal(await page.locator('#primary-action').isVisible(), false);
  assert.equal(await page.locator('#proposal-title').isDisabled(), true);
}
