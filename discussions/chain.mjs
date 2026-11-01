import { readFileSync } from 'node:fs';
import { discussionSource } from '../discussion-links.mjs';
import { REVIEW_MAINNET_RELEASE } from '../juno-review-mainnet-config.mjs';
import { finalizedReview, matchesReview } from '../juno-community-governance.mjs';
import { normalizedComment } from '../src/governance/comments.mjs';
import { normalizeName } from '../names-profile-core.mjs';
import { validWallet } from '../relay-backup/auth.mjs';

const directory = JSON.parse(
  readFileSync(new URL('../data/dao-directory.json', import.meta.url))
).daos;
const names = JSON.parse(
  readFileSync(new URL('../docs/deployments/nns-mainnet.json', import.meta.url))
);
const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]])
        )
      : v
  );
const unavailable = { status: 'unavailable' };
const keyOf = (source, id) => discussionSource({ ...source, id });
export const SOURCES = Object.freeze([
  { kind: 'native', chainId: 'juno-1', contract: 'gov', dao: 'juno' },
  { kind: 'review', chainId: 'juno-1', contract: REVIEW_MAINNET_RELEASE.contract, dao: 'juno' },
  ...directory
    .filter((d) => d.proposalModule)
    .map((d) => ({ kind: 'dao', chainId: 'juno-1', contract: d.proposalModule, dao: d.id }))
]);
export function discussionScope(root) {
  const [kind, , contract] = root.split(':');
  return kind === 'dao'
    ? directory.find((d) => d.proposalModule === contract)?.name || 'DAO governance'
    : 'Juno governance';
}
const defaults = ['https://juno-api.polkachu.com', 'https://juno.api.m.stavr.tech'];
export class DiscussionChain {
  constructor({ endpoints = defaults, fetcher = fetch, now = Date.now } = {}) {
    if (
      endpoints.length !== 2 ||
      new Set(endpoints.map((e) => new URL(e).origin)).size !== 2 ||
      endpoints.some((e) => !e.startsWith('https://'))
    )
      throw Error('Two independent HTTPS chain providers are required.');
    this.endpoints = endpoints;
    this.fetcher = fetcher;
    this.now = now;
    this.names = new Map();
  }
  async json(base, path, height, deadline) {
    if (!path.startsWith('/') || path.startsWith('//')) throw Error('Invalid chain path.');
    const response = await this.fetcher(base + path, {
      redirect: 'error',
      signal: deadline
        ? AbortSignal.any([deadline, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
      headers: height ? { 'x-cosmos-block-height': String(height) } : {}
    });
    if (
      !response.ok ||
      (height && response.headers.get('x-cosmos-block-height') !== String(height))
    )
      throw Error('Height-pinned chain evidence is unavailable.');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16 * 1024 * 1024) throw Error('Chain response exceeds its size limit.');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async snapshot({ timeout = 20000 } = {}) {
    const deadline = AbortSignal.timeout(timeout);
    const blocks = await Promise.all(
      this.endpoints.map((base) =>
        this.json(base, '/cosmos/base/tendermint/v1beta1/blocks/latest', null, deadline)
      )
    );
    const headers = blocks.map((b) => b.block?.header || b.sdk_block?.header);
    for (const h of headers)
      if (
        h?.chain_id !== 'juno-1' ||
        !/^[1-9]\d*$/.test(h.height) ||
        !Number.isSafeInteger(Number(h.height)) ||
        !Number.isFinite(Date.parse(h.time)) ||
        this.now() - Date.parse(h.time) > 120000 ||
        Date.parse(h.time) - this.now() > 30000
      )
        throw Error('Fresh Juno mainnet evidence is unavailable.');
    const height = Math.min(...headers.map((h) => Number(h.height)));
    const get = async (path) => {
      const values = await Promise.all(
        this.endpoints.map((base) => this.json(base, path, height, deadline))
      );
      if (stable(values[0]) !== stable(values[1]))
        throw Error('Independent Juno sources disagree.');
      return values[0];
    };
    const block = (await get('/cosmos/base/tendermint/v1beta1/blocks/' + height)).block?.header;
    if (block?.chain_id !== 'juno-1' || Number(block.height) !== height)
      throw Error('Observation block mismatch.');
    return { get, height, time: block.time };
  }
  async pages(get, path, field) {
    const rows = [];
    let key = '';
    const seen = new Set();
    for (let page = 0; page < 100; page++) {
      const data = await get(
        path + '?pagination.limit=100' + (key ? '&pagination.key=' + encodeURIComponent(key) : '')
      );
      if (!Array.isArray(data[field])) throw Error('Incomplete chain page.');
      rows.push(...data[field]);
      key = data.pagination?.next_key || '';
      if (!key) return rows;
      if (typeof key !== 'string' || key.length > 1024 || seen.has(key))
        throw Error('Invalid chain pagination.');
      seen.add(key);
    }
    throw Error('Chain history exceeds the bounded sync range.');
  }
  smart(get, contract, query) {
    return get(
      `/cosmwasm/wasm/v1/contract/${contract}/smart/${encodeURIComponent(Buffer.from(JSON.stringify(query)).toString('base64'))}`
    ).then((r) => {
      if (!Object.hasOwn(r, 'data')) throw Error('Missing contract evidence.');
      return r.data;
    });
  }
  async contractPages(get, contract, makeQuery, field, idField) {
    const all = [];
    let cursor = null;
    for (let page = 0; page < 100; page++) {
      const data = await this.smart(get, contract, makeQuery(cursor));
      const batch = field ? data[field] : data;
      if (!Array.isArray(batch)) throw Error('Incomplete contract page.');
      for (const row of batch) {
        if (!Number.isSafeInteger(row[idField]) || row[idField] <= (cursor || 0))
          throw Error('Invalid contract ordering.');
        cursor = row[idField];
        all.push(row);
      }
      // DAO contracts can clamp a requested page size. Only an empty page ends it.
      if (!batch.length) return all;
    }
    throw Error('Contract history exceeds the bounded sync range.');
  }
  async identity(wallet, { stake = false } = {}) {
    if (!validWallet(wallet)) throw Error('Invalid Juno wallet.');
    const cached = this.names.get(wallet);
    if (!stake && cached && cached.expires > this.now())
      return { name: cached.name, stake: unavailable };
    try {
      const snapshot = await this.snapshot(),
        { get, height, time } = snapshot;
      let name = unavailable,
        holdings = unavailable;
      try {
        const info = (await get(`/cosmwasm/wasm/v1/contract/${names.registry}`)).contract_info;
        const code = (await get(`/cosmwasm/wasm/v1/code/${names.contracts.registry.code_id}`))
          .code_info;
        let digest = code?.data_hash;
        if (typeof digest === 'string' && !/^[a-f0-9]{64}$/i.test(digest))
          digest = Buffer.from(digest, 'base64').toString('hex');
        if (
          Number(info?.code_id) !== names.contracts.registry.code_id ||
          digest?.toLowerCase() !== names.contracts.registry.sha256
        )
          throw Error('Name registry identity mismatch.');
        const result = await this.smart(get, names.registry, { name_of: { address: wallet } });
        if (result?.address !== wallet) throw Error('Name reverse lookup identity mismatch.');
        if (result.name === null) name = { status: 'none', height, time };
        else {
          const value = result.name;
          if (typeof value !== 'string' || normalizeName(value) !== value)
            throw Error('Invalid name.');
          const identity = await this.smart(get, names.registry, { identity: { name: value } });
          if (
            identity?.name !== value ||
            identity.owner !== wallet ||
            !Number.isSafeInteger(identity.expires_at) ||
            identity.expires_at * 1000 <= Math.max(this.now(), Date.parse(time))
          )
            throw Error('Name ownership changed.');
          name = {
            status: 'verified',
            name: value,
            owner: wallet,
            height,
            time,
            expires: identity.expires_at * 1000
          };
        }
      } catch {
        /* A wallet remains the author when current name evidence is unavailable. */
      }
      if (stake)
        try {
          const [delegations, validators] = await Promise.all([
            this.pages(
              get,
              `/cosmos/staking/v1beta1/delegations/${wallet}`,
              'delegation_responses'
            ),
            this.pages(get, '/cosmos/staking/v1beta1/validators', 'validators')
          ]);
          const byValidator = new Map(validators.map((v) => [v.operator_address, v]));
          if (byValidator.size !== validators.length) throw Error('Duplicate validators.');
          const seen = new Set();
          let raw = 0n;
          for (const d of delegations) {
            const address = d.delegation?.validator_address,
              validator = byValidator.get(address);
            if (
              d.delegation?.delegator_address !== wallet ||
              !validator ||
              !['BOND_STATUS_BONDED', 'BOND_STATUS_UNBONDING', 'BOND_STATUS_UNBONDED'].includes(
                validator.status
              ) ||
              seen.has(address) ||
              d.balance?.denom !== 'ujuno' ||
              !/^(0|[1-9]\d{0,77})$/.test(d.balance.amount)
            )
              throw Error('Incomplete stake evidence.');
            seen.add(address);
            if (validator.status === 'BOND_STATUS_BONDED') raw += BigInt(d.balance.amount);
          }
          holdings = {
            status: 'verified',
            amountRaw: raw.toString(),
            denom: 'ujuno',
            height,
            time
          };
        } catch {
          /* Not measured is never zero. Posting does not require stake. */
        }
      if (this.names.size >= 1000) this.names.delete(this.names.keys().next().value);
      this.names.set(wallet, {
        name,
        expires: Math.min(this.now() + 60000, name.expires || Infinity)
      });
      return { name, stake: holdings };
    } catch {
      return { name: unavailable, stake: unavailable };
    }
  }
  async sync(store, sources = SOURCES) {
    const snapshot = await this.snapshot({ timeout: 180000 });
    const { get } = snapshot;
    const native = [];
    const finals = [];
    let nativeComplete = false;
    for (const source of sources) {
      const group = [source.kind, source.chainId, source.contract].join(':');
      try {
        if (source.kind === 'native') {
          for (const p of await this.pages(get, '/cosmos/gov/v1/proposals', 'proposals')) {
            const key = keyOf(source, p.id),
              legacy =
                p.messages?.find((m) => m['@type'] === '/cosmos.gov.v1.MsgExecLegacyContent')
                  ?.content || p.content,
              title = p.title || legacy?.title || `Juno proposal #${p.id}`;
            const created = Date.parse(p.submit_time);
            store.syncThread({
              source: key,
              title,
              summary: p.summary || legacy?.description || 'No summary was published.',
              author: p.proposer || null,
              created,
              phase: p.status,
              payload: p,
              url: `https://cosmoot.com/?dao=juno&proposal=${p.id}#governance`
            });
            store.syncStatus(key);
            native.push({ key, proposal: p });
          }
        } else if (source.kind === 'review') {
          const rows = await this.contractPages(
            get,
            source.contract,
            (start_after) => ({ proposals: { start_after, limit: 100 } }),
            null,
            'id'
          );
          for (const p of rows) {
            const revisions = await this.contractPages(
              get,
              source.contract,
              (start_after) => ({ revisions: { proposal_id: p.id, start_after, limit: 100 } }),
              null,
              'version'
            );
            const current = revisions.find(
              (r) => r.version === (p.finalized_version || p.latest_version)
            );
            if (!current || !validWallet(p.author)) throw Error('Incomplete review identity.');
            const key = keyOf(source, p.id);
            const url = new URL('https://cosmoot.com/');
            for (const [k, v] of Object.entries({
              dao: 'juno',
              reviewChain: source.chainId,
              reviewContract: source.contract,
              review: p.id,
              reviewHistory: 'full'
            }))
              url.searchParams.set(k, String(v));
            url.hash = 'governance';
            store.syncThread({
              source: key,
              title: current.title,
              summary: current.summary,
              author: p.author,
              created: p.created_time * 1000,
              phase: p.withdrawn ? 'withdrawn' : p.finalized_version ? 'finalized' : 'discussion',
              revision: current.version,
              payload: p,
              url: url.href,
              revisions
            });
            const comments = await this.contractPages(
              get,
              source.contract,
              (start_after) => ({ comments: { proposal_id: p.id, start_after, limit: 100 } }),
              null,
              'id'
            );
            for (const [i, c] of comments.entries()) {
              if (
                !validWallet(c.author) ||
                !Number.isSafeInteger(c.created_time) ||
                c.created_time < 0
              )
                throw Error('Invalid comment evidence.');
              // Preserve original hidden body internally; it is never returned publicly.
              const normalized = normalizedComment({ ...c, moderation: null }, i);
              store.importComment(key, { ...normalized, moderation: c.moderation });
            }
            store.syncStatus(key);
            if (p.finalized_version)
              try {
                finals.push({
                  key,
                  content: (await finalizedReview(p, current, source.chainId, { readOnly: true }))
                    .content
                });
              } catch {
                /* Unsupported review types remain independent discussions. */
              }
          }
        } else {
          const rows = await this.contractPages(
            get,
            source.contract,
            (start_after) => ({ list_proposals: { start_after, limit: 100 } }),
            'proposals',
            'id'
          );
          for (const p of rows) {
            const value = p.proposal || p;
            // DAO proposal contracts use heights; an original wall-clock time is not invented.
            const existing = store.resolve(keyOf(source, p.id));
            store.syncThread({
              source: keyOf(source, p.id),
              title: value.title,
              summary: value.description || 'No summary was published.',
              author: value.proposer || null,
              created: existing?.created || this.now(),
              phase: value.status,
              payload: p,
              url: `https://cosmoot.com/?dao=${source.dao}&proposal=${p.id}#governance`
            });
            store.syncStatus(keyOf(source, p.id));
          }
        }
        if (source.kind === 'native') nativeComplete = true;
        store.syncStatus(group);
      } catch (error) {
        store.syncStatus(group, error.message);
      }
    }
    for (const final of nativeComplete ? finals : []) {
      const matches = native.filter((n) => matchesReview(n.proposal, final.content));
      if (matches.length === 1) store.link(final.key, matches[0].key);
    }
  }
}
