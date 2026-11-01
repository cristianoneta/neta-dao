import { parseDiscussionSource } from '../discussion-links.mjs';
import { REVIEW_MAINNET_RELEASE } from '../juno-review-mainnet-config.mjs';

export function junoDiscussionSource(key) {
  const source = parseDiscussionSource(key);
  return (
    source.chainId === 'juno-1' &&
    ((source.kind === 'native' && source.contract === 'gov') ||
      (source.kind === 'review' && source.contract === REVIEW_MAINNET_RELEASE.contract))
  );
}

export function discussionPolicy({ since, include = [] }) {
  const createdSince = Date.parse(since);
  if (
    !Number.isSafeInteger(createdSince) ||
    createdSince <= 0 ||
    !Array.isArray(include) ||
    include.length > 100 ||
    include.some((key) => !junoDiscussionSource(key))
  )
    throw Error('A valid discussion start date and Juno governance sources are required.');
  return {
    version: 1,
    since: new Date(createdSince).toISOString(),
    include: [...new Set(include)].sort()
  };
}

export function inDiscussionScope(policy, source, created) {
  if (!Number.isSafeInteger(created) || created < 0) throw Error('Invalid proposal creation time.');
  return (
    junoDiscussionSource(source) &&
    (policy.include.includes(source) || created >= Date.parse(policy.since))
  );
}
