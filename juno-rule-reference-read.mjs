import { parseRuleReference, referencedRuleContent } from './juno-rule-reference.mjs';
import { finalizedReview, matchesReview, reader, quorum } from './juno-community-governance.mjs';
import { readProposalReview } from './juno-delegation-review.mjs';
import { GOVERNANCE_SOURCES } from './governance-chain-read.mjs';

// Called inside each independent, height-pinned governance read. The native
// proposal binds the bytes forever; a later workshop withdrawal cannot revoke it.
export async function resolveRuleReference(proposal, source) {
  const ref = parseRuleReference(proposal);
  if (!ref) return null;
  const query = async (q) =>
    (
      await source.get(
        `/cosmwasm/wasm/v1/contract/${ref.contract}/smart/${encodeURIComponent(btoa(JSON.stringify(q)))}`
      )
    ).data;
  const [record, revisions] = await Promise.all([
    query({ proposal: { proposal_id: Number(ref.reviewId) } }),
    query({
      revisions: {
        proposal_id: Number(ref.reviewId),
        start_after: Number(ref.revision) > 1 ? Number(ref.revision) - 1 : null,
        limit: 1
      }
    })
  ]);
  if (
    String(record?.id) !== ref.reviewId ||
    String(record?.finalized_version) !== ref.revision ||
    record?.finalized_hash !== ref.contentHash ||
    !Array.isArray(revisions) ||
    revisions.length !== 1
  )
    throw Error('Referenced finalized review is unavailable or differs from the proposal.');
  const final = await finalizedReview(record, revisions[0], ref.chainId, { readOnly: true });
  const frozen = await readProposalReview(final.values);
  if (
    !frozen ||
    frozen.hash !== ref.reviewHash ||
    frozen.value.policyHash !== ref.policyHash ||
    !matchesReview(proposal, final.content) ||
    !matchesReview(proposal, referencedRuleContent(final.values, ref))
  )
    throw Error('Native proposal differs from its referenced rule review.');
  return { reference: ref, frozen };
}

export async function readReferencedRuleProposal(
  proposal,
  {
    endpoints = [GOVERNANCE_SOURCES['juno-polkachu'], GOVERNANCE_SOURCES['juno-stavr']],
    ...options
  } = {}
) {
  if (!parseRuleReference(proposal)) return null;
  const good = await quorum(
    endpoints,
    async (endpoint) => {
      const source = await reader(endpoint, 'juno-1', options);
      // The displayed record must itself be confirmed; a pasted reference is not
      // an on-chain proposal. Do not infer this from its status or title.
      if (!/^[1-9]\d{0,19}$/.test(String(proposal.id))) throw Error('Invalid native proposal ID.');
      const actual = (await source.get(`/cosmos/gov/v1/proposals/${proposal.id}`)).proposal;
      if (String(actual?.id) !== String(proposal.id) || !matchesReview(actual, proposal))
        throw Error('Displayed rule proposal differs from the chain record.');
      return resolveRuleReference(actual, source);
    },
    (value) => ({ reference: value.reference, hash: value.frozen.hash }),
    'Rule review evidence'
  );
  return good[0].frozen;
}
