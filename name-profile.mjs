import { NamesV2Reader } from './names-v2-reader.mjs';
import { normalizeName, normalizeContacts, contactLinks, validateJunoAddress } from './names-profile-core.mjs';

export async function readPublicProfile(reader, name, now = () => Date.now() / 1000) {
  name = normalizeName(name);
  const identity = await reader.identity(name);
  if (identity?.name !== name || !Number.isSafeInteger(identity.expires_at) || identity.expires_at <= Math.max(now(), reader.block?.time || 0))
    throw Error('This name is not currently active.');
  validateJunoAddress(identity.owner);
  const result = await reader.profile(name);
  if (!result || !Object.hasOwn(result, 'profile')) throw Error('Published profile data is unavailable.');
  if (result.profile === null) return { identity, contacts: null };
  const profile = result.profile;
  if (!result.active || ['name', 'owner', 'generation', 'ownership_revision'].some(key => profile.identity?.[key] !== identity[key]))
    throw Error('The published profile does not match the current name owner.');
  return { identity, contacts: normalizeContacts(profile.contacts) };
}

const $ = id => document.getElementById(id);
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
};
const link = (text, href, className) => {
  const el = node('a', text, className);
  el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer';
  return el;
};
async function load() {
  $('profile-retry').hidden = true;
  $('profile-content').hidden = true;
  $('profile-content').replaceChildren();
  $('profile-status').dataset.error = 'false';
  $('profile-status').textContent = 'Loading public profile…';
  try {
    const name = normalizeName(new URLSearchParams(location.search).get('name'));
    $('profile-name').textContent = name;
    document.title = `${name} · Cosmoot`;
    const response = await fetch('./docs/deployments/nns-mainnet.json', { cache: 'no-store' });
    if (!response.ok) throw Error('Name registry unavailable.');
    const deployment = await response.json();
    if (deployment.chain_id !== 'juno-1') throw Error('Name registry network mismatch.');
    const {identity, contacts} = await readPublicProfile(new NamesV2Reader({deployment}), name);
    const host = $('profile-content');
    host.append(node('h2', 'Public contacts'));
    if (contacts?.description) host.append(node('p', contacts.description));
    const list = node('dl', '');
    const owner = node('dd', '');
    owner.append(link(identity.owner, `https://atomscan.com/juno/accounts/${encodeURIComponent(identity.owner)}`, 'profile-wallet'));
    list.append(node('dt', 'Juno wallet'), owner);
    for (const item of contacts ? contactLinks(contacts) : []) {
      const value = node('dd', '');
      value.append(item.href ? link(item.text, item.href) : node('span', item.text));
      list.append(node('dt', item.label), value);
    }
    host.append(list);
    if (!contacts || !Object.values(contacts).some(Boolean)) host.append(node('p', 'No public contact details have been published.'));
    host.hidden = false;
    $('profile-status').textContent = 'Active .neta name · Juno mainnet';
  } catch (error) {
    $('profile-status').textContent = `Profile unavailable. ${error.message}`;
    $('profile-status').dataset.error = 'true';
    $('profile-retry').hidden = false;
  }
}
if (typeof document !== 'undefined') {
  $('profile-retry').onclick = load;
  void load();
}
