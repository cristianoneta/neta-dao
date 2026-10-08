// Exact operator-controlled HTTPS origins. Never derive this list from a request.
export function webOrigins(value) {
  const list = typeof value === 'string' ? value.split(',').map(s => s.trim()) : value;
  if (!Array.isArray(list) || list.length < 1 || list.length > 5) {
    throw Error('Explicit HTTPS origins required (at most five)');
  }
  for (const origin of list) {
    let url;
    try { url = new URL(origin); } catch { throw Error('Explicit HTTPS origins required'); }
    if (typeof origin !== 'string' || url.protocol !== 'https:' || url.origin !== origin) {
      throw Error('Explicit HTTPS origins required');
    }
  }
  return new Set(list);
}
