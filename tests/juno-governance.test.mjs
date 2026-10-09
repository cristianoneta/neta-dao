import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimMessages,
  proposalContent,
  validateEvidence,
  verifyGovernance,
  GOV
} from '../juno-governance-core.mjs';
import { PROGRAMME } from '../juno-delegation-core.mjs';
import { claimProposal, validatePlannerDraft } from '../planner-proposal-draft.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';
const sample = fixture();
const values = () => claimProposal(sample).values;
function evidence() {
  return {
    header: { chain_id: 'juno-1', time: new Date().toISOString() },
    info: { code_id: '4047' },
    admin: GOV,
    paused: { unpaused: {} },
    gov: { name: 'gov', base_account: { address: GOV } },
    withdraw: PROGRAMME,
    params: { min_deposit: [{ denom: 'ujuno', amount: '1000000000' }], voting_period: '432000s' },
    delegations: sample.validators.map((v) => ({
      delegation: { delegator_address: PROGRAMME, validator_address: v.address },
      balance: { denom: 'ujuno', amount: '1000' }
    }))
  };
}
test('governance wraps all claims with its authority while the programme remains the delegator', () => {
  const content = proposalContent('CLAIM_REWARDS', values()),
    m = content.messages[0];
  assert.equal(m.sender, GOV);
  assert.equal(m.contract, PROGRAMME);
  assert.deepEqual(m.funds, []);
  assert.equal(m.msg.execute_admin_msgs.msgs.length, sample.validators.length);
  assert.deepEqual(
    validateEvidence(evidence(), 'CLAIM_REWARDS', content).initialDeposit,
    evidence().params.min_deposit
  );
});
test('rejects altered native messages, nested transfers, authority and extra actions', () => {
  const changes = [
    (m) => (m.sender = PROGRAMME),
    (m) => (m.contract = GOV),
    (m) => m.funds.push({ denom: 'ujuno', amount: '1' }),
    (m) => m.msg.execute_admin_msgs.msgs.push({ bank: { send: {} } }),
    (m) => (m.extra = true)
  ];
  for (const change of changes) {
    const v = values(),
      ms = JSON.parse(v.actions_json);
    change(ms[0]);
    v.actions_json = JSON.stringify(ms);
    assert.throws(() => proposalContent('CLAIM_REWARDS', v));
  }
  assert.throws(() => claimMessages([sample.validators[0].address, sample.validators[0].address]));
});
test('wrong or stale chain, migrated/paused contract, changed admin, redirected rewards and changed positions block submission', () => {
  const content = proposalContent('CLAIM_REWARDS', values());
  const changes = [
    (e) => (e.header.chain_id = 'uni-7'),
    (e) => (e.header.time = 'invalid'),
    (e) => (e.header.time = new Date(Date.now() - 180000).toISOString()),
    (e) => (e.info.code_id = '4048'),
    (e) => (e.admin = PROGRAMME),
    (e) => (e.paused = { paused: {} }),
    (e) => (e.gov.base_account.address = PROGRAMME),
    (e) => (e.withdraw = GOV),
    (e) => e.delegations.pop(),
    (e) => e.delegations.push(e.delegations[0]),
    (e) => (e.delegations[0].balance.denom = 'ujunox'),
    (e) => (e.params.min_deposit[0].amount = '1e9')
  ];
  for (const change of changes) {
    const e = evidence();
    change(e);
    assert.throws(() => validateEvidence(e, 'CLAIM_REWARDS', content));
  }
});
test('rule approval contains the full text and no executable messages; UTF-8 limit is enforced', () => {
  const v = { title: 'Rules', summary: 'Decision', body: 'Full rules', actions_json: '[]' };
  assert.equal(proposalContent('RULE_APPROVAL', v).summary, 'Decision\n\nFull rules');
  assert.throws(() => proposalContent('RULE_APPROVAL', values()));
  assert.throws(() => proposalContent('RULE_APPROVAL', { ...v, body: '€'.repeat(4000) }));
});
test('previous withdrawal-only drafts upgrade without losing edited prose', () => {
  const d = claimProposal(sample),
    ms = JSON.parse(d.values.actions_json);
  d.values.actions_json = JSON.stringify(ms[0].msg.execute_admin_msgs.msgs);
  d.values.title = 'My edited title';
  const upgraded = validatePlannerDraft(d);
  assert.equal(upgraded.values.title, 'My edited title');
  assert.equal(proposalContent('CLAIM_REWARDS', upgraded.values).messages[0].sender, GOV);
});
test('requires independent evidence and rejects governance parameter disagreement', async () => {
  const content = proposalContent('CLAIM_REWARDS', values()),
    e = evidence();
  let mode = 'okay';
  const get = async (url) => {
    if (mode === 'offline' && !url.includes('polkachu')) throw Error('offline');
    if (url.includes('/blocks/')) return { block: { header: e.header } };
    if (url.includes('/smart/')) {
      const q = JSON.parse(atob(url.split('/').at(-1)));
      return { data: q.admin ? e.admin : e.paused };
    }
    if (url.includes('/contract/')) return { contract_info: e.info };
    if (url.endsWith('/gov')) return { account: e.gov };
    if (url.includes('/params/'))
      return {
        params: {
          ...e.params,
          min_deposit: [
            {
              denom: 'ujuno',
              amount: mode === 'disagree' && url.includes('lavender') ? '1' : '1000000000'
            }
          ]
        }
      };
    if (url.endsWith('/withdraw_address')) return { withdraw_address: e.withdraw };
    return { delegation_responses: e.delegations, pagination: { next_key: null } };
  };
  await verifyGovernance('CLAIM_REWARDS', content, get);
  mode = 'offline';
  await assert.rejects(verifyGovernance('CLAIM_REWARDS', content, get), /Two independent/);
  mode = 'disagree';
  await assert.rejects(verifyGovernance('CLAIM_REWARDS', content, get), /disagree/);
});
