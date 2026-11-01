import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { parseDiscussionSource } from '../discussion-links.mjs';

const hash = (v) => createHash('sha256').update(v).digest('hex');
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
const text = (v, max, label) => {
  if (typeof v !== 'string' || !v.trim() || [...v].length > max || /\u0000/.test(v))
    fail(`Invalid ${label}.`);
  return v.trim();
};
export class DiscussionStore {
  constructor(path, { now = Date.now, maximumPosts = 1000000 } = {}) {
    this.now = now;
    this.maximumPosts = maximumPosts;
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY, root TEXT UNIQUE NOT NULL, chain TEXT NOT NULL,
        title TEXT NOT NULL, summary TEXT NOT NULL, author TEXT,
        created INTEGER NOT NULL, updated INTEGER NOT NULL, phase TEXT NOT NULL,
        revision INTEGER NOT NULL, locked INTEGER NOT NULL DEFAULT 0, redirect TEXT
      );
      CREATE TABLE IF NOT EXISTS sources (
        key TEXT PRIMARY KEY, thread TEXT NOT NULL REFERENCES threads(id),
        payload TEXT NOT NULL, url TEXT NOT NULL, observed INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS revisions (
        source TEXT NOT NULL REFERENCES sources(key), version INTEGER NOT NULL,
        hash TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(source,version)
      );
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY, thread TEXT NOT NULL REFERENCES threads(id), wallet TEXT NOT NULL,
        body TEXT NOT NULL, reply INTEGER REFERENCES posts(id), quote INTEGER REFERENCES posts(id),
        created INTEGER NOT NULL, stake TEXT NOT NULL, name TEXT NOT NULL,
        request_id TEXT, digest TEXT, imported_key TEXT UNIQUE,
        source_hidden INTEGER NOT NULL DEFAULT 0, source_reason TEXT,
        hidden INTEGER NOT NULL DEFAULT 0, reason TEXT,
        UNIQUE(wallet,request_id)
      );
      CREATE INDEX IF NOT EXISTS posts_thread ON posts(thread,created,id);
      CREATE INDEX IF NOT EXISTS posts_wallet ON posts(wallet,created);
      CREATE TABLE IF NOT EXISTS moderation (
        id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
        target TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS blocks (wallet TEXT PRIMARY KEY, blocked INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_state (source TEXT PRIMARY KEY, success INTEGER, attempted INTEGER NOT NULL, error TEXT);
    `);
  }
  close() {
    this.db.close();
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  thread(id) {
    let row = this.db.prepare('SELECT * FROM threads WHERE id=?').get(id);
    const seen = new Set();
    while (row?.redirect) {
      if (seen.has(row.id)) fail('Invalid discussion redirect.', 503);
      seen.add(row.id);
      row = this.db.prepare('SELECT * FROM threads WHERE id=?').get(row.redirect);
    }
    if (!row) return null;
    const sources = this.db
      .prepare('SELECT key,url,observed,payload FROM sources WHERE thread=?')
      .all(row.id);
    const native = sources.filter((s) => s.key.startsWith('native:'));
    const phase = native.length === 1 ? JSON.parse(native[0].payload).status : null;
    const aliases = this.db
      .prepare('SELECT id FROM threads WHERE redirect=?')
      .all(row.id)
      .map((r) => r.id);
    return {
      ...row,
      aliases,
      phase: typeof phase === 'string' ? phase : row.phase,
      sources: sources.map(({ payload, ...s }) => s)
    };
  }
  resolve(source) {
    parseDiscussionSource(source);
    const row = this.db.prepare('SELECT thread FROM sources WHERE key=?').get(source);
    return row ? this.thread(row.thread) : null;
  }
  // Only the verified chain synchronizer calls this method. No public create API.
  syncThread({
    source,
    title,
    summary,
    author,
    created,
    phase,
    revision = 1,
    payload,
    url,
    revisions = []
  }) {
    const { chainId } = parseDiscussionSource(source);
    title = text(title, 1000, 'proposal title');
    phase = text(phase, 100, 'proposal status');
    summary = text(
      summary || 'No summary was published with this proposal.',
      200000,
      'proposal summary'
    );
    if (
      !Number.isSafeInteger(created) ||
      created < 0 ||
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      typeof url !== 'string' ||
      !url.startsWith('https://cosmoot.com/')
    )
      fail('Invalid proposal evidence.');
    return this.transaction(() => {
      const old = this.resolve(source),
        id = old?.id || hash(source).slice(0, 32);
      if (!old)
        this.db
          .prepare(
            'INSERT INTO threads(id,root,chain,title,summary,author,created,updated,phase,revision) VALUES(?,?,?,?,?,?,?,?,?,?)'
          )
          .run(
            id,
            source,
            chainId,
            title,
            summary,
            author || null,
            created,
            this.now(),
            phase,
            revision
          );
      // A linked native source must not rewrite the immutable review's summary.
      else if (old.root === source)
        this.db
          .prepare('UPDATE threads SET title=?,summary=?,phase=?,revision=?,updated=? WHERE id=?')
          .run(title, summary, phase, revision, this.now(), id);
      this.db
        .prepare(
          'INSERT INTO sources VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,url=excluded.url,observed=excluded.observed'
        )
        .run(source, id, JSON.stringify(payload), url, this.now());
      for (const item of revisions) {
        const encoded = JSON.stringify(item),
          digest = hash(encoded);
        const prior = this.db
          .prepare('SELECT hash FROM revisions WHERE source=? AND version=?')
          .get(source, item.version);
        if (prior && prior.hash !== digest)
          fail('Previously recorded proposal revision changed.', 503);
        this.db
          .prepare('INSERT OR IGNORE INTO revisions VALUES(?,?,?,?)')
          .run(source, item.version, digest, encoded);
      }
      return this.thread(id);
    });
  }
  link(reviewSource, nativeSource) {
    const review = this.resolve(reviewSource),
      native = this.resolve(nativeSource);
    if (!review || !native) fail('Both verified proposal sources are required.');
    if (review.id === native.id) return review;
    return this.transaction(() => {
      this.db.prepare('UPDATE posts SET thread=? WHERE thread=?').run(review.id, native.id);
      this.db.prepare('UPDATE sources SET thread=? WHERE thread=?').run(review.id, native.id);
      this.db.prepare('UPDATE threads SET redirect=? WHERE id=?').run(review.id, native.id);
      this.db
        .prepare('UPDATE threads SET locked=max(locked,?),updated=? WHERE id=?')
        .run(native.locked, this.now(), review.id);
      return this.thread(review.id);
    });
  }
  list({ chain = 'juno-1', before = null, limit = 30 } = {}) {
    if (
      !['juno-1', 'uni-7'].includes(chain) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      fail('Invalid history range.');
    if (
      before !== null &&
      (!Number.isSafeInteger(before.created) || !/^[a-f0-9]{32}$/.test(before.id))
    )
      fail('Invalid history cursor.');
    const rows = this.db
      .prepare(
        `SELECT t.*, (SELECT count(*) FROM posts p WHERE p.thread=t.id) AS replies
      FROM threads t WHERE redirect IS NULL AND chain=? AND (? IS NULL OR created<? OR (created=? AND id<?))
      ORDER BY created DESC,id DESC LIMIT ?`
      )
      .all(
        chain,
        before?.created ?? null,
        before?.created ?? null,
        before?.created ?? null,
        before?.id ?? null,
        limit
      );
    return rows.map(({ summary, ...row }) => row);
  }
  revisions(id) {
    const t = this.thread(id);
    if (!t) fail('Discussion not found.', 404);
    return this.db
      .prepare(
        'SELECT r.source,r.version,r.hash,r.payload FROM revisions r JOIN sources s ON s.key=r.source WHERE s.thread=? ORDER BY r.version'
      )
      .all(t.id)
      .map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
  }
  posts(id, { start = 0, limit = 30, anchor = null } = {}) {
    const t = this.thread(id);
    if (!t) fail('Discussion not found.', 404);
    if (
      !Number.isSafeInteger(start) ||
      start < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      (anchor !== null && (!Number.isSafeInteger(anchor) || anchor < 1))
    )
      fail('Invalid post range.');
    if (anchor !== null) {
      const a = this.db
        .prepare('SELECT id,created FROM posts WHERE thread=? AND id=?')
        .get(t.id, anchor);
      if (!a) fail('Post not found.', 404);
      start = this.db
        .prepare(
          'SELECT count(*) n FROM posts WHERE thread=? AND (created<? OR (created=? AND id<?))'
        )
        .get(t.id, a.created, a.created, a.id).n;
    }
    const total = this.db.prepare('SELECT count(*) n FROM posts WHERE thread=?').get(t.id).n;
    const rows = this.db
      .prepare('SELECT * FROM posts WHERE thread=? ORDER BY created,id LIMIT ? OFFSET ?')
      .all(t.id, limit, start);
    const posts = rows.map((p, index) => ({
      id: p.id,
      position: start + index + 2,
      wallet: p.wallet,
      body: p.hidden || p.source_hidden ? null : p.body,
      reply: p.reply,
      quote: p.quote,
      created: p.created,
      stake: JSON.parse(p.stake),
      nameAtPosting: JSON.parse(p.name),
      imported: p.imported_key !== null,
      hidden: !!(p.hidden || p.source_hidden),
      reason: p.source_hidden ? p.source_reason : p.reason
    }));
    const latest = this.db
      .prepare('SELECT max(created) time FROM posts WHERE thread=?')
      .get(t.id).time;
    return {
      thread: t,
      posts,
      start,
      total,
      latest: Math.max(t.created, latest || 0),
      hasMore: start + rows.length < total
    };
  }
  request(wallet, requestId) {
    const p = this.db
      .prepare('SELECT id,thread,digest FROM posts WHERE wallet=? AND request_id=?')
      .get(wallet, requestId);
    return p ? { ...p } : null;
  }
  addPost({ thread, wallet, body, reply = null, quote = null, requestId, stake, name }) {
    body = text(body, 6000, 'reply (maximum 6,000 characters)');
    if (!/^[a-f0-9-]{36}$/.test(requestId || '')) fail('Invalid reply request ID.');
    const t = this.thread(thread);
    if (!t) fail('Discussion not found.', 404);
    const digest = hash(JSON.stringify([body, reply, quote]));
    return this.transaction(() => {
      const saved = this.request(wallet, requestId);
      if (saved) {
        if (saved.digest !== digest || this.thread(saved.thread)?.id !== t.id)
          fail('This request ID belongs to another reply.', 409);
        return { id: saved.id, thread: saved.thread, replayed: true };
      }
      if (t.locked) fail('This discussion is locked.', 403);
      if (this.db.prepare('SELECT blocked FROM blocks WHERE wallet=?').get(wallet)?.blocked)
        fail('Posting is restricted for this wallet.', 403);
      const recent = this.db
        .prepare(
          'SELECT count(*) n,max(created) latest FROM posts WHERE wallet=? AND imported_key IS NULL AND created>?'
        )
        .get(wallet, this.now() - 3600000);
      if (recent.n >= 20 || (recent.latest !== null && this.now() - recent.latest < 30000))
        fail('Please wait before posting again.', 429);
      if (this.db.prepare('SELECT count(*) n FROM posts').get().n >= this.maximumPosts)
        fail('Discussion storage capacity reached.', 503);
      for (const target of [reply, quote])
        if (target !== null) {
          if (
            !Number.isSafeInteger(target) ||
            !this.db
              .prepare(
                'SELECT id FROM posts WHERE id=? AND thread=? AND hidden=0 AND source_hidden=0'
              )
              .get(target, t.id)
          )
            fail('The quoted or replied-to post is unavailable in this discussion.');
        }
      const result = this.db
        .prepare(
          'INSERT INTO posts(thread,wallet,body,reply,quote,created,stake,name,request_id,digest) VALUES(?,?,?,?,?,?,?,?,?,?)'
        )
        .run(
          t.id,
          wallet,
          body,
          reply,
          quote,
          this.now(),
          JSON.stringify(stake),
          JSON.stringify(name),
          requestId,
          digest
        );
      this.db.prepare('UPDATE threads SET updated=? WHERE id=?').run(this.now(), t.id);
      return { id: Number(result.lastInsertRowid), thread: t.id, replayed: false };
    });
  }
  importComment(source, comment) {
    const t = this.resolve(source);
    if (!t) fail('Review discussion is unavailable.');
    const key = source + ':comment:' + comment.id;
    const old = this.db.prepare('SELECT * FROM posts WHERE imported_key=?').get(key);
    const hidden = !!comment.moderation?.hidden,
      reason = comment.moderation?.reason || null;
    const body = text(
      (comment.title ? comment.title + '\n\n' : '') + comment.body,
      10000,
      'legacy comment'
    );
    if (
      old &&
      (old.wallet !== comment.author ||
        old.body !== body ||
        old.created !== comment.created_time * 1000)
    )
      fail('Previously imported comment changed.', 503);
    if (old) {
      this.db
        .prepare('UPDATE posts SET source_hidden=?,source_reason=? WHERE id=?')
        .run(+hidden, reason, old.id);
      return old.id;
    }
    const parent = comment.parent_id
      ? this.db
          .prepare('SELECT id FROM posts WHERE imported_key=?')
          .get(source + ':comment:' + comment.parent_id)?.id || null
      : null;
    const r = this.db
      .prepare(
        'INSERT INTO posts(thread,wallet,body,reply,created,stake,name,imported_key,source_hidden,source_reason) VALUES(?,?,?,?,?,?,?,?,?,?)'
      )
      .run(
        t.id,
        comment.author,
        body,
        parent,
        comment.created_time * 1000,
        '{"status":"unavailable","reason":"No historical JUNO stake was recorded with this on-chain comment."}',
        '{"status":"unavailable"}',
        key,
        +hidden,
        reason
      );
    return Number(r.lastInsertRowid);
  }
  moderate(actor, { action, target, reason }) {
    reason = text(reason, 500, 'moderation reason');
    return this.transaction(() => {
      if (['hide', 'restore'].includes(action)) {
        if (
          !Number.isSafeInteger(target) ||
          !this.db.prepare('SELECT id FROM posts WHERE id=?').get(target)
        )
          fail('Post not found.', 404);
        this.db
          .prepare('UPDATE posts SET hidden=?,reason=? WHERE id=?')
          .run(+(action === 'hide'), action === 'hide' ? reason : null, target);
      } else if (['lock', 'unlock'].includes(action)) {
        const t = this.thread(target);
        if (!t) fail('Discussion not found.', 404);
        target = t.id;
        this.db.prepare('UPDATE threads SET locked=? WHERE id=?').run(+(action === 'lock'), target);
      } else if (['block', 'unblock'].includes(action)) {
        if (!/^juno1[023456789acdefghjklmnpqrstuvwxyz]{38}$/.test(target)) fail('Invalid wallet.');
        this.db
          .prepare(
            'INSERT INTO blocks VALUES(?,?) ON CONFLICT(wallet) DO UPDATE SET blocked=excluded.blocked'
          )
          .run(target, +(action === 'block'));
      } else fail('Invalid moderation action.');
      this.db
        .prepare('INSERT INTO moderation(actor,action,target,reason,created) VALUES(?,?,?,?,?)')
        .run(actor, action, String(target), reason, this.now());
      return { ok: true };
    });
  }
  audit(limit = 50) {
    return this.db.prepare('SELECT * FROM moderation ORDER BY id DESC LIMIT ?').all(limit);
  }
  syncStatus(source, error = null) {
    this.db
      .prepare(
        'INSERT INTO sync_state VALUES(?,?,?,?) ON CONFLICT(source) DO UPDATE SET success=coalesce(excluded.success,sync_state.success),attempted=excluded.attempted,error=excluded.error'
      )
      .run(
        source,
        error ? null : this.now(),
        this.now(),
        error ? String(error).slice(0, 300) : null
      );
  }
  ready(source) {
    return !!this.db.prepare('SELECT success FROM sync_state WHERE source=?').get(source)?.success;
  }
  health() {
    return this.db
      .prepare(
        "SELECT * FROM sync_state WHERE length(source)-length(replace(source,':',''))<3 ORDER BY source"
      )
      .all();
  }
}
