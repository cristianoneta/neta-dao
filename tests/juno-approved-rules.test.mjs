import { reviewSizeInput } from './fixtures/delegation-review-size.mjs';
import { buildRuleReview, readProposalReview } from '../juno-delegation-review.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedRule, currentApprovedRules } from '../juno-approved-rules.mjs';
import { legacyPolicy as defaultPolicy, PROGRAMME } from '../juno-delegation-core.mjs';
import { approvedProposal } from './fixtures/approved-rules.mjs';

const endpoints = ['https://one.example', 'https://two.example'];
const now = Date.now();
function readHistory(pages, alter = (value) => value) {
  return async (url, options) => {
    const parsed = new URL(url);
    let value;
    if (parsed.pathname.endsWith('/blocks/latest'))
      value = {
        block: {
          header: {
            chain_id: 'juno-1',
            height: '50000000',
            time: new Date(now).toISOString()
          }
        }
      };
    else {
      assert.equal(options.headers['x-cosmos-block-height'], '50000000');
      const index = Number(parsed.searchParams.get('pagination.key') || 0);
      value = {
        proposals: pages[index],
        pagination: { next_key: index + 1 < pages.length ? String(index + 1) : null }
      };
    }
    return new Response(JSON.stringify(alter(structuredClone(value), parsed)), {
      headers: { 'x-cosmos-block-height': '50000000' }
    });
  };
}
test('display reads exact passed policy including exclusions, never pending/rejected/different programmes', async () => {
  const rule = defaultPolicy();
  rule.factorTenths = 18;
  rule.commissionMaxBps = null;
  rule.exclusions = [
    {
      chainId: 'juno-1',
      validator: 'junovaloper1' + 'q'.repeat(38),
      reason: '<script>Public reason</script>'
    }
  ];
  const p = await approvedProposal({}, rule);
  assert.deepEqual((await approvedRule(p)).rule, rule);
  for (const status of [
    'PROPOSAL_STATUS_VOTING_PERIOD',
    'PROPOSAL_STATUS_REJECTED',
    'PROPOSAL_STATUS_FAILED'
  ])
    assert.equal(await approvedRule({ ...p, status }), null);
  assert.equal(
    await approvedRule({ ...p, summary: p.summary.replaceAll(PROGRAMME, 'another-programme') }),
    null
  );
});
test('malformed, unsupported or altered approved policy cannot be shown as valid', async () => {
  const p = await approvedProposal();
  for (const changed of [
    { summary: p.summary.replace('"factorTenths": 15', '"factorTenths": 19') },
    { summary: p.summary.replace('"schema": 2', '"schema": 3') },
    { summary: p.summary.replace('"schema": 2', '"extra": true, "schema": 2') },
    { summary: p.summary + '\nRule SHA-256: ' + 'a'.repeat(64) },
    { messages: [{}] },
    { failed_reason: 'execution failed' },
    { voting_end_time: new Date(Date.now() + 86400000).toISOString() },
    { summary: p.summary.replace('Chain: juno-1', 'Chain: uni-7') }
  ])
    await assert.rejects(approvedRule({ ...p, ...changed }));
});
test('complete paginated history selects latest passing time, excluding newer pending proposals', async () => {
  const old = await approvedProposal({
    id: '951',
    voting_end_time: new Date(now - 7200000).toISOString()
  });
  const current = await approvedProposal({
    id: '950',
    voting_end_time: new Date(now - 3600000).toISOString()
  });
  const pending = { ...current, id: '952', status: 'PROPOSAL_STATUS_VOTING_PERIOD' };
  const result = await currentApprovedRules({
    endpoints,
    now,
    fetcher: readHistory([[old], [current, pending]])
  });
  assert.equal(result.current.proposalId, '950');
  assert.equal(result.sources.length, 2);
  assert.equal(
    (await currentApprovedRules({ endpoints, now, fetcher: readHistory([[]]) })).current,
    null
  );
});
test('missing source, disagreement, wrong chain, stale blocks or incomplete pagination are unavailable, never empty', async () => {
  const p = await approvedProposal();
  for (const alter of [
    (v, url) => (url.hostname === 'two.example' && v.proposals ? { ...v, proposals: [] } : v),
    (v) => (v.block ? { block: { header: { ...v.block.header, chain_id: 'uni-7' } } } : v),
    (v) => (v.block ? { block: { header: { ...v.block.header, time: '2020-01-01' } } } : v),
    (v) => (v.proposals ? { proposals: v.proposals } : v),
    (v) => (v.proposals ? { ...v, pagination: { next_key: '0' } } : v)
  ])
    await assert.rejects(
      currentApprovedRules({ endpoints, now, fetcher: readHistory([[p]], alter) })
    );
  await assert.rejects(
    currentApprovedRules({
      endpoints: [endpoints[0], endpoints[0]],
      now,
      fetcher: readHistory([[p]])
    }),
    /independent/
  );
  const fetcher = readHistory([[p]]);
  await assert.rejects(
    currentApprovedRules({
      endpoints,
      now,
      fetcher: (url, options) => {
        if (url.includes('two.example')) throw Error('offline');
        return fetcher(url, options);
      }
    }),
    /independent/
  );
});
test('latest unsupported approved version does not fall back to an older valid version', async () => {
  const old = await approvedProposal({ voting_end_time: new Date(now - 7200000).toISOString() });
  const latest = await approvedProposal({ id: '951' });
  latest.summary = latest.summary.replace('"schema": 2', '"schema": 3');
  await assert.rejects(
    currentApprovedRules({ endpoints, now, fetcher: readHistory([[old, latest]]) }),
    /not supported/
  );
});

test('a programme-sized compact rule proposal is discovered after passage, including its original released envelope', async () => {
  const review = await buildRuleReview(reviewSizeInput()),
    draft = await frozenRuleProposal(review);
  assert.ok(Buffer.byteLength(draft.values.summary + '\n\n' + draft.values.body) <= 10000);
  assert.ok(
    !draft.values.body.includes('# Proposed allocation rules'),
    'Exercise the compact envelope'
  );
  assert.match(draft.values.body, /^Chain: juno-1$/m);
  assert.match(draft.values.body, new RegExp('^Programme: ' + PROGRAMME + '$', 'm'));
  const previous = await approvedProposal({
    id: '950',
    voting_end_time: new Date(now - 7200000).toISOString()
  });
  for (const legacy of [false, true]) {
    const values = {
      ...draft.values,
      body: legacy
        ? draft.values.body.replace(/^Chain: juno-1\nProgramme: [^\n]+\n\n/, '')
        : draft.values.body
    };
    assert.equal((await readProposalReview(values)).hash, review.hash);
    const proposal = {
      id: '951',
      status: 'PROPOSAL_STATUS_PASSED',
      title: values.title,
      summary: values.summary + '\n\n' + values.body,
      messages: [],
      voting_end_time: new Date(now - 3600000).toISOString()
    };
    assert.equal((await approvedRule(proposal)).hash, review.value.policyHash);
    const result = await currentApprovedRules({
      endpoints,
      now,
      fetcher: readHistory([[previous], [proposal]])
    });
    assert.equal(result.current.proposalId, '951');
    assert.deepEqual(result.current.rule, review.value.rule);
    await assert.rejects(
      approvedRule({ ...proposal, messages: [{ execute: {} }] }),
      /invalid rule approval/
    );
    await assert.rejects(
      approvedRule({
        ...proposal,
        summary: proposal.summary.replace(
          'Rule SHA-256: ' + review.value.policyHash,
          'Rule SHA-256: ' + '0'.repeat(64)
        )
      })
    );
    const damaged = {
      ...proposal,
      summary: proposal.summary.replace(
        'Review SHA-256: ' + review.hash,
        'Review SHA-256: ' + '0'.repeat(64)
      )
    };
    await assert.rejects(
      currentApprovedRules({ endpoints, now, fetcher: readHistory([[previous, damaged]]) }),
      /fingerprint mismatch/
    );
    if (legacy)
      await assert.rejects(
        approvedRule({ ...proposal, summary: 'Chain: uni-7\n' + proposal.summary }),
        /invalid rule approval/
      );
  }
});
