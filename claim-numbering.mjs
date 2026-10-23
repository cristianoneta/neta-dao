import { governanceFetch } from './governance-chain-read.mjs';
import { claimValidators } from './juno-governance-core.mjs';
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
export const CLAIM_381_EXPLANATION =
  'Proposal #381 passed its vote but failed because the programme’s DAO DAO contract does not accept the generated distribution messages; this replacement uses the supported Stargate MsgWithdrawDelegatorReward format with the programme treasury explicitly set as delegator, verified through local Juno governance and contract execution.';
function decodedMessages(proposal) {
  return proposal.messages.map((m) => ({
    ...m,
    msg:
      typeof m.msg === 'string'
        ? JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(
              Uint8Array.from(atob(m.msg), (c) => c.charCodeAt(0))
            )
          )
        : m.msg
  }));
}
export function nextClaimContext(proposals) {
  let maximum = 0,
    incident = false,
    replacement = false;
  for (const p of proposals) {
    const number = sequence(p.title);
    if (number === null) continue;
    try {
      const messages = decodedMessages(p);
      claimValidators(messages);
      maximum = Math.max(maximum, number);
      if (
        String(p.id) === '381' &&
        p.status === 'PROPOSAL_STATUS_FAILED' &&
        p.failed_reason?.includes('unknown variant `distribution`')
      )
        incident = true;
      if (/^[1-9]\d*$/.test(String(p.id)) && BigInt(p.id) > 381n) {
        try {
          claimValidators(messages, { allowLegacy: false });
          replacement = true;
        } catch {
          /* A later legacy claim does not consume the correction explanation. */
        }
      }
    } catch {
      /* Similar titles with unrelated execution messages are not claims. */
    }
  }
  return { title: `${CLAIM_TITLE} ${roman(maximum + 1)}`, explain381: incident && !replacement };
}
export const nextClaimTitle = (proposals) => nextClaimContext(proposals).title;
export function withClaimContext(values, context) {
  const body = values.body.split(CLAIM_381_EXPLANATION).join('').trim();
  return {
    ...values,
    title: context.title,
    body: (context.explain381 ? CLAIM_381_EXPLANATION + '\n\n' : '') + body
  };
}
export function assertClaimContext(content, context) {
  if (!content.messages.length) return;
  claimValidators(content.messages, { allowLegacy: false });
  const explanations = content.summary.split(CLAIM_381_EXPLANATION).length - 1;
  if (content.title !== context.title || explanations !== (context.explain381 ? 1 : 0))
    throw Error(
      'Claim history changed or the replacement explanation is missing. Prepare a new claim from the programme overview before publishing or submitting.'
    );
}
// Exhaust the mainnet history; never reset numbering on a partial/failed read.
export async function readClaimContext(endpoints, { fetcher = governanceFetch } = {}) {
  const sources = [
    ...new Map(endpoints.map((x) => [new URL(x).origin, x.replace(/\/$/, '')])).values()
  ];
  const results = await Promise.allSettled(
    sources.map(async (base) => {
      let height;
      const get = async (path) => {
        const r = await fetcher(base + path, {
          cache: 'no-store',
          signal: AbortSignal.timeout(12000),
          headers: height ? { 'x-cosmos-block-height': height } : {}
        });
        if (!r.ok) throw Error('Mainnet claim history unavailable.');
        const returned = r.headers?.get('x-cosmos-block-height');
        if (height && returned && returned !== height)
          throw Error('Claim history height mismatch.');
        return r.json();
      };
      const latest = await get('/cosmos/base/tendermint/v1beta1/blocks/latest');
      const header = latest.block?.header || latest.sdk_block?.header;
      const age = Date.now() - Date.parse(header?.time);
      if (header?.chain_id !== 'juno-1' || !Number.isFinite(age) || age < -30000 || age > 120000)
        throw Error('Fresh Juno mainnet history required for claim numbering.');
      height = header.height;
      let key = '',
        rows = [];
      const seen = new Set();
      // Juno's reverse cursor traversal can panic on older proposal pages.
      // Forward traversal still checks the complete history, including later claims.
      for (let page = 0; page < 100; page++) {
        const data = await get(
          '/cosmos/gov/v1/proposals?pagination.limit=100' +
            (key ? '&pagination.key=' + encodeURIComponent(key) : '')
        );
        if (!Array.isArray(data.proposals)) throw Error('Mainnet claim history unavailable.');
        rows.push(...data.proposals);
        key = data.pagination?.next_key || '';
        if (!key) return nextClaimContext(rows);
        if (seen.has(key)) break;
        seen.add(key);
      }
      throw Error('Complete mainnet claim history required.');
    })
  );
  const good = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (good.length < 2 || good.some((context) => canonical(context) !== canonical(good[0])))
    throw Error('Two mainnet sources must agree on the next claim number. Refresh and try again.');
  return good[0];
}

export async function readClaimTitle(endpoints, options) {
  return (await readClaimContext(endpoints, options)).title;
}
