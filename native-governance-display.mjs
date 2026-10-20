import { finalizedReview, matchesReview, reader } from './juno-community-governance.mjs';

export function formatVoteAmount(raw, locale) {
  const value = BigInt(raw), formatter = new Intl.NumberFormat(locale);
  if (value === 0n) return '0 JUNO';
  const decimal = formatter.formatToParts(1.1).find(p => p.type === 'decimal').value;
  if (value < 10000n) return `<0${decimal}01 JUNO`;
  const cents = (value + 5000n) / 10000n;
  return `${formatter.format(cents / 100n)}${decimal}${String(cents % 100n).padStart(2, '0')} JUNO`;
}

export function formatWholeVoteAmount(raw, locale) {
  return `${new Intl.NumberFormat(locale).format((BigInt(raw) + 500000n) / 1000000n)} JUNO`;
}

export const nativeStatus = (value) => ({
  PROPOSAL_STATUS_DEPOSIT_PERIOD: 'deposit',
  PROPOSAL_STATUS_VOTING_PERIOD: 'open',
  PROPOSAL_STATUS_PASSED: 'passed',
  PROPOSAL_STATUS_REJECTED: 'rejected',
  PROPOSAL_STATUS_FAILED: 'execution_failed'
})[value] || 'closed';

export function nativeExecutionFailure(proposal) {
  if (proposal?.status !== 'PROPOSAL_STATUS_FAILED') return '';
  return 'Execution failed. Chain-reported reason: ' +
    (typeof proposal.failed_reason === 'string' && proposal.failed_reason.trim()
      ? proposal.failed_reason : 'Unavailable.');
}

export function nativeTally(raw) {
  if (!raw) throw Error('Voting results unavailable.');
  return Object.fromEntries([
    ['yes', 'yes_count'], ['no', 'no_count'],
    ['abstain', 'abstain_count'], ['veto', 'no_with_veto_count']
  ].map(([key, field]) => {
    const amount = raw[field];
    if (typeof amount !== 'string' || !/^\d+$/.test(amount))
      throw Error('Incomplete voting results.');
    return [key, amount];
  }));
}

export function normalizeNativeProposal(p) {
  let votes = null;
  if (!['open', 'deposit'].includes(nativeStatus(p.status))) {
    try { votes = nativeTally(p.final_tally_result); } catch {}
  }
  return { id: Number(p.id), proposal: {
    title: p.title || `Juno proposal #${p.id}`,
    description: p.summary || p.metadata || '', msgs: p.messages || [],
    status: nativeStatus(p.status), votes,
    expiration: p.voting_end_time && Number.isFinite(Date.parse(p.voting_end_time))
      ? { at_time: String(BigInt(Date.parse(p.voting_end_time)) * 1000000n) } : null,
    native: true, raw: p, total_deposit: p.total_deposit || []
  }};
}

// A matching title is never sufficient to merge a review with a chain proposal.
// Preserve ambiguous submissions as separate records rather than picking one.
export async function linkedNativeId(proposal, revision, chainId, nativeRecords) {
  try {
    const final = await finalizedReview(proposal, revision, chainId);
    const matches = nativeRecords.filter(p => matchesReview(p.proposal.raw, final.content));
    return matches.length === 1 ? matches[0].id : null;
  } catch { return null; }
}

// Read-only display snapshot: all queries use one fresh provider and one height.
// This is not a transaction authorization or a two-provider verification proof.
export async function readNativeVoting(endpoints, id, options = {}) {
  if (!/^[1-9]\d{0,19}$/.test(String(id))) throw Error('Invalid proposal ID.');
  const failures = [];
  for (const endpoint of endpoints) {
    try {
      const source = await reader(endpoint, 'juno-1', options);
      const { proposal } = await source.get(`/cosmos/gov/v1/proposals/${id}`);
      if (String(proposal?.id) !== String(id)) throw Error('Proposal identity mismatch.');
      const status = nativeStatus(proposal.status);
      const votes = status === 'open'
        ? nativeTally((await source.get(`/cosmos/gov/v1/proposals/${id}/tally`)).tally)
        : status === 'deposit' ? null : nativeTally(proposal.final_tally_result);
      return { ...normalizeNativeProposal(proposal), votes,
        checkedAt: Date.now(), height: source.height, endpoint };
    } catch (error) { failures.push(error.message); }
  }
  throw Error(`Voting results unavailable. ${failures.join(' · ')}`);
}
