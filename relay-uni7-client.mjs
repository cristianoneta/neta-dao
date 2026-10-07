// Shared identity/query/registration adapter. The compatibility UNI-7 wrapper
// retains its original deployment. Mainnet requires an explicit verified profile.
// This module never creates keys or accepts plaintext.
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
const UNI7_PROFILE = Object.freeze({ chain: CHAIN, contract: RELAY_UNI7_MAILBOX, creator: CREATOR,
  label: LABEL, codeHash: CODE_HASH, rests: RESTS, rpcs: RPCS, chainConfig: CHAIN_CONFIG, fee: undefined });
export class PersonalMailboxClient {
  constructor({ keplr, bundle, fetcher = fetch, assertDevicePrepared }, profile = UNI7_PROFILE) {
    if (!keplr || !bundle?.connect || !bundle?.execute || typeof fetcher !== 'function' ||
        typeof assertDevicePrepared !== 'function') throw Error('UNI-7 dependencies unavailable');
    if (!profile?.contract || !["uni-7","juno-1"].includes(profile.chain)) throw Error("Invalid mailbox profile");
    this.profile = Object.freeze(structuredClone(profile));
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
      if (!response.ok) throw Error('Mailbox HTTP ' + response.status);
      return await deadline(response.json());
    } finally { clearTimeout(timer); }
  }
  async checkIdentity(base) {
    const node = await this.get(base, '/cosmos/base/tendermint/v1beta1/node_info');
    if (node.default_node_info?.network !== this.profile.chain) throw Error('Mailbox NETWORK MISMATCH');
    const info = (await this.get(base, '/cosmwasm/wasm/v1/contract/' + this.profile.contract)).contract_info;
    if (info?.creator !== this.profile.creator || info.label !== this.profile.label || !/^[1-9]\d*$/.test(String(info.code_id)))
      throw Error('Mailbox CONTRACT MISMATCH');
    if (this.profile.admin && (info.admin !== this.profile.admin || String(info.code_id) !== this.profile.codeId)) throw Error('Mailbox administrator or code ID MISMATCH');
    const code = (await this.get(base, '/cosmwasm/wasm/v1/code/' + info.code_id)).code_info;
    if (hash(code?.data_hash) !== this.profile.codeHash) throw Error('Mailbox CODE MISMATCH');
    if (this.profile.policy) {
      const value = (await this.get(base, '/cosmwasm/wasm/v1/contract/' + this.profile.contract + '/smart/' + encodeURIComponent(btoa(JSON.stringify({ config: {} }))))).data;
      if (Object.entries(this.profile.policy).some(([key, expected]) => value?.[key] !== expected)) throw Error('Mailbox policy MISMATCH');
    }
  }
  async verify() {
    this.base = null;
    for (const base of this.profile.rests) {
      try { await this.checkIdentity(base); this.base = base; return base; }
      catch (error) { if (/MISMATCH/.test(error.message)) throw error; }
    }
    throw Error('Mailbox verification unavailable');
  }
  async smart(query) {
    const base = await this.verify();
    const encoded = encodeURIComponent(btoa(JSON.stringify(query)));
    const response = await this.get(base, '/cosmwasm/wasm/v1/contract/' + this.profile.contract + '/smart/' + encoded);
    return response.data;
  }
  async connect() {
    if (this.profile.chainConfig) await this.keplr.experimentalSuggestChain(this.profile.chainConfig);
    await this.keplr.enable(this.profile.chain);
    const signer = this.keplr.getOfflineSigner(this.profile.chain);
    const address = (await signer.getAccounts())[0]?.address;
    if (!ADDRESS.test(address || '')) throw Error('Invalid Juno Keplr account');
    this.address = address;
    this.signingClient = null;
    await this.verify();
    return address;
  }
  async assertWallet() {
    if (!ADDRESS.test(this.address || '')) throw Error('Connect the mailbox network in Keplr first');
    const active = (await this.keplr.getOfflineSigner(this.profile.chain).getAccounts())[0]?.address;
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
    if (!Array.isArray(result?.messages)) throw Error('Invalid mailbox inbox response');
    return result.messages; // Public ciphertext only. The ratchet client must authenticate before display.
  }
  async signer() {
    await this.assertWallet();
    if (this.signingClient) return this.signingClient;
    const signer = this.keplr.getOfflineSigner(this.profile.chain);
    const wrapped = {
      getAccounts: () => signer.getAccounts(),
      signDirect: (address, doc) => this.keplr.signDirect(this.profile.chain, address, doc, { preferNoSetFee: true }),
      signAmino: (address, doc) => this.keplr.signAmino(this.profile.chain, address, doc, { preferNoSetFee: true })
    };
    for (const rpc of this.profile.rpcs) {
      try {
        const client = await deadline(this.bundle.connect(rpc, wrapped, this.profile.fee), 15000);
        if (this.profile.chain === 'juno-1' && (typeof client?.getChainId !== 'function' || await deadline(client.getChainId()) !== this.profile.chain)) {
          client?.disconnect?.(); throw Error('Signing RPC chain mismatch');
        }
        this.signingClient = client; return client;
      }
      catch { /* Try next pinned UNI-7 endpoint. */ }
    }
    throw Error('Mailbox signing RPC unavailable');
  }
  registrationIntentKey() {
    return this.profile.chain === 'uni-7' ? 'relay-uni7-registration-intent:' + this.address :
      ['relay-personal-registration-intent', this.profile.chain, this.profile.contract, this.address].join(':');
  }
  async historicalDevice(address, generation) {
    if (!ADDRESS.test(address || '') || !Number.isSafeInteger(generation) || generation < 1) throw Error('Invalid historical identity');
    return this.smart({ historical_device: { address, generation } });
  }
  async reconcileRegistration(device) {
    validateDevice(device); await this.assertWallet();
    const intentKey = this.registrationIntentKey();
    const saved = this.registrationStore.getItem?.(intentKey) || this.registrationStore.get?.(intentKey);
    if (!saved) return null;
    if (saved !== device.fingerprint) throw Error('Registration intent belongs to another device');
    const confirmed = await this.device();
    if (!confirmed?.active || confirmed.generation !== 1 || confirmed.fingerprint !== device.fingerprint || confirmed.device_id !== device.device_id)
      throw Error('Registration intent remains unresolved; no second signature');
    this.registrationStore.removeItem ? this.registrationStore.removeItem(intentKey) : this.registrationStore.delete(intentKey);
    return confirmed;
  }
  async registerPreparedDevice(device) {
    validateDevice(device);
    await this.assertWallet();
    if (await this.assertDevicePrepared(this.address, device) !== true)
      throw Error('Local encrypted device is not durably prepared');
    const old = await this.device();
    if (old) throw Error('Device already registered; rotation needs a separate reviewed flow');
    const intentKey = this.registrationIntentKey();
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
      result = await this.bundle.execute(await this.signer(), this.address, this.profile.contract, msg,
        'Register RELAY encrypted device on ' + this.profile.chain);
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

export class Uni7MailboxClient extends PersonalMailboxClient {
  constructor(dependencies) { super(dependencies, UNI7_PROFILE); }
}
