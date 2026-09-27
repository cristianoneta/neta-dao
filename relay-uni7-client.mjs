// UNI-7 only. This adapter binds Keplr, the pinned mailbox and a locally
// prepared cryptographic device. It never creates keys or accepts plaintext.
export const RELAY_UNI7_MAILBOX = 'juno13uft9dl34x9wdzcxnm80q8m8sh5cw04lkskzknm9vc0wduxchdxsrnr4pa';
const CHAIN = 'uni-7';
const CREATOR = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const LABEL = 'NETA RELAY mailbox v0.1 · UNI-7';
const CODE_HASH = 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a';
const RESTS = ['https://juno.test.api.nodeshub.online', 'https://juno.api.t.stavr.tech'];
const RPCS = ['https://juno.test.rpc.nodeshub.online', 'https://juno.rpc.t.stavr.tech'];
const ADDRESS = /^juno1[023456789acdefghjklmnpqrstuvwxyz]{38,90}$/;
const HEX = /^[0-9a-f]{64}$/;
const CHAIN_CONFIG = {
  chainId: CHAIN, chainName: 'Juno Testnet', rpc: RPCS[0], rest: RESTS[0],
  bip44: { coinType: 118 },
  bech32Config: {
    bech32PrefixAccAddr: 'juno', bech32PrefixAccPub: 'junopub',
    bech32PrefixValAddr: 'junovaloper', bech32PrefixValPub: 'junovaloperpub',
    bech32PrefixConsAddr: 'junovalcons', bech32PrefixConsPub: 'junovalconspub'
  },
  currencies: [{ coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6 }],
  feeCurrencies: [{ coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6,
    gasPriceStep: { low: .1, average: .2, high: .3 } }],
  stakeCurrency: { coinDenom: 'JUNOX', coinMinimalDenom: 'ujunox', coinDecimals: 6 },
  features: ['cosmwasm']
};
function hash(value) {
  if (/^[0-9a-f]{64}$/i.test(value || '')) return value.toLowerCase();
  const bytes = Uint8Array.from(atob(value || ''), char => char.charCodeAt(0));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function prekey(value) {
  if (!Number.isInteger(value?.id) || value.id < 0 || value.id > 65535 ||
      typeof value.bundle !== 'string' || value.bundle.length > 1370) throw Error('Invalid local prekey');
  let bytes;
  try { bytes = Uint8Array.from(atob(value.bundle), char => char.charCodeAt(0)); }
  catch { throw Error('Invalid local prekey'); }
  if (bytes.length < 32 || bytes.length > 1024 || btoa(String.fromCharCode(...bytes)) !== value.bundle)
    throw Error('Invalid local prekey');
}
function validateDevice(device) {
  if (!device || !/^[A-Za-z0-9-]{1,64}$/.test(device.device_id || '') ||
      device.protocol_version !== 1 || !HEX.test(device.fingerprint || '') ||
      !Array.isArray(device.prekeys) || !device.prekeys.length || device.prekeys.length > 16)
    throw Error('Invalid prepared device');
  const ids = new Set();
  for (const key of device.prekeys) { prekey(key); if (ids.has(key.id)) throw Error('Duplicate prekey'); ids.add(key.id); }
}
async function deadline(promise, ms = 12000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('UNI-7 query timed out')), ms); })]); }
  finally { clearTimeout(timer); }
}
export class Uni7MailboxClient {
  constructor({ keplr, bundle, fetcher = fetch, assertDevicePrepared }) {
    if (!keplr || !bundle?.connect || !bundle?.execute || typeof fetcher !== 'function' ||
        typeof assertDevicePrepared !== 'function') throw Error('UNI-7 dependencies unavailable');
    Object.assign(this, { keplr, bundle, assertDevicePrepared });
    this.fetcher = (...args) => fetcher(...args);
    this.address = null;
    this.base = null;
    this.signingClient = null;
    this.registrationStore = globalThis.localStorage || new Map();
  }
  async get(base, path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await deadline(this.fetcher(base + path, { signal: controller.signal, cache: 'no-store' }));
      if (!response.ok) throw Error('UNI-7 HTTP ' + response.status);
      return await deadline(response.json());
    } finally { clearTimeout(timer); }
  }
  async checkIdentity(base) {
    const node = await this.get(base, '/cosmos/base/tendermint/v1beta1/node_info');
    if (node.default_node_info?.network !== CHAIN) throw Error('UNI-7 NETWORK MISMATCH');
    const info = (await this.get(base, '/cosmwasm/wasm/v1/contract/' + RELAY_UNI7_MAILBOX)).contract_info;
    if (info?.creator !== CREATOR || info.label !== LABEL || !/^[1-9]\d*$/.test(String(info.code_id)))
      throw Error('UNI-7 CONTRACT MISMATCH');
    const code = (await this.get(base, '/cosmwasm/wasm/v1/code/' + info.code_id)).code_info;
    if (hash(code?.data_hash) !== CODE_HASH) throw Error('UNI-7 CODE MISMATCH');
  }
  async verify() {
    this.base = null;
    for (const base of RESTS) {
      try { await this.checkIdentity(base); this.base = base; return base; }
      catch (error) { if (/MISMATCH/.test(error.message)) throw error; }
    }
    throw Error('UNI-7 verification unavailable');
  }
  async smart(query) {
    const base = await this.verify();
    const encoded = encodeURIComponent(btoa(JSON.stringify(query)));
    const response = await this.get(base, '/cosmwasm/wasm/v1/contract/' + RELAY_UNI7_MAILBOX + '/smart/' + encoded);
    return response.data;
  }
  async connect() {
    await this.keplr.experimentalSuggestChain(CHAIN_CONFIG);
    await this.keplr.enable(CHAIN);
    const signer = this.keplr.getOfflineSigner(CHAIN);
    const address = (await signer.getAccounts())[0]?.address;
    if (!ADDRESS.test(address || '')) throw Error('Invalid UNI-7 Keplr account');
    this.address = address;
    this.signingClient = null;
    await this.verify();
    return address;
  }
  async assertWallet() {
    if (!ADDRESS.test(this.address || '')) throw Error('Connect UNI-7 Keplr first');
    const active = (await this.keplr.getOfflineSigner(CHAIN).getAccounts())[0]?.address;
    if (active !== this.address) { this.signingClient = null; throw Error('Keplr account changed; reconnect'); }
  }
  async device(address = this.address) {
    if (!ADDRESS.test(address || '')) throw Error('Invalid Juno address');
    return this.smart({ device: { address } });
  }
  async inbox(after = null) {
    await this.assertWallet();
    if (after !== null && (!Number.isSafeInteger(after) || after < 0)) throw Error('Invalid inbox cursor');
    const result = await this.smart({ inbox: { address: this.address, after, limit: 50 } });
    if (!Array.isArray(result?.messages)) throw Error('Invalid UNI-7 inbox response');
    return result.messages; // Public ciphertext only. The ratchet client must authenticate before display.
  }
  async signer() {
    await this.assertWallet();
    if (this.signingClient) return this.signingClient;
    const signer = this.keplr.getOfflineSigner(CHAIN);
    const wrapped = {
      getAccounts: () => signer.getAccounts(),
      signDirect: (address, doc) => this.keplr.signDirect(CHAIN, address, doc, { preferNoSetFee: true }),
      signAmino: (address, doc) => this.keplr.signAmino(CHAIN, address, doc, { preferNoSetFee: true })
    };
    for (const rpc of RPCS) {
      try { this.signingClient = await deadline(this.bundle.connect(rpc, wrapped), 15000); return this.signingClient; }
      catch { /* Try next pinned UNI-7 endpoint. */ }
    }
    throw Error('UNI-7 signing RPC unavailable');
  }
  async registerPreparedDevice(device) {
    validateDevice(device);
    await this.assertWallet();
    if (await this.assertDevicePrepared(this.address, device) !== true)
      throw Error('Local encrypted device is not durably prepared');
    const old = await this.device();
    if (old) throw Error('Device already registered; rotation needs a separate reviewed flow');
    const intentKey = 'relay-uni7-registration-intent:' + this.address;
    if (this.registrationStore.getItem?.(intentKey) || this.registrationStore.get?.(intentKey))
      throw Error('Unresolved registration intent; inspect chain before another attempt');
    await this.verify();
    await this.assertWallet();
    const msg = { register: {
      device_id: device.device_id, protocol_version: 1,
      fingerprint: device.fingerprint, prekeys: device.prekeys
    } };
    this.registrationStore.setItem ? this.registrationStore.setItem(intentKey, device.fingerprint) :
      this.registrationStore.set(intentKey, device.fingerprint);
    let result, failure;
    try {
      result = await this.bundle.execute(await this.signer(), this.address, RELAY_UNI7_MAILBOX, msg,
        'Register RELAY encrypted device on UNI-7');
    } catch (error) { failure = error; }
    // A broadcast timeout can be ambiguous. Never re-register automatically:
    // a second Register would rotate the generation and invalidate sessions.
    let confirmed;
    try { confirmed = await this.device(); } catch { /* Preserve the ambiguous outcome. */ }
    if (confirmed?.active && confirmed.generation === 1 &&
        confirmed.device_id === device.device_id && confirmed.fingerprint === device.fingerprint) {
      this.registrationStore.removeItem ? this.registrationStore.removeItem(intentKey) :
        this.registrationStore.delete(intentKey);
      return { device: confirmed, transactionHash: result?.transactionHash || null };
    }
    if (failure) throw Error('Registration outcome uncertain; inspect chain before retry: ' + failure.message);
    throw Error('Registration not confirmed; inspect chain before retry');
  }
}
