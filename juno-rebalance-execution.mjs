import { fingerprint, units } from './juno-delegation-core.mjs';
import { activeFixed } from './juno-fixed-allocations.mjs';
import { verifyRuleReview } from './juno-delegation-review.mjs';
import { packReview, unpackReview } from './juno-review-transport.mjs';
import {
  canonical,
  movementPlan,
  stakingMessages,
  assertStaking,
  isStaking
} from './juno-programme-staking.mjs';

export const REBALANCE_KIND = 'ALLOCATION_EXECUTION';
export const REBALANCE_TITLE = 'Juno Delegation Programme — rebalance';
const marker = '## Frozen rebalance execution';
export async function executionReview(calculation) {
  const checked = await verifyRuleReview(calculation);
  if (
    !calculation.parent ||
    calculation.parent.hash !== calculation.policyHash ||
    canonical(calculation.parent.rule) !== canonical(calculation.rule) ||
    !checked.model.proposed.result
  )
    throw Error('Rebalance requires the exact approved rules and complete allocation evidence.');
  const plan = movementPlan(checked.model.proposed.result.rows);
  if (!plan.moves.length)
    throw Error('Current holdings already match the target. No proposal is needed.');
  const value = { schema: 1, kind: REBALANCE_KIND, calculation: checked.value, plan };
  return { value, hash: await fingerprint(value), messages: stakingMessages(plan.moves) };
}
export async function verifyExecutionReview(value) {
  const rebuilt = await executionReview(value?.calculation);
  if (canonical(value) !== canonical(rebuilt.value))
    throw Error('Rebalance evidence or movements changed.');
  return rebuilt;
}
function executionDescription(c, plan, legacy = false) {
  if (legacy)
    return (
      `Approved policy: Juno proposal #${c.parent.proposalId}\nPolicy SHA-256: ${c.policyHash}\nAllocation observations: block ${c.snapshot.height} · ${c.snapshot.blockTime}\n\n` +
      `Delegate: ${units(plan.totals.delegate)} JUNO\nRedelegate: ${units(plan.totals.redelegate)} JUNO\nBegin unbonding: ${units(plan.totals.undelegate)} JUNO\n\n` +
      'This proposal authorizes the exact movements below. Unbonding funds are unavailable until chain completion. Staking share rounding can leave micro-JUNO differences. Checks describe current state; changes during voting can make execution fail. A successful submission is not execution.\n\n'
    );
  return (
    `Rules #${c.parent.proposalId} · observations: block ${c.snapshot.height} (${c.snapshot.blockTime}).\n` +
    `JUNO: delegate ${units(plan.totals.delegate)}; redelegate ${units(plan.totals.redelegate)}; begin unbonding ${units(plan.totals.undelegate)}.\n\n` +
    (c.rule.fixedAllocations?.length
      ? `Fixed targets reserved: ${units(activeFixed(c.rule, c.snapshot.blockTime).reduce((sum, a) => sum + BigInt(a.amountRaw), 0n))} JUNO. Only this portion bypasses regular eligibility and the voting-power cap. Periods use the frozen observation date; the contract does not cancel movements if a period ends during voting.\n\n`
      : '') +
    'Unbonding is delayed; share rounding may leave dust. State changes during voting can cause execution to fail. Submission is not execution.\n\n'
  );
}
export async function executionValues(review) {
  const checked = await verifyExecutionReview(review.value),
    { calculation: c, plan } = checked.value;
  // Format 2 reconstructs the deterministic plan from the complete frozen
  // calculation. Its full-value hash and separately reviewed messages still bind
  // every movement; only redundant transport bytes are removed.
  const packet = {
    schema: checked.value.schema,
    kind: checked.value.kind,
    calculation: packReview(c)
  };
  if (canonical(unpackReview(packet.calculation)) !== canonical(c))
    throw Error('The complete rebalance evidence cannot be transported without changes.');
  const bytes = new TextEncoder().encode(canonical(packet));
  if (bytes.length > 750000) throw Error('Rebalance evidence exceeds the supported size.');
  const zipped = new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
    ).arrayBuffer()
  );
  const encoded = btoa(Array.from(zipped, (b) => String.fromCharCode(b)).join(''));
  const values = {
    title: REBALANCE_TITLE,
    summary: `Execute ${plan.moves.length} staking movements under approved rule proposal #${c.parent.proposalId}.`,
    body:
      executionDescription(c, plan) +
      `${marker}\n\nFormat: cosmoot-rebalance-2+gzip\nReview SHA-256: ${checked.hash}\n\n\`\`\`cosmoot-rebalance\n${encoded}\n\`\`\`\n\nThis proposal was created on cosmoot.com.`,
    actions_json: JSON.stringify(checked.messages, null, 2)
  };
  if (
    new TextEncoder().encode(values.summary + '\n\n' + values.body).length > 10000 ||
    values.actions_json.length > 100000
  )
    throw Error(
      'The complete rebalance evidence exceeds governance limits. No evidence was omitted.'
    );
  return values;
}
export async function readExecutionReview(values) {
  const messages = JSON.parse(values.actions_json || '[]');
  const expected =
    isStaking(messages) ||
    values.title?.startsWith(REBALANCE_TITLE) ||
    values.body?.includes(marker);
  if (!expected) return null;
  assertStaking(messages);
  const body = values.body;
  if (typeof body !== 'string' || body.length > 30000 || values.title !== REBALANCE_TITLE)
    throw Error('Invalid rebalance proposal identity.');
  const blocks = [
    ...body.matchAll(
      /^## Frozen rebalance execution\n\nFormat: cosmoot-rebalance-([12])\+gzip\nReview SHA-256: ([a-f0-9]{64})\n\n```cosmoot-rebalance\n([A-Za-z0-9+/=]+)\n```/gm
    )
  ];
  if (blocks.length !== 1 || body.split(marker).length !== 2)
    throw Error('Complete frozen rebalance evidence is required.');
  const zipped = Uint8Array.from(atob(blocks[0][3]), (c) => c.charCodeAt(0));
  const reader = new Blob([zipped])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 750000) throw Error('Expanded rebalance evidence is too large.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const packet = JSON.parse(await new Blob(chunks).text());
  const calculation = unpackReview(packet.calculation);
  const checked =
    blocks[0][1] === '1'
      ? await verifyExecutionReview({ ...packet, calculation })
      : await executionReview(calculation);
  if (
    blocks[0][1] === '2' &&
    canonical(packet) !==
      canonical({
        schema: checked.value.schema,
        kind: checked.value.kind,
        calculation: packReview(calculation)
      })
  )
    throw Error('Invalid compact rebalance transport.');
  if (checked.hash !== blocks[0][2] || canonical(messages) !== canonical(checked.messages))
    throw Error('Rebalance messages do not match the frozen allocation.');
  // Bind human-readable amounts/identity without requiring identical gzip bytes
  // across browser zlib versions or identical REST object-key order.
  const expectedValues = await executionValues(checked);
  const textWithoutPacket = (text) =>
    text.replace(
      /^## Frozen rebalance execution\n\nFormat: cosmoot-rebalance-[12]\+gzip\nReview SHA-256: [a-f0-9]{64}\n\n```cosmoot-rebalance\n[A-Za-z0-9+/=]+\n```/gm,
      '<verified rebalance evidence>'
    );
  if (
    values.title !== expectedValues.title ||
    values.summary !== expectedValues.summary ||
    (textWithoutPacket(values.body) !== textWithoutPacket(expectedValues.body) &&
      !(
        blocks[0][1] === '1' &&
        textWithoutPacket(values.body) ===
          executionDescription(checked.value.calculation, checked.value.plan, true) +
            '<verified rebalance evidence>\n\nThis proposal was created on cosmoot.com.'
      ))
  )
    throw Error(
      'Rebalance text differs from its frozen evidence. Return to Rebalance to prepare a new draft.'
    );
  return checked;
}
