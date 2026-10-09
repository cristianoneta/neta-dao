import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { claimProposal } from '../planner-proposal-draft.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';
import {
  finalizedReview,
  reviewValues,
  matchesReview,
  fundingTerms,
  validateContribution,
  fundingProof,
  verifyReview,
  findReviewSubmission,
  REVIEW_CONTRACT
} from '../juno-community-governance.mjs';

const params = {
  min_deposit: [{ denom: 'ujuno', amount: '5000000000' }],
  min_initial_deposit_ratio: '0.2',
  min_deposit_ratio: '0.01',
  burn_vote_veto: true,
  burn_vote_quorum: false,
  burn_proposal_deposit_prevote: false
};
function reviewed() {
  const values = claimProposal(fixture()).values;
  const revision = { ...values, version: 3, proposal_id: 17 };
  const proposal = {
    id: 17,
    author: 'author-wallet',
    latest_version: 3,
    finalized_version: 3,
    finalized_hash: createHash('sha256').update(JSON.stringify(values)).digest('hex'),
    withdrawn: false
  };
  return { proposal, revision };
}
function chainProposal() {
  return {
    id: '900',
    status: 'PROPOSAL_STATUS_DEPOSIT_PERIOD',
    title: 'Funding test',
    summary: 'Summary',
    messages: [],
    metadata: '',
    expedited: false,
    total_deposit: [{ denom: 'ujuno', amount: '1000000000' }],
    deposit_end_time: new Date(Date.now() + 86400000).toISOString()
  };
}
const sources = ['https://one.example', 'https://two.example'];
test('only immutable finalized contents can cross from community review to mainnet', async () => {
  const { proposal, revision } = reviewed();
  const result = await finalizedReview(proposal, revision);
  assert.equal(result.author, 'author-wallet');
  assert.equal(result.kind, 'CLAIM_REWARDS');
  assert.match(result.content.metadata, /cosmoot:review:uni-7:/);
  assert.equal(result.content.summary, revision.summary + '\n\n' + revision.body);
  for (const edit of [
    (p) => (p.withdrawn = true),
    (p) => (p.finalized_version = null),
    (p) => p.latest_version++,
    (p) => (p.finalized_hash = '0'.repeat(64))
  ]) {
    const p = structuredClone(proposal);
    edit(p);
    await assert.rejects(finalizedReview(p, revision));
  }
  for (const field of ['title', 'summary', 'body', 'actions_json']) {
    await assert.rejects(
      finalizedReview(proposal, { ...revision, [field]: revision[field] + ' ' }),
      /hash/
    );
  }
  await assert.rejects(finalizedReview(proposal, { ...revision, proposal_id: 18 }));
  assert.throws(() => reviewValues({ title: 'missing content' }));
});
test('a copied review marker cannot substitute different executable content', async () => {
  const { proposal, revision } = reviewed(),
    { content } = await finalizedReview(proposal, revision);
  const native = {
    ...content,
    messages: content.messages.map((m) => ({
      ...m,
      msg: Buffer.from(JSON.stringify(m.msg)).toString('base64')
    }))
  };
  assert.equal(matchesReview(native, content), true);
  for (const field of ['title', 'summary', 'metadata'])
    assert.equal(matchesReview({ ...native, [field]: 'changed' }, content), false);
  assert.equal(matchesReview({ ...native, messages: [] }, content), false);
  assert.equal(matchesReview({ ...native, expedited: true }, content), false);
});
test('funding allows partial or remaining contributions and respects minimum, deadline and status', () => {
  const p = chainProposal(),
    terms = fundingTerms(p, params);
  assert.equal(terms.minimum, '50000000');
  assert.equal(terms.remaining, '4000000000');
  assert.equal(validateContribution('50000000', terms), '50000000');
  assert.equal(validateContribution('4000000000', terms), '4000000000');
  for (const amount of ['0', '-1', '49999999', '4000000001', '1.5'])
    assert.throws(() => validateContribution(amount, terms));
  for (const status of [
    'PROPOSAL_STATUS_VOTING_PERIOD',
    'PROPOSAL_STATUS_PASSED',
    'PROPOSAL_STATUS_REJECTED'
  ])
    assert.throws(
      () => validateContribution('50000000', fundingTerms({ ...p, status }, params)),
      /no longer/
    );
  assert.equal(fundingTerms(p, params, Date.parse(p.deposit_end_time)).open, false);
  assert.equal(
    fundingTerms({ ...p, total_deposit: [{ denom: 'ujuno', amount: '5000000000' }] }, params).open,
    false
  );
  const almost = fundingTerms(
    { ...p, total_deposit: [{ denom: 'ujuno', amount: '4990000000' }] },
    params
  );
  assert.equal(almost.remaining, '10000000');
  assert.equal(validateContribution('50000000', almost), '50000000');
  assert.throws(() => fundingTerms(p, { ...params, min_deposit_ratio: undefined }));
});
test('funding proof rejects mismatched proposal identity, stale chain, incomplete sources and changes in funded amount', async () => {
  const p = chainProposal();
  let failure = '';
  const fetcher = async (url) => {
    const second = url.includes('two.example');
    let data = url.includes('/latest')
      ? {
          block: {
            header: {
              chain_id: failure === 'chain' ? 'uni-7' : 'juno-1',
              height: '42',
              time: new Date(Date.now() - (failure === 'stale' ? 180000 : 0)).toISOString()
            }
          }
        }
      : url.includes('/params/')
        ? { params }
        : url.includes('/spendable_')
          ? { balance: { denom: 'ujuno', amount: second ? '6000000000' : '7000000000' } }
          : {
              proposal: {
                ...p,
                ...(second && failure === 'identity' ? { title: 'Different proposal' } : {}),
                ...(second && failure === 'funding'
                  ? { total_deposit: [{ denom: 'ujuno', amount: '2000000000' }] }
                  : {})
              }
            };
    return new Response(JSON.stringify(data), {
      status: failure === 'source' && second ? 503 : 200
    });
  };
  assert.equal((await fundingProof(sources, '900', 'wallet', { fetcher })).balance, '6000000000');
  for (failure of ['chain', 'stale', 'source', 'identity', 'funding'])
    await assert.rejects(fundingProof(sources, '900', 'wallet', { fetcher }));
  failure = '';
  await assert.rejects(fundingProof([sources[0], sources[0] + '/'], '900', null, { fetcher }));
});
test('review recheck binds a final revision from two UNI-7 sources and paginated mainnet duplicate detection', async () => {
  const { proposal, revision } = reviewed(),
    expected = await finalizedReview(proposal, revision);
  let tamper = false;
  const fetcher = async (url) => {
    let body;
    if (url.includes('/latest'))
      body = {
        block: { header: { chain_id: 'uni-7', height: '88', time: new Date().toISOString() } }
      };
    else {
      assert.ok(url.includes(REVIEW_CONTRACT));
      const q = JSON.parse(Buffer.from(decodeURIComponent(url.split('/smart/')[1]), 'base64'));
      if (q.revisions) {
        assert.equal(q.revisions.start_after, 2);
        body = { data: [{ ...revision, ...(tamper ? { body: 'Tampered' } : {}) }] };
      } else body = { data: proposal };
    }
    return new Response(JSON.stringify(body));
  };
  assert.equal((await verifyReview(sources, expected, { fetcher })).hash, expected.hash);
  tamper = true;
  await assert.rejects(verifyReview(sources, expected, { fetcher }));
  let pages = 0;
  const mainnet = async (url) => {
    if (url.includes('/latest'))
      return new Response(
        JSON.stringify({
          block: { header: { chain_id: 'juno-1', height: '99', time: new Date().toISOString() } }
        })
      );
    pages++;
    return new Response(
      JSON.stringify(
        url.includes('pagination.key=')
          ? { proposals: [{ ...expected.content, id: '901' }], pagination: {} }
          : {
              proposals: [{ ...expected.content, title: 'Spoofed', id: '900' }],
              pagination: { next_key: 'next' }
            }
      )
    );
  };
  assert.deepEqual(await findReviewSubmission(sources, expected.content, { fetcher: mainnet }), [
    '901'
  ]);
  assert.equal(pages, 4);
});
