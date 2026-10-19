import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { canonical, fingerprint, collectingPolicy } from '../juno-delegation-core.mjs';
import {
  buildRuleReview,
  verifyRuleReview,
  readProposalReview,
  REVIEW_MARKER
} from '../juno-delegation-review.mjs';
import { packReview, unpackReview } from '../juno-review-transport.mjs';
import { frozenRuleProposal } from '../planner-proposal-draft.mjs';
import { reviewSizeInput } from './fixtures/delegation-review-size.mjs';

const bytes = (p) => Buffer.byteLength(p.values.summary + '\n\n' + p.values.body);
const block = (format, value, hash) =>
  `${REVIEW_MARKER}\n\nFormat: cosmoot-allocation-review-${format}+gzip\nReview SHA-256: ${hash}\n\n\`\`\`cosmoot-review\n${gzipSync(canonical(value)).toString('base64')}\n\`\`\``;
const replaceBlock = (p, encoded) => ({
  ...p.values,
  body: p.values.body.slice(0, p.values.body.indexOf(REVIEW_MARKER)) + encoded
});

test('a realistic 37-position portfolio fits with all 46 relevant validators and exact evidence', async () => {
  const input = reviewSizeInput(),
    review = await buildRuleReview(input),
    proposal = await frozenRuleProposal(review);
  assert.equal(review.value.snapshot.validators.length, 46);
  assert.equal(
    review.value.snapshot.validators.filter((v) => BigInt(v.currentRaw) > 0n).length,
    37
  );
  assert.ok(bytes(proposal) <= 10000, String(bytes(proposal)));
  assert.match(proposal.values.body, /cosmoot-allocation-review-2\+gzip/);
  const decoded = await readProposalReview(proposal.values);
  assert.equal(decoded.hash, review.hash);
  assert.equal(canonical(decoded.value), canonical(review.value));
  assert.deepEqual(decoded.value.activeHistory, input.activeHistory);
  assert.deepEqual(JSON.parse(proposal.values.actions_json), []);
});

test('compact text retains long rationale, exclusions and an exact prior policy inside the review', async () => {
  const input = reviewSizeInput();
  input.rationale =
    'Keep every current holding visible and compare both rule versions on the same observations. The participation threshold uses all available history before the rolling ninety-day window. '
      .repeat(6)
      .slice(0, 1000);
  input.rule.exclusions = [
    {
      chainId: 'juno-1',
      validator: input.snapshot.validators[2].address,
      reason: 'Example exclusion for community review; preserved exactly.'
    }
  ];
  const previous = collectingPolicy();
  previous.commissionMaxBps = 800;
  input.parent = {
    proposalId: '901',
    votingEndedAt: '2026-10-01T00:00:00Z',
    rule: previous,
    hash: await fingerprint(previous)
  };
  const review = await buildRuleReview(input),
    proposal = await frozenRuleProposal(review),
    decoded = await readProposalReview(proposal.values);
  assert.ok(bytes(proposal) <= 10000, String(bytes(proposal)));
  assert.equal(canonical(decoded.value), canonical(review.value));
  assert.equal(decoded.value.rationale.length, 1000);
  assert.deepEqual(decoded.value.parent, input.parent);
  assert.deepEqual(decoded.model.changes, review.model.changes);
});

test('the existing gzip format still loads an unchanged released schema-4 review', async () => {
  const { value } = JSON.parse(
    await readFile(new URL('./fixtures/frozen-collecting-review.json', import.meta.url), 'utf8')
  );
  const review = await verifyRuleReview(value),
    proposal = await frozenRuleProposal(review);
  const decoded = await readProposalReview(replaceBlock(proposal, block(1, value, review.hash)));
  assert.equal(decoded.hash, '45f06a50be13d02096b74869286b4ef3ec46f4ae89d3fd71bf4bf0c77cc0b560');
  assert.equal(canonical(decoded.value), canonical(value));
});

test('bad identity references, tuples, substituted counts and extra transport fields cannot become a review', async () => {
  const review = await buildRuleReview(reviewSizeInput()),
    proposal = await frozenRuleProposal(review);
  const packed = packReview(review.value);
  assert.equal(canonical(unpackReview(packed)), canonical(review.value));
  for (const change of [
    (p) => p.addresses.push(p.addresses[0]),
    (p) => (p.value.snapshot.validators[0][1] = -1),
    (p) => (p.value.evidence.records[0][0] = p.addresses.length),
    (p) => p.value.snapshot.validators[0].pop(),
    (p) => (p.value.activeHistory.spans[0].addresses[0] = '0'),
    (p) => p.value.activeHistory.participation.validators[0][2]--,
    (p) => (p.extra = true)
  ]) {
    const bad = structuredClone(packed);
    change(bad);
    await assert.rejects(readProposalReview(replaceBlock(proposal, block(2, bad, review.hash))));
  }
  await assert.rejects(
    readProposalReview(replaceBlock(proposal, block(3, packed, review.hash))),
    /malformed/
  );
});

test('oversize required evidence fails accurately without suggesting that an empty rationale caused it', async () => {
  const review = await buildRuleReview(reviewSizeInput({ count: 250, allHeld: true })),
    before = canonical(review.value);
  await assert.rejects(frozenRuleProposal(review), (error) => {
    assert.match(error.message, /needs [\d,]+ bytes; the proposal limit is 10,000/);
    assert.match(error.message, /required evidence is too large/);
    assert.doesNotMatch(error.message, /Shorten optional/);
    return true;
  });
  assert.equal(canonical(review.value), before);
});
