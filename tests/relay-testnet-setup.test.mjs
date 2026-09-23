import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = await readFile(new URL('../relay-testnet-setup.js', import.meta.url), 'utf8');
const admin = 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57';
const hash = 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a';
const bytes = Uint8Array.from(hash.match(/../g).map(pair => parseInt(pair, 16)));

function fixture() {
  const elements = new Map();
  for (const id of ['status', 'wallet', 'code-id', 'contract-address', 'connect', 'wasm', 'artifact', 'upload', 'instantiate']) {
    elements.set(id, { textContent: '', disabled: false, files: [] });
  }
  let account = admin;
  let uploaded = false;
  let instantiated = false;
  let uploads = 0;
  let instances = 0;
  let digest = bytes;
  const keplr = {
    experimentalSuggestChain: async () => {}, enable: async () => {},
    getOfflineSigner: () => ({ getAccounts: async () => [{ address: account }] }),
    signDirect: async () => {}, signAmino: async () => {},
  };
  const actions = {
    connect: async () => ({ queryContractSmart: async () => null }),
    upload: async () => { uploads++; uploaded = true; return { codeId: 9 }; },
    instantiate: async () => { instances++; instantiated = true; return { contractAddress: 'juno1mailbox' }; },
  };
  const context = {
    document: { getElementById: id => elements.get(id) }, window: { keplr }, NetaSocialsTestnet: actions,
    crypto: { subtle: { digest: async () => digest.buffer } },
    fetch: async url => ({ ok: true, json: async () => {
      if (url.includes('/cosmwasm/wasm/v1/code?')) return { code_infos: uploaded ? [{ creator: admin, data_hash: hash, code_id: '9' }] : [], pagination: {} };
      if (url.includes('/contracts/creator/')) return { contract_addresses: instantiated ? ['juno1mailbox'] : [], pagination: {} };
      if (url.includes('/contract/juno1mailbox')) return { contract_info: { creator: admin, code_id: '9', label: 'NETA RELAY mailbox v0.1 · UNI-7' } };
      throw Error(`Unexpected query ${url}`);
    } }),
    setTimeout, clearTimeout, AbortController, atob,
  };
  runInNewContext(script, context);
  return { elements, setAccount: value => { account = value; }, setDigest: value => { digest = value; }, counts: () => ({ uploads, instances }) };
}

test('bad WASM and a changed wallet cannot trigger testnet transactions', async () => {
  const app = fixture();
  const el = id => app.elements.get(id);
  await el('connect').onclick();
  assert.equal(el('upload').disabled, true);
  el('wasm').files = [{ name: 'neta_relay_mailbox.wasm', size: 1, arrayBuffer: async () => new ArrayBuffer(1) }];
  await el('wasm').onchange();
  await el('upload').onclick();
  assert.deepEqual(app.counts(), { uploads: 0, instances: 0 });

  el('wasm').files = [{ name: 'neta_relay_mailbox.wasm', size: 266165, arrayBuffer: async () => new ArrayBuffer(266165) }];
  app.setDigest(new Uint8Array(32));
  await el('wasm').onchange();
  assert.equal(el('upload').disabled, true);
  await el('upload').onclick();
  assert.deepEqual(app.counts(), { uploads: 0, instances: 0 });
  app.setDigest(bytes);
  await el('wasm').onchange();
  assert.equal(el('upload').disabled, false);
  app.setAccount('juno1different');
  await el('upload').onclick();
  assert.deepEqual(app.counts(), { uploads: 0, instances: 0 });
});

test('verified test wallet explicitly uploads and instantiates once', async () => {
  const app = fixture();
  const el = id => app.elements.get(id);
  await el('connect').onclick();
  el('wasm').files = [{ name: 'neta_relay_mailbox.wasm', size: 266165, arrayBuffer: async () => new ArrayBuffer(266165) }];
  await el('wasm').onchange();
  assert.deepEqual(app.counts(), { uploads: 0, instances: 0 });
  await el('upload').onclick();
  assert.deepEqual(app.counts(), { uploads: 1, instances: 0 });
  await el('instantiate').onclick();
  assert.deepEqual(app.counts(), { uploads: 1, instances: 1 });
  assert.equal(el('contract-address').textContent, 'juno1mailbox');
  await el('instantiate').onclick();
  assert.deepEqual(app.counts(), { uploads: 1, instances: 1 });
});
