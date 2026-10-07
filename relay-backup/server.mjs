import http from 'node:http';
import { clientThrottle, readJson, rejectBody } from '../service/http-guards.mjs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { BackupStore, MAX_BACKUP_BYTES } from './store.mjs';
import { validWallet, verifyOwnership } from './auth.mjs';
const token = () => randomBytes(32).toString('hex');
export function backupServer({
  store,
  origin,
  domain,
  chain,
  contract,
  now = Date.now,
  verify = verifyOwnership,
  allowedWallets,
  bodyTimeoutMs = 5000
}) {
  if (
    !/^https:\/\/[^/]+$/.test(origin) ||
    !/^https:\/\/[^/]+$/.test(domain) ||
    chain !== 'juno-1' ||
    !/^juno1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(contract || '')
  )
    throw Error('Explicit HTTPS origins and deployed mainnet mailbox required');
  if (
    !Array.isArray(allowedWallets) ||
    !allowedWallets.length ||
    allowedWallets.length > 10 ||
    allowedWallets.some((w) => !validWallet(w))
  )
    throw Error('Explicit pilot backup wallet allowlist required');
  const permitted = new Set(allowedWallets);
  const challenges = new Map(),
    sessions = new Map(),
    rates = new Map();
  const active = { anonymous: 0, authenticated: 0 },
    walletActive = new Map();
  const admitAnonymous = clientThrottle({ now, maximum: 30 });
  const purge = (map) => {
    for (const [k, v] of map) if (v.expires <= now()) map.delete(k);
  };
  const json = (res, status, value) => {
    if (res.destroyed || res.headersSent) return;
    res
      .writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      })
      .end(JSON.stringify(value));
  };
  return http.createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      json(res, 200, { ok: true });
      return;
    }
    if (req.headers.origin !== origin) {
      json(res, 403, { error: 'Origin denied' });
      return;
    }
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('access-control-allow-methods', 'GET, POST, PUT');
      res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
      res.writeHead(204).end();
      return;
    }
    purge(challenges);
    purge(sessions);
    purge(rates);
    if (!['/v1/challenge', '/v1/auth', '/v1/backup'].includes(req.url)) {
      json(res, 404, { error: 'Not found' });
      return;
    }
    const isBackup = req.url === '/v1/backup';
    if (!(isBackup ? ['GET', 'PUT'] : ['POST']).includes(req.method)) {
      json(res, 405, { error: 'Unsupported method' });
      return;
    }
    let session = null;
    if (isBackup) {
      session = sessions.get((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!session || session.expires <= now()) {
        json(res, 401, { error: 'Authentication required' });
        return;
      }
      if (++session.requests > 120) {
        json(res, 401, { error: 'Session request limit' });
        return;
      }
    } else if (!admitAnonymous(req)) {
      json(res, 429, { error: 'Rate limit' });
      return;
    }
    const lane = isBackup ? 'authenticated' : 'anonymous';
    if (active[lane] >= 4 || (session && (walletActive.get(session.scope) || 0) >= 1)) {
      json(res, 429, { error: 'Backup request capacity reached' });
      return;
    }
    active[lane]++;
    if (session) walletActive.set(session.scope, (walletActive.get(session.scope) || 0) + 1);
    try {
      if (req.url === '/v1/backup' && req.method === 'GET') {
        json(res, 200, { backup: store.get(session.scope) });
        return;
      }
      if (
        !['POST', 'PUT'].includes(req.method) ||
        req.headers['content-type'] !== 'application/json'
      )
        throw Error('Invalid method or content type');
      const max = req.url === '/v1/backup' ? MAX_BACKUP_BYTES + 4096 : 8192;
      const body = await readJson(req, { maximum: max, timeoutMs: bodyTimeoutMs });
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw Error('Invalid JSON object');
      if (req.url === '/v1/challenge' && req.method === 'POST') {
        if (!validWallet(body.wallet) || !permitted.has(body.wallet) || challenges.size >= 1000)
          throw Error('Invalid wallet or challenge capacity');
        const nonce = token(),
          expires = now() + 120000,
          scope = JSON.stringify([chain, contract, body.wallet]);
        const message = JSON.stringify({
          purpose: 'NETA RELAY encrypted backup access v1',
          domain,
          origin,
          scope,
          nonce,
          expires
        });
        challenges.set(nonce, { wallet: body.wallet, scope, message, expires });
        json(res, 200, { nonce, message, expires });
      } else if (req.url === '/v1/auth' && req.method === 'POST') {
        const challenge = challenges.get(body.nonce);
        challenges.delete(body.nonce);
        if (
          !challenge ||
          challenge.expires <= now() ||
          !(await verify(challenge.wallet, challenge.message, body.signature)) ||
          sessions.size >= 1000
        )
          throw Error('Invalid wallet proof');
        const accessToken = token(),
          expires = now() + 15 * 60000;
        sessions.set(accessToken, { scope: challenge.scope, expires, requests: 0 });
        json(res, 200, { accessToken, expires, scope: challenge.scope });
      } else if (req.url === '/v1/backup' && req.method === 'PUT')
        json(
          res,
          200,
          store.put(session.scope, body.expectedRevision, JSON.stringify(body.envelope))
        );
      else throw Error('Unsupported method');
    } catch (error) {
      const message = error.message;
      if (error.status === 413 || error.status === 408) rejectBody(req, res);
      json(
        res,
        error.status ||
          (/Authentication required|Session request limit/.test(message)
            ? 401
            : /Revision conflict/.test(message)
              ? 409
              : /quota|capacity|limit|Busy/.test(message)
                ? 429
                : /Authentication|proof/.test(message)
                  ? 401
                  : 400),
        { error: /SQLITE|database/i.test(message) ? 'Backup storage unavailable' : message }
      );
    } finally {
      active[lane]--;
      if (session) {
        const n = walletActive.get(session.scope) - 1;
        if (n) walletActive.set(session.scope, n);
        else walletActive.delete(session.scope);
      }
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = new BackupStore(process.env.RELAY_BACKUP_DB || '/var/data/relay-backup.sqlite');
  const server = backupServer({
    store,
    origin: process.env.RELAY_WEB_ORIGIN,
    domain: process.env.RELAY_BACKUP_ORIGIN || process.env.RENDER_EXTERNAL_URL,
    chain: 'juno-1',
    contract: process.env.RELAY_MAILBOX_CONTRACT,
    allowedWallets: (process.env.RELAY_BACKUP_WALLETS || '').split(',').filter(Boolean)
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.listen(Number(process.env.PORT || 10000), process.env.HOST || '0.0.0.0');
  process.on('SIGTERM', () =>
    server.close(() => {
      store.close();
      process.exit(0);
    })
  );
}
