import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicAuthorName } from '../proposal-identity.mjs';
import { nextClaimTitle, roman, CLAIM_TITLE, readClaimTitle } from '../claim-numbering.mjs';
import { rewardMessages } from '../juno-governance-core.mjs';
import { claimProposal } from '../planner-proposal-draft.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';
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
test('new claim text includes a single Cosmoot attribution', () => {
  const s = fixture();
  const p = claimProposal(s);
  assert.equal(p.values.body.split('This proposal was created on cosmoot.com.').length - 1, 1);
});
