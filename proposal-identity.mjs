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
function renderIdentity(element, owner, networkLabel, name) {
  const doc = element.ownerDocument;
  const wallet = doc.createElement('a');
  wallet.className = 'review-author-wallet';
  wallet.textContent = owner;
  wallet.href = `https://atomscan.com/juno/accounts/${encodeURIComponent(owner)}`;
  wallet.target = '_blank';
  wallet.rel = 'noopener noreferrer';
  wallet.setAttribute('aria-label', `View ${owner} on Atomscan (opens in a new tab)`);
  const network = doc.createElement('span');
  network.className = 'review-author-network';
  network.textContent = `Review on ${networkLabel}`;
  element.replaceChildren();
  if (name) {
    const profile = doc.createElement('a');
    profile.className = 'review-author-name';
    profile.textContent = name;
    profile.href = `/name-profile.html?${new URLSearchParams({ name })}`;
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    profile.setAttribute('aria-label', `View ${name} profile (opens in a new tab)`);
    element.append(profile);
  }
  element.append(wallet, network);
}
export function authorNameRenderer({ fetcher = fetch } = {}) {
  let manifest;
  return async (element, owner, current = () => true, networkLabel = 'UNI-7') => {
    renderIdentity(element, owner, networkLabel);
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
      if (name && current()) renderIdentity(element, owner, networkLabel, name);
    } catch {
      /* The full verifiable address remains the public fallback. */
    }
  };
}
