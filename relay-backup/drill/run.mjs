// Uses a new temporary database and random test identity; never takes production paths.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Secp256k1Wallet } from '@cosmjs/amino';
import { exportBackupDatabase } from '../snapshot.mjs';
import { sealPersonalBackup, openPersonalBackup, personalBackupScope } from '../../relay-personal-backup.mjs';

async function start(file, wallet, contract) {
  const child = fork(new URL('./worker.mjs', import.meta.url), [file, wallet, contract], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [],
    env: { PATH: process.env.PATH, NODE_NO_WARNINGS: '1' }
  });
  const done = new Promise(resolve => child.once('exit', resolve));
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    try { await done; } finally { clearTimeout(timer); }
  }
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Synthetic service startup timed out')), 10000);
      child.once('message', value => {
        clearTimeout(timer);
        if (!Number.isInteger(value?.port) || value.port < 1) reject(Error('Invalid synthetic service port'));
        else resolve(value.port);
      });
      child.once('error', () => { clearTimeout(timer); reject(Error('Synthetic process failed')); });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Synthetic process exited before readiness')); });
    });
    return { stop, url: `http://127.0.0.1:${port}` };
  } catch (error) { await stop(); throw error; }
}

export async function runDrill() {
  const started = Date.now(), directory = await mkdtemp(join(tmpdir(), 'cosmoot-synthetic-drill-'));
  await chmod(directory, 0o700);
  let service;
  try {
    const signing = await Secp256k1Wallet.fromKey(randomBytes(32), 'juno');
    const wallet = (await signing.getAccounts())[0].address;
    const identity = { chain: 'juno-1', contract: 'juno1' + 'a'.repeat(58), wallet };
    const code = randomBytes(32).toString('hex'), path = 'relay-' + '1'.repeat(24) + '.db';
    const snapshot = { version: 1, scope: personalBackupScope(identity), corecryptoVersion: '10.5.3',
      descriptor: { fingerprint: 'a'.repeat(64), generation: 1 }, wrappedKey: 'synthetic wrapped key',
      path, blocks: [{ path, offset: 0, data: [1, 2, 3] }],
      archiveRecords: [{ text: 'Synthetic application restore drill' }],
      sendRecords: [{ state: 'pending', id: '1'.repeat(64) }],
      transactionIntents: [{ status: 'unknown' }], registrationIntent: null, cursor: 8 };
    const source = join(directory, 'source.sqlite'), exported = join(directory, 'copy', 'backup.sqlite');
    const request = (path, method = 'GET', body, token, origin = 'https://drill.example') =>
      fetch(service.url + path, { method, signal: AbortSignal.timeout(5000),
        headers: { origin, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    async function authenticate() {
      const response = await request('/v1/challenge', 'POST', { wallet });
      assert.equal(response.status, 200);
      const challenge = await response.json();
      const doc = { chain_id: '', account_number: '0', sequence: '0', fee: { gas: '0', amount: [] },
        msgs: [{ type: 'sign/MsgSignData', value: { signer: wallet, data: Buffer.from(challenge.message).toString('base64') } }], memo: '' };
      const { signature } = await signing.signAmino(wallet, doc);
      const auth = await request('/v1/auth', 'POST', { nonce: challenge.nonce, signature });
      assert.equal(auth.status, 200);
      return (await auth.json()).accessToken;
    }
    const envelope = await sealPersonalBackup(identity, 1, snapshot, code);
    service = await start(source, wallet, identity.contract);
    let token = await authenticate();
    const written = await request('/v1/backup', 'PUT', { expectedRevision: 0, envelope }, token);
    assert.equal(written.status, 200);
    const receipt = await written.json();
    const conflict = await sealPersonalBackup(identity, 1, { ...snapshot, cursor: 9 }, code);
    assert.equal((await request('/v1/backup', 'PUT', { expectedRevision: 0, envelope: conflict }, token)).status, 409);
    assert.equal((await request('/v1/backup', 'GET', undefined, token, 'https://other.example')).status, 403);
    await exportBackupDatabase(source, exported); // Export committed WAL while the source lives.
    await service.stop();
    service = await start(source, wallet, identity.contract);
    assert.equal((await request('/v1/backup', 'GET', undefined, token)).status, 401);
    token = await authenticate();
    const restarted = (await (await request('/v1/backup', 'GET', undefined, token)).json()).backup;
    assert.equal(restarted.digest, receipt.digest);
    await service.stop();
    service = await start(exported, wallet, identity.contract);
    assert.equal((await request('/v1/backup', 'GET', undefined, token)).status, 401);
    token = await authenticate();
    const response = await request('/v1/backup', 'GET', undefined, token);
    assert.equal(response.status, 200);
    const restored = (await response.json()).backup;
    assert.equal(restored.digest, receipt.digest);
    assert.equal(restored.blob, JSON.stringify(envelope));
    const opened = await openPersonalBackup(identity, JSON.parse(restored.blob), code,
      { minimumRevision: 1, expectedDigest: receipt.digest });
    assert.deepEqual(opened.snapshot, snapshot);
    assert.equal(opened.writesAllowed, false);
    return { schema: 1, ok: true, synthetic: true, authenticated: true, conflictPreserved: true,
      processRestart: true, oldTokensRejected: true, exportedRestore: true, readOnlyRestore: true,
      unresolvedJournalsPreserved: true, elapsedMs: Date.now() - started,
      limitation: 'Local isolated processes only; not off-host retention, a real browser restore, or production cutover.' };
  } finally { await service?.stop(); await rm(directory, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw Error('This drill accepts no production paths or secrets');
  try { console.log(JSON.stringify(await runDrill())); }
  catch { console.error('Synthetic encrypted-backup drill failed; no production data was used.'); process.exitCode = 1; }
}
