// Operator-only export/verification. Never expose over HTTP or upload to Git/CI.
import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, chmod, lstat, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const files = ['faucet.sqlite', 'relay-backup/relay-backup.sqlite'];
const queries = [
  ['SELECT id,address,message,expires,used FROM challenges LIMIT 0',
    'SELECT id,address,status,slot,hash,bytes,confirmed,created FROM claims LIMIT 0',
    'SELECT kind,start,n FROM request_usage LIMIT 0'],
  ['SELECT scope,revision,digest,blob,updated FROM backups LIMIT 0']
];

async function checksum(file) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(file)) hash.update(part);
  return hash.digest('hex');
}

async function regularFile(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.size === 0) throw Error('Expected a nonempty regular database file');
  return info;
}

function inspect(db, index) {
  const checks = db.prepare('PRAGMA integrity_check').all();
  if (checks.length !== 1 || checks[0].integrity_check !== 'ok') {
    throw Error('Database integrity check failed');
  }
  for (const sql of queries[index]) db.prepare(sql).all();
  const tables = index === 0 ? ['challenges', 'claims', 'request_usage'] : ['backups'];
  const rows = Object.fromEntries(tables.map(table => [table,
    db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n]));
  if (index === 1) return { rows };
  // Fingerprint the entire unresolved journal, including signed bytes and locks.
  // The receipt contains no wallet addresses, signed bytes or transaction hashes.
  const hash = createHash('sha256');
  let unresolvedClaims = 0;
  for (const row of db.prepare(
    "SELECT id,address,status,slot,hash,bytes,confirmed,created FROM claims WHERE status IN ('pending','signing') ORDER BY id"
  ).iterate()) {
    hash.update(JSON.stringify(row) + '\n');
    unresolvedClaims++;
  }
  return { rows, unresolvedClaims, unresolvedJournalSha256: hash.digest('hex') };
}

export async function exportState(faucetSource, relaySource, destination) {
  const target = resolve(destination);
  // mkdir is deliberately exclusive: existing exports/state directories are never replaced.
  await mkdir(target, { mode: 0o700 });
  try {
    const receipt = { version: 1, createdAt: new Date().toISOString(),
      consistency: 'individual-snapshots; final cutover requires all source writers stopped',
      files: [] };
    for (const [index, source] of [faucetSource, relaySource].entries()) {
      await regularFile(source);
      const db = new DatabaseSync(resolve(source), { readOnly: true });
      const output = join(target, files[index]);
      try {
        // Validate role before export, then inspect the snapshot itself. No schema changes.
        for (const sql of queries[index]) db.prepare(sql).all();
        await mkdir(dirname(output), { recursive: true, mode: 0o700 });
        await backup(db, output);
      } finally { db.close(); }
      await chmod(output, 0o600);
      // Normalize only the new copy to a standalone file. A WAL-mode header can
      // otherwise create sidecars even on a later read-only verification.
      const snapshot = new DatabaseSync(output);
      let data;
      try {
        snapshot.exec('PRAGMA journal_mode=DELETE');
        data = inspect(snapshot, index);
      } finally { snapshot.close(); }
      receipt.files.push({ path: files[index], bytes: (await lstat(output)).size,
        sha256: await checksum(output), ...data });
    }
    // A complete receipt is published last; an interrupted partial export fails verification.
    await writeFile(join(target, 'state-manifest.json'), JSON.stringify(receipt, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
    await verifyState(target);
    return receipt;
  } catch (error) {
    // Only remove the private directory this invocation created successfully.
    await rm(target, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyState(directory) {
  const root = resolve(directory);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || (rootInfo.mode & 0o077)) throw Error('Export directory must be private');
  const relayInfo = await lstat(join(root, 'relay-backup'));
  if (!relayInfo.isDirectory() || (relayInfo.mode & 0o077)) throw Error('Backup directory must be private');
  const manifestInfo = await regularFile(join(root, 'state-manifest.json'));
  if (manifestInfo.mode & 0o077) throw Error('Export manifest must be private');
  const receipt = JSON.parse(await readFile(join(root, 'state-manifest.json'), 'utf8'));
  if (receipt.version !== 1 || receipt.files?.length !== files.length) throw Error('Invalid export receipt');
  for (let index = 0; index < files.length; index++) {
    const entry = receipt.files[index];
    if (entry.path !== files[index]) throw Error('Unexpected export file');
    const file = join(root, files[index]);
    const info = await regularFile(file);
    if (info.mode & 0o077) throw Error('Export database must be private');
    // Export packages must remain standalone and untouched until verified on the target.
    for (const suffix of ['-wal', '-shm', '-journal']) {
      const sidecar = await lstat(file + suffix).catch(error => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (sidecar) throw Error('Unexpected SQLite sidecar in export');
    }
    if (entry.bytes !== info.size || entry.sha256 !== await checksum(file)) throw Error('Export checksum mismatch');
    const db = new DatabaseSync(file, { readOnly: true });
    let observed;
    try { observed = inspect(db, index); } finally { db.close(); }
    if (JSON.stringify(entry.rows) !== JSON.stringify(observed.rows) ||
        entry.unresolvedClaims !== observed.unresolvedClaims ||
        entry.unresolvedJournalSha256 !== observed.unresolvedJournalSha256) {
      throw Error('Export state does not match its receipt');
    }
  }
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.umask(0o077);
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'export' && args.length === 3) await exportState(...args);
    else if (command === 'verify' && args.length === 1) await verifyState(args[0]);
    else throw Error('Usage: node scripts/backend-state.mjs export FAUCET_DB RELAY_DB NEW_DIRECTORY | verify DIRECTORY');
    console.log('Both database snapshots and their private receipt verified. This does not prove final cutover or off-server recovery.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
