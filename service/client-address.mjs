import { isIP } from 'node:net';

// Canonicalize IPv6 as well as IPv4-mapped socket addresses before comparing peers.
export function normalizeAddress(value) {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const high = parseInt(mapped[1], 16),
    low = parseInt(mapped[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

export function trustedProxyAddresses(value = '') {
  if (typeof value !== 'string') throw Error('Trusted proxy addresses must be explicit IPs.');
  if (!value.trim()) return [];
  return value.split(',').map((part) => {
    const address = normalizeAddress(part.trim());
    if (!address)
      throw Error('COSMOOT_TRUSTED_PROXY_IPS requires explicit IPs, not ranges or hosts.');
    return address;
  });
}

export function clientAddressResolver(trustedProxies = []) {
  const trusted = new Set(
    trustedProxies.map((value) => {
      const address = normalizeAddress(value);
      if (!address) throw Error('Invalid trusted proxy IP.');
      return address;
    })
  );
  return (request) => {
    const peer = normalizeAddress(request.socket.remoteAddress);
    if (!peer || !trusted.has(peer)) return peer;
    // Caddy overwrites this single header with its socket peer. Missing, duplicate,
    // list-valued and malformed headers fail closed; arbitrary X-Forwarded-For is ignored.
    return normalizeAddress(request.headers['x-cosmoot-client-ip']);
  };
}
