import {normalizeContacts, normalizeName, contactLinks, validatePair} from './names-profile-core.mjs?v=20261004-1';

const form = document.querySelector('#names-profile-form');
const preview = document.querySelector('#names-profile-preview');
const status = document.querySelector('#names-profile-result');

// Each future network needs its own supported chain pair and address validator.
// This preview registry does not change the wallet lab or the proof protocol.
const validatorNetworks = new Map([['juno', {
  label: 'Juno',
  mainnet: {chainId: 'juno-1', prefix: 'junovaloper'},
  testnet: {chainId: 'uni-7', prefix: 'junovaloper'},
  validate: validatePair,
}]]);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

if (form) {
  const networkSelect = form.elements.network;
  let selectedNetwork = networkSelect.value;
  networkSelect.replaceChildren(...Array.from(validatorNetworks, ([id, network]) => {
    const option = element('option', network.label);
    option.value = id;
    option.defaultSelected = id === 'juno';
    return option;
  }));
  function updateNetwork() {
    const network = validatorNetworks.get(networkSelect.value);
    preview.hidden = true;
    status.textContent = '';
    if (!network) {
      status.textContent = 'This validator network is not supported yet.';
      return;
    }
    for (const role of ['mainnet', 'testnet']) {
      if (selectedNetwork !== networkSelect.value) form.elements[role].value = '';
      form.querySelector(`label[for="names-profile-${role}"]`).textContent = `${network.label} ${role} operator · ${network[role].chainId}`;
      form.elements[role].placeholder = `${network[role].prefix}1…`;
    }
    selectedNetwork = networkSelect.value;
  }
  networkSelect.addEventListener('change', updateNetwork);
  updateNetwork();
  form.addEventListener('submit', event => {
    event.preventDefault();
    status.textContent = '';
    try {
      const fields = Object.fromEntries(new FormData(form));
      const network = validatorNetworks.get(fields.network);
      if (!network) throw Error('This validator network is not supported yet.');
      const name = fields.name.trim() ? normalizeName(fields.name) : 'Your .neta name';
      const contacts = normalizeContacts(fields);
      let pair = null;
      if (fields.mainnet.trim() || fields.testnet.trim()) pair = network.validate({
        mainnet: {chain_id: network.mainnet.chainId, address: fields.mainnet.trim()},
        testnet: {chain_id: network.testnet.chainId, address: fields.testnet.trim()},
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
        preview.append(element('p', `Network: ${network.label}`, 'names-help'));
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
  form.addEventListener('reset', () => { networkSelect.value = 'juno'; updateNetwork(); });
}
