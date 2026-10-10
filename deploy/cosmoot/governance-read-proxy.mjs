import { CHAIN_READ_PATH, governanceReadTarget } from '../../governance-chain-read.mjs';
const MAX_BYTES = 4 * 1024 * 1024;
const response = (message, status) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
export async function governanceReadProxy(request, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== CHAIN_READ_PATH) return null;
  if (request.method !== 'GET') return response('Read-only endpoint.', 405);
  const params = url.searchParams;
  let target;
  try {
    if (
      [...params.keys()].some(
        (k) => !['source', 'path', 'height'].includes(k) || params.getAll(k).length !== 1
      )
    )
      throw Error();
    target = governanceReadTarget(
      params.get('source'),
      params.get('path'),
      params.get('height') || ''
    );
  } catch {
    return response('Unsupported governance read.', 400);
  }
  try {
    const headers = { Accept: 'application/json', 'Cache-Control': 'no-cache' };
    if (params.has('height')) headers['x-cosmos-block-height'] = params.get('height');
    const upstream = await fetcher(target, {
      method: 'GET',
      redirect: 'manual',
      headers,
      signal: AbortSignal.timeout(10000),
      cf: { cacheEverything: false, cacheTtl: 0 }
    });
    if (upstream.status !== 200) {
      await upstream.body?.cancel();
      return response(`Chain source returned HTTP ${upstream.status}.`, 502);
    }
    if (Number(upstream.headers.get('Content-Length')) > MAX_BYTES) {
      await upstream.body?.cancel();
      return response('Chain response too large.', 502);
    }
    const reader = upstream.body.getReader(),
      chunks = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) {
        await reader.cancel();
        return response('Chain response too large.', 502);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const result = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    const height = upstream.headers.get('x-cosmos-block-height');
    if (height && /^[1-9]\d{0,19}$/.test(height)) result.set('x-cosmos-block-height', height);
    return new Response(bytes, { headers: result });
  } catch {
    return response('Chain source unavailable. Please retry.', 502);
  }
}
