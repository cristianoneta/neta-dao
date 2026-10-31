import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reviewSizeInput } from './fixtures/delegation-review-size.mjs';
import { buildRuleReview, readProposalReview } from '../juno-delegation-review.mjs';
import { canonical, fingerprint } from '../juno-delegation-core.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import { finalizedReview } from '../juno-community-governance.mjs';
import { approvedRule, currentApprovedRules } from '../juno-approved-rules.mjs';
import { parseRuleReference, ruleReviewUrl, assertPinnedReview } from '../juno-rule-reference.mjs';
import { readReferencedRuleProposal } from '../juno-rule-reference-read.mjs';
import { validateProposalContent } from '../src/governance/proposal-content.mjs';
import { proposalContent } from '../juno-governance-core.mjs';

const endpoints = ['https://one.example', 'https://two.example'];
const now = Date.now();
async function fixture() {
  const input = reviewSizeInput({ points: true });
  const frozen = await buildRuleReview(input);
  const draft = await frozenRuleProposal(frozen, { referenced: true });
  const record = {
    id: 17,
    latest_version: 101,
    finalized_version: 101,
    finalized_hash: createHash('sha256').update(JSON.stringify(draft.values)).digest('hex'),
    withdrawn: false,
    author: 'juno1testauthor'
  };
  const revision = { ...draft.values, proposal_id: 17, version: 101 };
  const final = await finalizedReview(record, revision, 'juno-1');
  const proposal = {
    ...final.content,
    id: '951',
    status: 'PROPOSAL_STATUS_PASSED',
    voting_end_time: new Date(now - 1000).toISOString()
  };
  const calls = [];
  const source = {
    get: async (path) => {
      calls.push(path);
      if (path.includes('/smart/')) {
        const q = JSON.parse(atob(decodeURIComponent(path.split('/smart/')[1])));
        if (q.proposal) {
          assert.equal(q.proposal.proposal_id, 17);
          return { data: record };
        }
        assert.deepEqual(q.revisions, { proposal_id: 17, start_after: 100, limit: 1 });
        return { data: [revision] };
      }
      if (path.includes('/blocks/latest'))
        return {
          block: {
            header: {
              chain_id: 'juno-1',
              height: '50000000',
              time: new Date(now).toISOString()
            }
          }
        };
      if (path.endsWith('/proposals/951')) return { proposal };
      return { proposals: [proposal], pagination: { next_key: null } };
    }
  };
  const fetcher = async (url) =>
    new Response(JSON.stringify(await source.get(new URL(url).pathname + new URL(url).search)), {
      headers: { 'x-cosmos-block-height': '50000000' }
    });
  return { input, frozen, draft, record, revision, final, proposal, source, fetcher, calls };
}

test('new rule content is small and human-readable, while the complete frozen review remains unchanged', async () => {
  const f = await fixture();
  assert.match(f.proposal.summary, /initial rules.*Delegation Programme/);
  assert.match(f.proposal.summary, /existing delegations remain unchanged/i);
  assert.doesNotMatch(f.proposal.summary, /```cosmoot-review/);
  assert.ok(Buffer.byteLength(f.proposal.summary) < 2500);
  assert.ok([...f.draft.values.summary].length <= 300);
  assert.equal((await readProposalReview(f.draft.values)).hash, f.frozen.hash);
  assert.equal((await approvedRule(f.proposal, now, f.source)).hash, f.frozen.value.policyHash);
  const current = await currentApprovedRules({ endpoints, now, fetcher: f.fetcher });
  assert.deepEqual(current.current.rule, f.frozen.value.rule);
  const displayed = await readReferencedRuleProposal(f.proposal, {
    endpoints,
    now,
    fetcher: f.fetcher
  });
  assert.equal(canonical(displayed.value), canonical(f.frozen.value));
  assert.equal(displayed.proposalSummary, f.draft.values.summary);
  await assert.rejects(approvedRule(f.proposal, now), /on-chain review/);
});

test('changing any referenced identity, contents, link or native payload fails verification', async () => {
  const f = await fixture();
  for (const key of [
    'reviewId',
    'revision',
    'contentHash',
    'policyHash',
    'reviewHash',
    'contract',
    'chainId',
    'schema'
  ]) {
    const ref = parseRuleReference(f.proposal);
    const changed = {
      ...ref,
      [key]:
        key === 'schema'
          ? 2
          : key.endsWith('Hash')
            ? '0'.repeat(64)
            : key === 'reviewId'
              ? '18'
              : key === 'revision'
                ? '102'
                : 'different'
    };
    const p = {
      ...f.proposal,
      summary: f.proposal.summary.replace(JSON.stringify(ref), JSON.stringify(changed))
    };
    await assert.rejects(approvedRule(p, now, f.source), undefined, key);
  }
  for (const change of [
    { summary: f.proposal.summary.replace('Establish', 'Overrule') },
    { summary: f.proposal.summary.replace('https://cosmoot.com/', 'https://other.example/') },
    { summary: f.proposal.summary + '\nUnreviewed exception.' },
    { metadata: f.proposal.metadata + '0' },
    { title: f.proposal.title + ' copied' },
    { messages: [{}] },
    { expedited: true },
    { failed_reason: 'failed' }
  ])
    await assert.rejects(approvedRule({ ...f.proposal, ...change }, now, f.source));
  const original = f.revision.body;
  f.revision.body += ' changed';
  await assert.rejects(approvedRule(f.proposal, now, f.source), /hash/);
  f.revision.body = original;
  f.record.finalized_version = null;
  await assert.rejects(approvedRule(f.proposal, now, f.source), /unavailable/);
});

test('reference readers reject missing evidence and source disagreement without falling back to an older rule', async () => {
  const f = await fixture();
  await assert.rejects(
    currentApprovedRules({
      endpoints,
      now,
      fetcher: async (url) => {
        if (url.includes('two.example') && url.includes('/smart/')) throw Error('Unavailable');
        return f.fetcher(url);
      }
    }),
    /unavailable/
  );
  await assert.rejects(
    readReferencedRuleProposal(f.proposal, {
      endpoints,
      now,
      fetcher: async (url) => {
        const response = await f.fetcher(url),
          value = await response.json();
        if (url.includes('two.example') && value.proposal) value.proposal.metadata += 'different';
        return new Response(JSON.stringify(value), { headers: response.headers });
      }
    }),
    /differs/
  );
  const inline = await frozenRuleProposal(f.frozen);
  const older = {
    ...f.proposal,
    id: '950',
    summary: inline.values.summary + '\n\n' + inline.values.body,
    voting_end_time: new Date(now - 10000).toISOString()
  };
  await assert.rejects(
    currentApprovedRules({
      endpoints,
      now,
      fetcher: async (url) => {
        if (url.includes('/smart/')) throw Error('Missing review');
        const r = await f.fetcher(url),
          v = await r.json();
        if (v.proposals) v.proposals.unshift(older);
        return new Response(JSON.stringify(v), { headers: r.headers });
      }
    }),
    /unavailable/
  );
});

test('a workshop withdrawal blocks new submission but cannot revoke a stored native rule decision', async () => {
  const f = await fixture();
  f.record.withdrawn = true;
  await assert.rejects(finalizedReview(f.record, f.revision, 'juno-1'), /Finalize/);
  assert.equal((await approvedRule(f.proposal, now, f.source)).hash, f.frozen.value.policyHash);
  for (const status of [
    'PROPOSAL_STATUS_VOTING_PERIOD',
    'PROPOSAL_STATUS_REJECTED',
    'PROPOSAL_STATUS_FAILED'
  ])
    assert.equal(await approvedRule({ ...f.proposal, status }, now, f.source), null);
});

test('pinned review links bind chain, contract, ID, finalized revision and actual content hash', async () => {
  const f = await fixture(),
    ref = parseRuleReference(f.proposal);
  const params = new URL(ruleReviewUrl(ref)).searchParams;
  assertPinnedReview(params, f.record, f.revision, 'juno-1', ref.contract, f.final.hash);
  for (const key of ['review', 'reviewChain', 'reviewContract', 'reviewRevision', 'reviewHash']) {
    const p = new URLSearchParams(params);
    p.set(key, 'wrong');
    assert.throws(() =>
      assertPinnedReview(p, f.record, f.revision, 'juno-1', ref.contract, f.final.hash)
    );
  }
  assert.throws(() =>
    assertPinnedReview(params, f.record, f.revision, 'juno-1', ref.contract, '0'.repeat(64))
  );
});

test('review character limits are independent of native text bytes and cannot be bypassed', async () => {
  const f = await fixture();
  const values = { ...f.draft.values };
  values.body += 'é'.repeat(10000 - [...values.body].length);
  validateProposalContent(values, { native: true });
  assert.ok(Buffer.byteLength(values.summary + values.body) > 10000);
  const record = {
    ...f.record,
    finalized_hash: createHash('sha256').update(JSON.stringify(values)).digest('hex')
  };
  const final = await finalizedReview(record, { ...f.revision, ...values }, 'juno-1');
  assert.ok(Buffer.byteLength(final.content.summary) < 2500);
  assert.throws(
    () => validateProposalContent({ ...values, body: values.body + 'a' }, { native: true }),
    /BODY/
  );
  assert.throws(
    () => validateProposalContent({ ...values, summary: 'x'.repeat(301) }, { native: true }),
    /SUMMARY/
  );
  assert.throws(
    () => validateProposalContent({ ...values, actions_json: '[{}]' }, { native: true }),
    /no execution/
  );
  assert.throws(() => proposalContent('RULE_APPROVAL', values), /finalized/);
});

test('explicitly reformatting a local draft preserves its exact rules and frozen evidence; legacy remains supported', async () => {
  const f = await fixture(),
    old = await frozenRuleProposal(f.frozen);
  const restored = await readProposalReview(old.values);
  const next = await frozenRuleProposal(restored, { referenced: true });
  assert.equal((await readProposalReview(next.values)).hash, restored.hash);
  const prior = await finalizedReview(
    {
      ...f.record,
      finalized_hash: createHash('sha256').update(JSON.stringify(old.values)).digest('hex')
    },
    { ...f.revision, ...old.values },
    'juno-1'
  );
  assert.equal(prior.content.summary, old.values.summary + '\n\n' + old.values.body);
  assert.equal(
    (await approvedRule({ ...f.proposal, ...prior.content }, now)).hash,
    f.frozen.value.policyHash
  );
});

test('amendment summaries state exact changed thresholds and points instead of repeating initial-adoption copy', async () => {
  const f = await fixture(),
    input = f.input;
  input.parent = {
    rule: structuredClone(input.rule),
    proposalId: '901',
    votingEndedAt: new Date(now - 20000).toISOString(),
    hash: await fingerprint(input.rule)
  };
  input.rule.commissionMaxBps = 800;
  input.rule.minParticipationBps = 9800;
  const review = await buildRuleReview(input),
    result = await frozenRuleProposal(review, { referenced: true });
  assert.match(result.values.summary, /10% → 8%/);
  assert.match(result.values.summary, /97.5% → 98%/);
  assert.doesNotMatch(result.values.summary, /initial rules/);
  input.rule = structuredClone(input.parent.rule);
  input.rule.points.base = 750;
  const points = await frozenRuleProposal(await buildRuleReview(input), { referenced: true });
  assert.match(points.values.summary, /900\/100 → 750\/250/);
  assert.ok([...points.values.summary].length <= 300);
});
