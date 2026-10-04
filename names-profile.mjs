import {normalizeContacts, normalizeName, contactLinks, validatePair} from './names-profile-core.mjs?v=20261004-1';

const form = document.querySelector('#names-profile-form');
const preview = document.querySelector('#names-profile-preview');
const status = document.querySelector('#names-profile-result');

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

if (form) {
  form.addEventListener('submit', event => {
    event.preventDefault();
    status.textContent = '';
    try {
      const fields = Object.fromEntries(new FormData(form));
      const name = fields.name.trim() ? normalizeName(fields.name) : 'Your .neta name';
      const contacts = normalizeContacts(fields);
      let pair = null;
      if (fields.mainnet.trim() || fields.testnet.trim()) pair = validatePair({
        mainnet: {chain_id: 'juno-1', address: fields.mainnet.trim()},
        testnet: {chain_id: 'uni-7', address: fields.testnet.trim()},
      });
      const title = element('h3', name);
      preview.replaceChildren(element('span', 'Preview · not published', 'names-badge'), title);
      if (contacts.description) preview.append(element('p', contacts.description));
      const list = element('dl', undefined, 'names-contact-list');
      for (const item of contactLinks(contacts)) {
        const value = element('dd');
        if (item.href) {
          const link = element('a', item.text);
          link.href = item.href;
          if (item.href.startsWith('https:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
          value.append(link);
        } else value.textContent = item.text;
        list.append(element('dt', item.label), value);
      }
      preview.append(list);
      if (pair) {
        preview.append(element('h4', 'Validator addresses · unverified'));
        for (const op of [pair.mainnet, pair.testnet]) preview.append(element('p', `${op.chain_id} · ${op.address}`, 'names-address'));
      }
      if (!list.children.length && !contacts.description && !pair) preview.append(element('p', 'Your profile is empty. All contact fields are optional.'));
      preview.append(element('p', 'Contact details are self-declared. Validator ownership requires a separate signature from each operator wallet.', 'names-help'));
      preview.hidden = false;
      status.textContent = 'Preview updated. Nothing has been published or saved.';
    } catch (error) {
      preview.hidden = true;
      status.textContent = error.message;
    }
  });
  // Editing invalidates the old preview immediately; stale information must not
  // appear to be the result of the currently visible form.
  form.addEventListener('input', () => { preview.hidden = true; status.textContent = ''; });
  form.addEventListener('reset', () => { preview.hidden = true; status.textContent = ''; });
}
