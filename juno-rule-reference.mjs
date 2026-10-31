import { PROGRAMME } from './juno-delegation-core.mjs';
import { reviewNetwork } from './juno-review-network.mjs';

// Only new, explicitly prepared reviews opt in. Historical finalized bytes keep
// their original native proposal representation.
export const RULE_REVIEW_MARKER = 'Native proposal format: cosmoot-rule-reference-1';
export const RULE_REFERENCE_MARKER = '## Referenced rule review';
export const RULE_TITLE = 'Juno Delegation Programme — allocation rules';
const hash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const positive = (v) =>
  typeof v === 'string' && /^[1-9]\d*$/.test(v) && BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER);
const keys = 'chainId,contentHash,contract,policyHash,reviewHash,reviewId,revision,schema';

export function usesRuleReference(values) {
  return typeof values?.body === 'string' && values.body.includes(RULE_REVIEW_MARKER);
}
export function assertRuleReference(ref) {
  if (
    !ref ||
    Object.keys(ref).sort().join(',') !== keys ||
    ref.schema !== 1 ||
    ref.chainId !== 'juno-1' ||
    ref.contract !== reviewNetwork('juno-1').contract ||
    !positive(ref.reviewId) ||
    !positive(ref.revision) ||
    !hash(ref.contentHash) ||
    !hash(ref.policyHash) ||
    !hash(ref.reviewHash)
  )
    throw Error('Invalid rule review reference.');
  return ref;
}
export function ruleReviewUrl(reference) {
  const ref = assertRuleReference(reference);
  const url = new URL('https://cosmoot.com/');
  for (const [key, value] of Object.entries({
    chain: 'juno',
    dao: 'juno',
    subdao: 'juno-delegation',
    reviewChain: ref.chainId,
    reviewContract: ref.contract,
    review: ref.reviewId,
    reviewRevision: ref.revision,
    reviewHash: ref.contentHash,
    reviewHistory: '1'
  }))
    url.searchParams.set(key, value);
  url.hash = 'governance';
  return url.href;
}
export function referencedRuleContent(values, reference) {
  const ref = assertRuleReference(reference);
  if (
    !usesRuleReference(values) ||
    values.body.split(RULE_REVIEW_MARKER).length !== 2 ||
    !values.body.split('\n').includes(RULE_REVIEW_MARKER) ||
    !values.title?.startsWith(RULE_TITLE) ||
    !values.summary?.trim() ||
    [...values.summary.trim()].length > 300 ||
    !Array.isArray(JSON.parse(values.actions_json)) ||
    JSON.parse(values.actions_json).length
  )
    throw Error('Invalid referenced rule review content.');
  const body =
    `Approve the exact rule revision linked below. Existing delegations remain unchanged. Moving funds requires a separate governance proposal.\n\n` +
    `Rules, changes and frozen allocation comparison:\n${ruleReviewUrl(ref)}\n\n` +
    `Chain: juno-1\nProgramme: ${PROGRAMME}\nRule SHA-256: ${ref.policyHash}\n\n` +
    `The complete review is stored on Juno at the contract, review ID and revision below. Verify its hashes; the website is a viewer of that recorded decision.\n\n` +
    `${RULE_REFERENCE_MARKER}\n\n\`\`\`cosmoot-rule-reference\n${JSON.stringify(ref)}\n\`\`\`\n\nThis proposal was created on cosmoot.com.`;
  const summary = `${values.summary.trim()}\n\n${body}`;
  if (new TextEncoder().encode(summary).length > 10000)
    throw Error('On-chain proposal text exceeds 10,000 bytes.');
  return {
    title: values.title.trim(),
    summary,
    messages: [],
    expedited: false,
    metadata: `cosmoot:review:${ref.chainId}:${ref.contract}:${ref.reviewId}:${ref.contentHash}`
  };
}
export function parseRuleReference(proposal) {
  const text = proposal?.summary;
  if (typeof text !== 'string' || !text.includes(RULE_REFERENCE_MARKER)) return null;
  const matches = [
    ...text.matchAll(/^## Referenced rule review\n\n```cosmoot-rule-reference\n([^\n]+)\n```/gm)
  ];
  if (text.length > 10000 || matches.length !== 1 || text.split(RULE_REFERENCE_MARKER).length !== 2)
    throw Error('Malformed rule review reference.');
  return assertRuleReference(JSON.parse(matches[0][1]));
}

export function assertPinnedReview(params, proposal, revision, chainId, contract, contentHash) {
  if (!params.has('reviewRevision') && !params.has('reviewHash')) return;
  if (
    params.get('review') !== String(proposal.id) ||
    params.get('reviewChain') !== chainId ||
    params.get('reviewContract') !== contract ||
    !positive(params.get('reviewRevision')) ||
    params.get('reviewRevision') !== String(revision.version) ||
    String(proposal.finalized_version) !== String(revision.version) ||
    !hash(params.get('reviewHash')) ||
    params.get('reviewHash') !== contentHash ||
    proposal.finalized_hash !== contentHash
  )
    throw Error('This link does not match the finalized review revision.');
}
