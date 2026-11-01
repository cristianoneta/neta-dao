import { DISCUSSION_API, discussionUrl } from '../../discussion-links.mjs';

// Only link an indexed proposal. Pending on-chain operations keep their existing
// recovery controls in the proposal action area; the old comment form is retired.
export function discussionEntry({ link, fetcher = fetch, now = Date.now }) {
  let epoch = 0;
  const cache = new Map();
  return async ({ source = null, pending = false } = {}) => {
    const request = ++epoch;
    link.hidden = true;
    if (!source || pending) return;
    let entry = cache.get(source);
    if (!entry || entry.expires <= now()) {
      entry = {
        expires: now() + 30000,
        promise: fetcher(DISCUSSION_API + '/v1/resolve?source=' + encodeURIComponent(source), {
          cache: 'no-store',
          credentials: 'omit',
          signal: AbortSignal.timeout(4000)
        }).then(async (r) => {
          if (!r.ok) throw Error('Discussion unavailable');
          const result = await r.json();
          if (
            !result.ready ||
            !result.thread?.sources?.some((s) => s.key === source) ||
            !Number.isSafeInteger(result.replies) ||
            result.replies < 0
          )
            throw Error('Discussion not indexed');
          return result;
        })
      };
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(source, entry);
    }
    try {
      const result = await entry.promise;
      if (request !== epoch) return;
      link.href = discussionUrl(source);
      link.textContent = `Join the discussion${result.replies ? ' · ' + result.replies : ''} →`;
      link.setAttribute(
        'aria-label',
        `Join the discussion · ${result.replies} ${result.replies === 1 ? 'reply' : 'replies'}`
      );
      link.title = `${result.replies} ${result.replies === 1 ? 'reply' : 'replies'}`;
      link.hidden = false;
    } catch {
      /* Leave proposal and wallet transaction recovery usable during an outage. */
    }
  };
}
