// Prepared for workshop 0.4.0. Production activation requires the reviewed
// migration and code-checksum allowlist update; never infer support from a URL.
export const ATTACHMENT_PREFIX = 'cosmoot-review-attachment-1\n';
export const ATTACHMENT_CHUNK_BYTES = 8192;
export const ATTACHMENT_MAX_BYTES = 750000;
const utf8 = new TextEncoder();
const hash = /^[a-f0-9]{64}$/;
const sha256 = async (bytes) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
export function attachmentManifest(body) {
  if (typeof body !== 'string' || !body.startsWith(ATTACHMENT_PREFIX)) return null;
  if (body.length > 10000) throw Error('Invalid review attachment manifest.');
  const json = body.slice(ATTACHMENT_PREFIX.length),
    m = JSON.parse(json);
  if (
    m?.schema !== 1 ||
    !hash.test(m.sha256) ||
    !Number.isSafeInteger(m.bytes) ||
    m.bytes < 1 ||
    m.bytes > ATTACHMENT_MAX_BYTES ||
    !Array.isArray(m.chunks) ||
    m.chunks.length !== Math.ceil(m.bytes / ATTACHMENT_CHUNK_BYTES) ||
    m.chunks.some((h) => typeof h !== 'string' || !hash.test(h)) ||
    JSON.stringify({ schema: m.schema, sha256: m.sha256, bytes: m.bytes, chunks: m.chunks }) !==
      json
  )
    throw Error('Invalid review attachment manifest.');
  return m;
}
export async function attachReviewBody(values) {
  if (typeof values?.body !== 'string' || attachmentManifest(values.body))
    throw Error('Expected a complete inline review body.');
  const bytes = utf8.encode(values.body);
  if (!bytes.length || bytes.length > ATTACHMENT_MAX_BYTES)
    throw Error('Review attachment exceeds 750,000 bytes. No evidence was omitted.');
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += ATTACHMENT_CHUNK_BYTES)
    chunks.push(bytes.slice(offset, offset + ATTACHMENT_CHUNK_BYTES));
  const manifest = {
    schema: 1,
    sha256: await sha256(bytes),
    bytes: bytes.length,
    chunks: await Promise.all(chunks.map(sha256))
  };
  return {
    values: { ...values, body: ATTACHMENT_PREFIX + JSON.stringify(manifest) },
    manifest,
    chunks
  };
}
export async function resolveReviewBody(values, readChunk) {
  const m = attachmentManifest(values.body);
  if (!m) return { ...values };
  if (typeof readChunk !== 'function')
    throw Error('The complete on-chain attachment must be loaded before this review can be used.');
  const bytes = new Uint8Array(m.bytes);
  // Sequential bounded reads avoid a large concurrent request fanout.
  for (let i = 0; i < m.chunks.length; i++) {
    const chunk = await readChunk(i);
    if (
      !(chunk instanceof Uint8Array) ||
      chunk.length !== Math.min(ATTACHMENT_CHUNK_BYTES, m.bytes - i * ATTACHMENT_CHUNK_BYTES) ||
      (await sha256(chunk)) !== m.chunks[i]
    )
      throw Error(
        `Review attachment chunk ${i + 1} is missing or does not match its immutable manifest.`
      );
    bytes.set(chunk, i * ATTACHMENT_CHUNK_BYTES);
  }
  if ((await sha256(bytes)) !== m.sha256) throw Error('Review attachment fingerprint mismatch.');
  const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (attachmentManifest(body)) throw Error('Nested review attachments are not supported.');
  return { ...values, body };
}
export function pendingReviewChunks(packet, status, capabilities, { proposalId, version }) {
  if (
    capabilities?.schema !== 1 ||
    capabilities.chunk_bytes !== ATTACHMENT_CHUNK_BYTES ||
    capabilities.max_bytes !== ATTACHMENT_MAX_BYTES
  )
    throw Error('This verified review contract does not support the required attachment format.');
  const manifest = attachmentManifest(packet.values.body);
  if (
    !manifest ||
    JSON.stringify(manifest) !== JSON.stringify(status?.manifest) ||
    !Array.isArray(status.uploaded) ||
    new Set(status.uploaded).size !== status.uploaded.length ||
    status.uploaded.some((i) => !Number.isInteger(i) || i < 0 || i >= manifest.chunks.length) ||
    !Number.isSafeInteger(proposalId) ||
    proposalId < 1 ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    packet.chunks.length !== manifest.chunks.length
  )
    throw Error('The on-chain revision does not match this attachment upload.');
  return packet.chunks.flatMap((data, index) =>
    status.uploaded.includes(index)
      ? []
      : [
          {
            upload_review_chunk: {
              proposal_id: proposalId,
              version,
              index,
              data: btoa(Array.from(data, (b) => String.fromCharCode(b)).join(''))
            }
          }
        ]
  );
}

export function reviewChunkReader(query, proposalId, version) {
  return async (index) => {
    if (
      !Number.isSafeInteger(proposalId) ||
      proposalId < 1 ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= Math.ceil(ATTACHMENT_MAX_BYTES / ATTACHMENT_CHUNK_BYTES)
    )
      throw Error('Invalid review attachment location.');
    const encoded = await query({ review_chunk: { proposal_id: proposalId, version, index } });
    if (
      typeof encoded !== 'string' ||
      encoded.length > 10924 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    )
      throw Error('Invalid review attachment bytes.');
    return Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  };
}
export async function attachedRuleReview(review) {
  const { verifyRuleReview, encodeRuleReview, FROZEN_POLICY_REFERENCE } = await import(
    './juno-delegation-review.mjs'
  );
  const { RULE_REVIEW_MARKER, RULE_TITLE } = await import('./juno-rule-reference.mjs');
  const { ruleProposalSummary } = await import('./juno-rule-summary.mjs');
  const checked = await verifyRuleReview(review.value);
  if (checked.value.rule.schema < 9) throw Error('New attachments require current rule semantics.');
  const values = {
    title: RULE_TITLE,
    summary: ruleProposalSummary(checked),
    actions_json: '[]',
    body: `Chain: juno-1\nProgramme: ${checked.value.rule.programme}\n\n${RULE_REVIEW_MARKER}\n\n${FROZEN_POLICY_REFERENCE}\n\nRule SHA-256: ${checked.value.policyHash}\n\n${await encodeRuleReview(checked, { compact: true })}\n\nThis proposal was created on cosmoot.com.`
  };
  return attachReviewBody(values);
}
export async function attachedExecutionReview(review) {
  const { executionValues } = await import('./juno-rebalance-execution.mjs');
  return attachReviewBody(await executionValues(review, { referenced: true, reading: true }));
}
