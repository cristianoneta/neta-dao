import {NamesV2Reader} from './names-v2-reader.mjs?v=5';
import {normalizeName} from './names-profile-core.mjs';
import {emptyState, readState, observeName, validIdentity, nameLinks, GRACE} from './names-v2-notifications-core.mjs?v=1';

const manifests = {'juno-1':'./docs/deployments/nns-mainnet.json','uni-7':'./docs/deployments/nns-uni7-owner-2026-10-04.json'};
const wallet = () => window.NetaWorkspaceWallet?.getAddress() || null;
const network = () => document.getElementById('nns-network')?.value || 'juno-1';
let state = emptyState(), activeOwner = null, activeChain = null, key = null, epoch = 0, loading = false, again = false, lastChecked = 0;
const status = text => { const node = document.getElementById('relay-nns-status'); if (node) node.textContent = text; };
const changed = () => window.dispatchEvent(new Event('neta:nns-notifications'));
function persist(next) {
  const latest = readState(localStorage.getItem(key));
  const alreadyRead = new Set(latest.events.filter(e => e.read).map(e => e.id));
  for (const event of next.events) if (alreadyRead.has(event.id)) event.read = true;
  const encoded = JSON.stringify(next); localStorage.setItem(key, encoded);
  if (localStorage.getItem(key) !== encoded) throw Error('Name notifications could not be saved.');
  state = next;
}
function reset() {
  epoch++; lastChecked = 0; state = emptyState(); key = null; activeOwner = wallet(); activeChain = network(); changed();
  refresh();
}
async function refresh({force = true} = {}) {
  if (document.hidden || (!force && Date.now() - lastChecked < 15 * 60000)) return;
  if (loading) { again = true; return; }
  const owner = wallet(), chainId = network(), ticket = epoch;
  if (!owner) { status('Connect Keplr to load your name notifications.'); return; }
  if (!manifests[chainId]) return;
  loading = true; lastChecked = Date.now();
  const check = () => { if (ticket !== epoch || wallet() !== owner || network() !== chainId) throw Error('Names account changed.'); };
  try {
    const response = await fetch(manifests[chainId], {cache:'no-store', signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('Name deployment unavailable.');
    const deployment = await response.json(); check();
    if (deployment.chain_id !== chainId) throw Error('Names network mismatch.');
    const reader = new NamesV2Reader({deployment});
    await reader.verify(); check();
    key = `neta-nns-notifications:v1:${chainId}:${deployment.registry}:${owner}`;
    let next = readState(localStorage.getItem(key));
    if (Object.values(next.identities).some(r => r.owner !== owner) || next.events.some(e => e.kind !== 'names' || e.chainId !== chainId || e.registry !== deployment.registry || e.identity.owner !== owner)) throw Error('Saved name notification scope mismatch.');
    const owned = await reader.nameOf(owner); check();
    if (owned?.address !== owner || (owned.name !== null && normalizeName(owned.name) !== owned.name)) throw Error('Name ownership unavailable.');
    const now = Math.floor(reader.block.time);
    const names = new Set(Object.values(next.identities).filter(r => now < r.expires_at + GRACE || !next.events.some(e => e.identity.name === r.name && e.identity.expires_at === r.expires_at && e.type === 'NAME RELEASED')).map(r => r.name));
    if (owned.name) names.add(owned.name);
    // A previous completed registration can recover an expired name after notification storage was cleared.
    const saved = localStorage.getItem(`neta-nns-v2-intent:${chainId}:${deployment.registry}:${owner}`);
    if (saved) { try { const i=JSON.parse(saved); if(i.owner===owner && i.registry===deployment.registry && i.chain_id===chainId && i.phase==='complete' && i.payment_hash && i.action!=='cancel-registration' && i.name) names.add(normalizeName(i.name)); } catch {} }
    for (const name of names) {
      const identity = validIdentity(await reader.identity(name)); check();
      if (identity.name !== name) throw Error('Name identity mismatch.');
      next = observeName(next, identity, {owner, chainId, registry:deployment.registry, now});
    }
    check(); activeOwner = owner; activeChain = chainId; persist(next); changed();
    status(`Name notifications checked · ${chainId === 'juno-1'?'Juno mainnet':'UNI-7 testnet'} · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}. Updated while this page is open; history is saved in this browser.`);
  } catch(error) {
    if (ticket === epoch) status(`Name notifications unavailable · ${error.message}`);
  } finally {
    loading = false;
    if (again) { again = false; queueMicrotask(refresh); }
  }
}
window.NetaNameNotifications = Object.freeze({
  links: nameLinks,
  events: () => activeOwner === wallet() && activeChain === network() ? structuredClone(state.events) : [],
  markRead: thread => {
    if (!key || activeOwner !== wallet() || activeChain !== network()) return;
    try { const next=readState(localStorage.getItem(key)); for (const e of next.events) if (!thread || e.proposalKey===thread) e.read=true; persist(next); }
    catch(error) { status(error.message); }
  }, refresh
});
for (const event of ['neta:wallet-change','neta:nns-network','keplr_keystorechange']) window.addEventListener(event, reset);
window.addEventListener('neta:nns-updated', refresh);
window.addEventListener('storage', event => { if (event.key === key) reset(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh({force:false}); });
setInterval(() => { if (!document.hidden) refresh({force:false}); }, 15 * 60000);
reset();
