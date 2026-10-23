import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicAuthorName } from '../proposal-identity.mjs';
import { nextClaimTitle, roman, CLAIM_TITLE, readClaimTitle, nextClaimContext, withClaimContext, assertClaimContext, CLAIM_381_EXPLANATION } from '../claim-numbering.mjs';
import { readFileSync } from 'node:fs';
import { proposalContent } from '../juno-governance-core.mjs';
import { rewardMessages } from '../juno-governance-core.mjs';
import { legacyClaimDraft as claimProposal } from './fixtures/legacy-claim.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';
test('explanation belongs to the first corrected native claim, never to local draft count', () => {
  const old = JSON.parse(readFileSync(new URL('./fixtures/juno-proposal-381.json', import.meta.url))).proposal;
  const messages = rewardMessages(fixture().validators.map(v => v.address));
  const context = nextClaimContext([old]);
  assert.deepEqual(context, { title: CLAIM_TITLE + ' II', explain381: true });
  const values = { title: '', summary: 'Claim', body: 'Rewards\n\nThis proposal was created on cosmoot.com.', actions_json: JSON.stringify(messages) };
  const first = withClaimContext(values, context);
  assert.deepEqual(withClaimContext(first, context), first, 'Repeated preparation retains exactly one explanation');
  assertClaimContext(proposalContent('CLAIM_REWARDS', first), context);
  assert.throws(() => assertClaimContext(proposalContent('CLAIM_REWARDS', { ...first, body: 'Removed explanation' }), context));
  const replacement = { id: '382', title: CLAIM_TITLE + ' II', messages, status: 'PROPOSAL_STATUS_DEPOSIT_PERIOD' };
  const later = nextClaimContext([old, replacement]);
  assert.deepEqual(later, { title: CLAIM_TITLE + ' III', explain381: false });
  assert.equal(withClaimContext(first, later).body.includes(CLAIM_381_EXPLANATION), false);
  assert.throws(() => assertClaimContext(proposalContent('CLAIM_REWARDS', first), later));
  assert.equal(nextClaimContext([old, { ...replacement, messages: [] }]).explain381, true);
  assert.equal(nextClaimContext([old, { ...replacement, messages: old.messages }]).explain381, true);
  assert.equal(nextClaimContext([old, { ...replacement, status: 'PROPOSAL_STATUS_FAILED' }]).explain381, false);
});
test('public names require matching reverse record, active ownership and expiry', async () => {
  const reader = {
    nameOf: async () => ({ address: 'owner', name: 'alice.neta' }),
    identity: async () => ({ name: 'alice.neta', owner: 'owner', expires_at: 200 }),
    block: { time: 100 }
  };
  assert.equal(await publicAuthorName(reader, 'owner', () => 100), 'alice.neta');
  assert.equal(await publicAuthorName(reader, 'other', () => 100), null);
  assert.equal(await publicAuthorName(reader, 'owner', () => 200), null);
  reader.identity = async () => ({ name: 'alice.neta', owner: 'new-owner', expires_at: 200 });
  assert.equal(await publicAuthorName(reader, 'owner', () => 100), null);
});
test('claim series advances by verified numbered mainnet claims, independent of status', () => {
  const messages = rewardMessages(fixture().validators.map((v) => v.address));
  assert.equal(nextClaimTitle([]), CLAIM_TITLE + ' I');
  assert.equal(nextClaimTitle([{ title: CLAIM_TITLE, messages }]), CLAIM_TITLE + ' I');
  assert.equal(
    nextClaimTitle([
      { title: CLAIM_TITLE + ' IX', messages },
      { title: CLAIM_TITLE + ' III', messages }
    ]),
    CLAIM_TITLE + ' X'
  );
  assert.equal(nextClaimTitle([{ title: CLAIM_TITLE + ' X', messages: [] }]), CLAIM_TITLE + ' I');
  assert.equal(nextClaimTitle([{ title: CLAIM_TITLE + ' IIII', messages }]), CLAIM_TITLE + ' I');
  const reordered = messages.map((m) => ({
    '@type': m['@type'],
    sender: m.sender,
    contract: m.contract,
    msg: btoa(JSON.stringify(m.msg)),
    funds: m.funds
  }));
  assert.equal(
    nextClaimTitle([{ title: CLAIM_TITLE + ' IV', messages: reordered }]),
    CLAIM_TITLE + ' V'
  );
  assert.equal(roman(49), 'XLIX');
  assert.equal(roman(3999), 'MMMCMXCIX');
  assert.throws(() => roman(4000));
});
test('numbering fails closed on unavailable or incomplete histories', async () => {
  await assert.rejects(
    readClaimTitle(['https://one.test', 'https://two.test'], {
      fetcher: async () => ({ ok: false })
    })
  );
  let calls = 0;
  const fetcher = async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith('/latest')
        ? { block: { header: { chain_id: 'juno-1', time: new Date().toISOString() } } }
        : (calls++, { proposals: [], pagination: { next_key: 'repeated' } })
  });
  await assert.rejects(readClaimTitle(['https://one.test', 'https://two.test'], { fetcher }));
  assert.ok(calls >= 4);
});
test('historical claim text retains a single Cosmoot attribution', () => {
  const s = fixture();
  const p = claimProposal(s);
  assert.equal(p.values.body.split('This proposal was created on cosmoot.com.').length - 1, 1);
});

test('claim numbering traverses forward through the last page and retains provider path prefixes', async () => {
  const messages = rewardMessages(fixture().validators.map((v) => v.address));
  const endpoints = ['https://one.test', 'https://two.test/juno', 'https://two.test/juno/'];
  const calls = [];
  let mismatch = false;
  const fetcher = async (url) => {
    const u = new URL(url);
    if (u.hostname === 'two.test') assert.ok(u.pathname.startsWith('/juno/'));
    if (u.pathname.endsWith('/latest'))
      return new Response(
        JSON.stringify({
          block: { header: { chain_id: 'juno-1', height: '99', time: new Date().toISOString() } }
        })
      );
    assert.equal(u.searchParams.has('pagination.reverse'), false);
    calls.push(url);
    const last = u.searchParams.has('pagination.key');
    if (last) assert.equal(u.searchParams.get('pagination.key'), 'cursor+/=');
    return new Response(
      JSON.stringify({
        proposals: [
          {
            title:
              CLAIM_TITLE + (last ? (mismatch && u.hostname === 'two.test' ? ' VI' : ' V') : ' II'),
            messages
          }
        ],
        pagination: { next_key: last ? null : 'cursor+/=' }
      })
    );
  };
  assert.equal(await readClaimTitle(endpoints, { fetcher }), CLAIM_TITLE + ' VI');
  assert.equal(calls.length, 4, 'Only independent hosts count, with every page read');
  mismatch = true;
  await assert.rejects(readClaimTitle(endpoints, { fetcher }), /must agree/);
});
