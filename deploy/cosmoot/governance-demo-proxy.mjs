// Preserve the public /demo origin while the isolated governance app publishes
// independently. The destination is reviewed source, never a request parameter.
export const GOVERNANCE_DEMO_ORIGIN = 'https://cosmoot-governance.cristiano-neta.chatgpt.site';
export const GOVERNANCE_DEMO_MARKER = 'independent-v1';
const maximumBytes = 4 * 1024 * 1024;
const commonHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};
const failure = (request, status, message, extra = {}) =>
  new Response(request.method === 'HEAD' ? null : message, {
    status,
    headers: { ...commonHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...extra }
  });

export async function governanceDemoProxy(request, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== '/demo' && !url.pathname.startsWith('/demo/')) return null;
  if (!['GET', 'HEAD'].includes(request.method))
    return failure(request, 405, 'The governance demo is read-only.', { Allow: 'GET, HEAD' });
  if (url.search.length > 4096) return failure(request, 400, 'The governance query is too long.');
  // The app uses exact ASCII asset and API paths; reject alternate encodings.
  if (/%|\\|\/\//.test(url.pathname)) return failure(request, 404, 'Not found.');
  if (url.pathname === '/demo')
    return new Response(null, {
      status: 302,
      headers: { ...commonHeaders, Location: '/demo/' + url.search }
    });
  const target = new URL(GOVERNANCE_DEMO_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  try {
    const upstream = await fetcher(target.href, {
      method: request.method,
      redirect: 'manual',
      headers: { Accept: '*/*' },
      signal: AbortSignal.timeout(18000),
      cf: { cacheEverything: false, cacheTtl: 0 }
    });
    if (
      ![200, 400, 404, 405, 429].includes(upstream.status) ||
      upstream.headers.get('X-Cosmoot-Governance') !== GOVERNANCE_DEMO_MARKER ||
      Number(upstream.headers.get('Content-Length')) > maximumBytes
    ) {
      await upstream.body?.cancel();
      throw Error('Independent governance app unavailable.');
    }
    const headers = new Headers({
      ...commonHeaders,
      'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
      'X-Cosmoot-Governance': GOVERNANCE_DEMO_MARKER
    });
    if (upstream.status === 405) {
      const offered = (upstream.headers.get('Allow') || '')
        .split(',')
        .map((method) => method.trim());
      const allowed = ['GET', 'HEAD'].filter((method) => offered.includes(method));
      headers.set('Allow', allowed.length ? allowed.join(', ') : 'GET, HEAD');
    }
    if (request.method === 'HEAD') {
      await upstream.body?.cancel();
      return new Response(null, { status: upstream.status, headers });
    }
    const reader = upstream.body?.getReader();
    if (!reader) throw Error('Independent governance response is missing.');
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximumBytes) {
        await reader.cancel();
        throw Error('Independent governance response is too large.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new Response(bytes, { status: upstream.status, headers });
  } catch {
    return failure(request, 503, 'Governance is temporarily unavailable. Please retry shortly.', {
      'Retry-After': '30'
    });
  }
}
