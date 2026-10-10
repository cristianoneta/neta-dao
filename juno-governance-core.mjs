import { governanceFetch } from './governance-chain-read.mjs';
import { PROGRAMME, operator } from './juno-delegation-core.mjs';

export const GOVERNANCE = 'juno10d07y265gmmuvt4z0w9aw880jnsr700jvss730';
export const EXECUTE = '/cosmwasm.wasm.v1.MsgExecuteContract';
export const SUBMIT = '/cosmos.gov.v1.MsgSubmitProposal';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function rewardMessages(validators) {
  if (
    !Array.isArray(validators) ||
    !validators.length ||
    validators.length > 500 ||
    new Set(validators).size !== validators.length ||
    validators.some((v) => typeof v !== 'string' || !operator.test(v))
  )
    throw Error('Invalid programme reward validators.');
  return [
    {
      '@type': EXECUTE,
      sender: GOVERNANCE,
      contract: PROGRAMME,
      funds: [],
      msg: {
        execute_admin_msgs: {
          msgs: [...validators].sort().map((validator) => ({
            distribution: { withdraw_delegator_reward: { validator } }
          }))
        }
      }
    }
  ];
}
export function claimValidators(messages) {
  const inner = messages?.[0]?.msg?.execute_admin_msgs?.msgs;
  if (!Array.isArray(inner)) throw Error('Expected a Juno governance programme rewards message.');
  const validators = inner.map((v) => v?.distribution?.withdraw_delegator_reward?.validator);
  // Exact allowlist: no funds, transfers, delegated signer or extra messages/fields.
  if (!same(messages, rewardMessages(validators)))
    throw Error('Only the reviewed programme rewards message is supported.');
  return validators;
}
export function proposalContent(kind, values) {
  if (
    !values?.title?.trim() ||
    values.title.length > 120 ||
    !values.summary?.trim() ||
    !values.body?.trim()
  )
    throw Error('Review the proposal title, summary and body.');
  const summary = `${values.summary.trim()}\n\n${values.body.trim()}`;
  if (new TextEncoder().encode(summary).length > 10000)
    throw Error('On-chain proposal text exceeds 10,000 bytes.');
  const messages = JSON.parse(values.actions_json);
  if (kind === 'CLAIM_REWARDS') claimValidators(messages);
  else if (kind !== 'RULE_APPROVAL' || !same(messages, []))
    throw Error('Rule approval must contain no execution messages.');
  return { title: values.title.trim(), summary, messages, metadata: '', expedited: false };
}
export function depositTerms(params) {
  const coins = params?.min_deposit,
    ratio = params?.min_initial_deposit_ratio;
  if (
    !Array.isArray(coins) ||
    coins.length !== 1 ||
    coins[0].denom !== 'ujuno' ||
    !/^[1-9]\d*$/.test(coins[0].amount) ||
    !/^(0|1)(\.\d{1,18})?$/.test(ratio)
  )
    throw Error('Unsupported Juno governance deposit parameters.');
  const total = BigInt(coins[0].amount),
    [whole, fraction = ''] = ratio.split('.'),
    scale = 10n ** BigInt(fraction.length),
    factor = BigInt(whole) * scale + BigInt(fraction || '0');
  if (factor > scale) throw Error('Invalid initial deposit ratio.');
  const initial = (total * factor + scale - 1n) / scale;
  return { total: total.toString(), initial: (initial || 1n).toString() };
}
export function parseDeposit(text) {
  if (!/^\d+(\.\d{1,6})?$/.test(text))
    throw Error('Enter a JUNO deposit with at most six decimals.');
  const [whole, fraction = ''] = text.split('.');
  return (BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'))).toString();
}
export function displayJuno(raw) {
  const value = BigInt(raw),
    fraction = (value % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${value / 1000000n}${fraction ? '.' + fraction : ''}`;
}
export function verifyProgramme({ account, info, admin, paused, withdraw, delegations }, messages) {
  if (
    account?.account?.base_account?.address !== GOVERNANCE ||
    account.account.name !== 'gov' ||
    Number(info?.contract_info?.code_id) !== 4047 ||
    admin?.data !== GOVERNANCE
  )
    throw Error('Juno governance authority over the programme could not be verified.');
  // Conservative product gate: governance-admin execution itself can bypass a
  // DAO pause, but an active pause requires separate operator review.
  if (!same(paused?.data, { unpaused: {} }))
    throw Error('Programme pause state requires review before preparing a claim.');
  if (withdraw?.withdraw_address !== PROGRAMME)
    throw Error('Programme rewards withdrawal destination is not the programme treasury.');
  const validators = claimValidators(messages);
  if (
    !Array.isArray(delegations) ||
    delegations.some(
      (d) =>
        d.delegation?.delegator_address !== PROGRAMME ||
        d.balance?.denom !== 'ujuno' ||
        !/^\d+$/.test(d.balance?.amount)
    )
  )
    throw Error('Invalid programme delegation data.');
  const current = delegations
    .filter((d) => BigInt(d.balance.amount) > 0n)
    .map((d) => d.delegation.validator_address)
    .sort();
  if (!same(current, validators))
    throw Error('Programme delegations changed. Refresh the planner and prepare a new claim.');
}

// One node and one height for each complete preflight. Fail over whole checks,
// never assemble authority/deposit evidence from different nodes or heights.
async function preflightSource(
  endpoints,
  content,
  proposer,
  { fetcher = governanceFetch, now = Date.now() } = {}
) {
  let last;
  for (const endpoint of endpoints) {
    try {
      let height;
      const get = async (path) => {
        const response = await fetcher(endpoint + path, {
          cache: 'no-store',
          signal: AbortSignal.timeout(12000),
          headers: height ? { 'x-cosmos-block-height': height } : {}
        });
        if (!response.ok) throw Error(`Juno preflight query failed (${response.status}).`);
        const returned = response.headers.get('x-cosmos-block-height');
        if (height && returned && returned !== height)
          throw Error('Juno preflight height mismatch.');
        return response.json();
      };
      const latest = await get('/cosmos/base/tendermint/v1beta1/blocks/latest'),
        header = latest.block?.header || latest.sdk_block?.header,
        age = now - Date.parse(header?.time);
      if (
        header?.chain_id !== 'juno-1' ||
        !/^[1-9]\d*$/.test(header?.height) ||
        !Number.isFinite(age) ||
        age < -30000 ||
        age > 120000
      )
        throw Error('Fresh Juno mainnet evidence is unavailable.');
      height = header.height;
      const [parameters, balance] = await Promise.all([
        get('/cosmos/gov/v1/params/deposit'),
        get(
          `/cosmos/bank/v1beta1/spendable_balances/${encodeURIComponent(proposer)}/by_denom?denom=ujuno`
        )
      ]);
      const terms = depositTerms(parameters.params);
      if (balance.balance?.denom !== 'ujuno' || !/^\d+$/.test(balance.balance?.amount))
        throw Error('Spendable JUNO balance unavailable.');
      if (content.messages.length) {
        const [account, info, admin, paused, withdraw] = await Promise.all([
          get('/cosmos/auth/v1beta1/module_accounts/gov'),
          get(`/cosmwasm/wasm/v1/contract/${PROGRAMME}`),
          get(`/cosmwasm/wasm/v1/contract/${PROGRAMME}/smart/${btoa('{"admin":{}}')}`),
          get(`/cosmwasm/wasm/v1/contract/${PROGRAMME}/smart/${btoa('{"pause_info":{}}')}`),
          get(`/cosmos/distribution/v1beta1/delegators/${PROGRAMME}/withdraw_address`)
        ]);
        const delegations = [],
          seen = new Set();
        let key = '';
        for (let page = 0; page < 20; page++) {
          const data = await get(
            `/cosmos/staking/v1beta1/delegations/${PROGRAMME}?pagination.limit=100${key ? '&pagination.key=' + encodeURIComponent(key) : ''}`
          );
          if (!Array.isArray(data.delegation_responses))
            throw Error('Programme delegations unavailable.');
          delegations.push(...data.delegation_responses);
          key = data.pagination?.next_key || '';
          if (!key) break;
          if (seen.has(key) || page === 19) throw Error('Incomplete programme delegations.');
          seen.add(key);
        }
        verifyProgramme({ account, info, admin, paused, withdraw, delegations }, content.messages);
      }
      return {
        height,
        endpoint,
        params: parameters.params,
        terms,
        balance: balance.balance.amount,
        checkedAt: now
      };
    } catch (error) {
      last = error;
    }
  }
  throw last || Error('Juno preflight unavailable.');
}

const stable = (value) =>
  JSON.stringify(value, function (key, item) {
    return item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((name) => [name, item[name]])
        )
      : item;
  });
function independentEndpoints(endpoints) {
  return [
    ...new Map(
      endpoints.map((endpoint) => [new URL(endpoint).origin, endpoint.replace(/\/$/, '')])
    ).values()
  ];
}
export async function preflight(endpoints, content, proposer, options = {}) {
  const results = await Promise.allSettled(
    independentEndpoints(endpoints).map((endpoint) =>
      preflightSource([endpoint], content, proposer, options)
    )
  );
  const good = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (good.length < 2)
    throw Error(
      'Two independent Juno sources must verify this proposal. ' +
        results
          .filter((r) => r.status === 'rejected')
          .map((r) => r.reason.message)
          .join(' · ')
    );
  if (good.some((proof) => stable(proof.params) !== stable(good[0].params)))
    throw Error('Juno sources disagree on governance parameters. Review again later.');
  return {
    ...good[0],
    balance: good.reduce(
      (min, proof) => (BigInt(proof.balance) < BigInt(min) ? proof.balance : min),
      good[0].balance
    ),
    sources: good.map(({ endpoint, height }) => ({ endpoint, height }))
  };
}

// Checking an uncertain attempt never signs, broadcasts or removes its journal.
export async function submissionReceipt(endpoints, hash, { fetcher = governanceFetch } = {}) {
  if (!/^[A-F0-9]{64}$/.test(hash)) throw Error('Invalid submission transaction hash.');
  const results = await Promise.allSettled(
    independentEndpoints(endpoints).map(async (endpoint) => {
      const response = await fetcher(endpoint + '/cosmos/tx/v1beta1/txs/' + hash, {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw Error('Transaction lookup unavailable.');
      const { tx_response: tx } = await response.json();
      if (
        tx?.txhash?.toUpperCase() !== hash ||
        !/^[1-9]\d*$/.test(String(tx.height)) ||
        !Number.isSafeInteger(tx.code) ||
        tx.code < 0
      )
        throw Error('Transaction inclusion is unverified.');
      return {
        hash,
        height: String(tx.height),
        code: tx.code,
        state: tx.code === 0 ? 'included' : 'failed'
      };
    })
  );
  const good = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (good.length < 2 || good.some((r) => !same(r, good[0])))
    throw Error(
      'Submission outcome is still unconfirmed. Check again; do not submit another proposal.'
    );
  return good[0];
}
