import assert from 'node:assert/strict';
import test from 'node:test';
import { Uni7MailboxClient, RELAY_UNI7_MAILBOX } from '../relay-uni7-client.mjs';

const wallet = 'juno1' + 'q'.repeat(38);
const other = 'juno1' + 'p'.repeat(38);
const fingerprint = 'a'.repeat(64);
const device = { device_id: 'local-device-1', protocol_version: 1, fingerprint,
  prekeys: [{ id: 1, bundle: btoa('x'.repeat(32)) }] };
function harness({ network = 'uni-7', existing = null, executeError = null } = {}) {
  let active = wallet, registered = existing, writes = 0, prepared = true;
  const keplr = {
    experimentalSuggestChain: async config => assert.equal(config.chainId, 'uni-7'),
    enable: async chain => assert.equal(chain, 'uni-7'),
    getOfflineSigner: chain => {
      assert.equal(chain, 'uni-7');
      return { getAccounts: async () => [{ address: active }] };
    },
    signDirect: async () => {}, signAmino: async () => {}
  };
  const bundle = {
    connect: async () => ({}),
    execute: async (_, address, contract, message) => {
      assert.equal(address, wallet); assert.equal(contract, RELAY_UNI7_MAILBOX);
      assert.deepEqual(message, { register: device });
      writes++;
      registered = { ...device, generation: 1, active: true };
      if (executeError) throw executeError;
      return { transactionHash: 'tx-hash' };
    }
  };
  const fetcher = async url => {
    let data;
    if (url.endsWith('/node_info')) data = { default_node_info: { network } };
    else if (url.endsWith('/contract/' + RELAY_UNI7_MAILBOX))
      data = { contract_info: { creator: 'juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57',
        label: 'NETA RELAY mailbox v0.1 · UNI-7', code_id: '42' } };
    else if (url.endsWith('/code/42'))
      data = { code_info: { data_hash: 'e02c7918d1f8da0f662a0720fc3668765d79ededce8e9e9dcccff9aae2b9e64a' } };
    else if (url.includes('/smart/')) {
      const query = JSON.parse(atob(decodeURIComponent(url.split('/smart/')[1])));
      if (query.device) data = { data: registered };
      else if (query.inbox) data = { data: { messages: [{ sequence: 1, sender: other, recipient: wallet,
        ciphertext: btoa('encrypted bytes') }] } };
    }
    if (!data) return { ok: false, status: 404 };
    return { ok: true, json: async () => data };
  };
  const client = new Uni7MailboxClient({ keplr, bundle, fetcher,
    assertDevicePrepared: async (address, candidate) => prepared && address === wallet && candidate === device });
  return { client, switchWallet: () => { active = other; }, unprepare: () => { prepared = false; },
    writes: () => writes };
}
test('a prepared wallet device registers once and confirms the exact chain identity', async () => {
  const h = harness();
  assert.equal(await h.client.connect(), wallet);
  const result = await h.client.registerPreparedDevice(device);
  assert.equal(result.device.fingerprint, fingerprint);
  assert.equal(result.transactionHash, 'tx-hash');
  assert.equal(h.writes(), 1);
  await assert.rejects(h.client.registerPreparedDevice(device), /already registered/);
  assert.equal(h.writes(), 1);
});
test('wrong chain and unprepared local state cannot request a signature', async () => {
  const wrong = harness({ network: 'juno-1' });
  await assert.rejects(wrong.client.connect(), /NETWORK MISMATCH/);
  assert.equal(wrong.writes(), 0);
  const h = harness();
  await h.client.connect(); h.unprepare();
  await assert.rejects(h.client.registerPreparedDevice(device), /not durably prepared/);
  assert.equal(h.writes(), 0);
});
test('Keplr account switching blocks registration and public inbox reads', async () => {
  const h = harness();
  await h.client.connect(); h.switchWallet();
  await assert.rejects(h.client.registerPreparedDevice(device), /account changed/);
  await assert.rejects(h.client.inbox(), /account changed/);
  assert.equal(h.writes(), 0);
});
test('broadcast uncertainty is reconciled without a second Register', async () => {
  const h = harness({ executeError: Error('timeout after broadcast') });
  await h.client.connect();
  const result = await h.client.registerPreparedDevice(device);
  assert.equal(result.device.generation, 1);
  assert.equal(result.transactionHash, null);
  assert.equal(h.writes(), 1);
});
test('inbox exposes only public ciphertext records for the connected wallet', async () => {
  const h = harness();
  await h.client.connect();
  assert.deepEqual((await h.client.inbox()).map(item => item.sequence), [1]);
  await assert.rejects(h.client.inbox(-1), /Invalid inbox cursor/);
});
