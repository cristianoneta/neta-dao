import { snapshot, upgradeEvidence, withVotingPowerCap } from './juno-delegation-core.mjs';
import { readProposalReview, buildRuleReview, parentMatches } from './juno-delegation-review.mjs';
import { frozenRuleProposal } from './planner-proposal-draft.mjs';
import { currentApprovedRules } from './juno-approved-rules.mjs';
import { assertReviewLimits } from './juno-proposal-limits.mjs';

// Prepare new content only. Publication remains the existing add_revision wallet action.
export async function recalculateRuleCap(
  values,
  capBps,
  { fetcher = fetch, approvals = currentApprovedRules, now = Date.now() } = {}
) {
  const original = await readProposalReview(values);
  if (!original || original.value.rule.schema < 9)
    throw Error('Open a points-based rule discussion before recalculating its cap.');
  const rule = withVotingPowerCap(original.value.rule, capBps);
  const read = async (path) => {
    const response = await fetcher(path, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error(`Programme data unavailable (${response.status}).`);
    const text = await response.text();
    if (text.length > 4 * 1024 * 1024) throw Error('Programme data exceeds the review limit.');
    return JSON.parse(text);
  };
  const [source, history, readiness, approved] = await Promise.all([
    read('/data/daos/juno-delegation-planner.json'),
    read('/data/validator-upgrades/juno-v31.json'),
    read('/data/validator-upgrades/juno-v31-readiness.json'),
    approvals()
  ]);
  const data = snapshot(source);
  if (
    [data.blockTime, data.collectedAt].some(
      (time) => now - Date.parse(time) > 3600000 || Date.parse(time) > now + 300000
    ) ||
    data.height < original.value.snapshot.height
  )
    throw Error('Fresh programme data is required. The existing review has not changed.');
  if (!parentMatches(original.value.parent, approved.current))
    throw Error('The approved rules changed. Start from the current approval in the planner.');
  const review = await buildRuleReview({
    rule,
    parent: original.value.parent,
    snapshot: data,
    evidence: upgradeEvidence(history, readiness),
    activeHistory: data.activeSetHistory ?? null,
    budgetRaw: original.value.budgetRaw,
    rationale: original.value.rationale,
    createdAt: new Date(now).toISOString()
  });
  if (review.value.proposed.status !== 'calculated')
    throw Error(
      `Allocation comparison unavailable: ${review.value.proposed.reason}. The existing review has not changed.`
    );
  const draft = await frozenRuleProposal(review, { referenced: true });
  // Keep the author's explanation and proposal identity; change details belong in the revision log.
  draft.values.title = values.title;
  draft.values.summary = values.summary;
  assertReviewLimits(draft.values);
  return {
    values: draft.values,
    review,
    changeNote: `Set voting-power cap to ${capBps / 100}%; recalculate validator allocations using collected data at block ${data.height}. Other criteria and the comparison budget are unchanged. Rules only; no funds move.`
  };
}
