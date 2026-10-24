// Public data only. No request cookies, wallet tokens, query strings or user-
// selected destinations leave Pages. Existing static data remains the fallback.
const cacheStatuses = new Set([
  'HIT',
  'MISS',
  'EXPIRED',
  'STALE',
  'UPDATING',
  'REVALIDATED',
  'BYPASS',
  'DYNAMIC'
]);

function setUpstreamDiagnostics(headers, upstream) {
  // These describe the response seen by fetch, not a fresh origin connection.
  // Never copy arbitrary upstream headers, error text or request metadata.
  const status = upstream?.status;
  headers.set(
    'X-Cosmoot-Upstream-Status',
    status >= 100 && status <= 599 ? String(status) : 'unavailable'
  );
  const cache = upstream?.headers.get('CF-Cache-Status')?.toUpperCase();
  headers.set('X-Cosmoot-Upstream-Cache', cacheStatuses.has(cache) ? cache : 'unknown');
  const age = upstream?.headers.get('Age');
  headers.delete('X-Cosmoot-Upstream-Age');
  if (age != null && /^\d{1,10}$/.test(age)) {
    headers.set('X-Cosmoot-Upstream-Age', String(Number(age)));
  }
}

export function snapshotProxy(paths, fetcher = fetch) {
  const allowed = new Set(paths.map((path) => `/${path}`));
  return async function onRequest(context) {
    const { request } = context;
    const path = new URL(request.url).pathname;
    if (!allowed.has(path) || !['GET', 'HEAD'].includes(request.method)) return context.next();
    let upstream;
    try {
      upstream = await fetcher(`https://data.cosmoot.com${path}`, {
        method: request.method,
        // workerd supports manual/follow only; the status check rejects redirects.
        redirect: 'manual',
        signal: AbortSignal.timeout(4000),
        cf: { cacheEverything: true, cacheTtl: 60 }
      });
      if (upstream.status !== 200) throw Error('Snapshot unavailable');
      // Construct new headers: never relay upstream cookies or private metadata.
      const headers = new Headers({
        'Content-Type': path.endsWith('.gz') ? 'application/gzip' : 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Content-Type-Options': 'nosniff',
        'X-Cosmoot-Snapshot': 'server'
      });
      setUpstreamDiagnostics(headers, upstream);
      return new Response(upstream.body, { status: 200, headers });
    } catch {
      const fallback = await context.next();
      const response = new Response(fallback.body, fallback);
      response.headers.set('X-Cosmoot-Snapshot', 'static-fallback');
      response.headers.set('Cache-Control', 'no-cache');
      setUpstreamDiagnostics(response.headers, upstream);
      return response;
    }
  };
}
