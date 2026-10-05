import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {generateKeyPairSync, createPrivateKey, createPublicKey, sign, createHash} from 'node:crypto';

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true, mode: 0o700});
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS quota (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS issued (hash TEXT PRIMARY KEY, at INTEGER NOT NULL, price TEXT NOT NULL, amount TEXT NOT NULL);`);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let pem = this.get('signing-key');
      if (!pem) {
        pem = generateKeyPairSync('ed25519').privateKey.export({type: 'pkcs8', format: 'pem'});
        this.set('signing-key', pem);
      }
      this.key = createPrivateKey(pem);
      if (this.key.asymmetricKeyType !== 'ed25519') throw Error('Unexpected signing key type.');
      this.publicKey = Buffer.from(createPublicKey(this.key).export({format: 'jwk'}).x, 'base64url').toString('base64');
      this.db.exec('COMMIT');
    } catch (e) {this.db.exec('ROLLBACK'); throw e;}
  }
  get(key) {const row = this.db.prepare('SELECT value FROM state WHERE key=?').get(key); return row ? JSON.parse(row.value) : null;}
  set(key, value) {this.db.prepare('INSERT INTO state VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));}
  take(now) {
    const buckets = [[`day:${Math.floor(now / 86400)}`, 1000], [`minute:${Math.floor(now / 60)}`, 20]];
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, limit] of buckets) {
        const n = this.db.prepare('SELECT count FROM quota WHERE bucket=?').get(key)?.count || 0;
        if (n >= limit) {this.db.exec('ROLLBACK'); return false;}
      }
      for (const [key] of buckets) this.db.prepare('INSERT INTO quota VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1').run(key);
      this.db.exec('COMMIT'); return true;
    } catch (e) {this.db.exec('ROLLBACK'); throw e;}
  }
  issue(bytes, quote, now) {
    const signature = sign(null, bytes, this.key).toString('base64');
    // Commit the audit record before returning a signature; failure returns no offer.
    this.db.prepare('INSERT INTO issued VALUES (?,?,?,?)').run(createHash('sha256').update(bytes).digest('hex'), now, quote.usd_per_neta_12, quote.amount);
    return signature;
  }
  prune(now) {
    this.db.prepare('DELETE FROM issued WHERE at < ?').run(now - 30 * 86400);
    this.db.prepare('DELETE FROM quota WHERE bucket NOT IN (?,?)').run(`day:${Math.floor(now / 86400)}`, `minute:${Math.floor(now / 60)}`);
  }
  close() {this.db.close();}
}
