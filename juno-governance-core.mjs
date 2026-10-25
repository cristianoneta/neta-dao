import { isStaking, assertStaking } from './juno-programme-staking.mjs';
import {
  COMMUNITY_POOL_KIND,
  isCommunityPoolSpend,
  assertCommunityPoolSpend,
  verifyCommunityPoolState,
  COMMUNITY_POOL_PATH,
  DAI_DENOM_PATH
} from './juno-community-pool-proposal.mjs';
import { governanceFetch } from './governance-chain-read.mjs';
import { PROGRAMME, operator } from './juno-delegation-core.mjs';

export const GOVERNANCE = 'juno10d07y265gmmuvt4z0w9aw880jnsr700jvss730';
export const EXECUTE = '/cosmwasm.wasm.v1.MsgExecuteContract';
export const SUBMIT = '/cosmos.gov.v1.MsgSubmitProposal';
export const PROGRAMME_CODE_HASH =
  'cf70918a88a9e0654e6b439b8927e8d7897bf113f25909973910682af227e287';
export const WITHDRAW_REWARD = '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward';
export const CLAIM_REWARDS_BLOCK_REASON =
  'This saved claim uses the incompatible format from proposal #381. Return to the programme overview and prepare a new claim; the original review remains unchanged.';
const same = (a, b) => stable(a) === stable(b);

// MsgWithdrawDelegatorReward has exactly two string fields. Both reviewed Bech32
// addresses fit a canonical one-byte protobuf length; reject any other encoding.
export function encodeRewardWithdrawal(validator) {
  if (typeof validator !== 'string' || !operator.test(validator))
    throw Error('Invalid programme reward validator.');
  const delegator = new TextEncoder().encode(PROGRAMME),
    target = new TextEncoder().encode(validator);
  if (delegator.length >= 128 || target.length >= 128) throw Error('Invalid address length.');
  return btoa(
    String.fromCharCode(10, delegator.length, ...delegator, 18, target.length, ...target)
  );
}
export function decodeRewardWithdrawal(message) {
  if (message?.type_url !== WITHDRAW_REWARD || typeof message.value !== 'string')
    throw Error('Expected a staking rewards withdrawal.');
  const bytes = Uint8Array.from(atob(message.value), (c) => c.charCodeAt(0)),
    split = 2 + bytes[1],
    end = split + 2 + bytes[split + 1];
  if (
    bytes[0] !== 10 ||
    bytes[1] >= 128 ||
    bytes[split] !== 18 ||
    bytes[split + 1] >= 128 ||
    end !== bytes.length
  )
    throw Error('Invalid reward withdrawal protobuf.');
  const decoder = new TextDecoder('utf-8', { fatal: true }),
    delegator = decoder.decode(bytes.slice(2, split)),
    validator = decoder.decode(bytes.slice(split + 2));
  if (
    delegator !== PROGRAMME ||
    !same(message, {
      type_url: WITHDRAW_REWARD,
      value: encodeRewardWithdrawal(validator)
    })
  )
    throw Error('Reward withdrawal must use the programme as delegator.');
  return { delegator, validator };
}
function rewardEnvelope(validators, legacy) {
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
          msgs: [...validators].sort().map((validator) =>
            legacy
              ? { distribution: { withdraw_delegator_reward: { validator } } }
              : {
                  stargate: {
                    type_url: WITHDRAW_REWARD,
                    value: encodeRewardWithdrawal(validator)
                  }
                }
          )
        }
      }
    }
  ];
}
export const rewardMessages = (validators) => rewardEnvelope(validators, false);
// Only for immutable historical reviews and schema-1 decoding. Never authorize a write.
export const legacyRewardMessages = (validators) => rewardEnvelope(validators, true);
export function claimValidators(messages, { allowLegacy = true } = {}) {
  const inner = messages?.[0]?.msg?.execute_admin_msgs?.msgs;
  if (!Array.isArray(inner)) throw Error('Expected a Juno governance programme rewards message.');
  const legacy = inner.some((v) => v?.distribution);
  if (legacy && !allowLegacy) throw Error(CLAIM_REWARDS_BLOCK_REASON);
  const validators = inner.map((v) =>
    legacy
      ? v?.distribution?.withdraw_delegator_reward?.validator
      : decodeRewardWithdrawal(v?.stargate).validator
  );
  if (!same(messages, rewardEnvelope(validators, legacy)))
    throw Error('Only the reviewed programme rewards message is supported.');
  return validators;
}
// Gate every publication, submission and contribution. Reading old reviews is separate.
export function assertProgrammeExecutionAvailable(messages) {
  if (!Array.isArray(messages)) throw Error('Invalid proposal messages.');
  if (isStaking(messages)) assertStaking(messages);
  else if (messages.some((m) => m?.contract === PROGRAMME))
    claimValidators(messages, { allowLegacy: false });
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
  if (kind === COMMUNITY_POOL_KIND) assertCommunityPoolSpend(messages);
  else if (kind === 'ALLOCATION_EXECUTION') assertStaking(messages);
  else if (kind === 'CLAIM_REWARDS') claimValidators(messages);
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
export function verifyProgrammeAuthority({ account, info, code, admin, paused, withdraw }) {
  if (
    account?.account?.base_account?.address !== GOVERNANCE ||
    account.account.name !== 'gov' ||
    Number(info?.contract_info?.code_id) !== 4047 ||
    String(code?.code_info?.data_hash || '').toLowerCase() !== PROGRAMME_CODE_HASH ||
    admin?.data !== GOVERNANCE
  )
    throw Error('Juno governance authority over the programme could not be verified.');
  // Conservative product gate: governance-admin execution itself can bypass a
  // DAO pause, but an active pause requires separate operator review.
  if (!same(paused?.data, { unpaused: {} }))
    throw Error('Programme pause state requires review before preparing a claim.');
  if (withdraw?.withdraw_address !== PROGRAMME)
    throw Error('Programme rewards withdrawal destination is not the programme treasury.');
}
export function verifyProgramme(evidence, messages) {
  verifyProgrammeAuthority(evidence);
  const { delegations } = evidence;
  const validators = claimValidators(messages, { allowLegacy: false });
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
        if (
          height &&
          (((isCommunityPoolSpend(content.messages) || isStaking(content.messages)) && !returned) ||
            (returned && returned !== height))
        )
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
      let staking = null;
      if (balance.balance?.denom !== 'ujuno' || !/^\d+$/.test(balance.balance?.amount))
        throw Error('Spendable JUNO balance unavailable.');
      if (isCommunityPoolSpend(content.messages)) {
        const [account, pool, denom] = await Promise.all([
          get('/cosmos/auth/v1beta1/module_accounts/gov'),
          get(COMMUNITY_POOL_PATH),
          get(DAI_DENOM_PATH)
        ]);
        verifyCommunityPoolState({ account, pool, denom }, content.messages);
      } else if (isStaking(content.messages)) {
        const { readExecutionReview } = await import('./juno-rebalance-execution.mjs');
        const { checkRebalanceSource } = await import('./juno-rebalance-chain.mjs');
        const split = content.summary.indexOf('\n\n');
        const review = await readExecutionReview({
          title: content.title,
          summary: content.summary.slice(0, split),
          body: content.summary.slice(split + 2),
          actions_json: JSON.stringify(content.messages, null, 2)
        });
        staking = await checkRebalanceSource(get, review);
      } else if (content.messages.length) {
        const [account, info, code, admin, paused, withdraw] = await Promise.all([
          get('/cosmos/auth/v1beta1/module_accounts/gov'),
          get(`/cosmwasm/wasm/v1/contract/${PROGRAMME}`),
          get('/cosmwasm/wasm/v1/code/4047'),
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
        verifyProgramme(
          { account, info, code, admin, paused, withdraw, delegations },
          content.messages
        );
      }
      return {
        height,
        endpoint,
        staking,
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
  assertProgrammeExecutionAvailable(content.messages);
  if (isStaking(content.messages)) {
    const { readExecutionReview } = await import('./juno-rebalance-execution.mjs');
    const { checkCurrentApproval } = await import('./juno-rebalance-chain.mjs');
    const split = content.summary.indexOf('\n\n');
    const review = await readExecutionReview({
      title: content.title,
      summary: content.summary.slice(0, split),
      body: content.summary.slice(split + 2),
      actions_json: JSON.stringify(content.messages, null, 2)
    });
    await checkCurrentApproval(review, { ...options, endpoints });
  }
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
  if (
    isStaking(content.messages) &&
    good.some((proof) => stable(proof.staking) !== stable(good[0].staking))
  )
    throw Error('Juno sources disagree on staking state. Review again later.');
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
