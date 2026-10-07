import http from 'node:http';
import { clientThrottle, readJson, rejectBody } from '../../service/http-guards.mjs';
import { AMOUNT } from './ledger.mjs';
import { validAddress } from './chain.mjs';

export function createFaucetServer({
  ledger,
  adapter,
  origin,
  paused = false,
  now = Date.now,
  backup = null
}) {
  const admitCheap = clientThrottle({ now, maximum: 60 }),
    admitClaim = clientThrottle({ now, maximum: 30 });
  let active = 0,
    snapshot = null,
    snapshotError = false,
    nextRefresh = 0,
    refresh = null;
  async function chainStatus() {
    if (refresh) return refresh;
    if (now() < nextRefresh) {
      if (snapshotError) throw Error('RPC unavailable');
      return snapshot;
    }
    refresh = (async () => {
      try {
        await ledger.reconcile();
        snapshot = { balance: await adapter.balance() };
        snapshotError = false;
        return snapshot;
      } catch (error) {
        snapshotError = true;
        throw error;
      } finally {
        nextRefresh = now() + 30000;
        refresh = null;
      }
    })();
    return refresh;
  }
  const server = http.createServer(async (req, res) => {
    // Shared pilot host, separate protocol routes and admission counters. Never
    // pass a RELAY request to the payout handler (including while disabled).
    if (req.url === '/health' || req.url?.startsWith('/v1/')) {
      if (backup) return backup.emit('request', req, res);
      res
        .writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify({ error: 'RELAY backup is not enabled' }));
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers.origin === origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    const respond = (code, data) => {
      if (!res.headersSent && !res.destroyed) {
        res.writeHead(code);
        res.end(code === 204 ? undefined : JSON.stringify(data));
      }
    };
    let admitted = false;
    try {
      const url = new URL(req.url, 'http://localhost');
      const claim = req.method === 'POST' && url.pathname === '/claim';
      if (!(claim ? admitClaim : admitCheap)(req))
        return respond(429, { error: 'Short-term request limit. Try later.' });
      if (!['/status', '/challenge', '/claim'].includes(url.pathname))
        return respond(404, { error: 'Not found.' });
      if (
        req.method !== 'OPTIONS' &&
        !(url.pathname === '/status' ? req.method === 'GET' : req.method === 'POST')
      )
        return respond(405, { error: 'Method not allowed.' });
      if (paused)
        return respond(503, { error: 'Faucet paused by its operator. Please try later.' });
      if (active >= 4) return respond(429, { error: 'Faucet is busy. Try later.' });
      active++;
      admitted = true;
      if (req.method === 'OPTIONS') {
        if (req.headers.origin !== origin) return respond(403, { error: 'Origin not allowed.' });
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return respond(204);
      }
      if (req.method === 'GET' && url.pathname === '/status') {
        const address = url.searchParams.get('address');
        if (address && !validAddress(address))
          return respond(400, { error: 'Invalid Juno wallet address.' });
        const { balance } = await chainStatus(),
          pause = ledger.guard.payoutPause();
        return respond(200, {
          chainId: 'uni-7',
          address: adapter.address,
          amount: AMOUNT,
          intervalSeconds: 86400,
          balance,
          ready: BigInt(balance) >= BigInt(AMOUNT) + 2000000n && !ledger.blocked() && !pause,
          protection: 'usage-guards-v1',
          confirmation: adapter.confirmation,
          gasPolicy: adapter.gasPolicy,
          pause,
          ...(address ? ledger.eligibility(address) : {})
        });
      }
      if (req.method !== 'POST' || !['/challenge', '/claim'].includes(url.pathname))
        return respond(404, { error: 'Not found.' });
      if (req.headers.origin !== origin) return respond(403, { error: 'Origin not allowed.' });
      if (!req.headers['content-type']?.startsWith('application/json'))
        return respond(415, { error: 'JSON required.' });
      const body = await readJson(req);
      if (!body || !validAddress(body.address) || body.address === adapter.address)
        return respond(400, { error: 'Invalid payout recipient.' });
      if (url.pathname === '/challenge') return respond(200, ledger.challenge(body.address));
      if (typeof body.id !== 'string' || !/^[0-9a-f]{48}$/.test(body.id))
        return respond(400, { error: 'Invalid request id.' });
      const result = await ledger.claim(body);
      // Cached balances can overstate readiness after a payout. Refresh next read.
      nextRefresh = 0;
      return respond(200, result);
    } catch (error) {
      if (error.status) {
        if (error.status === 413 || error.status === 408) rejectBody(req, res);
        return respond(error.status, { error: error.message });
      }
      if (error.retryAt) {
        res.setHeader(
          'Retry-After',
          String(Math.max(1, Math.ceil((Date.parse(error.retryAt) - ledger.now()) / 1000)))
        );
        return respond(429, { error: error.message, retryAt: error.retryAt });
      }
      // Never return secret-bearing RPC/configuration details or log request bodies.
      const allowed =
        /^(Only 25 JUNOX|Your previous payout|Wallet signature|Request a fresh|This request|The faucet is confirming|Please wait|Faucet is busy|Faucet (day|month) payout limit|Invalid payout recipient)/;
      respond(503, {
        error: allowed.test(error.message)
          ? error.message
          : 'Faucet temporarily unavailable. Refresh to check your payout status.'
      });
    } finally {
      if (admitted) active--;
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 40;
  server.setTimeout(15000, (socket) => socket.destroy());
  server.maxRequestsPerSocket = 100;
  return server;
}
