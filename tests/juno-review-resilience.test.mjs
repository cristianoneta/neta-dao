import test from 'node:test';
import assert from 'node:assert/strict';
import { readReviewActions, compactReviewActions } from '../juno-review-actions.mjs';
import { movementPlan, stakingMessages } from '../juno-programme-staking.mjs';
import { fixture } from './fixtures/delegation-planner.mjs';
import { reviewSizeInput } from './fixtures/delegation-review-size.mjs';
import { buildRuleReview, readProposalReview } from '../juno-delegation-review.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import {
  attachReviewBody,
  resolveReviewBody,
  pendingReviewChunks,
  ATTACHMENT_CHUNK_BYTES,
  ATTACHMENT_MAX_BYTES
} from '../juno-review-attachments.mjs';
import {
  reviewSizeReport,
  assertReviewLimits,
  assertNativeText
} from '../juno-proposal-limits.mjs';
const capabilities = {
  schema: 1,
  chunk_bytes: ATTACHMENT_CHUNK_BYTES,
  max_bytes: ATTACHMENT_MAX_BYTES
};

test('compact stored actions reconstruct exact original execution bytes and order', () => {
  const rows = fixture()
    .validators.slice(0, 3)
    .map((v, i) => ({
      address: v.address,
      currentRaw: i ? '0' : '1000000000',
      targetRaw: i ? '600000000' : '0'
    }));
  const messages = stakingMessages(movementPlan(rows).moves),
    compact = compactReviewActions(messages);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(messages).length / 2);
  assert.deepEqual(readReviewActions(JSON.stringify(compact)), messages);
  assert.deepEqual(readReviewActions(JSON.stringify(messages)), messages);
  for (const mutate of [
    (p) => p.push(messages[0]),
    (p) => p[0].addresses.push(p[0].addresses[0]),
    (p) => p[0].moves[0].push('injected'),
    (p) => (p[0].moves[0][1] = '0'),
    (p) => (p[0].moves[0][1] = 999),
    (p) => (p[0].moves[0][3] = '0'),
    (p) => (p[0].extra = true),
    (p) => (p[0].format = 'cosmoot-staking-actions-2')
  ]) {
    const changed = structuredClone(compact);
    mutate(changed);
    assert.throws(() => readReviewActions(JSON.stringify(changed)));
  }
});
test('compact rule storage retains every semantic field and original review hash', async () => {
  const review = await buildRuleReview(reviewSizeInput());
  const draft = await frozenRuleProposal(review, { referenced: true });
  assert.match(draft.values.body, /cosmoot-allocation-review-3\+gzip\+z85/);
  const decoded = await readProposalReview(draft.values);
  assert.equal(decoded.hash, review.hash);
  assert.deepEqual(decoded.value, review.value);
});
test('byte-bounded on-chain attachment restores exact Unicode content and resumes only missing chunks', async () => {
  const values = {
    title: 'Rules',
    summary: 'Rules only',
    body: 'Complete evidence 🪐\n'.repeat(4000),
    actions_json: '[]'
  };
  const packet = await attachReviewBody(values);
  assert.ok(packet.chunks.length > 2);
  assertReviewLimits(packet.values);
  const restored = await resolveReviewBody(packet.values, async (i) => packet.chunks[i]);
  assert.deepEqual(restored, values);
  const pending = pendingReviewChunks(
    packet,
    { manifest: packet.manifest, uploaded: [0, 2] },
    capabilities,
    { proposalId: 4, version: 3 }
  );
  assert.equal(pending.length, packet.chunks.length - 2);
  assert.equal(pending[0].upload_review_chunk.index, 1);
  assert.equal(pending[0].upload_review_chunk.version, 3);
  for (const read of [
    async () => null,
    async (i) => packet.chunks[(i + 1) % packet.chunks.length],
    async (i) => {
      const b = packet.chunks[i].slice();
      b[0] ^= 1;
      return b;
    }
  ])
    await assert.rejects(resolveReviewBody(packet.values, read), /chunk/);
  assert.throws(() =>
    pendingReviewChunks(packet, { manifest: packet.manifest, uploaded: [0, 0] }, capabilities, {
      proposalId: 4,
      version: 3
    })
  );
  assert.throws(() =>
    pendingReviewChunks(packet, { manifest: packet.manifest, uploaded: [] }, null, {
      proposalId: 4,
      version: 3
    })
  );
  const nested = await attachReviewBody({ ...values, body: 'not nested' });
  await assert.rejects(attachReviewBody(nested.values));
  await assert.rejects(attachReviewBody({ ...values, body: 'x'.repeat(ATTACHMENT_MAX_BYTES + 1) }));
});
test('review characters, native text bytes and near-limit warnings are distinct', () => {
  const v = { title: 'Rules', summary: 'Summary', body: '🪐'.repeat(9000), actions_json: '[]' };
  assertReviewLimits(v);
  assert.throws(() => assertNativeText(v.body));
  assert.equal(reviewSizeReport(v).state, 'near-limit');
  assert.equal(reviewSizeReport({ ...v, body: 'x'.repeat(10001) }).state, 'blocked');
});

test('an attached oversized rule review binds its full content and native approval reference', async () => {
  const { attachedRuleReview, reviewChunkReader } = await import('../juno-review-attachments.mjs');
  const { finalizedReview, reviewValues } = await import('../juno-community-governance.mjs');
  const { createHash } = await import('node:crypto');
  const review = await buildRuleReview(
    reviewSizeInput({ count: 250, allHeld: true, points: true })
  );
  const packet = await attachedRuleReview(review);
  const full = await resolveReviewBody(packet.values, async (i) => packet.chunks[i]);
  assert.ok(full.body.length > 10000);
  assert.equal((await readProposalReview(full)).hash, review.hash);
  const contentHash = createHash('sha256')
    .update(JSON.stringify(reviewValues(packet.values)))
    .digest('hex');
  const record = { id: 4, latest_version: 1, finalized_version: 1, finalized_hash: contentHash };
  const revision = { ...packet.values, proposal_id: 4, version: 1 };
  const final = await finalizedReview(record, revision, 'juno-1', {
    readChunk: reviewChunkReader(
      async (q) => Buffer.from(packet.chunks[q.review_chunk.index]).toString('base64'),
      4,
      1
    )
  });
  assert.equal(final.hash, contentHash);
  assert.deepEqual(final.content.messages, []);
  assert.ok(Buffer.byteLength(final.content.summary) < 2000);
  assert.deepEqual(final.resolvedValues, full);
  await assert.rejects(finalizedReview(record, revision, 'juno-1'), /attachment/);
  await assert.rejects(
    finalizedReview({ ...record, finalized_hash: '0'.repeat(64) }, revision, 'juno-1', {
      readChunk: async (i) => packet.chunks[i]
    }),
    /hash/
  );
});

test('180-day history with 120 proposals preserves every relevant vote and fixed obligation', async () => {
  const { withGovernance } = await import('./fixtures/delegation-planner.mjs');
  const { attachedRuleReview } = await import('../juno-review-attachments.mjs');
  const input = reviewSizeInput({ points: true }),
    s = input.snapshot;
  withGovernance(s, 180);
  const at = (days) => ({
    height: s.height - Math.round(days * 100),
    time: new Date(Date.parse(s.blockTime) - days * 86400000).toISOString()
  });
  s.governanceHistory.proposals = Array.from({ length: 120 }, (_, i) => ({
    id: String(1000 + i),
    start: at(i * 1.4 + 3),
    end: { ...at(i * 1.4 + 2), result: i % 3 ? 'proposal_passed' : 'proposal_rejected' },
    votes: s.validators
      .filter((v) => v.active)
      .filter((v, j) => (i + j) % 7 !== 0)
      .map((v, j) => ({
        voter: v.address,
        height: at(i * 1.4 + 2).height - 1,
        scope: `tx:${j}`,
        index: 0,
        option: i % 2 ? 'VOTE_OPTION_YES:1' : 'VOTE_OPTION_ABSTAIN:1'
      }))
  }));
  input.rule.fixedAllocations = s.validators.slice(0, 12).map((v) => ({
    chainId: 'juno-1',
    validator: v.address,
    amountRaw: '1000000',
    purpose: 'Maintain independently reviewed public infrastructure',
    documentation: 'https://example.org/obligation',
    startDate: '2026-10-01',
    endDate: '2026-12-31'
  }));
  const { policy } = await import('../juno-delegation-core.mjs');
  input.rule = policy(input.rule);
  const review = await buildRuleReview(input),
    packet = await attachedRuleReview(review);
  const decoded = await readProposalReview(
    await resolveReviewBody(packet.values, async (i) => packet.chunks[i])
  );
  assert.equal(decoded.hash, review.hash);
  assert.deepEqual(decoded.value, review.value);
  assert.equal(decoded.value.rule.fixedAllocations.length, 12);
  const { governanceEvidence } = await import('../juno-governance-points.mjs');
  assert.equal(input.snapshot.governanceHistory.proposals.length, 120);
  assert.equal(
    decoded.value.snapshot.governanceHistory.proposals.length,
    governanceEvidence(input.snapshot).count
  );
  assert.ok(decoded.value.snapshot.governanceHistory.proposals.length > 60);
  assertReviewLimits(packet.values);
});
