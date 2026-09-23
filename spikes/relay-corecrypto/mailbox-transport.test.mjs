import assert from 'node:assert/strict';
import test from 'node:test';
import { MailboxTransport, MAILBOX } from './mailbox-transport.mjs';

const alice = `juno1${'a'.repeat(38)}`;
const bob = `juno1${'b'.repeat(38)}`;
const messageId = 'a'.repeat(64);
const bytes = new Uint8Array(64).fill(7);
const prekey = new Uint8Array(64).fill(8);
const bundle = Buffer.from(prekey).toString('base64');
const target = { messageId, recipient: bob, generation: 1, deviceId: 'bob-one', fingerprint: 'f'.repeat(64), initialPrekeyId: 4, initialPrekeyBundle: prekey };

function fixture() {
  let network = 'uni-7', account = alice, delivered = null, queries = 0, verified = true;
  let receiver = { active: true, generation: 1, device_id: 'bob-one', fingerprint: target.fingerprint, prekeys: [{ id: 4, bundle }] };
  const transactions = [];
  const query = async (contract, msg) => {
    assert.equal(contract, MAILBOX);
    queries++;
    if (msg.sent) return delivered;
    if (msg.device) return msg.device.address === bob ? receiver : { active: true, generation: 1 };
    throw Error('Unknown query');
  };
  const outbox = { reconcile: async (id, lookup) => {
    const found = await lookup();
    return found != null ? { state: 'confirmed', sequence: found } : { state: 'ready', id, recipient: bob, generation: 1, ciphertext: bytes };
  } };
  const transport = new MailboxTransport({ sender: alice, network: async () => network, account: async () => account, verifyMailbox: async contract => contract === MAILBOX && verified, query, execute: async (contract, msg) => { assert.equal(contract, MAILBOX); transactions.push(msg); delivered = 73; }, outbox });
  return { transport, transactions, get queries() { return queries; }, setNetwork: value => { network = value; }, setAccount: value => { account = value; }, setReceiver: value => { receiver = value; }, setVerified: value => { verified = value; }, setDelivered: value => { delivered = value; } };
}

test('uses persisted ciphertext and consumed prekey once, then recovers by message ID', async () => {
  const app = fixture();
  assert.deepEqual(await app.transport.sendReady(target), { state: 'confirmed', sequence: 73 });
  assert.deepEqual(app.transactions[0], { send_initial: { recipient: bob, recipient_generation: 1, prekey_id: 4, message_id: messageId, ciphertext: Buffer.from(bytes).toString('base64') } });
  assert.deepEqual(await app.transport.sendReady(target), { state: 'confirmed', sequence: 73 });
  assert.equal(app.transactions.length, 1);
});

test('wrong account, chain, device fingerprint or prekey never reaches execute', async () => {
  const app = fixture();
  app.setAccount(bob);
  await assert.rejects(app.transport.sendReady(target), /Wrong chain or wallet/);
  app.setAccount(alice);
  app.setNetwork('juno-1');
  await assert.rejects(app.transport.sendReady(target), /Wrong chain or wallet/);
  app.setNetwork('uni-7');
  app.setVerified(false);
  await assert.rejects(app.transport.sendReady(target), /code identity not verified/);
  app.setVerified(true);
  app.setReceiver({ active: true, generation: 2, device_id: 'bob-one', fingerprint: target.fingerprint, prekeys: [{ id: 4, bundle }] });
  await assert.rejects(app.transport.sendReady(target), /Device identity changed/);
  app.setReceiver({ active: true, generation: 1, device_id: 'bob-one', fingerprint: target.fingerprint, prekeys: [] });
  await assert.rejects(app.transport.sendReady(target), /prekey changed/);
  assert.equal(app.transactions.length, 0);
});

test('RPC uncertainty or an unresolved outbox blocks a second transaction', async () => {
  const app = fixture();
  const transport = app.transport;
  transport.outbox = { reconcile: async () => { throw Error('RPC unavailable'); } };
  await assert.rejects(transport.sendReady(target), /RPC unavailable/);
  assert.equal(app.transactions.length, 0);
  transport.outbox = { reconcile: async () => { throw Error('Unrecoverable send: rotate device'); } };
  await assert.rejects(transport.sendReady(target), /Unrecoverable send/);
  assert.equal(app.transactions.length, 0);
});
