import { REVIEW_MAINNET_RELEASE } from './juno-review-mainnet-config.mjs';
// Public read-only transport. Provider identities stay distinct for quorum checks.
export const GOVERNANCE_SOURCES = /* @__PURE__ */ Object.freeze({
  'uni7-nodeshub': 'https://juno.test.api.nodeshub.online',
  'uni7-stavr': 'https://juno.api.t.stavr.tech',
  'juno-polkachu': 'https://juno-api.polkachu.com',
  'juno-lavenderfive': 'https://rest.lavenderfive.com/juno',
  'juno-stavr': 'https://juno.api.m.stavr.tech'
});
export const CHAIN_READ_PATH = '/data/governance-read';
const programme = 'juno1nmezpepv3lx45mndyctz2lzqxa6d9xzd2xumkxf7a6r4nxt0y95qypm6c0';
const review = 'juno18d3mzk3ver06zfr5nf752aycss75vtcqd8fsdcuuzmh5mzj4cm6qrgx3fw';
const positive = (v) => /^[1-9]\d{0,19}$/.test(String(v));
export function governanceReadTarget(source, path, height = '') {
  const base = GOVERNANCE_SOURCES[source];
  if (
    !base ||
    typeof path !== 'string' ||
    path.length > 3000 ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    (height && !positive(height))
  )
    throw Error('Invalid governance read.');
  const url = new URL(base + path);
  if (url.href !== base + path || url.hash || url.username || url.password)
    throw Error('Invalid governance URL.');
  const pathname = path.split('?')[0],
    params = url.searchParams;
  let allowed = pathname === '/cosmos/base/tendermint/v1beta1/blocks/latest';
  const mainnet = source.startsWith('juno-');
  if (mainnet) {
    allowed ||=
      [
        '/cosmos/gov/v1/params/deposit',
        '/cosmos/auth/v1beta1/module_accounts/gov',
        `/cosmwasm/wasm/v1/contract/${programme}`,
        `/cosmwasm/wasm/v1/contract/${REVIEW_MAINNET_RELEASE.contract}`,
        `/cosmwasm/wasm/v1/code/${REVIEW_MAINNET_RELEASE.codeId}`,
        `/cosmos/distribution/v1beta1/delegators/${programme}/withdraw_address`
      ].includes(pathname) ||
      /^\/cosmos\/gov\/v1\/proposals\/[1-9]\d{0,19}$/.test(pathname) ||
      /^\/cosmos\/tx\/v1beta1\/txs\/[A-F0-9]{64}$/.test(pathname);
    if (
      /^\/cosmos\/bank\/v1beta1\/spendable_balances\/juno1[a-z0-9]{38,58}\/by_denom$/.test(pathname)
    ) {
      if (params.toString() !== 'denom=ujuno') throw Error('Unsupported denomination.');
      return url.href;
    }
    if (
      pathname === '/cosmos/gov/v1/proposals' ||
      pathname === `/cosmos/staking/v1beta1/delegations/${programme}`
    ) {
      if (
        params.get('pagination.limit') !== '100' ||
        [...params.keys()].some(
          (k) => !['pagination.limit', 'pagination.reverse', 'pagination.key'].includes(k)
        ) ||
        [...params.keys()].some((k) => params.getAll(k).length !== 1) ||
        (params.has('pagination.reverse') && params.get('pagination.reverse') !== 'true') ||
        (params.get('pagination.key') || '').length > 1024
      )
        throw Error('Invalid governance pagination.');
      return url.href;
    }
  }
  const isMainnetReview =
    mainnet &&
    pathname.startsWith(`/cosmwasm/wasm/v1/contract/${REVIEW_MAINNET_RELEASE.contract}/smart/`);
  const prefix = `/cosmwasm/wasm/v1/contract/${isMainnetReview ? REVIEW_MAINNET_RELEASE.contract : mainnet ? programme : review}/smart/`;
  if (pathname.startsWith(prefix)) {
    const q = JSON.parse(atob(decodeURIComponent(pathname.slice(prefix.length))));
    const keys = Object.keys(q),
      type = keys[0],
      value = q[type];
    if (keys.length !== 1 || !value || typeof value !== 'object' || Array.isArray(value))
      throw Error('Invalid contract read.');
    if (mainnet && !isMainnetReview)
      allowed = ['admin', 'pause_info'].includes(type) && Object.keys(value).length === 0;
    else if (isMainnetReview && type === 'config') allowed = Object.keys(value).length === 0;
    else if (type === 'proposal')
      allowed =
        Object.keys(value).length === 1 &&
        Number.isSafeInteger(value.proposal_id) &&
        positive(value.proposal_id);
    else if (type === 'revisions')
      allowed =
        Object.keys(value).sort().join(',') === 'limit,proposal_id,start_after' &&
        Number.isSafeInteger(value.proposal_id) &&
        positive(value.proposal_id) &&
        value.limit === 1 &&
        (value.start_after === null ||
          (Number.isSafeInteger(value.start_after) && positive(value.start_after)));
  }
  if (!allowed || url.search) throw Error('Unsupported governance read.');
  return url.href;
}
export function governanceFetch(url, options = {}) {
  const source = Object.entries(GOVERNANCE_SOURCES).find(([, base]) =>
    String(url).startsWith(base + '/')
  );
  if (!source || typeof location === 'undefined') return fetch(url, options);
  const path = String(url).slice(source[1].length);
  const height = new Headers(options.headers).get('x-cosmos-block-height') || '';
  governanceReadTarget(source[0], path, height);
  const query = new URLSearchParams({ source: source[0], path });
  if (height) query.set('height', height);
  return fetch(`${CHAIN_READ_PATH}?${query}`, {
    cache: 'no-store',
    credentials: 'omit',
    signal: options.signal
  });
}
