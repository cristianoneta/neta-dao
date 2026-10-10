import {
  REVIEW_MAINNET_RELEASE as PIN,
  REVIEW_MAINNET_POLICY as POLICY
} from './juno-review-mainnet-config.mjs';
import { namesNetwork } from './names/networks.mjs';
import { freshNamesBlock } from './names-v2-reader.mjs';
import { governanceFetch } from './governance-chain-read.mjs';
const stable = (value) =>
  JSON.stringify(value, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x
  );
const decodeHash = (value) =>
  /^[a-f0-9]{64}$/i.test(value || '')
    ? value.toLowerCase()
    : [...Uint8Array.from(atob(value || ''), (c) => c.charCodeAt(0))]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
export async function verifyMainnetReview({
  fetcher = governanceFetch,
  requireActive = false,
  now = () => Math.floor(Date.now() / 1000)
} = {}) {
  if (!PIN) throw Error('Mainnet review is not configured.');
  const observations = await Promise.all(
    namesNetwork('juno-1').rests.map(async (base) => {
      let height;
      const get = async (path) => {
        const r = await fetcher(base + path, {
          cache: 'no-store',
          signal: AbortSignal.timeout(12000),
          headers: height ? { 'x-cosmos-block-height': height } : {}
        });
        if (!r.ok) throw Error('Mainnet review verification unavailable (' + r.status + ').');
        const h = r.headers?.get('x-cosmos-block-height');
        if (height && h && h !== height) throw Error('Review block height mismatch.');
        return r.json();
      };
      const block = freshNamesBlock(
        await get('/cosmos/base/tendermint/v1beta1/blocks/latest'),
        'juno-1',
        typeof now === 'function' ? now() : now / 1000
      );
      height = String(block.height);
      const [instance, code, result] = await Promise.all([
        get('/cosmwasm/wasm/v1/contract/' + PIN.contract),
        get('/cosmwasm/wasm/v1/code/' + PIN.codeId),
        get(
          '/cosmwasm/wasm/v1/contract/' +
            PIN.contract +
            '/smart/' +
            btoa(JSON.stringify({ config: {} }))
        )
      ]);
      const c = instance.contract_info,
        info = code.code_info,
        config = result.data;
      if (
        String(c?.code_id) !== String(PIN.codeId) ||
        c?.creator !== PIN.creator ||
        c?.admin !== PIN.admin ||
        c?.label !== PIN.label ||
        info?.creator !== PIN.creator ||
        decodeHash(info?.data_hash) !== PIN.codeHash
      )
        throw Error('Mainnet review code or authority mismatch.');
      if (
        typeof config?.paused !== 'boolean' ||
        stable({ ...config, paused: true }) !== stable(POLICY)
      )
        throw Error('Mainnet review policy mismatch.');
      return { provider: base, height, config };
    })
  );
  if (stable(observations[0].config) !== stable(observations[1].config))
    throw Error('Mainnet review providers disagree. Retry after confirmation.');
  if (requireActive && observations[0].config.paused)
    throw Error('Mainnet review is paused. The owner must enable it before publication.');
  return { config: observations[0].config, observations };
}
