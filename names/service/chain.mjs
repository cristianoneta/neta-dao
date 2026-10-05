import {CHAIN, POOL, NETA, DAO, RESTS, ARTIFACTS, TARIFF} from './constants.mjs';
import {poolObservation, usdObservation} from './market.mjs';
import {validateJunoAddress, normalizeName} from '../../names-profile-core.mjs';

export const MARKET_PINS = Object.freeze({
  pool: {code_id: 2289, sha256: '42aa4c87ae45d1181cad9a21aea1c3cae352a407f8b72af8ee11d820b1ae7c54',
    creator: 'juno16adshp473hd9sruwztdqrtsfckgtd69glqm6sqk0hc4q40c296qsxl3u3s', admin: 'juno16d73yt7y75pelye4q9jjhew0mttztjf3836w5wwyx7nusl6cnrhqxetv3h'},
  token: {code_id: 1, sha256: 'a9b21b682b417f14b105db5a93367a1b6ae3a827639ea129fb73d47c7322722e',
    creator: 'juno1kysf6ey83a3vkhjm6svyc4fu32kakndhy3ypc8', admin: null},
});
export function publicKey(value) {
  const bytes = Buffer.from(value || '', 'base64');
  if (bytes.length !== 32 || bytes.every(b => b === 0) || bytes.toString('base64') !== value) throw Error('Pin a canonical Ed25519 public key.');
  return value;
}
export function validateDeployment(m, key) {
  if (m?.version !== 2 || m.chain_id !== CHAIN || m.testnet_only !== false || m.token !== NETA || m.treasury !== DAO || m.admin !== DAO || m.quote_public_key !== publicKey(key)) throw Error('Mainnet deployment identity mismatch.');
  for (const k of ['registry', 'profile_contract']) validateJunoAddress(m[k]);
  if (new Set([m.registry, m.profile_contract, NETA, DAO]).size !== 4) throw Error('Contract roles overlap.');
  if (!Number.isSafeInteger(m.signer_version) || m.signer_version < 1) throw Error('Invalid signer version.');
  for (const role of ['registry', 'profiles']) {
    const pin = m.contracts?.[role];
    if (!pin || !Number.isSafeInteger(pin.code_id) || pin.code_id < 1 || pin.sha256 !== ARTIFACTS[role] || pin.admin !== null) throw Error('Mainnet code identity mismatch.');
    validateJunoAddress(pin.creator);
  }
  return structuredClone(m);
}
const canonical = value => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
export function agree(values) {
  if (values.length !== 2 || canonical(values[0]) !== canonical(values[1])) throw Error('Independent chain providers disagree.');
  return values[0];
}
export function blockAnchor(data, now, height) {
  const h = (data?.block || data?.sdk_block)?.header;
  const time = Math.floor(Date.parse(h?.time) / 1000), n = Number(h?.height), hash = data?.block_id?.hash;
  if (h?.chain_id !== CHAIN || !Number.isSafeInteger(n) || n < 1 || (height !== undefined && n !== height) || !Number.isSafeInteger(time) || time > now || now - time > 90 || typeof hash !== 'string' || !/^(?:[A-Fa-f0-9]{64}|[A-Za-z0-9+/]{43}=)$/.test(hash)) throw Error('Mainnet block identity/freshness mismatch.');
  return {height: n, time, hash};
}
export async function boundedText(response, max = 2_000_000) {
  if (!response.ok) throw Error('Upstream unavailable (' + response.status + ').');
  let size = 0; const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > max) throw Error('Upstream response too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Two pinned public providers must agree at one height. This is not a light client.
export class MainnetReader {
  constructor({fetcher = fetch, now = () => Math.floor(Date.now() / 1000)} = {}) {
    this.fetcher = fetcher; this.now = now; this.codeCache = new Set();
  }
  async get(base, path, height) {
    const response = await this.fetcher(base + path, {redirect: 'error', signal: AbortSignal.timeout(12000), headers: height ? {'x-cosmos-block-height': String(height)} : {}});
    if (height && response.headers.get('x-cosmos-block-height') !== String(height)) throw Error('Provider did not honor the requested state height.');
    return JSON.parse(await boundedText(response));
  }
  async atHeight(read) {
    const latest = await Promise.all(RESTS.map(async base => blockAnchor(await this.get(base, '/cosmos/base/tendermint/v1beta1/blocks/latest'), this.now())));
    const height = Math.min(...latest.map(b => b.height));
    const observations = await Promise.all(RESTS.map(async base => {
      const anchor = blockAnchor(await this.get(base, '/cosmos/base/tendermint/v1beta1/blocks/' + height), this.now(), height);
      const value = await read(base, anchor);
      if (this.now() - anchor.time > 90) throw Error('Chain snapshot expired while reading.');
      return {anchor, value};
    }));
    return agree(observations);
  }
  async smart(base, address, query, height) {
    const result = await this.get(base, `/cosmwasm/wasm/v1/contract/${address}/smart/${encodeURIComponent(Buffer.from(JSON.stringify(query)).toString('base64'))}`, height);
    if (!Object.hasOwn(result, 'data')) throw Error('Missing smart-query result.');
    return result.data;
  }
  async contract(base, address, pin, height) {
    const info = (await this.get(base, '/cosmwasm/wasm/v1/contract/' + address, height)).contract_info;
    if (Number(info?.code_id) !== pin.code_id || info.creator !== pin.creator || (info.admin || null) !== pin.admin) throw Error('Contract identity mismatch.');
    const cacheKey = `${base}:${pin.code_id}:${pin.sha256}`;
    if (!this.codeCache.has(cacheKey)) {
      const code = (await this.get(base, '/cosmwasm/wasm/v1/code/' + pin.code_id, height)).code_info;
      const raw = code?.data_hash || '';
      const digest = /^[a-f0-9]{64}$/i.test(raw) ? raw.toLowerCase() : Buffer.from(raw, 'base64').toString('hex');
      if (digest !== pin.sha256) throw Error('Contract code checksum mismatch.');
      this.codeCache.add(cacheKey);
    }
  }
  async pool() {
    const {anchor, value} = await this.atHeight(async (base, a) => {
      await Promise.all([this.contract(base, POOL, MARKET_PINS.pool, a.height), this.contract(base, NETA, MARKET_PINS.token, a.height)]);
      const [pair, cumulative, tokenInfo] = await Promise.all([
        this.smart(base, POOL, {pair: {}}, a.height), this.smart(base, POOL, {cumulative_prices: {}}, a.height), this.smart(base, NETA, {token_info: {}}, a.height),
      ]);
      return {pair, cumulative, tokenInfo};
    });
    return poolObservation({...value, ...anchor});
  }
  async registry(m, key, request) {
    validateDeployment(m, key);
    if (request) {validateJunoAddress(request.payer); normalizeName(request.name);}
    return this.atHeight(async (base, a) => {
      await Promise.all([this.contract(base, m.registry, m.contracts.registry, a.height), this.contract(base, m.profile_contract, m.contracts.profiles, a.height), this.contract(base, NETA, MARKET_PINS.token, a.height)]);
      const [config, profile, tokenInfo] = await Promise.all([
        this.smart(base, m.registry, {config: {}}, a.height), this.smart(base, m.profile_contract, {config: {}}, a.height), this.smart(base, NETA, {token_info: {}}, a.height),
      ]);
      for (const k of ['chain_id', 'token', 'treasury', 'admin', 'quote_public_key', 'signer_version', 'testnet_only']) if (config?.[k] !== m[k]) throw Error('Registry config identity mismatch.');
      if (profile?.registry !== m.registry || tokenInfo?.decimals !== 6 || typeof config.purchases_paused !== 'boolean' || !Number.isSafeInteger(config.tariff_version) || config.tariff_version < 1) throw Error('Invalid registry configuration.');
      if (!request) return {config};
      if (canonical(config.tariff) !== canonical(TARIFF)) throw Error('DAO has not activated the approved 99/19/5 tariff.');
      const name = normalizeName(request.name), identity = await this.smart(base, m.registry, request.operation === 'register' ? {resolve: {name}} : {identity: {name}}, a.height);
      const owner = request.operation === 'register' ? request.payer : identity?.owner;
      validateJunoAddress(owner);
      const owned = await this.smart(base, m.registry, {name_of: {address: owner}}, a.height);
      if (owned?.address !== owner || (owned.name !== null && owned.name !== name)) throw Error('Owner already has another active name.');
      return {config, identity};
    });
  }
}

export async function readUsd({fetcher = fetch, now = Math.floor(Date.now() / 1000), apiKey = ''} = {}) {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=juno-network&vs_currencies=usd&include_last_updated_at=true&precision=full';
  const response = await fetcher(url, {redirect: 'error', signal: AbortSignal.timeout(12000), headers: apiKey ? {'x-cg-demo-api-key': apiKey} : {}});
  return usdObservation(await boundedText(response, 8192), now);
}
