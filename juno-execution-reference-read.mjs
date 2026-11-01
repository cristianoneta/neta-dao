import { parseExecutionReference } from './juno-execution-reference.mjs';
import { finalizedReview, matchesReview, reader, quorum } from './juno-community-governance.mjs';
import { readExecutionReview } from './juno-rebalance-execution.mjs';
import { GOVERNANCE_SOURCES } from './governance-chain-read.mjs';

// Also used before submission: content is verified against its exact finalized
// workshop revision, never an editable local draft or the latest planner state.
export async function readExecutionContent(content, source) {
  const ref = parseExecutionReference(content);
  if (!ref) {
    const split = content.summary.indexOf('\n\n');
    return readExecutionReview({
      title: content.title,
      summary: content.summary.slice(0, split),
      body: content.summary.slice(split + 2),
      actions_json: JSON.stringify(content.messages)
    });
  }
  if (!source?.get) throw Error('Rebalance reference requires verified on-chain review evidence.');
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
    throw Error('Referenced finalized rebalance review is unavailable or changed.');
  const final = await finalizedReview(record, revisions[0], ref.chainId, { readOnly: true });
  const review = await readExecutionReview(final.values);
  if (
    !review ||
    review.hash !== ref.reviewHash ||
    review.value.calculation.policyHash !== ref.policyHash ||
    !matchesReview(content, final.content)
  )
    throw Error('Native proposal differs from its referenced rebalance review.');
  return { ...review, proposalSummary: final.values.summary };
}

export async function readExecutionSources(
  content,
  {
    endpoints = [GOVERNANCE_SOURCES['juno-polkachu'], GOVERNANCE_SOURCES['juno-stavr']],
    requireNative = false,
    ...options
  } = {}
) {
  const good = await quorum(
    endpoints,
    async (endpoint) => {
      const source = await reader(endpoint, 'juno-1', { ...options, requireHeight: true });
      if (requireNative) {
        if (!/^[1-9]\d{0,19}$/.test(String(content.id))) throw Error('Invalid native proposal ID.');
        const actual = (await source.get(`/cosmos/gov/v1/proposals/${content.id}`)).proposal;
        if (String(actual?.id) !== String(content.id) || !matchesReview(actual, content))
          throw Error('Displayed rebalance differs from the chain record.');
      }
      return readExecutionContent(content, source);
    },
    (value) => ({ hash: value?.hash, messages: value?.messages }),
    'Rebalance review evidence'
  );
  if (!good[0]) throw Error('Complete rebalance evidence is required.');
  return good[0];
}
