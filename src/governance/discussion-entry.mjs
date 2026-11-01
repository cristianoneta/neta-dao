import { DISCUSSION_API, discussionUrl } from '../../discussion-links.mjs';

// Switch only after this exact proposal and its existing comments are indexed.
// An absent service must not remove the currently usable comment/receipt view.
export function discussionEntry({ link, panel, fetcher = fetch, now = Date.now }) {
  let epoch = 0;
  const cache = new Map();
  return async ({ source = null, legacyVisible = false, pending = false } = {}) => {
    const request = ++epoch;
    link.hidden = true;
    panel.hidden = !legacyVisible;
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
      panel.hidden = true;
    } catch {
      /* Preserve original comments and wallet transaction recovery. */
    }
  };
}
