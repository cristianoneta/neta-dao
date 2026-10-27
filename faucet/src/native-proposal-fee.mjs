import { fixedFee } from './wynd-swap-fee.mjs';

// Submitting the full deposit also starts voting. Large, reviewed proposal
// envelopes can exceed the former 2M estimate guard before fee adjustment.
// Bound the final limit, not just the estimate; votes and deposits keep theirs.
export function proposalFee(estimate) {
  if (!Number.isSafeInteger(estimate) || estimate <= 0)
    throw Error('Invalid proposal gas estimate. Refresh and try again.');
  const limit = Math.max(250000, Math.ceil(estimate * 1.4));
  if (!Number.isSafeInteger(limit) || limit > 5000000)
    throw Error(
      `Proposal needs ${limit} gas including reserve, above the 5000000 submission limit. Nothing was signed or sent.`
    );
  return fixedFee(limit, 1, '0.075ujuno', 5000000);
}
