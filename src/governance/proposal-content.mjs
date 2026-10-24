import { accountingType, validateCategories } from '../../proposal-accounting.mjs';
import {
  isCommunityPoolSpend,
  assertCommunityPoolSpend
} from '../../juno-community-pool-proposal.mjs';
export const DELIVERABLE_TYPE = 'dao_deliverable_v1';
export function payloadParts(raw = '[]') {
  const parsed = JSON.parse(raw || '[]');
  if (!Array.isArray(parsed)) throw new Error('ACTIONS MUST BE A JSON ARRAY');
  const metadata = parsed.filter((item) => item?.type === accountingType);
  if (metadata.length > 1 || metadata.some((item) => !Array.isArray(item.allocations)))
    throw new Error('INVALID SPENDING CATEGORIES');
  return {
    actions: parsed.filter((item) => ![DELIVERABLE_TYPE, accountingType].includes(item?.type)),
    deliverables: parsed
      .filter((item) => item?.type === DELIVERABLE_TYPE)
      .map(({ type, ...item }) => item),
    accounting: metadata[0]?.allocations || []
  };
}
export function validateProposalContent(v, { native = false } = {}) {
  if (v.title.length < 3) throw new Error('TITLE MUST CONTAIN AT LEAST 3 CHARACTERS');
  if (!v.summary) throw new Error('SUMMARY IS REQUIRED');
  if (!v.body) throw new Error('PROPOSAL BODY IS REQUIRED');
  let actions;
  try {
    actions = JSON.parse(v.actions_json);
  } catch {
    throw new Error('ACTIONS MUST BE VALID JSON');
  }
  if (!Array.isArray(actions)) throw new Error('ACTIONS MUST BE A JSON ARRAY');
  if (native) {
    if (new TextEncoder().encode(`${v.summary.trim()}\n\n${v.body.trim()}`).length > 10000)
      throw new Error(
        'On-chain proposal text exceeds 10,000 bytes. Shorten the text or prepare a smaller frozen comparison; do not remove its data.'
      );
    for (const [field, max] of [
      ['title', 100],
      ['summary', 300],
      ['body', 10000],
      ['actions_json', 20000]
    ])
      if ([...v[field].trim()].length > max)
        throw new Error(
          `${field.toUpperCase()} EXCEEDS THE SHARED REVIEW LIMIT OF ${max} CHARACTERS`
        );
  }
  const parts = payloadParts(v.actions_json);
  if (native && isCommunityPoolSpend(parts.actions)) assertCommunityPoolSpend(actions);
  else validateCategories(parts.actions, parts.accounting);
  actions
    .filter((item) => item?.type === DELIVERABLE_TYPE)
    .forEach((item, index) => {
      if (!item.title || !item.due_date || !item.owner || !item.verifier)
        throw new Error(
          `DELIVERABLE ${index + 1} REQUIRES TITLE, DEADLINE, RESPONSIBLE AND CONFIRMED BY`
        );
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.due_date))
        throw new Error(`DELIVERABLE ${index + 1} HAS AN INVALID DEADLINE`);
    });
}
