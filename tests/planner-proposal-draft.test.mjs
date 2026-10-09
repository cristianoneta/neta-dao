import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimProposal,
  ruleProposal,
  savePlannerProposal,
  readPlannerProposal,
  PLANNER_DRAFT_PREFIX
} from '../planner-proposal-draft.mjs';
import { claimValidators, GOVERNANCE, EXECUTE } from '../juno-governance-core.mjs';
import { defaultPolicy, simulate, amount } from '../juno-delegation-core.mjs';
import { fixture, observed } from './fixtures/delegation-planner.mjs';
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
test('claims include all positions, including jailed/standby, with no transfers or delegation', () => {
  const s = fixture();
  s.validators[0].active = false;
  s.activeCount--;
  s.validators[1].jailed = true;
  const d = claimProposal(s),
    actions = JSON.parse(d.values.actions_json);
  assert.equal(actions.length, 1);
  assert.equal(actions[0]['@type'], EXECUTE);
  assert.equal(actions[0].sender, GOVERNANCE);
  assert.equal(d.governanceDaoId, 'juno');
  assert.deepEqual(new Set(claimValidators(actions)), new Set(s.validators.map((v) => v.address)));
  assert.match(d.values.body, /withdrawal address/);
  s.blockTime = new Date(Date.now() - 3600001).toISOString();
  assert.throws(() => claimProposal(s), /Refresh/);
  s.blockTime = new Date(Date.now() + 600000).toISOString();
  assert.throws(() => claimProposal(s), /Refresh/);
  s.chainId = 'uni-7';
  assert.throws(() => claimProposal(s));
});
test('rule proposal is a separate non-executable decision', () => {
  const s = fixture(),
    rule = defaultPolicy(),
    simulation = simulate(rule, s, amount('3000'), observed(s));
  const result = ruleProposal({
    proposalType: 'RULE_APPROVAL',
    rule,
    snapshot: s,
    simulation,
    approval: null,
    policyHash: 'a'.repeat(64),
    snapshotHash: 'b'.repeat(64),
    evidenceHash: 'c'.repeat(64)
  });
  assert.equal(result.kind, 'RULE_APPROVAL');
  assert.deepEqual(JSON.parse(result.values.actions_json), []);
  assert.match(result.values.body, /"schema": 2/);
  assert.match(result.values.body, /50 JUNO/);
  assert.match(result.values.body, /not required/);
});
test('unique proposal drafts preserve previous drafts and reject mismatched or corrupt context', () => {
  const storage = memory(),
    id = '11111111-1111-4111-8111-111111111111';
  storage.setItem('neta-governance-local-draft:juno-delegation', 'original');
  const draft = claimProposal(fixture()),
    url = new URL(savePlannerProposal(storage, draft, id), 'https://example.org');
  assert.equal(url.hash, '#governance');
  assert.equal(url.searchParams.get('subdao'), 'juno-delegation');
  assert.equal(
    readPlannerProposal(storage, url.searchParams, 'juno-delegation').kind,
    'CLAIM_REWARDS'
  );
  assert.equal(storage.getItem('neta-governance-local-draft:juno-delegation'), 'original');
  assert.throws(() => savePlannerProposal(storage, draft, id), /already exists/);
  assert.throws(() => readPlannerProposal(storage, url.searchParams, 'neta'));
  storage.setItem(PLANNER_DRAFT_PREFIX + id, '{}');
  assert.throws(() => readPlannerProposal(storage, url.searchParams, 'juno-delegation'));
  assert.throws(
    () =>
      savePlannerProposal(
        {
          getItem: () => null,
          setItem: () => {
            throw Error('quota');
          }
        },
        draft,
        id
      ),
    /could not save.*draft/
  );
  assert.throws(
    () => savePlannerProposal({ getItem: () => null, setItem: () => {} }, draft, id),
    /could not save/
  );
});
test('native claims retain the long DAO validator addresses rejected by the former 20-byte-only check', () => {
  const source = fixture();
  const long = [
    'junovaloper185hgkqs8q8ysnc8cvkgd8j2knnq2m0ah6ae73gntv9ampgwpmrxqlfzywn',
    'junovaloper1pvuxgpct3n8pk4dk2vsvuz2y9tav62ug2c8n093dhzh5qqqe3w3qzgq2d7'
  ];
  long.forEach((v, i) => (source.validators[i].address = v));
  const messages = JSON.parse(claimProposal(source).values.actions_json);
  for (const address of long) assert.ok(claimValidators(messages).includes(address));
  for (const bad of [
    long[0] + 'q',
    long[0].slice(0, -1),
    long[0].replace('junovaloper', 'juno'),
    'junovaloper1' + 'b'.repeat(58)
  ]) {
    const invalid = structuredClone(messages);
    invalid[0].msg.execute_admin_msgs.msgs[0].distribution.withdraw_delegator_reward.validator =
      bad;
    assert.throws(() => claimValidators(invalid));
  }
});
