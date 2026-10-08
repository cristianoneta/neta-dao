import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readFile, writeFile, stat, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportState, verifyState } from '../scripts/backend-state.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'cosmoot-state-'));
  const faucet = join(root, 'faucet.sqlite'), relay = join(root, 'relay.sqlite');
  const db = new DatabaseSync(faucet), backup = new DatabaseSync(relay);
  t.after(async () => { db.close(); backup.close(); await rm(root, { recursive: true, force: true }); });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
    CREATE TABLE challenges(id TEXT PRIMARY KEY,address TEXT,message TEXT,expires INTEGER,used INTEGER);
    CREATE TABLE claims(id TEXT PRIMARY KEY,address TEXT,status TEXT,slot INTEGER UNIQUE,hash TEXT,bytes TEXT,confirmed INTEGER,created INTEGER);
    CREATE TABLE request_usage(kind TEXT PRIMARY KEY,start INTEGER,n INTEGER);
    INSERT INTO claims VALUES('pending','synthetic-wallet','pending',1,'SYNTHETIC_HASH','signed fixture',NULL,100);
    INSERT INTO claims VALUES('confirmed','synthetic-wallet-2','confirmed',NULL,'OTHER_HASH','older fixture',50,1);
    INSERT INTO claims VALUES('signing','synthetic-wallet-3','signing',NULL,NULL,NULL,NULL,101);
    INSERT INTO request_usage VALUES('day',0,12);`);
  backup.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
    CREATE TABLE backups(scope TEXT PRIMARY KEY,revision INTEGER,digest TEXT,blob TEXT,updated INTEGER);
    INSERT INTO backups VALUES('synthetic-scope',7,'synthetic-digest','encrypted fixture',100);`);
  return { root, faucet, relay, db, backup, target: join(root, 'export') };
}

test('export captures live WAL, all payout locks/quotas and encrypted revisions without exposing them', async t => {
  const f = await fixture(t);
  const receipt = await exportState(f.faucet, f.relay, f.target);
  assert.equal(receipt.files[0].rows.claims, 3);
  assert.equal(receipt.files[0].unresolvedClaims, 2);
  assert.equal(receipt.files[1].rows.backups, 1);
  assert.doesNotMatch(JSON.stringify(receipt), /synthetic-wallet|SYNTHETIC_HASH|signed fixture|encrypted fixture/);
  const restored = new DatabaseSync(join(f.target, 'faucet.sqlite'), { readOnly: true });
  try {
    assert.deepEqual(restored.prepare('SELECT * FROM claims ORDER BY id').all(), f.db.prepare('SELECT * FROM claims ORDER BY id').all());
    assert.equal(restored.prepare('SELECT n FROM request_usage').get().n, 12);
  } finally { restored.close(); }
  f.db.exec("UPDATE claims SET status='confirmed',slot=NULL WHERE id='pending'");
  f.backup.exec('UPDATE backups SET revision=8');
  assert.deepEqual(await verifyState(f.target), receipt);
  const relay = new DatabaseSync(join(f.target, 'relay-backup/relay-backup.sqlite'), { readOnly: true });
  try { assert.equal(relay.prepare('SELECT revision FROM backups').get().revision, 7); } finally { relay.close(); }
  assert.equal((await stat(f.target)).mode & 0o777, 0o700);
  assert.equal((await stat(join(f.target, 'faucet.sqlite'))).mode & 0o777, 0o600);
});

test('existing destinations and missing/wrong-role source databases fail without modifying source state', async t => {
  const f = await fixture(t);
  await exportState(f.faucet, f.relay, f.target);
  const before = await readFile(join(f.target, 'state-manifest.json'));
  await assert.rejects(exportState(f.faucet, f.relay, f.target), /EEXIST/);
  assert.deepEqual(await readFile(join(f.target, 'state-manifest.json')), before);
  const wrong = join(f.root, 'wrong');
  await assert.rejects(exportState(f.relay, f.faucet, wrong), /no such table/);
  await assert.rejects(stat(wrong), /ENOENT/);
  const missing = join(f.root, 'missing');
  await assert.rejects(exportState(missing, f.relay, wrong), /ENOENT/);
  await assert.rejects(stat(missing), /ENOENT/);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM claims').get().n, 3);
});

test('verification rejects incomplete, tampered, unsafe-path and publicly readable exports', async t => {
  const f = await fixture(t);
  const receipt = await exportState(f.faucet, f.relay, f.target);
  const manifest = join(f.target, 'state-manifest.json');
  await writeFile(manifest, JSON.stringify({ ...receipt, files: [] }));
  await assert.rejects(verifyState(f.target), /receipt/);
  const changed = structuredClone(receipt);
  changed.files[0].path = '../faucet.sqlite';
  await writeFile(manifest, JSON.stringify(changed));
  await assert.rejects(verifyState(f.target), /Unexpected export file/);
  await writeFile(manifest, JSON.stringify(receipt));
  await chmod(join(f.target, 'faucet.sqlite'), 0o644);
  await assert.rejects(verifyState(f.target), /private/);
  await chmod(join(f.target, 'faucet.sqlite'), 0o600);
  await writeFile(join(f.target, 'faucet.sqlite-wal'), 'unexpected');
  await assert.rejects(verifyState(f.target), /sidecar/);
  await rm(join(f.target, 'faucet.sqlite-wal'));
  const restored = new DatabaseSync(join(f.target, 'faucet.sqlite'));
  restored.exec("UPDATE claims SET bytes='changed' WHERE id='pending'");
  restored.close();
  await assert.rejects(verifyState(f.target), /checksum/);
});
