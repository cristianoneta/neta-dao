import { assertRuleReference, ruleReviewUrl, usesRuleReference } from './juno-rule-reference.mjs';
import { assertStaking } from './juno-programme-staking.mjs';
import { assertNativeText, assertReviewLimits } from './juno-proposal-limits.mjs';

export const EXECUTION_REVIEW_MARKER = 'Native proposal format: cosmoot-execution-reference-1';
export const EXECUTION_REFERENCE_MARKER = '## Referenced rebalance review';
export const usesExecutionReference = (values) =>
  typeof values?.body === 'string' && values.body.includes(EXECUTION_REVIEW_MARKER);
export const usesReviewReference = (values) =>
  usesRuleReference(values) || usesExecutionReference(values);

// References optimize only the description. Every reviewed staking message is
// still directly authorized and executed by native governance.
export function referencedExecutionContent(values, reference) {
  const ref = assertRuleReference(reference);
  assertReviewLimits(values);
  if (
    !usesExecutionReference(values) ||
    values.body.split(EXECUTION_REVIEW_MARKER).length !== 2 ||
    !values.body.split('\n').includes(EXECUTION_REVIEW_MARKER) ||
    values.title !== 'Juno Delegation Programme — rebalance' ||
    !values.summary.trim()
  )
    throw Error('Invalid referenced rebalance review.');
  const messages = JSON.parse(values.actions_json);
  assertStaking(messages);
  const summary =
    `${values.summary.trim()}\n\n` +
    `Exact allocations, fixed obligations and staking movements:\n${ruleReviewUrl(ref)}\n\n` +
    'This proposal authorizes the attached transactions. The complete calculation is stored in the finalized Juno review identified below. No rule change. Unbonding is delayed; state changes during voting can cause execution to fail. Fixed periods use the recorded observation date and do not cancel transactions when they expire.\n\n' +
    `${EXECUTION_REFERENCE_MARKER}\n\n\`\`\`cosmoot-execution-reference\n${JSON.stringify(ref)}\n\`\`\`\n\nThis proposal was created on cosmoot.com.`;
  assertNativeText(summary);
  return {
    title: values.title,
    summary,
    messages,
    expedited: false,
    metadata: `cosmoot:review:${ref.chainId}:${ref.contract}:${ref.reviewId}:${ref.contentHash}`
  };
}

export function parseExecutionReference(proposal) {
  const text = proposal?.summary;
  if (typeof text !== 'string' || !text.includes(EXECUTION_REFERENCE_MARKER)) return null;
  assertNativeText(text);
  const matches = [
    ...text.matchAll(
      /^## Referenced rebalance review\n\n```cosmoot-execution-reference\n([^\n]+)\n```/gm
    )
  ];
  if (matches.length !== 1 || text.split(EXECUTION_REFERENCE_MARKER).length !== 2)
    throw Error('Malformed rebalance review reference.');
  return assertRuleReference(JSON.parse(matches[0][1]));
}
