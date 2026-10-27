import { submissionReceipt } from './juno-governance-core.mjs';

export function previousVoteHashes(receipt) {
  const hashes = receipt.previousHashes ?? [];
  if (
    !Array.isArray(hashes) ||
    hashes.length > 16 ||
    hashes.some(
      (hash) => typeof hash !== 'string' || !/^[A-F0-9]{64}$/.test(hash) || hash === receipt.hash
    ) ||
    new Set(hashes).size !== hashes.length
  )
    throw Error('Saved vote attempt history is unreadable.');
  return hashes;
}

export function replacementReceipt(receipt, hash) {
  const previousHashes = [receipt.hash, ...previousVoteHashes(receipt)];
  const next = { ...receipt, hash, previousHashes, gasRejected: false, sendError: undefined };
  previousVoteHashes(next);
  return next;
}

// A successful predecessor consumes the shared account sequence. An included
// failure alone is insufficient: an ante-handler failure may leave it unused.
// Resolve either successful attempt through the same independent REST proof.
export async function confirmedVoteReceipt(endpoints, receipt, options = {}) {
  const previous = previousVoteHashes(receipt);
  try {
    return await submissionReceipt(endpoints, receipt.hash, { ...options, kind: 'vote' });
  } catch (unconfirmed) {
    for (const hash of previous) {
      try {
        const result = await submissionReceipt(endpoints, hash, { ...options, kind: 'vote' });
        if (result.code === 0) return result;
      } catch {
        // Missing or inconsistent evidence cannot unlock another attempt.
      }
    }
    throw unconfirmed;
  }
}
