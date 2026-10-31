import { matchesReview, findReviewSubmission } from '../../juno-community-governance.mjs';

// The shipped, hash-bound rule links contain reviewHistory=1. Keep those bytes
// unchanged, but open their verified native proposal once it exists. Explicit
// history navigation uses "full"; older unpinned history links remain history.
export function reviewHistoryOnly(params) {
  return (
    params.get('reviewHistory') === 'full' ||
    (params.get('reviewHistory') === '1' &&
      !(params.has('reviewRevision') && params.has('reviewHash')))
  );
}

export async function verifiedReviewTarget(final, records, endpoints, options = {}) {
  const matches = records.filter((p) => matchesReview(p.proposal.raw, final.content));
  if (!matches.length) return null;
  if (matches.length !== 1)
    throw Error(
      'Multiple native proposals match this review. Select the intended proposal from the list.'
    );
  const ids = await findReviewSubmission(endpoints, final.content, options);
  if (ids.length !== 1 || ids[0] !== String(matches[0].id))
    throw Error('Independent sources do not identify one matching native proposal.');
  return matches[0];
}
