import { NamesV2Reader } from './names-v2-reader.mjs';
import { normalizeName } from './names-profile-core.mjs';

// Public mainnet identity, independent of the visitor's wallet or review network.
export async function publicAuthorName(reader, owner, now = () => Date.now() / 1000) {
  const reverse = await reader.nameOf(owner);
  if (reverse?.address !== owner || !reverse.name) return null;
  const name = normalizeName(reverse.name);
  const record = await reader.identity(name);
  if (
    record?.name !== name ||
    record.owner !== owner ||
    !Number.isSafeInteger(record.expires_at) ||
    record.expires_at <= Math.max(now(), reader.block?.time || 0)
  )
    return null;
  return name;
}
export function authorNameRenderer({ fetcher = fetch } = {}) {
  let manifest;
  return async (element, owner, current = () => true) => {
    element.textContent = `Draft author: ${owner} · Review on UNI-7`;
    element.title = owner;
    try {
      manifest ||= fetcher('./docs/deployments/nns-mainnet.json', { cache: 'no-store' })
        .then(async (r) => {
          if (!r.ok) throw Error('Name registry unavailable');
          const value = await r.json();
          if (value.chain_id !== 'juno-1') throw Error('Name registry network mismatch');
          return value;
        })
        .catch((e) => {
          manifest = null;
          throw e;
        });
      const reader = new NamesV2Reader({ deployment: await manifest, fetcher });
      const name = await publicAuthorName(reader, owner);
      if (name && current())
        element.textContent = `Draft author: ${name} (${owner}) · Review on UNI-7`;
    } catch {
      /* The full verifiable address remains the public fallback. */
    }
  };
}
