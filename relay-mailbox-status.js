(() => {
  'use strict';
  // Read-only testnet check. Do not register devices or submit messages here.
  const ADDRESS = 'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa';
  const CREATOR = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
  const HASH = 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a';
  const LABEL = 'NETA RELAY mailbox v0.1 · UNI-7';
  const RESTS = ['https://juno.test.api.nodeshub.online', 'https://juno.api.t.stavr.tech'];
  const status = document.querySelector('#relay-mailbox-status');
  if (!status) return;

  function hex(value) {
    if (/^[0-9a-f]{64}$/i.test(value || '')) return value.toLowerCase();
    return Array.from(Uint8Array.from(atob(value || ''), char => char.charCodeAt(0)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function get(base, path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(base + path, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function check(base) {
    const node = await get(base, '/cosmos/base/tendermint/v1beta1/node_info');
    if (node.default_node_info?.network !== 'uni-7') throw Error('WRONG CHAIN');
    const contract = await get(base, `/cosmwasm/wasm/v1/contract/${ADDRESS}`);
    const info = contract.contract_info;
    if (info?.creator !== CREATOR || info.label !== LABEL || !/^[1-9]\d*$/.test(String(info.code_id))) throw Error('CONTRACT IDENTITY MISMATCH');
    const code = await get(base, `/cosmwasm/wasm/v1/code/${info.code_id}`);
    if (hex(code.code_info?.data_hash) !== HASH) throw Error('CODE HASH MISMATCH');
  }
  async function verify() {
    status.textContent = 'CHECKING UNI-7 MAILBOX…';
    let mismatch = false;
    for (const base of RESTS) {
      try {
        await check(base);
        if (mismatch) break;
        status.textContent = `MAILBOX VERIFIED ON UNI-7 · ${ADDRESS} · DMS STILL IN PREVIEW`;
        return;
      } catch (error) {
        if (/WRONG CHAIN|MISMATCH/.test(error.message)) mismatch = true;
      }
    }
    status.textContent = `${mismatch ? 'MAILBOX IDENTITY MISMATCH' : 'MAILBOX CHECK UNAVAILABLE'} · ${ADDRESS} · DMS STILL IN PREVIEW`;
  }
  document.querySelector('#relay-new-message')?.addEventListener('click', () => {
    if (!document.querySelector('#relay-composer')?.hidden) verify();
  });
})();
