(() => {
  'use strict';
  const CHAIN_ID = 'uni-7';
  const ADMIN = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
  const RPCS = ['https://juno.test.rpc.nodeshub.online', 'https://juno.rpc.t.stavr.tech'];
  const RESTS = ['https://juno.test.api.nodeshub.online', 'https://juno.api.t.stavr.tech'];
  const EXPECTED_HASH = 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a';
  const LABEL = 'NETA RELAY mailbox v0.1 · UNI-7';
  const $ = id => document.getElementById(id);
  const state = { address: null, client: null, wasm: null, codeId: null, contract: null, busy: false };
  function status(text) { $('status').textContent = text; }
  function update() {
    $('wallet').textContent = state.address || '';
    $('code-id').textContent = state.codeId ?? '—';
    $('contract-address').textContent = state.contract || '—';
    $('upload').disabled = state.busy || !state.address || !state.wasm || !!state.codeId;
    $('instantiate').disabled = state.busy || !state.codeId || !!state.contract;
  }
  function hex(bytes) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
  function hashHex(value) { return /^[0-9a-f]{64}$/i.test(value || '') ? value.toLowerCase() : hex(Uint8Array.from(atob(value || ''), c => c.charCodeAt(0))); }
  async function get(path) {
    for (const base of RESTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try { const response = await fetch(base + path, { signal: controller.signal, cache: 'no-store' }); if (response.ok) return response.json(); }
        finally { clearTimeout(timer); }
      } catch { /* Try the next public testnet endpoint. */ }
    }
    throw Error('UNI-7 QUERY UNAVAILABLE · NO TRANSACTION WAS STARTED');
  }
  async function findCode() {
    let key = '';
    for (let page = 0; page < 100; page++) {
      const data = await get(`/cosmwasm/wasm/v1/code?pagination.limit=100${key ? `&pagination.key=${encodeURIComponent(key)}` : ''}`);
      const code = (data.code_infos || []).find(info => info.creator === ADMIN && hashHex(info.data_hash) === EXPECTED_HASH);
      if (code) return Number(code.code_id);
      key = data.pagination?.next_key || '';
      if (!key) return null;
    }
    throw Error('CODE SEARCH LIMIT REACHED');
  }
  async function findInstance() {
    let key = '';
    for (let page = 0; page < 100; page++) {
      const data = await get(`/cosmwasm/wasm/v1/contracts/creator/${ADMIN}?pagination.limit=100${key ? `&pagination.key=${encodeURIComponent(key)}` : ''}`);
      for (const address of (data.contract_addresses || []).reverse()) {
        const info = (await get(`/cosmwasm/wasm/v1/contract/${address}`)).contract_info;
        if (Number(info?.code_id) === state.codeId && info.creator === ADMIN && info.label === LABEL) return address;
      }
      key = data.pagination?.next_key || '';
      if (!key) return null;
    }
    throw Error('CONTRACT SEARCH LIMIT REACHED');
  }
  async function assertWallet() {
    if ((await window.keplr.getOfflineSigner(CHAIN_ID).getAccounts())[0]?.address !== ADMIN || state.address !== ADMIN) throw Error('WALLET ACCOUNT CHANGED · RECONNECT KEPLR');
  }
  async function connect() {
    if (!window.keplr) throw Error('KEPLR NOT FOUND');
    const chain = { chainId: CHAIN_ID, chainName: 'Juno Testnet', rpc: RPCS[0], rest: RESTS[0], bip44: { coinType: 118 }, bech32Config: { bech32PrefixAccAddr: 'juno', bech32PrefixAccPub: 'junopub', bech32PrefixValAddr: 'junovaloper', bech32PrefixValPub: 'junovaloperpub', bech32PrefixConsAddr: 'junovalcons', bech32PrefixConsPub: 'junovalconspub' }, currencies: [{ coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6 }], feeCurrencies: [{ coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6, gasPriceStep: { low: .1, average: .2, high: .3 } }], stakeCurrency: { coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6 }, features: ['cosmwasm'] };
    await window.keplr.experimentalSuggestChain(chain);
    await window.keplr.enable(CHAIN_ID);
    const signer = window.keplr.getOfflineSigner?.(CHAIN_ID);
    if (!signer) throw Error('UNI-7 SIGNER UNAVAILABLE');
    const account = (await signer.getAccounts())[0];
    if (account?.address !== ADMIN) throw Error('THIS TEST WALLET IS NOT THE CONFIGURED SETUP WALLET');
    const wrapped = { getAccounts: () => signer.getAccounts(), signDirect: (address, doc) => window.keplr.signDirect(CHAIN_ID, address, doc, { preferNoSetFee: true }), signAmino: (address, doc) => window.keplr.signAmino(CHAIN_ID, address, doc, { preferNoSetFee: true }) };
    for (const rpc of RPCS) {
      try { state.client = await NetaSocialsTestnet.connect(rpc, wrapped); break; } catch { /* Try next RPC. */ }
    }
    if (!state.client) throw Error('UNI-7 RPC UNAVAILABLE');
    state.address = account.address;
    await refresh();
  }
  async function refresh() {
    state.codeId = await findCode();
    state.contract = state.codeId ? await findInstance() : null;
    update();
    status(state.contract ? `MAILBOX VERIFIED ON UNI-7 · ${state.contract}` : state.codeId ? `CODE ${state.codeId} FOUND · READY TO INSTANTIATE` : 'CONNECTED · SELECT THE VERIFIED WASM TO UPLOAD');
  }
  async function run(action) {
    if (state.busy) return;
    state.busy = true; update();
    try { await action(); } catch (error) { status(error.message || String(error)); }
    finally { state.busy = false; update(); }
  }
  $('connect').onclick = () => run(connect);
  $('wasm').onchange = () => run(async () => {
    state.wasm = null;
    $('artifact').textContent = 'WAITING FOR VERIFIED WASM';
    const file = $('wasm').files?.[0];
    if (!file || file.name !== 'neta_relay_mailbox.wasm' || file.size !== 266165) throw Error('SELECT THE EXACT REVIEWED WASM FILE');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    if (digest !== EXPECTED_HASH) throw Error('WASM CHECKSUM MISMATCH · NOTHING WILL BE UPLOADED');
    state.wasm = bytes;
    $('artifact').textContent = `SHA-256 VERIFIED · ${digest}`;
    status('WASM VERIFIED · UPLOAD REQUIRES A KEPLR SIGNATURE');
  });
  $('upload').onclick = () => run(async () => {
    if (!state.address || !state.wasm || state.codeId) throw Error('CONNECT WALLET AND VERIFY WASM FIRST');
    await assertWallet();
    status('CHECK KEPLR · UPLOADING ON UNI-7');
    try { const result = await NetaSocialsTestnet.upload(state.client, state.address, state.wasm, 'Upload NETA RELAY mailbox v0.1 to UNI-7'); state.codeId = Number(result.codeId); }
    catch (error) { state.codeId = await findCode(); if (!state.codeId) throw error; }
    await refresh();
  });
  $('instantiate').onclick = () => run(async () => {
    if (!state.address || !state.codeId || state.contract) throw Error('VERIFIED CODE REQUIRED');
    await assertWallet();
    status('CHECK KEPLR · INSTANTIATING ON UNI-7');
    try { const result = await NetaSocialsTestnet.instantiate(state.client, state.address, state.codeId, {}, LABEL, 'Instantiate NETA RELAY mailbox on UNI-7'); state.contract = result.contractAddress; }
    catch (error) { state.contract = await findInstance(); if (!state.contract) throw error; }
    await refresh();
  });
  update();
})();
