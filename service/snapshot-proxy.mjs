// Public data only. No request cookies, wallet tokens, query strings or user-
// selected destinations leave Pages. Existing static data remains the fallback.
export function snapshotProxy(paths, fetcher = fetch) {
  const allowed = new Set(paths.map(path => `/${path}`));
  return async function onRequest(context) {
    const { request } = context;
    const path = new URL(request.url).pathname;
    if (!allowed.has(path) || !['GET', 'HEAD'].includes(request.method)) return context.next();
    try {
      const upstream = await fetcher(`https://data.cosmoot.com${path}`, {
        method: request.method,
        redirect: 'error',
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
      return new Response(upstream.body, { status: 200, headers });
    } catch {
      const fallback = await context.next();
      const response = new Response(fallback.body, fallback);
      response.headers.set('X-Cosmoot-Snapshot', 'static-fallback');
      response.headers.set('Cache-Control', 'no-cache');
      return response;
    }
  };
}
