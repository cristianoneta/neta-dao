import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { clientThrottle, readJson, rejectBody } from '../service/http-guards.mjs';
import { webOrigins } from '../service/web-origins.mjs';
import { trustedProxyAddresses } from '../service/client-address.mjs';
import { validWallet, verifyOwnership } from '../relay-backup/auth.mjs';
import { DiscussionStore } from './store.mjs';
import { DiscussionChain, discussionScope, SOURCES } from './chain.mjs';

const token = () => randomBytes(32).toString('hex');
const fail = (message, status) => {
  throw Object.assign(Error(message), { status });
};
export function discussionServer({
  store,
  chain,
  origins,
  domain = 'https://api.cosmoot.com',
  moderators = [],
  now = Date.now,
  verify = verifyOwnership,
  trustedProxies = [],
  bodyTimeoutMs = 5000
}) {
  const allowed = webOrigins(origins);
  webOrigins(domain);
  if (typeof domain !== 'string' || domain.includes(',') || moderators.some((w) => !validWallet(w)))
    throw Error('Explicit discussion domain and moderator wallets required.');
  const roles = new Set(moderators),
    challenges = new Map(),
    sessions = new Map();
  const admit = clientThrottle({ now, maximum: 180, trustedProxies });
  const admitAuth = clientThrottle({ now, maximum: 15, trustedProxies });
  let active = 0,
    nameWorkers = 0;
  const nameJobs = new Map(),
    nameQueue = [];
  function startNames() {
    while (nameWorkers < 4 && nameQueue.length) {
      const { wallet, job, done } = nameQueue.shift();
      nameWorkers++;
      Promise.resolve()
        .then(() => chain.identity(wallet))
        .then(
          (result) => {
            job.name = result.name;
          },
          () => {}
        )
        .finally(() => {
          job.expires = now() + 30000;
          nameWorkers--;
          done();
          startNames();
        });
    }
  }
  async function authorNames(wallets) {
    for (const [wallet, job] of nameJobs)
      if (job.expires && job.expires <= now()) nameJobs.delete(wallet);
    const selected = wallets.map((wallet) => {
      let job = nameJobs.get(wallet);
      if (!job && nameJobs.size < 1000) {
        job = { name: { status: 'unavailable' }, expires: 0 };
        let done;
        job.promise = new Promise((resolve) => {
          done = resolve;
        });
        nameJobs.set(wallet, job);
        nameQueue.push({ wallet, job, done });
      }
      return [wallet, job];
    });
    startNames();
    let timer;
    await Promise.race([
      Promise.all(selected.map(([, job]) => job?.promise)),
      new Promise((resolve) => {
        timer = setTimeout(resolve, 1500);
      })
    ]);
    clearTimeout(timer);
    return Object.fromEntries(
      selected.map(([wallet, job]) => [wallet, job?.name || { status: 'unavailable' }])
    );
  }

  const purge = (map) => {
    for (const [k, v] of map) if (v.expires <= now()) map.delete(k);
  };
  const json = (res, status, value) => {
    if (res.headersSent || res.destroyed) return;
    res
      .writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      })
      .end(JSON.stringify(value));
  };
  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      // A malformed raw HTTP target must not reject this async listener and
      // terminate the process. Close any unread body after the bounded reply.
      rejectBody(req, res);
      return json(res, 400, { error: 'Invalid request target.' });
    }
    const path = url.pathname.replace(/^\/discussions(?=\/)/, '');
    if (path === '/health' && req.method === 'GET') {
      const sources = store.health();
      return json(res, 200, {
        service: 'cosmoot-discussions',
        version: 1,
        ready: SOURCES.every((required) =>
          sources.some(
            (s) =>
              s.source === [required.kind, required.chainId, required.contract].join(':') &&
              !s.error &&
              s.success &&
              now() - s.success < 300000
          )
        ),
        sources
      });
    }
    const origin = req.headers.origin;
    res.setHeader('vary', 'Origin');
    if (origin && !allowed.has(origin)) return json(res, 403, { error: 'Origin denied.' });
    if (origin) res.setHeader('access-control-allow-origin', origin);
    if (req.method === 'OPTIONS') {
      if (!allowed.has(origin)) return json(res, 403, { error: 'Origin denied.' });
      res.setHeader('access-control-allow-methods', 'GET, POST');
      res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
      return res.writeHead(204).end();
    }
    if (!admit(req) || active >= 12) return json(res, 429, { error: 'Please retry shortly.' });
    active++;
    purge(challenges);
    purge(sessions);
    try {
      if (!['GET', 'POST'].includes(req.method)) fail('Method not allowed.', 405);
      let session = null;
      const supplied = req.headers.authorization;
      if (supplied) {
        session = sessions.get(supplied.replace(/^Bearer /, ''));
        if (
          !session ||
          session.origin !== origin ||
          session.expires <= now() ||
          ++session.requests > 500
        )
          fail('Sign in again to continue.', 401);
      }
      if (req.method === 'GET') {
        if (path === '/v1/threads') {
          const before = url.searchParams.get('before');
          return json(res, 200, {
            threads: store
              .list({
                chain: url.searchParams.get('chain') || 'juno-1',
                before: before ? JSON.parse(before) : null
              })
              .map((t) => ({ ...t, scope: discussionScope(t.root) })),
            sources: store.health()
          });
        }
        if (path === '/v1/resolve') {
          const thread = store.resolve(url.searchParams.get('source'));
          if (!thread)
            fail(
              'This proposal has not been indexed yet. Its original proposal and comments remain available.',
              404
            );
          const ready = store.ready(thread.root);
          return json(res, 200, {
            thread,
            ready,
            replies: store.posts(thread.id, { limit: 1 }).total
          });
        }
        if (path === '/v1/session')
          return json(res, 200, {
            wallet: session?.wallet || null,
            moderator: !!session && roles.has(session.wallet)
          });
        if (path === '/v1/moderation') return json(res, 200, { actions: store.audit() });
        const receipt = path.match(/^\/v1\/requests\/([a-f0-9-]{36})$/);
        if (receipt) {
          if (!session) fail('Sign in to check this reply.', 401);
          const post = store.request(session.wallet, receipt[1]);
          return json(res, 200, { post: post ? { id: post.id, thread: post.thread } : null });
        }
        const match = path.match(/^\/v1\/threads\/([a-f0-9]{32})(?:\/(posts|revisions))?$/);
        if (!match) fail('Not found.', 404);
        if (match[2] === 'revisions')
          return json(res, 200, { revisions: store.revisions(match[1]) });
        const result = store.posts(match[1], {
          start: Number(url.searchParams.get('start') || 0),
          anchor: url.searchParams.has('anchor') ? Number(url.searchParams.get('anchor')) : null
        });
        const wallets = [
          ...new Set(
            [result.thread.author, ...result.posts.map((p) => p.wallet)].filter(validWallet)
          )
        ];
        const authors = await authorNames(wallets);
        return json(res, 200, {
          ...result,
          thread: { ...result.thread, scope: discussionScope(result.thread.root) },
          authors
        });
      }
      if (!allowed.has(origin)) fail('Origin denied.', 403);
      if (req.headers['content-type'] !== 'application/json') fail('JSON required.', 415);
      const body = await readJson(req, { maximum: 32768, timeoutMs: bodyTimeoutMs });
      if (!body || typeof body !== 'object' || Array.isArray(body))
        fail('JSON object required.', 400);
      if (path === '/v1/challenge') {
        if (!admitAuth(req) || challenges.size >= 1000) fail('Please retry shortly.', 429);
        if (!validWallet(body.wallet)) fail('Invalid Juno wallet.', 400);
        const nonce = token(),
          expires = now() + 120000;
        const message = JSON.stringify({
          purpose: 'COSMOOT proposal discussion sign-in v1',
          domain,
          origin,
          chainId: 'juno-1',
          wallet: body.wallet,
          nonce,
          expires
        });
        challenges.set(nonce, { wallet: body.wallet, message, expires, origin });
        return json(res, 200, { nonce, message, expires });
      }
      if (path === '/v1/auth') {
        if (!admitAuth(req)) fail('Please retry shortly.', 429);
        const c = challenges.get(body.nonce);
        if (!c || c.origin !== origin) fail('Sign-in challenge expired or unavailable.', 401);
        challenges.delete(body.nonce);
        if (
          c.expires <= now() ||
          sessions.size >= 1000 ||
          !(await verify(c.wallet, c.message, body.signature))
        )
          fail('Wallet signature could not be verified.', 401);
        const accessToken = token(),
          expires = now() + 30 * 60000;
        sessions.set(accessToken, { wallet: c.wallet, origin, expires, requests: 0 });
        return json(res, 200, {
          accessToken,
          expires,
          wallet: c.wallet,
          moderator: roles.has(c.wallet)
        });
      }
      if (!session) fail('Sign in with Keplr to continue.', 401);
      if (path === '/v1/logout') {
        sessions.delete(supplied.replace(/^Bearer /, ''));
        return json(res, 200, { ok: true });
      }
      if (path === '/v1/moderation') {
        if (!roles.has(session.wallet)) fail('Moderator access required.', 403);
        return json(res, 200, store.moderate(session.wallet, body));
      }
      const match = path.match(/^\/v1\/threads\/([a-f0-9]{32})\/posts$/);
      if (!match) fail('Not found.', 404); // In particular, there is no create-topic endpoint.
      const input = {
        thread: match[1],
        wallet: session.wallet,
        body: body.body,
        reply: body.reply ?? null,
        quote: body.quote ?? null,
        requestId: body.requestId
      };
      const { thread, saved } = store.validatePost(input);
      if (!saved) {
        if (!store.ready(thread.root))
          fail('This proposal is still being indexed. Your reply has not been sent.', 503);
      }
      const evidence = saved
        ? { stake: { status: 'unavailable' }, name: { status: 'unavailable' } }
        : await chain.identity(session.wallet, { stake: true });
      return json(res, 200, store.addPost({ ...input, ...evidence }));
    } catch (error) {
      if ([408, 413].includes(error.status)) rejectBody(req, res);
      json(res, error.status || 400, {
        error: /SQLITE|database/i.test(error.message)
          ? 'Discussion storage is unavailable.'
          : error.message
      });
    } finally {
      active--;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DISCUSSIONS_DB || !process.env.DISCUSSIONS_ORIGINS)
    throw Error('Explicit discussion database and web origins required.');
  const store = new DiscussionStore(process.env.DISCUSSIONS_DB),
    chain = new DiscussionChain();
  if (process.env.DISCUSSIONS_START_AT)
    store.configureScope({
      since: process.env.DISCUSSIONS_START_AT,
      include: (process.env.DISCUSSIONS_INITIAL_SOURCES || '').split(',').filter(Boolean)
    });
  if (!store.policy)
    throw Error('Configure the discussion start date before starting the service.');
  const server = discussionServer({
    store,
    chain,
    origins: process.env.DISCUSSIONS_ORIGINS,
    moderators: (process.env.DISCUSSIONS_MODERATORS || '').split(',').filter(Boolean),
    trustedProxies: trustedProxyAddresses(process.env.COSMOOT_TRUSTED_PROXY_IPS)
  });
  let stopping = false,
    timer;
  async function sync() {
    try {
      await chain.sync(store);
    } catch {
      store.syncStatus(
        'juno-1',
        'Chain synchronization unavailable; retained discussions are still readable.'
      );
    } finally {
      if (!stopping) timer = setTimeout(sync, 60000);
    }
  }
  server.listen(Number(process.env.PORT || 8790), process.env.HOST || '127.0.0.1', () => {
    void sync();
  });
  const stop = () => {
    stopping = true;
    clearTimeout(timer);
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
