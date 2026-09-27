(() => {
  'use strict';
  const CHAIN = 'uni-7';
  const CONTRACT = 'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa';
  const CREATOR = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
  const LABEL = 'NETA RELAY mailbox v0.1 · UNI-7';
  const HASH = 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a';
  const RESTS = ['https://juno.test.api.nodeshub.online', 'https://juno.api.t.stavr.tech'];
  const $ = id => document.getElementById(id);
  let verifiedBase = null;
  let connected = null;
  let request = 0;
  const address = value => /^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,90}$/.test(value);
  const hex = value => /^[0-9a-f]{64}$/i.test(value || '') ? value.toLowerCase() :
    Array.from(Uint8Array.from(atob(value || ''), c => c.charCodeAt(0)), b => b.toString(16).padStart(2, '0')).join('');
  const encoded = query => encodeURIComponent(btoa(JSON.stringify(query)));
  async function get(base, path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(base + path, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error('HTTP ' + response.status);
      return response.json();
    } finally { clearTimeout(timer); }
  }
  async function identity(base) {
    const node = await get(base, '/cosmos/base/tendermint/v1beta1/node_info');
    if (node.default_node_info?.network !== CHAIN) throw Error('WRONG CHAIN');
    const info = (await get(base, '/cosmwasm/wasm/v1/contract/' + CONTRACT)).contract_info;
    if (info?.creator !== CREATOR || info.label !== LABEL || !/^[1-9]\\d*$/.test(String(info.code_id)))
      throw Error('CONTRACT IDENTITY MISMATCH');
    const code = (await get(base, '/cosmwasm/wasm/v1/code/' + info.code_id)).code_info;
    if (hex(code?.data_hash) !== HASH) throw Error('CODE HASH MISMATCH');
  }
  async function verify() {
    verifiedBase = null;
    $('check').disabled = true;
    $('results').replaceChildren();
    let mismatch = false;
    for (const base of RESTS) {
      try {
        await identity(base);
        if (mismatch) break;
        verifiedBase = base;
        $('identity').textContent = 'VERIFIED · UNI-7 · ' + CONTRACT;
        $('status').textContent = 'ENTER TWO ADDRESSES TO READ THEIR PUBLIC STATE.';
        $('check').disabled = false;
        return;
      } catch (error) {
        if (/WRONG CHAIN|MISMATCH/.test(error.message)) mismatch = true;
      }
    }
    $('identity').textContent = mismatch ? 'IDENTITY MISMATCH · CHECK BLOCKED' : 'NETWORK UNAVAILABLE · CHECK BLOCKED';
    $('status').textContent = 'NO PUBLIC STATE WAS READ.';
  }
  async function smart(base, query) {
    const result = await get(base, '/cosmwasm/wasm/v1/contract/' + CONTRACT + '/smart/' + encoded(query));
    return result.data;
  }
  function row(label, value) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = label + ': ';
    p.append(strong, document.createTextNode(String(value)));
    return p;
  }
  function render(addressValue, device, inbox) {
    const section = document.createElement('section');
    section.append(row('ADDRESS', addressValue), row('DEVICE', device ? device.active ? 'ACTIVE' : 'REVOKED' : 'NONE'));
    if (device) {
      section.append(row('GENERATION', device.generation), row('FINGERPRINT', device.fingerprint),
        row('AVAILABLE PREKEYS', device.prekeys?.length ?? 'UNKNOWN'));
    }
    section.append(row('INBOX', (inbox.messages || []).length + ' PUBLIC RECORDS IN FIRST PAGE (MAX 50)'));
    for (const message of inbox.messages || []) {
      // Deliberately omit ciphertext: this page cannot decrypt or authenticate it.
      section.append(row('RECORD', '#' + message.sequence + ' · FROM ' + message.sender +
        ' · SENDER GENERATION ' + message.sender_generation + ' · ID ' + message.message_id));
    }
    $('results').append(section);
  }
  async function check() {
    const current = ++request;
    const first = $('first').value.trim(), second = $('second').value.trim();
    $('results').replaceChildren();
    if (!verifiedBase || !address(first) || !address(second) || first === second) {
      $('status').textContent = 'ENTER TWO DISTINCT VALID JUNO ADDRESSES.';
      return;
    }
    if (connected && first !== connected) {
      $('status').textContent = 'KEPLR ACCOUNT CHANGED · RECONNECT OR CLEAR THE FIRST ADDRESS.';
      return;
    }
    $('status').textContent = 'READING UNI-7 PUBLIC STATE…';
    $('check').disabled = true;
    try {
      await identity(verifiedBase);
      if (connected) {
        const active = (await window.keplr.getOfflineSigner(CHAIN).getAccounts())[0]?.address;
        if (active !== connected) throw Error('KEPLR ACCOUNT CHANGED');
      }
      const data = await Promise.all([first, second].map(async addr => ({
        addr,
        device: await smart(verifiedBase, { device: { address: addr } }),
        inbox: await smart(verifiedBase, { inbox: { address: addr, after: null, limit: 50 } })
      })));
      if (current !== request) return;
      data.forEach(item => render(item.addr, item.device, item.inbox));
      $('status').textContent = 'PUBLIC READ COMPLETE · NO MESSAGE DECRYPTED OR SENT.';
    } catch (error) {
      if (current !== request) return;
      $('results').replaceChildren();
      verifiedBase = null;
      $('status').textContent = 'CHECK FAILED · ' + (error.message || 'NETWORK UNAVAILABLE') + ' · RETRY VERIFICATION.';
      $('identity').textContent = 'VERIFICATION EXPIRED';
    } finally { if (current === request) $('check').disabled = !verifiedBase; }
  }
  $('check').addEventListener('click', check);
  $('connect').addEventListener('click', async () => {
    try {
      if (!window.keplr) throw Error('KEPLR NOT FOUND');
      await window.keplr.enable(CHAIN);
      const account = (await window.keplr.getOfflineSigner(CHAIN).getAccounts())[0]?.address;
      if (!address(account)) throw Error('INVALID UNI-7 ACCOUNT');
      connected = account;
      $('first').value = account;
      ++request;
      $('results').replaceChildren();
      $('status').textContent = 'KEPLR ADDRESS CONNECTED · NO SIGNATURE REQUESTED.';
    } catch (error) { $('status').textContent = error.message || 'KEPLR CONNECTION FAILED'; }
  });
  window.addEventListener('keplr_keystorechange', () => {
    connected = null;
    ++request;
    $('first').value = '';
    $('results').replaceChildren();
    $('status').textContent = 'KEPLR ACCOUNT CHANGED · CONNECT AGAIN.';
  });
  verify();
})();
