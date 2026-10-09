import { PROGRAMME, policy, snapshot, units } from './juno-delegation-core.mjs';

import { rewardMessages } from './juno-governance-core.mjs';
import { claimRewardsOverview } from './juno-claim-rewards.mjs';

export const PLANNER_DRAFT_PREFIX = 'cosmoot:juno:planner-proposal:';
const identifier = /^[a-f0-9-]{36}$/;
export function validatePlannerDraft(value) {
  if (
    ![1, 2].includes(value?.schema) ||
    value.daoId !== 'juno-delegation' ||
    value.chainId !== 'juno-1' ||
    value.programme !== PROGRAMME ||
    !['RULE_APPROVAL', 'CLAIM_REWARDS'].includes(value.kind)
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
    values: { title, summary, body, actions_json: JSON.stringify(actions, null, 2) }
  });
}
export function ruleProposal(review) {
  const p = policy(review.rule),
    s = snapshot(review.snapshot),
    r = review.simulation;
  if (review.proposalType !== 'RULE_APPROVAL' || !r || review.approval !== null)
    throw Error('Simulate an unapproved rule draft first.');
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
export function claimProposal(input, now = Date.now(), rewardsSource = null) {
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
  const actions = rewardMessages(validators.map((v) => v.address));
  let estimate =
    'The current claimable reward estimate is unavailable. Refresh rewards data before deciding whether to submit.';
  try {
    const rewards = claimRewardsOverview(rewardsSource, s, now);
    estimate = `Estimated claimable staking rewards: ${units(rewards.amountRaw)} JUNO${rewards.usd === null ? '' : ` (approximately USD ${rewards.usd.toFixed(2)})`}. Rewards snapshot: ${rewards.observedAt}, block ${rewards.height}${rewards.priceObservedAt ? `; indicative USD price snapshot: ${rewards.priceObservedAt}` : ''}. The amount can change before governance execution.`;
  } catch {}
  return draft(
    'CLAIM_REWARDS',
    'Juno Delegation Programme — claim staking rewards',
    `Claim staking rewards from the programme’s current delegations. ${estimate}`,
    `# Claim programme staking rewards\n\nDecision requested: claim programme staking rewards through Juno governance.\nChain: juno-1\nDecision and submission: Juno native governance\nTopic: Delegation Programme\nExecuting account: ${PROGRAMME}\n\nAsk Juno governance to execute ${validators.length} reward-withdrawal actions through the programme contract’s execute_admin_msgs entry point for the programme delegations recorded at block ${s.height} (${s.blockTime}). Include jailed and standby validators with recorded delegations; allocation exclusions do not exclude reward claims.\n\nJuno stakers decide this native governance proposal. The proposer submits it from their own wallet; after approval, the Juno governance module instructs the programme contract to execute the withdrawals. Membership of the Delegation DAO is not required to submit this proposal. They do not delegate, redelegate or change the withdrawal address. Confirm the current withdrawal address belongs to the programme treasury before submission; the planner snapshot does not verify that address. ${estimate} Refresh the delegation list, verify the contract’s supported messages and simulate fees/message limits before submission.\n\nAfter the proposal has passed and execution is confirmed, return to the planner and refresh programme data. Only the confirmed spendable balance is included in a new allocation. Keep at least 50 JUNO liquid and round the suggested allocation down to whole hundreds. The estimate is informational and never added to the allocation budget before confirmed execution.`,
    actions
  );
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
      'This browser could not save the claim or rule draft. Allow site storage or free space, then try again. Existing drafts have been kept.'
    );
  }
  return `/?chain=juno&dao=juno&subdao=juno-delegation&plannerDraft=${id}#governance`;
}
export function readPlannerProposal(storage, params, daoId) {
  const id = params.get('plannerDraft');
  if (!id) return null;
  if (!identifier.test(id) || daoId !== 'juno-delegation')
    throw Error('Planner proposal belongs to the Juno Delegation Programme.');
  const source = storage.getItem(PLANNER_DRAFT_PREFIX + id);
  if (!source || source.length > 150000)
    throw Error(
      'Planner draft unavailable in this browser. Return to the planner to prepare it again.'
    );
  const parsed = JSON.parse(source);
  return { id, ...validatePlannerDraft(parsed), legacy: parsed.schema === 1 };
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
  return { ...values, actions_json: JSON.stringify(rewardMessages(validators), null, 2) };
}
