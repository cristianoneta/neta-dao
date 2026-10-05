import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {Store} from './store.mjs';
import {QuoteEngine} from './engine.mjs';
import {ORIGIN} from './constants.mjs';
import {readUsd} from './chain.mjs';

export function createQuoteServer(engine, now = () => Date.now()) {
  let inFlight = 0, bucket = 0, count = 0;
  const server = createServer(async (req, res) => {
    const headers = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'vary': 'Origin'};
    const origin = req.headers.origin;
    const reply = (status, body) => {res.writeHead(status, headers); res.end(JSON.stringify(body));};
    if (origin && origin !== ORIGIN) return reply(403, {error: 'Origin not allowed.'});
    if (origin) headers['access-control-allow-origin'] = ORIGIN;
    if (req.url === '/healthz' && req.method === 'GET') return reply(200, {ok: true});
    const current = Math.floor(now() / 60000);
    if (current !== bucket) {bucket = current; count = 0;}
    if (++count > 300) return reply(429, {error: 'Request limit reached.'});
    if (req.url === '/status' && req.method === 'GET') return reply(200, engine.status());
    if (req.url !== '/quote') return reply(404, {error: 'Not found.'});
    if (req.method === 'OPTIONS') {
      headers['access-control-allow-methods'] = 'POST'; headers['access-control-allow-headers'] = 'Content-Type';
      return reply(204, {});
    }
    if (req.method !== 'POST') return reply(405, {error: 'Use POST.'});
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(415, {error: 'JSON required.'});
    if (Number(req.headers['content-length'] || 0) > 2048) return reply(413, {error: 'Request too large.'});
    if (inFlight >= 2) return reply(429, {error: 'Quote service busy.'});
    inFlight++;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) {size += chunk.length; if (size > 2048) {reply(413, {error: 'Request too large.'}); return;} chunks.push(chunk);}
      let input;
      try {input = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return reply(400, {error: 'Invalid JSON.'});}
      const offer = await engine.quote(input);
      reply(200, offer);
    } catch (e) {
      // No body, wallet address, API credentials or key is logged.
      reply(/limit reached/.test(e.message) ? 429 : 503, {error: e.message});
    } finally {inFlight--;}
  });
  server.requestTimeout = 20000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  return server;
}

export function start(env = process.env) {
  process.umask(0o077);
  const config = JSON.parse(env.NNS_CONFIG_JSON || '{}');
  const store = new Store(env.NNS_DB_PATH || '/var/data/nns/quotes.sqlite');
  const engine = new QuoteEngine({store, config, usdReader: () => readUsd({apiKey: env.COINGECKO_DEMO_API_KEY || ''})});
  const server = createQuoteServer(engine);
  const port = Number(env.PORT || 10000);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw Error('Invalid port.');
  server.listen(port, env.HOST || '0.0.0.0', () => console.log('NNS quote service listening; inspect /status for public readiness.'));
  let timer, stopped = false;
  const tick = async () => {await engine.poll(); if (!stopped) timer = setTimeout(tick, 30000);};
  void tick();
  const stop = () => {stopped = true; clearTimeout(timer); server.close(() => {store.close(); process.exit(0);});};
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  return {server, engine, store};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
