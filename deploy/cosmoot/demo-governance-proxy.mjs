import { GOVERNANCE_READ_PATH, demoGovernanceTarget } from '../../demo/governance-query.mjs';
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};
const error = (message, status) =>
  new Response(JSON.stringify({ error: message }), { status, headers });
export async function demoGovernanceProxy(request, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== GOVERNANCE_READ_PATH) return null;
  if (request.method !== 'GET') return error('Read-only endpoint.', 405);
  let target;
  try {
    target = demoGovernanceTarget(url.searchParams);
  } catch {
    return error('Unsupported governance read.', 400);
  }
  try {
    const upstream = await fetcher(target, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
      cf: { cacheEverything: false, cacheTtl: 0 }
    });
    if (
      upstream.status !== 200 ||
      Number(upstream.headers.get('Content-Length')) > 4 * 1024 * 1024
    ) {
      await upstream.body?.cancel();
      return error('Governance source unavailable.', 502);
    }
    const reader = upstream.body.getReader();
    let size = 0;
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        return error('Governance response too large.', 502);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return new Response(bytes, { headers });
  } catch {
    return error('Governance source unavailable. Please retry.', 502);
  }
}
