import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { toBech32, fromBech32 } from '../../faucet/node_modules/@cosmjs/encoding/build/index.js';
import { mkdir, readFile } from 'node:fs/promises';
import { GOVERNANCE_SOURCES, CHAIN_READ_PATH } from '../../governance-chain-read.mjs';
import {
  REVIEW_MAINNET_RELEASE as PIN,
  REVIEW_MAINNET_POLICY
} from '../../juno-review-mainnet-config.mjs';
import { GOVERNANCE } from '../../juno-governance-core.mjs';
import { UNI7_REVIEW_CONTRACT } from '../../juno-review-network.mjs';
const REVIEW_CONTRACT = PIN.contract;

// All external reads and wallet writes are synthetic. This exercises the actual
// composer, shared-review deep link, sponsor handoff and deposit controls.
export async function exerciseReviewFunding(page, origin, sample) {
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
    failReviewReads = false,
    holdAuthorLookup = false,
    releaseAuthorLookup;
  const author = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
  const sponsor = toBech32('juno', new Uint8Array(20).fill(3));
  const voterAccounts = [author, sponsor, toBech32('juno', new Uint8Array(20).fill(5))];
  const voteOperators = voterAccounts.map(a => toBech32('junovaloper', fromBech32(a).data));
  let authorChoice = 'VOTE_OPTION_YES', voteWrites = 0, lostVote = false, participationDown = false;
  const voteTally = () => ({yes_count: authorChoice === 'VOTE_OPTION_YES' ? tallyYes : '0', no_count: String(123456n + (authorChoice === 'VOTE_OPTION_NO' ? BigInt(tallyYes) : 0n)), abstain_count: authorChoice === 'VOTE_OPTION_ABSTAIN' ? tallyYes : '0', no_with_veto_count: String(5000000n + (authorChoice === 'VOTE_OPTION_NO_WITH_VETO' ? BigInt(tallyYes) : 0n))});
  const params = {
    quorum: '0.334', threshold: '0.5', expedited_threshold: '0.667', veto_threshold: '0.334',
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
    submits = 0,
    contributions = 0,
    contributionMode = 'ok',
    txKnown = false,
    wrongDisplayed = false,
    tallyYes = '2099071009805', failTally = false, holdTally = false, releaseTally;
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
        body = {
          code_info: url.pathname.endsWith('/5171')
            ? { creator: PIN.creator, data_hash: PIN.codeHash }
            : { data_hash: pin.sha256 }
        };
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
      else if (url.pathname === '/cosmos/staking/v1beta1/pool') body = {pool:{bonded_tokens:String(BigInt(tallyYes)+5123456n)}};
      else if (url.pathname === '/cosmos/staking/v1beta1/validators') {
        if (participationDown) return route.fulfill({status:503,headers,body:'No staking source'});
        body = {validators:voteOperators.map((operator_address,i)=>({operator_address,description:{moniker:['Alpha validator','Beta validator','Veto validator'][i]},status:'BOND_STATUS_BONDED',tokens:[tallyYes,'123456','5000000'][i],delegator_shares:[tallyYes,'123456','5000000'][i]})),pagination:{next_key:null}};
      } else if (url.pathname === '/cosmos/gov/v1/proposals/900/votes') body={votes:voterAccounts.map((voter,i)=>({proposal_id:'900',voter,options:[{option:[authorChoice,'VOTE_OPTION_NO','VOTE_OPTION_NO_WITH_VETO'][i],weight:'1'}]})),pagination:{next_key:null}};
      else if (url.pathname.startsWith('/cosmos/staking/v1beta1/delegations/') && voterAccounts.includes(url.pathname.split('/').at(-1))) {
        const a=url.pathname.split('/').at(-1),i=voterAccounts.indexOf(a);
        body={delegation_responses:[{delegation:{delegator_address:a,validator_address:voteOperators[i],shares:i===0?'1000000':i===1?'123456':'5000000'}}],pagination:{next_key:null}};
      }
      else if (url.pathname.includes('/spendable_balances/'))
        body = { balance: { denom: 'ujuno', amount: '10000000000' } };
      else if (url.pathname.includes('/module_accounts/gov'))
        body = { account: { name: 'gov', base_account: { address: GOVERNANCE } } };
      else if (url.pathname.includes('/smart/')) {
        const q = JSON.parse(
          Buffer.from(decodeURIComponent(url.pathname.split('/smart/')[1]), 'base64')
        );
        let data;
        if (url.pathname.includes(REVIEW_CONTRACT) || url.pathname.includes(UNI7_REVIEW_CONTRACT)) {
          if (q.config)
            data = testnet
              ? { owner: author, minimum_comment_stake: '1000000' }
              : { ...REVIEW_MAINNET_POLICY, paused: false };
          else if (q.access)
            data = {
              can_publish: true,
              can_comment: true,
              active_native_stake: '1000000',
              active_neta_stake: '0'
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
          else if (q.identity) {
            if (holdAuthorLookup) {
              await page.evaluate(() => { window.__authorLookupHeld = true; });
              await new Promise(resolve => { releaseAuthorLookup = resolve; });
            }
            data = {
              name: 'cristiano.neta',
              owner: author,
              generation: 1,
              ownership_revision: 1,
              expires_at: Math.floor(Date.now() / 1000) + 86400
            };
          }
        } else if (url.pathname.includes(manifest.profile_contract))
          data = q.profile ? { active: true, profile: { identity: {name: 'cristiano.neta', owner: author, generation: 1, ownership_revision: 1}, contacts: {description: 'Public profile fixture', website: 'https://example.org', twitter: 'cristiano'}, revision: 1 } } : { registry: manifest.registry };
        else if (url.pathname.includes(manifest.token)) data = { decimals: 6 };
        else
          data = q.pause_info
            ? { unpaused: {} }
            : GOVERNANCE;
        body = { data };
      } else if (url.pathname.includes('/contract/')) {
        const pin = url.pathname.endsWith(manifest.registry)
          ? manifest.contracts.registry
          : url.pathname.endsWith(manifest.profile_contract)
            ? manifest.contracts.profiles
            : { code_id: '4047' };
        body = {
          contract_info: url.pathname.endsWith(REVIEW_CONTRACT)
            ? { code_id: PIN.codeId, creator: PIN.creator, admin: PIN.admin, label: PIN.label }
            : pin
        };
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
        body = { tx_response: { txhash: url.pathname.split('/').at(-1), height: '42500125', code: 0 } };
      } else if (url.pathname === '/cosmos/gov/v1/proposals/900/tally') {
        assert.equal(verifiedRead, true, 'Browser tallies must use the same-origin read bridge');
        if (holdTally) await new Promise(resolve => { releaseTally = resolve; });
        if (failTally) return route.fulfill({status:503,headers,body:'Unavailable'});
        body = {tally:voteTally()};
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
    if (BigInt(native.total_deposit[0].amount) >= 5000000000n) {
      native.status = 'PROPOSAL_STATUS_VOTING_PERIOD';
      native.voting_end_time = new Date(Date.now() + 432000000).toISOString();
    }
    if (contributionMode === 'lost') throw Error('Synthetic lost response');
    return { transactionHash: 'B'.repeat(64), height: 42500125, code: 0 };
  });
  await page.exposeFunction('__nativeVote', async (id, sender, option) => {
    assert.equal(String(id),'900'); assert.equal(sender,author); voteWrites++;
    authorChoice = {yes:'VOTE_OPTION_YES',no:'VOTE_OPTION_NO',abstain:'VOTE_OPTION_ABSTAIN',veto:'VOTE_OPTION_NO_WITH_VETO'}[option];
    if(lostVote) throw Error('Synthetic vote response lost');
    return {transactionHash:'C'.repeat(64),height:42500127,code:0};
  });
  await page.route('**/assets/names-signing.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'window.NetaNamesSigning = window.__reviewSigningFixture;'
    })
  );
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
              `neta-pending-tx-v1:juno-1:${sender}`,
              JSON.stringify({
                version: 1,
                status: 'pending',
                chain: 'juno-1',
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
      const previouslyLoaded = !!window.NetaNamesSigning;
      window.__reviewSigningFixture = {
        connect: async () => ({ disconnect() {} }),
        createBridge: (opts) => ({
          execute: async (request, { beforeSign }) => {
            if (opts.chainId !== 'juno-1') throw Error('Wrong review chain');
            await opts.verifyDeployment();
            await beforeSign();
            return window.NetaSocialsTestnet.execute(
              null,
              request.owner,
              request.contract,
              request.msg
            );
          }
        })
      };
      if (previouslyLoaded) window.NetaNamesSigning = window.__reviewSigningFixture;
      else delete window.NetaNamesSigning;
      window.NetaJunoGovernance = {
        connect: async () => ({ disconnect() {} }),
        simulate: async (_client, _content, _sender, deposit) => {
          window.__selectedDeposit = deposit;
          if (window.__holdNativeSimulation)
            await new Promise((resolve) => (window.__releaseNativeSimulation = resolve));
          return 100000;
        },
        simulateDeposit: async () => 100000,
        simulateVote: async () => 100000,
        vote: async (_client, id, sender, option, _fee, guards) => {
          await guards.beforeSign(); await guards.assertWallet();
          if(window.__rejectVote) throw Error('Vote rejected by wallet');
          await guards.beforeBroadcast('C'.repeat(64));
          return window.__nativeVote(id,sender,option);
        },
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
      (text) => !!document.querySelector('#gov-connect').onclick &&
        document.querySelector('#primary-action').textContent === text,
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
  assert.deepEqual(await page.evaluate(() => window.__walletChains), ['juno-1']);
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
  assert.match(revision.title, /allocation rules$/);
  assert.match(revision.body, /This proposal was created on cosmoot.com\./);
  await page.waitForFunction(() =>
    document.querySelector('#shared-review-author').textContent.includes('cristiano.neta')
  );
  assert.equal(await page.locator('#discard-action').isVisible(), true);
  assert.equal(await page.locator('#discard-action').isDisabled(), false);
  assert.equal(await page.locator('#shared-review-copy, #shared-review-url, #review-network-archive, #comment-requirement').count(), 0);
  assert.equal(await page.locator('.review-author-wallet').getAttribute('href'), `https://atomscan.com/juno/accounts/${author}`);
  assert.equal(await page.locator('.review-author-name').getAttribute('href'), '/name-profile.html?name=cristiano.neta');
  assert.equal(await page.locator('#proposal-details').isVisible(), false);
  await page.locator('#proposal-details-toggle').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#proposal-details').isVisible(), true);
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#proposal-details').isVisible(), false);
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
  assert.match(page.url(), /review=77/);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`rule-community-review-${width}`);
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
    await shot(`rule-sponsor-submit-${width}`);
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
    await shot(`rule-community-funding-${width}`);
  }
  contributionMode = 'ok';
  await page.locator('#proposal-funding-confirm').check();
  await page.locator('#proposal-funding-action').click();
  await page.waitForFunction(() =>
    document.querySelector('#gov-status').textContent.includes('CONTRIBUTION CONFIRMED')
  );
  await page.locator('#voting-refresh').click();
  await page.waitForFunction(() => document.querySelector('#proposal-badge').textContent === 'VOTING');
  assert.equal(contributions, 2);
  assert.equal(await page.locator('#proposal-funding-panel').isVisible(), false);
  await page.waitForFunction(() => document.querySelector('#vote-yes').textContent === '2,099,071.01 JUNO');
  assert.equal(await page.locator('#vote-veto').textContent(), '5.00 JUNO');
  assert.equal(await page.locator('.vote-totals').isVisible(), false);
  assert.equal(await page.locator('#legacy-voting-heading').isVisible(), false);
  assert.match(await page.locator('#voting-deadline').innerText(), /REMAINING/);
  assert.match(await page.locator('#native-participation-bars').innerText(), /Yes · [\d.]+% \(2,099,071 JUNO\)/);
  assert.match(await page.locator('#native-participation-bars').innerText(), /No with veto · [\d.]+% \(5 JUNO\)/);
  assert.equal(await page.locator('#proposal-list button').filter({hasText: revision.title}).count(), 1);
  await page.locator('#proposal-review-history').click();
  await page.waitForFunction(() => document.querySelector('#action-hint').textContent.includes('Review history'));
  assert.equal(await page.locator('#planner-native-panel').isVisible(), false);
  assert.equal(await page.locator('#discard-action').isVisible(), false);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#action-hint').textContent.includes('Review history'));
  await page.locator('#action-hint button').click();
  await page.waitForFunction(() => document.querySelector('#vote-yes').textContent === '2,099,071.01 JUNO');
  await page.clock.install();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#vote-yes').textContent === '2,099,071.01 JUNO');
  tallyYes = '2599071009805';
  await page.clock.fastForward(31000);
  await page.waitForFunction(() => document.querySelector('#vote-yes').textContent === '2,599,071.01 JUNO');
  await page.clock.resume();
  tallyYes = '3099071009805';
  await page.locator('#voting-refresh').click();
  await page.waitForFunction(() => document.querySelector('#vote-yes').textContent === '3,099,071.01 JUNO');
  failTally = true;
  await page.locator('#voting-refresh').click();
  await page.waitForFunction(() => document.querySelector('#voting-data-status').textContent.includes('unavailable'));
  assert.equal(await page.locator('#vote-yes').textContent(), '—');
  assert.equal(await page.locator('#native-participation-bars meter').count(), 0);
  assert.doesNotMatch(await page.locator('#native-participation-bars').innerText(), /JUNO|0%/);
  failTally = false;
  await page.locator('#voting-refresh').click();
  await page.waitForFunction(() => document.querySelector('#vote-yes').textContent === '3,099,071.01 JUNO');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`native-voting-${width}`);
  }
  // Complete participation and direct voting share the same proposal view.
  await wallet(author);
  await page.locator('#gov-connect').click();
  await page.locator('#native-participation-refresh').click();
  await page.waitForFunction(() => document.querySelector('#native-participation-status').textContent.includes('Reconciled'));
  assert.equal(await page.locator('#native-participation-rows tr').count(),3);
  assert.match(await page.locator('#native-participation-metrics').textContent(),/Turnout 100.00%/);
  await page.locator('#native-participation-search').fill('Alpha');
  assert.equal(await page.locator('#native-participation-rows tr').count(),1);
  await page.locator('#native-participation-search').fill('');
  await page.locator('#native-participation-kind').selectOption('direct');
  assert.match(await page.locator('#native-own-vote').textContent(),/Own delegated weight: 1.00 JUNO/);
  assert.match(await page.locator('#native-participation-summary').textContent(),/3 voting addresses/);
  await page.locator('#native-vote-choice').selectOption('no');
  await page.locator('#native-vote-action').click();
  await page.waitForFunction(() => !document.querySelector('#native-vote-review').hidden);
  assert.match(await page.locator('#native-vote-review-text').textContent(),/Vote: No.*Fee: 0.0105 JUNO/);
  await page.evaluate(()=>{window.__rejectVote=true;});
  await page.locator('#native-vote-action').click();
  await page.waitForFunction(()=>document.querySelector('#native-vote-status').textContent.includes('rejected'));
  assert.equal(voteWrites,0);
  await page.evaluate(()=>{window.__rejectVote=false;});
  await page.locator('#native-vote-action').click();
  await page.waitForFunction(() => !document.querySelector('#native-vote-review').hidden);
  lostVote=true;
  await page.locator('#native-vote-action').click();
  await page.waitForFunction(()=>document.querySelector('#native-vote-action').textContent==='Check vote status');
  assert.equal(voteWrites,1);
  await page.reload();
  await wallet(author);
  // DOM load can precede async workspace initialization. Connect only once its
  // real handler and selected proposal are ready; never race a no-op click.
  await page.waitForFunction(() => !!document.querySelector('#gov-connect').onclick &&
    !document.querySelector('#native-voting-workspace').hidden);
  await page.locator('#gov-connect').click();
  await page.waitForFunction(()=>document.querySelector('#native-vote-action').textContent==='Check vote status');
  await page.locator('#native-vote-action').click();
  await page.waitForFunction(()=>document.querySelector('#native-vote-status').textContent.includes('Vote confirmed'));
  assert.equal(voteWrites,1,'Recovery never sends a second vote'); lostVote=false;
  await page.locator('#native-participation-refresh').click();
  await page.waitForFunction(()=>document.querySelector('#native-own-vote').textContent.startsWith('No ·'));
  participationDown=true;
  await page.locator('#native-participation-refresh').click();
  await page.waitForFunction(()=>document.querySelector('#native-participation-status').textContent.includes('unavailable'));
  assert.equal(await page.locator('#native-participation-data').isVisible(),false);
  assert.equal(await page.locator('#native-participation-bars meter').count(),4);
  assert.match(await page.locator('#native-participation-bars').innerText(), /JUNO/);
  participationDown=false;
  await page.locator('#native-participation-refresh').click();
  await page.waitForFunction(()=>document.querySelector('#native-participation-status').textContent.includes('Reconciled'));
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await shot(`native-participation-${width}`);
  }
  assert.equal(submits, 1);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('neta-governance-local-draft:juno-delegation')).title
    ),
    'Preserved draft'
  );
  // A delayed tally response must not overwrite a newly selected draft.
  holdTally = true;
  await page.locator('#voting-refresh').click();
  for (let i = 0; i < 100 && !releaseTally; i++) await new Promise(r => setTimeout(r, 10));
  assert.ok(releaseTally);
  await page.locator('#new-draft').click();
  holdTally = false;
  releaseTally();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#onchain-panel').isVisible(), false);
  assert.equal(await page.locator('#proposal-heading').textContent(), 'NEW PROPOSAL');
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
  holdAuthorLookup = true;
  await page.locator('.review-transaction-feedback [data-review-check]').click();
  await primary('FINALIZE REVIEW');
  assert.equal(reviewWrites, previousWrites + 1, 'Read-only status lookup must not republish');
  await page.waitForFunction(() => window.__authorLookupHeld === true);
  await page.locator('#gov-disconnect').click();
  holdAuthorLookup = false;
  releaseAuthorLookup();
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
  const mainnetUrl = page.url(),
    legacyUrl = new URL(mainnetUrl);
  legacyUrl.searchParams.delete('reviewChain');
  legacyUrl.searchParams.delete('reviewContract');
  await page.goto(legacyUrl.href);
  await page.waitForFunction(
    () => document.querySelector('#proposal-badge').textContent === 'WITHDRAWN'
  );
  assert.match(await page.locator('#shared-review-author').textContent(), /Review on UNI-7/);
  assert.match(page.url(), /reviewChain=uni-7/);
  await page.goto(mainnetUrl);
  await page.waitForFunction(
    () => document.querySelector('#proposal-badge').textContent === 'WITHDRAWN'
  );
  assert.match(await page.locator('#shared-review-author').textContent(), /Review on Juno mainnet/);
  await page.goto(origin + '/name-profile.html?name=cristiano.neta');
  await page.locator('#profile-content').waitFor({state: 'visible'});
  assert.match(await page.locator('#profile-content').innerText(), /Public profile fixture/);
  assert.equal(await page.locator('.profile-wallet').getAttribute('href'), `https://atomscan.com/juno/accounts/${author}`);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({width, height: 1000});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await shot(`public-profile-${width}`);
  }
  await page.goto(mainnetUrl);
  await page.waitForFunction(() => document.querySelector('#proposal-badge').textContent === 'WITHDRAWN');
}
