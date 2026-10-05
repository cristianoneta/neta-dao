import {MAINNET_UPGRADE_ADMIN,MAINNET_REGISTRY_ADMIN} from '../mainnet-config.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {Store} from '../service/store.mjs';
import {QuoteEngine, settings} from '../service/engine.mjs';
import {createQuoteServer} from '../service/server.mjs';
import {MainnetReader, agree, blockAnchor, validateDeployment} from '../service/chain.mjs';
import {poolObservation, averagedPool, addObservation, usdObservation} from '../service/market.mjs';
import {POLICY, POOL, NETA, DAO, LP, TARIFF, ARTIFACTS, ORIGIN} from '../service/constants.mjs';
import {marketPrice} from '../quote-policy.mjs';
import {validateQuote} from '../../names-v2-core.mjs';
import {deploymentPlan, tariffProposal} from '../mainnet-plan.mjs';
import {SNAPSHOT_ARTIFACTS} from '../mainnet-artifacts.mjs';

// Synthetic mainnet-shaped manifest: these test addresses are NOT a deployment.
const OWNER = 'juno12jc8ekvrvml9jtk5pvl4tpddj5pep5m5hd8aqt';
const REGISTRY = 'juno186sudtyc6sfwfhs77uj6dnsmgf7sl9774slycavxmmfakhmhxans6f64x7';
const PROFILES = 'juno1rch3ut6r5ht3l94nw9yptdv3lg9fjhafnax5udz6dqzxe8lt6u8qhtmjvp';
const START = 1791190000;
function manifest(key) {
  return {version: 2, chain_id: 'juno-1', testnet_only: false, registry: REGISTRY, profile_contract: PROFILES,
    token: NETA, treasury: DAO, admin: DAO, quote_public_key: key, signer_version: 1,
    contracts: Object.fromEntries(['registry', 'profiles'].map((role, i) => [role, {code_id: 5000 + i, creator: OWNER, admin: null, sha256: ARTIFACTS[role]}]))};
}
const usd = time => ({source: POLICY.usd_source, asset: 'JUNO', usd_per_juno_12: '10000000000', observed_at: time});
function sample(time, cumulative = BigInt(time - START) * 100000000n) {
  return {chain_id: 'juno-1', address: POOL, token: NETA, native_denom: 'ujuno', token_decimals: 6, native_decimals: 6,
    height: 1000 + time - START, hash: 'a'.repeat(64), observed_at: time, cumulative: cumulative.toString(), juno_reserve: '100000000000', neta_reserve: '1000000000'};
}
const samples = () => Array.from({length: 61}, (_, i) => sample(START + i * 30));
function fixture(store = new Store(':memory:')) {
  let now = START, paused = false, fail = false;
  const m = manifest(store.publicKey);
  const config = {...m, tariff: TARIFF, tariff_version: 2, purchases_paused: false};
  const reader = {pool: async () => {if (fail) throw Error('Upstream unavailable.'); return sample(now);},
    registry: async (_m, _key, request) => ({value: {config: {...config, purchases_paused: paused}, identity: request.operation === 'register'
      ? {name: request.name, available: true, next_generation: 1}
      : {name: request.name, owner: OWNER, generation: 1, ownership_revision: 2, expires_at: now + 86400}}})};
  const engine = new QuoteEngine({store, reader, now: () => now, usdReader: async () => usd(now),
    config: {signing_enabled: true, deployment: m, baseline: {observed_at: START, usd_per_neta_12: '1000000000000'}}});
  return {engine, store, m, config, setTime: t => {now = t;}, pause: () => {paused = true;}, fail: () => {fail = true;},
    warm: async () => {for (let i = 0; i <= 60; i++) {now = START + i * 30; await engine.poll();}}};
}
const request = {operation: 'register', payer: OWNER, name: 'abc.neta', years: 1};

test('WYND adapter validates roles and chooses NETA -> JUNO accumulator regardless of asset order', () => {
  const native = {native: 'ujuno'}, token = {token: NETA};
  const input = {pair: {contract_addr: POOL, liquidity_token: LP, pair_type: {xyk: {}}, asset_infos: [token, native]},
    cumulative: {assets: [{info: token, amount: '1000000000'}, {info: native, amount: '100000000000'}], cumulative_prices: [[native, token, '100'], [token, native, '9999']]},
    tokenInfo: {symbol: 'NETA', decimals: 6}, height: 123, time: START, hash: 'a'.repeat(64)};
  assert.equal(poolObservation(input).cumulative, '9999');
  assert.throws(() => poolObservation({...input, pair: {...input.pair, contract_addr: LP}}), /identity/);
  assert.throws(() => poolObservation({...input, tokenInfo: {symbol: 'NETA', decimals: 18}}), /identity/);
});
test('30-minute cumulative average handles Uint128 rollover and rejects gaps, low liquidity, spot manipulation and regressions', () => {
  const s = samples(), end = START + 1800;
  assert.equal(averagedPool(s, POLICY, end).twap_price_6, '100000000');
  const wrapped = s.map(p => ({...p, cumulative: ((BigInt(p.cumulative) + (1n << 128n) - 100n) % (1n << 128n)).toString()}));
  assert.equal(averagedPool(wrapped, POLICY, end).twap_price_6, '100000000');
  assert.throws(() => averagedPool(s.slice(1), POLICY, end), /warming/);
  assert.throws(() => averagedPool([...s.slice(0, 2), ...s.slice(8)], POLICY, end), /Gap/);
  assert.throws(() => averagedPool(s.map((p, i) => i === 20 ? {...p, neta_reserve: '1'} : p), POLICY, end), /liquidity/);
  assert.throws(() => averagedPool([...s.slice(0, -1), {...s.at(-1), juno_reserve: '200000000000'}], POLICY, end), /deviates/);
  assert.throws(() => averagedPool(s, POLICY, end + 91), /stale/);
  assert.throws(() => addObservation(s, sample(START), POLICY), /regressed/);
  assert.throws(() => addObservation(s, {...s.at(-1), hash: 'b'.repeat(64)}, POLICY), /Conflicting/);
});
test('USD reference preserves decimal precision, timestamp and coin identity', () => {
  const body = '{"juno-network":{"usd":0.008918049952961688,"last_updated_at":1791190000}}';
  assert.equal(usdObservation(body, START).usd_per_juno_12, '8918049952');
  assert.equal(usdObservation('{"juno-network":{"usd":1.25e-2,"last_updated_at":1791190000}}', START).usd_per_juno_12, '12500000000');
  for (const b of [body.replace('juno-network', 'other'), body.replace('0.008918049952961688', '-1'), body.replace('1791190000', '1791190001'), body.replace('"usd":', '"usd":1,"usd":')]) assert.throws(() => usdObservation(b, START));
});
test('market policy cannot silently revert to spot and rejects stale USD or price jumps', () => {
  const pool = averagedPool(samples(), POLICY, START + 1800);
  const args = {pool, usd: usd(START + 1800), previous: {usd_per_neta_12: '1000000000000', observed_at: START}, policy: POLICY, now: START + 1800};
  assert.equal(marketPrice(args), '1000000000000');
  assert.throws(() => marketPrice({...args, pool: sample(START + 1800)}), /average/);
  assert.throws(() => marketPrice({...args, usd: usd(START)}), /stale/);
  assert.throws(() => marketPrice({...args, previous: {...args.previous, usd_per_neta_12: '500000000000'}}), /movement/);
});
test('chain observations require matching providers, exact requested height, fresh juno-1 blocks and code pins', async () => {
  assert.deepEqual(agree([{a: 1, b: 2}, {b: 2, a: 1}]), {a: 1, b: 2});
  assert.throws(() => agree([{height: 3}, {height: 4}]), /disagree/);
  const block = {block: {header: {height: '10', chain_id: 'juno-1', time: new Date(START * 1000).toISOString()}}, block_id: {hash: 'a'.repeat(64)}};
  assert.equal(blockAnchor(block, START, 10).height, 10);
  assert.throws(() => blockAnchor(block, START, 11), /mismatch/);
  assert.throws(() => blockAnchor(block, START + 91), /mismatch/);
  const reader = new MainnetReader({fetcher: async () => new Response('{}', {headers: {'x-cosmos-block-height': '11'}})});
  await assert.rejects(reader.get('https://example.invalid', '/path', 10), /requested state height/);
  reader.get = async (_b, path) => path.includes('/code/') ? {code_info: {data_hash: 'b'.repeat(64)}} : {contract_info: {code_id: '1', creator: OWNER, admin: ''}};
  await assert.rejects(reader.contract('unused', REGISTRY, {code_id: 1, creator: OWNER, admin: null, sha256: 'a'.repeat(64)}, 10), /checksum/);
});
test('server key, quota and audit survive restart without exposing a private key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nns-')); let a;
  try {
    const path = join(dir, 'quotes.sqlite'); a = new Store(path); const key = a.publicKey;
    for (let i = 0; i < 20; i++) assert.equal(a.take(START), true);
    assert.equal(a.take(START), false);
    a.set('public-test', {number: 3}); a.close(); a = new Store(path);
    assert.equal(a.publicKey, key); assert.equal(a.take(START), false); assert.equal(a.take(START + 60), true);
    assert.deepEqual(a.get('public-test'), {number: 3}); assert.equal(statSync(path).mode & 0o777, 0o600);
  } finally {a?.close(); rmSync(dir, {recursive: true, force: true});}
});
test('daily quote budget survives minute rollover and blocks the 1,001st attempt', () => {
  const store = new Store(':memory:'), start = Math.floor(START / 86400) * 86400;
  try {
    for (let minute = 0; minute < 50; minute++) for (let n = 0; n < 20; n++) assert.equal(store.take(start + minute * 60), true);
    assert.equal(store.take(start + 3000), false);
    assert.equal(store.take(start + 86400), true);
  } finally {store.close();}
});
test('registry reader rejects wrong DAO/config, old tariffs and a second active name', async () => {
  const store = new Store(':memory:'), m = manifest(store.publicKey), reader = new MainnetReader();
  let config = {...m, purchases_paused: false, tariff: TARIFF, tariff_version: 2}, ownedName = null;
  reader.atHeight = async read => ({value: await read('unused', {height: 100})});
  reader.contract = async () => {};
  reader.smart = async (_base, address, query) => {
    if (address === PROFILES) return {registry: REGISTRY};
    if (address === NETA) return {decimals: 6};
    if (query.config) return config;
    if (query.resolve) return {name: query.resolve.name, available: true, next_generation: 1};
    if (query.name_of) return {address: query.name_of.address, name: ownedName};
    throw Error('Unexpected query');
  };
  try {
    assert.equal((await reader.registry(m, store.publicKey, request)).value.identity.available, true);
    config = {...config, admin: OWNER}; await assert.rejects(reader.registry(m, store.publicKey, request), /identity mismatch/);
    config = {...config, admin: DAO, tariff: {...TARIFF, three_cents: 64000}}; await assert.rejects(reader.registry(m, store.publicKey, request), /99\/19\/5/);
    config = {...config, tariff: TARIFF}; ownedName = 'other.neta'; await assert.rejects(reader.registry(m, store.publicKey, request), /another active/);
  } finally {store.close();}
});
test('mainnet registration and renewal offers verify against the browser protocol, and paused/stale services stop issuing', async () => {
  const f = fixture();
  try {
    await assert.rejects(f.engine.quote(request), /not ready/);
    await f.warm(); assert.equal(f.engine.status().market_ready, true);
    const offer = await f.engine.quote(request);
    assert.equal(offer.quote.amount, '99000000');
    await validateQuote({deployment: f.m, config: f.config, offer, expected: offer.quote, now: START + 1800});
    const renewal = await f.engine.quote({...request, operation: 'renew', name: 'four.neta'});
    assert.equal(renewal.quote.amount, '19000000'); assert.equal(renewal.quote.ownership_revision, 2);
    await validateQuote({deployment: f.m, config: f.config, offer: renewal, expected: renewal.quote, now: START + 1800});
    assert.equal(f.store.db.prepare('SELECT count(*) n FROM issued').get().n, 2);
    assert.equal(JSON.stringify(f.engine.status()).includes('PRIVATE KEY'), false);
    await assert.rejects(f.engine.quote({...request, amount: '1'}), /only/);
    f.pause(); await assert.rejects(f.engine.quote(request), /not enabled/);
    f.setTime(START + 1900); assert.equal(f.engine.status().market_ready, false);
    await assert.rejects(f.engine.quote(request), /not ready/);
    f.fail(); await f.engine.poll(); assert.equal(f.engine.market, null);
  } finally {f.store.close();}
});
test('price history and warm-up survive restart, but an unsuccessful new observation closes issuance', async () => {
  const f = fixture();
  try {
    await f.warm();
    const resumed = new QuoteEngine({store: f.store, config: f.engine.config, reader: f.engine.reader, usdReader: async () => usd(START + 1830), now: () => START + 1830});
    assert.equal(resumed.status().market_ready, false);
    f.setTime(START + 1830); await resumed.poll(); assert.equal(resumed.status().market_ready, true);
    f.fail(); await resumed.poll(); assert.equal(resumed.status().market_ready, false);
  } finally {f.store.close();}
});
test('mainnet plan pins actual NETA and DAO, starts paused and never bundles unpause with tariff approval', () => {
  const store = new Store(':memory:');
  try {
    const p = deploymentPlan(store.publicKey); assert.equal(p.registry_instantiate.admin, MAINNET_REGISTRY_ADMIN); assert.equal(p.registry_instantiate.token, NETA); assert.equal(p.starts_paused, true); assert.equal(p.wasm_migration_admin, MAINNET_UPGRADE_ADMIN);
    const m = {...manifest(store.publicKey),admin:MAINNET_REGISTRY_ADMIN,version:3,pricing_protocol:'treasury-snapshot-v1'};
    for (const role of ['registry','profiles']) Object.assign(m.contracts[role],{sha256:SNAPSHOT_ARTIFACTS[role].sha256,admin:MAINNET_UPGRADE_ADMIN});
    const proposal = tariffProposal(m, {...m, tariff_version: 1, purchases_paused: true});
    assert.deepEqual(JSON.parse(Buffer.from(proposal.msgs[0].wasm.execute.msg, 'base64')), {set_tariff: {tariff: TARIFF, expected_version: 1}});
    assert.equal(proposal.msgs.length, 1);
    const custom=tariffProposal(m,{...m,tariff_version:8,purchases_paused:false},{three_cents:12000,four_cents:2400,standard_cents:700});
    assert.equal(custom.signing_wallet,MAINNET_REGISTRY_ADMIN);
    assert.deepEqual(custom.decoded_execute,{set_tariff:{tariff:{three_cents:12000,four_cents:2400,standard_cents:700},expected_version:8}});
    assert.throws(()=>tariffProposal(m,{...m,tariff_version:8,purchases_paused:false},{three_cents:0,four_cents:2400,standard_cents:700}),/positive integer/);
    assert.throws(() => validateDeployment({...m, admin: OWNER}, store.publicKey), /mismatch/);
    assert.throws(() => settings({signing_enabled: true}, store.publicKey), /reviewed/);
    assert.throws(() => settings({usd_source: 'another-source'}, store.publicKey), /Unknown/);
  } finally {store.close();}
});
test('HTTP service enforces origin, methods, JSON bounds and disabled issuance without chain writes', async () => {
  const store = new Store(':memory:'), engine = new QuoteEngine({store});
  const server = createQuoteServer(engine);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const status = await fetch(base + '/status', {headers: {origin: ORIGIN}});
    assert.equal(status.headers.get('access-control-allow-origin'), ORIGIN); assert.equal((await status.json()).mode, 'observe');
    assert.equal((await fetch(base + '/status', {headers: {origin: 'https://evil.invalid'}})).status, 403);
    assert.equal((await fetch(base + '/quote')).status, 405);
    assert.equal((await fetch(base + '/quote', {method: 'POST', body: '{}'})).status, 415);
    const post = body => fetch(base + '/quote', {method: 'POST', headers: {'content-type': 'application/json'}, body});
    assert.equal((await post('bad-json')).status, 400);
    assert.equal((await post('x'.repeat(2049))).status, 413);
    assert.equal((await post(JSON.stringify(request))).status, 503);
  } finally {server.closeAllConnections(); await new Promise(r => server.close(r)); store.close();}
});
