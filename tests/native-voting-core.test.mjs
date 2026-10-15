import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ballot,
  participation,
  votingMetrics,
  pages,
  voteProof,
  readParticipation
} from '../native-voting-core.mjs';
import { governanceReadTarget } from '../governance-chain-read.mjs';
import { governanceOperatorAccount } from '../names-profile-core.mjs';
// Checksum-valid fixtures generated independently with the Cosmos address codec.
const account = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const val = 'junovaloper1z3xcalwan92yqxu9d406tlft9yy94jy80f0y08';
const user = 'juno1qvpsxqcrqvpsxqcrqvpsxqcrqvpsxqcr549pth';
const val2 = 'junovaloper1qszqgpqyqszqgpqyqszqgpqyqszqgpqytc5thj';
const v = (address = val, tokens = '100000000') => ({
  operator_address: address,
  tokens,
  delegator_shares: tokens + '.000000000000000000',
  status: 'BOND_STATUS_BONDED',
  description: { moniker: 'Validator' }
});
const vote = (voter, option, weight = '1') => ({
  proposal_id: '381',
  voter,
  options: [{ option, weight }]
});
const d = (delegator, shares, validator = val) => ({
  delegation: { delegator_address: delegator, validator_address: validator, shares }
});
const yes = { yes: '70000000', no: '30000000', abstain: '0', veto: '0' };
test('direct delegator votes replace validator weight; validator self delegation is counted once', () => {
  const r = participation(
    [v()],
    [vote(account, 'VOTE_OPTION_YES'), vote(user, 'VOTE_OPTION_NO')],
    { [account]: [d(account, '10000000')], [user]: [d(user, '30000000')] },
    yes,
    account
  );
  assert.equal(r.validators[0].weight, '60000000');
  assert.equal(r.directWeight, '40000000');
  assert.equal(r.inheritedWeight, '60000000');
  assert.equal(r.own.weight, '10000000');
  assert.equal(r.direct[0].validator, 'Validator');
});
test('nonvoting validators, unbonded stake and inherited personal ballots remain distinct', () => {
  const r = participation(
    [v(), { ...v(val2), status: 'BOND_STATUS_UNBONDED' }],
    [vote(user, 'VOTE_OPTION_ABSTAIN')],
    {
      [user]: [d(user, '30000000'), d(user, '50000000', val2)],
      [account]: [d(account, '10000000')]
    },
    { yes: '0', no: '0', abstain: '30000000', veto: '0' },
    account
  );
  assert.equal(r.validators[0].weight, '0');
  assert.equal(r.validators[0].remaining, '70000000');
  assert.equal(r.directWeight, '30000000');
  assert.equal(r.own.ballot.length, 0);
  assert.equal(r.own.inherited[0].ballot.length, 0);
});
test('weighted ballots aggregate every delegation before final truncation', () => {
  const weighted = {
    proposal_id: '381',
    voter: account,
    options: [
      { option: 'VOTE_OPTION_YES', weight: '0.25' },
      { option: 'VOTE_OPTION_NO_WITH_VETO', weight: '0.75' }
    ]
  };
  const r = participation(
    [v()],
    [weighted],
    { [account]: [d(account, '10000000')] },
    { yes: '25000000', no: '0', abstain: '0', veto: '75000000' }
  );
  assert.equal(r.validators[0].ballot.length, 2);
  assert.equal(r.validators[0].weight, '90000000');
  assert.throws(() => ballot({ ...weighted, options: weighted.options.slice(0, 1) }), /total/);
});
test('duplicate records, missing delegations, overdeductions and mismatched tally fail closed', () => {
  const votes = [vote(account, 'VOTE_OPTION_YES')],
    ds = { [account]: [d(account, '10000000')] },
    tally = { yes: '100000000', no: '0', abstain: '0', veto: '0' };
  for (const args of [
    [[v(), v()], votes, ds, tally],
    [[v()], [...votes, ...votes], ds, tally],
    [[v()], votes, {}, tally],
    [[v()], votes, { [account]: [d(account, '200000000')] }, tally],
    [[v()], votes, ds, yes]
  ])
    assert.throws(() => participation(...args));
});
test('turnout includes abstain, Yes excludes abstain, expedited threshold is read from chain', () => {
  const r = votingMetrics(
    { yes: '40', no: '10', abstain: '40', veto: '10' },
    { quorum: '0.5', threshold: '0.5', expedited_threshold: '0.667', veto_threshold: '0.334' },
    '200',
    true
  );
  assert.equal(r.turnout, '50.00');
  assert.equal(r.yesShare, '66.66');
  assert.equal(r.quorumReached, true);
  assert.equal(r.thresholds.threshold, '667000000000000000');
});
test('pagination follows every cursor and rejects missing metadata and loops', async () => {
  let n = 0;
  const source = {
    get: async () =>
      ++n === 1
        ? { votes: [1], pagination: { next_key: 'abc+' } }
        : { votes: [2], pagination: { next_key: null } }
  };
  assert.deepEqual(await pages(source, '/votes', 'votes'), [1, 2]);
  await assert.rejects(
    pages({ get: async () => ({ votes: [] }) }, '/votes', 'votes'),
    /Incomplete/
  );
  await assert.rejects(
    pages(
      { get: async () => ({ votes: [], pagination: { next_key: 'loop' } }) },
      '/votes',
      'votes'
    ),
    /complete-read/
  );
});
const expected = {
  id: '381',
  title: 'Proposal',
  summary: 'Summary',
  messages: [],
  metadata: '',
  expedited: false,
  status: 'PROPOSAL_STATUS_VOTING_PERIOD',
  voting_end_time: new Date(Date.now() + 3600000).toISOString()
};
function fetcher(mode = '') {
  return async (url) => {
    let body = url.endsWith('/latest')
      ? {
          block: {
            header: {
              chain_id: mode === 'chain' ? 'uni-7' : 'juno-1',
              height: '100',
              time: new Date().toISOString()
            }
          }
        }
      : url.includes('spendable_balances')
        ? { balance: { denom: 'ujuno', amount: '1000000' } }
        : {
            proposal: {
              ...expected,
              ...(mode === 'closed'
                ? { status: 'PROPOSAL_STATUS_PASSED' }
                : mode === 'changed'
                  ? { title: 'Different' }
                  : mode === 'deadline'
                    ? { voting_end_time: '2020-01-01T00:00:00Z' }
                    : {})
            }
          };
    return new Response(JSON.stringify(body), {
      headers: mode === 'height' ? {} : { 'x-cosmos-block-height': '100' }
    });
  };
}
test('vote preflight verifies two sources, content, chain, deadline and pinned height', async () => {
  const sources = ['https://a.example', 'https://b.example'];
  assert.equal(
    (await voteProof(sources, expected, account, { fetcher: fetcher() })).balance,
    '1000000'
  );
  for (const mode of ['chain', 'closed', 'changed', 'deadline', 'height'])
    await assert.rejects(voteProof(sources, expected, account, { fetcher: fetcher(mode) }));
  await assert.rejects(voteProof(sources.slice(0, 1), expected, account, { fetcher: fetcher() }));
});
test('new proxy paths are read-only and pagination cannot add filters or arbitrary queries', () => {
  for (const path of [
    '/cosmos/staking/v1beta1/pool',
    '/cosmos/gov/v1/params/tallying',
    '/cosmos/staking/v1beta1/validators?pagination.limit=100',
    `/cosmos/staking/v1beta1/delegations/${user}?pagination.limit=100`,
    '/cosmos/gov/v1/proposals/381/votes?pagination.limit=100'
  ])
    assert.ok(governanceReadTarget('juno-polkachu', path, '100'));
  for (const path of [
    '/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED',
    '/cosmos/gov/v1/proposals/381/votes?pagination.limit=100&evil=1',
    '/cosmos/staking/v1beta1/pool?x=1'
  ])
    assert.throws(() => governanceReadTarget('juno-polkachu', path));
});
test('closed proposal detail does not query current stake to invent a historical breakdown', async () => {
  const r = await readParticipation(['https://a.example'], '381', null, {
    fetcher: fetcher('closed')
  });
  assert.equal(r.historical, true);
});

test('fractional delegations retain turnout precision before integer tally truncation', () => {
  const tally = { yes: '1', no: '0', abstain: '0', veto: '0' };
  const r = participation(
    [{ ...v(), tokens: '2', delegator_shares: '3' }],
    [vote(account, 'VOTE_OPTION_YES'), vote(user, 'VOTE_OPTION_NO')],
    { [account]: [], [user]: [d(user, '1')] },
    tally
  );
  const metrics = votingMetrics(
    tally,
    { quorum: '0.9', threshold: '0.5', veto_threshold: '0.334' },
    '2',
    false,
    r
  );
  assert.equal(metrics.turnout, '100.00');
  assert.equal(metrics.quorumReached, true);
});
test('native governance decodes extended validator accounts without weakening profile wallet checks', () => {
  assert.equal(
    governanceOperatorAccount(
      'junovaloper1qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qurs6aydqy'
    ),
    'juno1qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qurswpc8qursaq28r5'
  );
});
