import { rewardMessages } from './juno-governance-core.mjs';
import { canonical } from './juno-community-governance.mjs';

export const CLAIM_TITLE = 'Juno Delegation Programme — claim staking rewards';
export function roman(value) {
  if (!Number.isInteger(value) || value < 1 || value > 3999)
    throw Error('Claim number outside the supported range.');
  let out = '';
  for (const [amount, symbol] of [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
  ])
    while (value >= amount) {
      out += symbol;
      value -= amount;
    }
  return out;
}
function sequence(title) {
  if (title === CLAIM_TITLE) return 0; // Existing unnumbered claims predate this series.
  if (!title?.startsWith(CLAIM_TITLE + ' ')) return null;
  const suffix = title.slice(CLAIM_TITLE.length + 1);
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  if (!/^[IVXLCDM]+$/.test(suffix) || suffix.length > 15) return null;
  let value = 0;
  for (let i = 0; i < suffix.length; i++)
    value += values[suffix[i]] * (values[suffix[i]] < (values[suffix[i + 1]] || 0) ? -1 : 1);
  return value > 0 && value <= 3999 && roman(value) === suffix ? value : null;
}
export function nextClaimTitle(proposals) {
  let maximum = 0;
  for (const p of proposals) {
    const number = sequence(p.title);
    if (number === null) continue;
    try {
      const messages = p.messages.map((m) => ({
        ...m,
        msg:
          typeof m.msg === 'string'
            ? JSON.parse(
                new TextDecoder().decode(Uint8Array.from(atob(m.msg), (c) => c.charCodeAt(0)))
              )
            : m.msg
      }));
      const validators = messages?.[0]?.msg?.execute_admin_msgs?.msgs?.map(
        (m) => m?.distribution?.withdraw_delegator_reward?.validator
      );
      if (canonical(messages) !== canonical(rewardMessages(validators))) continue;
      maximum = Math.max(maximum, number);
    } catch {
      /* Similar titles with unrelated execution messages are not claims. */
    }
  }
  return `${CLAIM_TITLE} ${roman(maximum + 1)}`;
}
// Exhaust the mainnet history; never reset numbering on a partial/failed read.
export async function readClaimTitle(endpoints, { fetcher = fetch } = {}) {
  const results = await Promise.allSettled(
    [...new Set(endpoints.map((x) => new URL(x).origin))].map(async (base) => {
      const get = async (path) => {
        const r = await fetcher(base + path, {
          cache: 'no-store',
          signal: AbortSignal.timeout(12000)
        });
        if (!r.ok) throw Error('Mainnet claim history unavailable.');
        return r.json();
      };
      const latest = await get('/cosmos/base/tendermint/v1beta1/blocks/latest');
      const header = latest.block?.header || latest.sdk_block?.header;
      const age = Date.now() - Date.parse(header?.time);
      if (header?.chain_id !== 'juno-1' || !Number.isFinite(age) || age < -30000 || age > 120000)
        throw Error('Fresh Juno mainnet history required for claim numbering.');
      let key = '',
        rows = [];
      const seen = new Set();
      for (let page = 0; page < 100; page++) {
        const data = await get(
          '/cosmos/gov/v1/proposals?pagination.limit=100&pagination.reverse=true' +
            (key ? '&pagination.key=' + encodeURIComponent(key) : '')
        );
        if (!Array.isArray(data.proposals)) throw Error('Mainnet claim history unavailable.');
        rows.push(...data.proposals);
        key = data.pagination?.next_key || '';
        if (!key) return nextClaimTitle(rows);
        if (seen.has(key)) break;
        seen.add(key);
      }
      throw Error('Complete mainnet claim history required.');
    })
  );
  const good = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (good.length < 2 || good.some((title) => title !== good[0]))
    throw Error('Two mainnet sources must agree on the next claim number. Refresh and try again.');
  return good[0];
}
