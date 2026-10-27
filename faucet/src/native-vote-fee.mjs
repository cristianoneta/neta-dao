import { fixedFee } from './wynd-swap-fee.mjs';

// The unsigned simulation understated the signed vote's admission work. Keep a
// vote-specific floor as well as headroom, with a cap on the final gas limit.
export function voteFee(estimate, previousGas = 0) {
  if (
    !Number.isSafeInteger(estimate) ||
    estimate <= 0 ||
    !Number.isSafeInteger(previousGas) ||
    previousGas < 0
  )
    throw Error('Invalid vote gas estimate.');
  const limit = Math.max(250000, Math.ceil(estimate * 1.8), Math.ceil(previousGas * 1.5));
  return fixedFee(limit, 1, '0.075ujuno', 2000000);
}
