// Isolated Juno only: caller supplies the synthetic signer and local REST reads.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildRuleReview } from '../juno-delegation-review.mjs';
import { reviewSizeInput } from '../tests/fixtures/delegation-review-size.mjs';
import {
  attachedRuleReview,
  resolveReviewBody,
  reviewChunkReader,
  pendingReviewChunks
} from '../juno-review-attachments.mjs';
import { finalizedReview } from '../juno-community-governance.mjs';
import { approvedRule } from '../juno-approved-rules.mjs';
export async function checkReviewAttachmentMigration({
  tx,
  workshopTx,
  queryReview,
  reviewContract,
  get,
  runProposal,
  wasm
}) {
  const before = await Promise.all(
    [1, 2, 3].map(async (proposal_id) => ({
      proposal: await queryReview({ proposal: { proposal_id } }),
      revisions: await queryReview({ revisions: { proposal_id, start_after: null, limit: 100 } })
    }))
  );
  const config = await queryReview({ config: {} });
  const contractBefore = await get(`/cosmwasm/wasm/v1/contract/${reviewContract}`);
  const store = await tx('wasm', 'store', wasm);
  assert.equal(store.code, 0, store.raw_log);
  const codeId = store.events
    .find((e) => e.type === 'store_code')
    .attributes.find((a) => a.key === 'code_id').value;
  const info = await get(`/cosmwasm/wasm/v1/code/${codeId}`);
  const digest = createHash('sha256').update(readFileSync(wasm)).digest('hex');
  assert.equal(info.code_info.data_hash.toLowerCase(), digest);
  const migrated = await tx('wasm', 'migrate', reviewContract, codeId, '{}');
  assert.equal(migrated.code, 0, migrated.raw_log);
  assert.deepEqual(await queryReview({ config: {} }), config);
  const contractAfter = await get(`/cosmwasm/wasm/v1/contract/${reviewContract}`);
  assert.equal(contractAfter.contract_info.admin, contractBefore.contract_info.admin);
  for (const old of before) {
    assert.deepEqual(
      await queryReview({ proposal: { proposal_id: old.proposal.id } }),
      old.proposal
    );
    assert.deepEqual(
      await queryReview({
        revisions: { proposal_id: old.proposal.id, start_after: null, limit: 100 }
      }),
      old.revisions
    );
  }
  // More validators/evidence than one workshop text field can carry.
  const review = await buildRuleReview(
    reviewSizeInput({ count: 250, allHeld: true, points: true })
  );
  const packet = await attachedRuleReview(review);
  const complete = await resolveReviewBody(packet.values, async (i) => packet.chunks[i]);
  assert.ok([...complete.body].length > 10000);
  const published = await workshopTx({ publish_proposal: { content: packet.values } });
  assert.equal(published.code, 0, published.raw_log);
  const id = Number(
    published.events.find((e) => e.type === 'wasm').attributes.find((a) => a.key === 'proposal_id')
      .value
  );
  const finalize = () => workshopTx({ finalize: { proposal_id: id, version: 1 } });
  assert.notEqual((await finalize()).code, 0, 'Incomplete evidence cannot be finalized');
  const capabilities = await queryReview({ attachment_capabilities: {} });
  let status = await queryReview({ review_attachment: { proposal_id: id, version: 1 } });
  const first = pendingReviewChunks(packet, status, capabilities, {
    proposalId: id,
    version: 1
  })[0];
  const uploaded = await workshopTx(first);
  assert.equal(uploaded.code, 0, uploaded.raw_log);
  assert.equal((await workshopTx(first)).code, 0, 'Retry of a lost receipt is idempotent');
  status = await queryReview({ review_attachment: { proposal_id: id, version: 1 } });
  assert.deepEqual(status.uploaded, [0]);
  for (const message of pendingReviewChunks(packet, status, capabilities, {
    proposalId: id,
    version: 1
  }).reverse()) {
    const receipt = await workshopTx(message);
    assert.equal(receipt.code, 0, receipt.raw_log);
  }
  const finalReceipt = await finalize();
  assert.equal(finalReceipt.code, 0, finalReceipt.raw_log);
  const record = await queryReview({ proposal: { proposal_id: id } });
  const [revision] = await queryReview({
    revisions: { proposal_id: id, start_after: null, limit: 1 }
  });
  const final = await finalizedReview(record, revision, 'juno-1', {
    readChunk: reviewChunkReader(queryReview, id, 1)
  });
  assert.deepEqual(final.resolvedValues, complete);
  assert.notEqual((await workshopTx(first)).code, 0, 'Finalized data cannot be written');
  const vote = await runProposal('attached-rule-review', [], final.content);
  assert.equal(vote.status, 'PROPOSAL_STATUS_PASSED', vote.failed_reason);
  assert.equal((await approvedRule(vote, Date.now(), { get })).hash, review.value.policyHash);
  return {
    sourceVersion: '0.3.1',
    targetVersion: '0.4.0',
    wasmSha256: digest,
    oldRecordsPreserved: true,
    adminPreserved: true,
    chunks: packet.chunks.length,
    bodyBytes: packet.manifest.bytes,
    finalizeGas: finalReceipt.gas_used,
    nativeRuleRecognition: true
  };
}
