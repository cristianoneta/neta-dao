import { COMMUNITY_POOL_KIND, assertCommunityPoolSpend } from './juno-community-pool-proposal.mjs';
import { PROGRAMME, policy, snapshot, units } from './juno-delegation-core.mjs';

import { rewardMessages, legacyRewardMessages } from './juno-governance-core.mjs';
import { encodeRuleReview, verifyRuleReview, ruleChanges } from './juno-delegation-review.mjs';
import { withClaimContext } from './claim-numbering.mjs';
import { claimRewardsOverview } from './juno-claim-rewards.mjs';
import { historyCoverageText } from './juno-active-set-history.mjs';

export const PLANNER_DRAFT_PREFIX = 'cosmoot:juno:planner-proposal:';
const identifier = /^[a-f0-9-]{36}$/;
export function validatePlannerDraft(value) {
  const community = value?.kind === COMMUNITY_POOL_KIND;
  if (
    ![1, 2].includes(value?.schema) ||
    (community && (value.schema !== 2 || value.governanceDaoId !== 'juno')) ||
    value.daoId !== (community ? 'juno' : 'juno-delegation') ||
    value.chainId !== 'juno-1' ||
    (!community && value.programme !== PROGRAMME) ||
    !['RULE_APPROVAL', 'CLAIM_REWARDS', 'ALLOCATION_EXECUTION', COMMUNITY_POOL_KIND].includes(
      value.kind
    )
  )
    throw Error('Invalid planner proposal context.');
  for (const [key, limit] of [
    ['title', 120],
    ['summary', 500],
    ['body', 20000],
    ['actions_json', 100000]
  ]) {
    if (
      typeof value.values?.[key] !== 'string' ||
      !value.values[key].trim() ||
      value.values[key].length > limit
    )
      throw Error(
        'The proposal exceeds the workspace limits. Keep the full review-data export and shorten the draft.'
      );
  }
  if (!Array.isArray(JSON.parse(value.values.actions_json)))
    throw Error('Invalid proposal actions.');
  if (community) assertCommunityPoolSpend(JSON.parse(value.values.actions_json));
  const checked = structuredClone(value);
  if (checked.schema === 1 && checked.kind === 'CLAIM_REWARDS') {
    checked.values = upgradeLegacyPlannerValues(checked.values, checked.kind);
  }
  checked.schema = 2;
  checked.governanceDaoId = 'juno';
  return checked;
}
function draft(kind, title, summary, body, actions = []) {
  return validatePlannerDraft({
    schema: 2,
    governanceDaoId: 'juno',
    daoId: 'juno-delegation',
    chainId: 'juno-1',
    programme: PROGRAMME,
    kind,
    createdAt: new Date().toISOString(),
    values: {
      title,
      summary,
      body: body + '\n\nThis proposal was created on cosmoot.com.',
      actions_json: JSON.stringify(actions, null, 2)
    }
  });
}
export function ruleProposal(review) {
  const p = policy(review.rule),
    s = snapshot(review.snapshot),
    r = review.simulation;
  if (review.proposalType !== 'RULE_APPROVAL' || !r || review.approval !== null)
    throw Error('Simulate an unapproved rule draft first.');
  if (p.schema !== 2) throw Error('New rule proposals require a frozen allocation review.');
  return draft(
    'RULE_APPROVAL',
    'Juno Delegation Programme — allocation rules',
    'Approve the allocation criteria. The illustrated distribution is not authorization to delegate or redelegate funds.',
    `# Proposed allocation rules\n\nDecision requested: approve allocation rules. Execution: none.\nChain: juno-1\nDecision and submission: Juno native governance\nTopic: Delegation Programme\nProgramme: ${PROGRAMME}\n\n` +
      `- Equal allocation within the voting power cap.\n- Non-jailed validators with participation evidence; membership of the current consensus set is not required. Absence from that set is not evidence of an offline node.\n- Cap: min(30%, ${p.factorTenths / 10} × 100% / full consensus validator count).\n- Commission: ${p.commissionMaxBps === null ? 'no limit' : p.commissionMaxBps / 100 + '% maximum'}.\n- Juno v31 participation within five hours of the halt is required. Missing evidence remains unresolved, not proof of downtime.\n- Keep at least 50 JUNO outside the allocation as the liquid reserve.\n- Changes to criteria or exclusions require a new community approval.\n\n` +
      `## Exact policy\n\n\`\`\`json\n${JSON.stringify(p, null, 2)}\n\`\`\`\n\n` +
      `## Illustrative distribution\n\nBudget: ${units(r.budgetRaw)} JUNO\nAllocated: ${units(r.allocatedRaw)} JUNO\nUnallocated: ${units(r.unallocatedRaw)} JUNO\nSnapshot block: ${s.height}\nSnapshot time: ${s.blockTime}\nRule SHA-256: ${review.policyHash}\nSnapshot SHA-256: ${review.snapshotHash}\nEvidence SHA-256: ${review.evidenceHash}\n\nKeep the full planner review-data export alongside this proposal. Refresh evidence before voting. A later allocation proposal needs verified on-chain rule approval, authority, fresh balances, consensus-set and redelegation checks. This draft contains no execution messages.`
  );
}
export async function frozenRuleProposal(review) {
  const checked = await verifyRuleReview(review.value),
    v = checked.value,
    encoded = await encodeRuleReview(checked);
  const changes = ruleChanges(v.parent?.rule, v.rule).filter((r) => r.changed);
  const content =
    `# Proposed allocation rules\n\nDecision requested: approve this exact rule revision. Execution: none.\nChain: juno-1\nDecision and submission: Juno native governance\nTopic: Delegation Programme\nProgramme: ${v.rule.programme}\n\n` +
    (v.parent
      ? `Parent policy: Juno proposal #${v.parent.proposalId}\nParent rule SHA-256: ${v.parent.hash}`
      : 'Initial adoption: no prior Cosmoot-format approval found at preparation.') +
    `\n\n${v.rationale ? 'Rationale: ' + v.rationale + '\n\n' : ''}## Changes\n\n` +
    changes
      .map(
        (r) => `- ${r.label}${r.address ? ' (' + r.address + ')' : ''}: ${r.before} → ${r.after}`
      )
      .join('\n') +
    (changes.length ? '' : 'No semantic rule changes.') +
    `\n\n## Exact policy\n\n\`\`\`json\n${JSON.stringify(v.rule)}\n\`\`\`\n\nRule SHA-256: ${v.policyHash}\n\n` +
    `Comparison budget: ${units(v.budgetRaw)} JUNO (illustrative, not authorized expenditure).\nSnapshot: ${v.snapshot.height} · ${v.snapshot.blockTime}\n` +
    (checked.model.proposed.coverage?.complete
      ? historyCoverageText(checked.model.proposed.coverage) + '\n'
      : '') +
    (v.proposed.status === 'calculated'
      ? `Proposed total: ${units(v.proposed.allocatedRaw)} JUNO; unallocated: ${units(v.proposed.unallocatedRaw)} JUNO.\n`
      : `Allocation impact unavailable: ${v.proposed.reason}\n`) +
    '\nApproval changes the rules only. Holdings remain unchanged by this vote. A separate allocation proposal must use the approved revision, fresh evidence, verified programme authority and exact reviewed transactions.\n\n' +
    encoded;
  const summary =
      'Approve this exact rule revision. No funds move; the comparison is illustrative.',
    attribution = '\n\nThis proposal was created on cosmoot.com.',
    size = (body) => new TextEncoder().encode(summary + '\n\n' + body + attribution).length;
  // The shared author/voter view renders every change, rationale and exact value
  // from the same verified package. Do not repeat all of it in the text envelope
  // when that repetition would prevent publishing the complete evidence.
  const compact =
    `${v.parent ? 'Revises Juno proposal #' + v.parent.proposalId + '.' : 'Initial adoption; no prior Cosmoot-format approval found.'}\n\n` +
    `## Exact policy\n\n\`\`\`json\n${JSON.stringify(v.rule)}\n\`\`\`\n\nRule SHA-256: ${v.policyHash}\n\n` +
    `Illustrative budget: ${units(v.budgetRaw)} JUNO. Snapshot: ${v.snapshot.height} · ${v.snapshot.blockTime}.\n` +
    (checked.model.proposed.coverage?.complete
      ? historyCoverageText(checked.model.proposed.coverage) + '\n'
      : `Allocation impact unavailable: ${v.proposed.reason}\n`) +
    '\nFull changes, rationale and validator comparison are frozen below and displayed by Cosmoot. Moving funds requires separate approval.\n\n' +
    encoded;
  const body = size(content) <= 10000 ? content : compact;
  if (size(body) > 10000)
    throw Error(
      `The complete review needs ${size(body).toLocaleString('en-US')} bytes; the proposal limit is 10,000. Nothing was published. ` +
        (v.rationale || v.rule.exclusions.length
          ? 'Shorten optional rationale or exclusion reasons and prepare it again. '
          : 'The required evidence is too large for this proposal format. ') +
        'Keep the full review-data export; evidence cannot be omitted.'
    );
  return draft('RULE_APPROVAL', 'Juno Delegation Programme — allocation rules', summary, body);
}
export function claimProposal(input, now = Date.now(), rewardsSource = null, context = null) {
  const s = snapshot(input);
  for (const time of [s.blockTime, s.collectedAt]) {
    const age = now - Date.parse(time);
    if (age > 3600000 || age < -300000)
      throw Error('Refresh programme data before preparing the rewards proposal.');
  }
  const validators = s.validators
    .filter((v) => BigInt(v.currentRaw) > 0n)
    .sort((a, b) => a.address.localeCompare(b.address));
  if (!validators.length) throw Error('No current programme delegations to claim from.');
  if (rewardsSource) claimRewardsOverview(rewardsSource, s, now);
  const actions = rewardMessages(validators.map((v) => v.address));
  const result = draft(
    'CLAIM_REWARDS',
    'Juno Delegation Programme — claim staking rewards',
    `This proposal claims the accrued staking rewards from the Juno Delegation Programme’s ${validators.length} listed validator positions and makes them available in the programme treasury.`,
    'Existing delegations remain unchanged. No tokens are delegated, redelegated or transferred to another recipient.',
    actions
  );
  if (context) result.values = withClaimContext(result.values, context);
  return result;
}
export function savePlannerProposal(storage, value, id = crypto.randomUUID()) {
  if (!identifier.test(id)) throw Error('Invalid planner draft identifier.');
  const checked = validatePlannerDraft(value),
    key = PLANNER_DRAFT_PREFIX + id;
  if (storage.getItem(key) !== null) throw Error('Planner draft already exists.');
  const encoded = JSON.stringify(checked);
  try {
    storage.setItem(key, encoded);
    if (storage.getItem(key) !== encoded) throw Error('Draft was not retained.');
  } catch {
    throw Error(
      'This browser could not save the prepared proposal. Allow site storage or free space, then try again. Existing drafts have been kept.'
    );
  }
  return `/?chain=juno&dao=juno${checked.daoId === 'juno' ? '' : '&subdao=juno-delegation'}&plannerDraft=${id}#governance`;
}
export function readPlannerProposal(storage, params, daoId) {
  const id = params.get('plannerDraft');
  if (!id) return null;
  if (!identifier.test(id) || !['juno', 'juno-delegation'].includes(daoId))
    throw Error('Open this prepared proposal in its Juno treasury workspace.');
  const source = storage.getItem(PLANNER_DRAFT_PREFIX + id);
  if (!source || source.length > 150000)
    throw Error(
      'Prepared draft unavailable in this browser. Open the original preparation link again.'
    );
  const parsed = JSON.parse(source);
  const checked = validatePlannerDraft(parsed);
  if (checked.daoId !== daoId)
    throw Error('This prepared proposal belongs to a different treasury.');
  return { id, ...checked, legacy: parsed.schema === 1 };
}

export function upgradeLegacyPlannerValues(values, kind) {
  if (kind !== 'CLAIM_REWARDS') return values;
  const old = JSON.parse(values.actions_json);
  if (old[0]?.['@type']) return values;
  const validators = old.map((v) => v?.distribution?.withdraw_delegator_reward?.validator);
  const expected = validators.map((validator) => ({
    distribution: { withdraw_delegator_reward: { validator } }
  }));
  if (JSON.stringify(old) !== JSON.stringify(expected))
    throw Error(
      'Legacy rewards actions were modified. Review the saved draft before preparing a new claim.'
    );
  return { ...values, actions_json: JSON.stringify(legacyRewardMessages(validators), null, 2) };
}

export async function rebalanceProposal(review) {
  const { executionValues } = await import('./juno-rebalance-execution.mjs');
  return validatePlannerDraft({
    schema: 2,
    governanceDaoId: 'juno',
    daoId: 'juno-delegation',
    chainId: 'juno-1',
    programme: PROGRAMME,
    kind: 'ALLOCATION_EXECUTION',
    createdAt: new Date().toISOString(),
    values: await executionValues(review)
  });
}
