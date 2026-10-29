import { fixedByValidator } from './juno-fixed-allocations.mjs';
import { junoConsensusHex } from './juno-consensus-address.mjs';
import { PROGRAMME, operator } from './juno-delegation-core.mjs';
import { reader, quorum } from './juno-community-governance.mjs';
import { verifyProgrammeAuthority } from './juno-governance-core.mjs';
import {
  canonical,
  checkMovementState,
  checkCurrentAllocation
} from './juno-programme-staking.mjs';
import { readExecutionReview } from './juno-rebalance-execution.mjs';

export const REBALANCE_SOURCES = ['https://juno-api.polkachu.com', 'https://juno.api.m.stavr.tech'];
const staking = '/cosmos/staking/v1beta1';
const uint = (v) => typeof v === 'string' && /^(0|[1-9]\d{0,29})$/.test(v);
const dec = (v) =>
  typeof v === 'string' && /^\d+\.\d{18}$/.test(v) && BigInt(v.replace('.', '')) > 0n;
export async function stakingState(get, height) {
  async function pages(path, field) {
    const rows = [],
      seen = new Set();
    let key = '';
    for (let i = 0; i < 20; i++) {
      const data = await get(
        path + '?pagination.limit=100' + (key ? '&pagination.key=' + encodeURIComponent(key) : '')
      );
      if (
        !Array.isArray(data[field]) ||
        !data.pagination ||
        typeof (data.pagination.next_key ?? '') !== 'string'
      )
        throw Error('Incomplete staking pagination.');
      if (path.includes('/validatorsets/') && data.block_height !== height)
        throw Error('Consensus set height mismatch.');
      rows.push(...data[field]);
      key = data.pagination.next_key || '';
      if (!key) return rows;
      if (seen.has(key)) throw Error('Repeated staking pagination cursor.');
      seen.add(key);
    }
    throw Error('Staking pagination limit reached.');
  }
  const [params, balance, delegations, validators, redelegations, unbondings, consensus] =
    await Promise.all([
      get(staking + '/params'),
      get(`/cosmos/bank/v1beta1/spendable_balances/${PROGRAMME}/by_denom?denom=ujuno`),
      pages(staking + '/delegations/' + PROGRAMME, 'delegation_responses'),
      pages(staking + '/validators', 'validators'),
      pages(staking + '/delegators/' + PROGRAMME + '/redelegations', 'redelegation_responses'),
      pages(staking + '/delegators/' + PROGRAMME + '/unbonding_delegations', 'unbonding_responses'),
      pages(`/cosmos/base/tendermint/v1beta1/validatorsets/${height}`, 'validators')
    ]);
  if (
    params.params?.bond_denom !== 'ujuno' ||
    !Number.isSafeInteger(params.params.max_entries) ||
    params.params.max_entries < 1 ||
    !/^\d+(\.\d+)?s$/.test(params.params.unbonding_time) ||
    balance.balance?.denom !== 'ujuno' ||
    !uint(balance.balance.amount)
  )
    throw Error('Invalid staking parameters or spendable balance.');
  const positions = delegations.map((d) => {
    if (
      d.delegation?.delegator_address !== PROGRAMME ||
      !operator.test(d.delegation.validator_address) ||
      !dec(d.delegation.shares) ||
      d.balance?.denom !== 'ujuno' ||
      !uint(d.balance.amount)
    )
      throw Error('Invalid programme delegation.');
    return { address: d.delegation.validator_address, currentRaw: d.balance.amount };
  });
  const members = new Map(
    consensus.map((v) => {
      const hex =
        typeof v.address === 'string' && v.address.startsWith('junovalcons1')
          ? junoConsensusHex(v.address)
          : null;
      const bytes = hex
        ? Uint8Array.from(hex.match(/../g), (n) => parseInt(n, 16))
        : Uint8Array.from(atob(v.address), (c) => c.charCodeAt(0));
      if (bytes.length !== 20 || typeof v.pub_key?.key !== 'string')
        throw Error('Invalid consensus identity.');
      return [
        v.pub_key.key,
        Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()
      ];
    })
  );
  if (members.size !== consensus.length || !members.size || members.size > 200)
    throw Error('Invalid consensus set.');
  const nodes = validators.map((v) => {
    if (
      !operator.test(v.operator_address) ||
      typeof v.jailed !== 'boolean' ||
      !uint(v.tokens) ||
      !/^\d+\.\d{18}$/.test(v.delegator_shares) ||
      typeof v.consensus_pubkey?.key !== 'string' ||
      !/^(0\.\d{18}|1\.0{18})$/.test(v.commission?.commission_rates?.rate)
    )
      throw Error('Invalid validator exchange rate.');
    return {
      address: v.operator_address,
      jailed: v.jailed,
      tokensRaw: v.tokens,
      active: members.has(v.consensus_pubkey.key),
      consensusAddress: members.get(v.consensus_pubkey.key) || null,
      commissionAtoms: v.commission.commission_rates.rate.replace('.', '').replace(/^0+(?=\d)/, ''),
      exchangeRateValid:
        (BigInt(v.tokens) === 0n) === (BigInt(v.delegator_shares.replace('.', '')) === 0n)
    };
  });
  if (
    new Set(nodes.map((v) => v.address)).size !== nodes.length ||
    new Set(validators.map((v) => v.consensus_pubkey.key)).size !== nodes.length ||
    nodes.filter((v) => v.active).length !== members.size
  )
    throw Error('Duplicate validator state.');
  function entries(values) {
    if (
      !Array.isArray(values) ||
      values.some((e) => !e || !Number.isFinite(Date.parse(e.completion_time)))
    )
      throw Error('Invalid staking completion evidence.');
    return values.map((e) => ({ completionTime: e.completion_time }));
  }
  const reds = redelegations.map((r) => {
    const v = r.redelegation;
    if (
      v?.delegator_address !== PROGRAMME ||
      !operator.test(v.validator_src_address) ||
      !operator.test(v.validator_dst_address)
    )
      throw Error('Invalid redelegation identity.');
    return {
      source: v.validator_src_address,
      destination: v.validator_dst_address,
      entries: entries(v.entries)
    };
  });
  const unbonds = unbondings.map((v) => {
    if (v?.delegator_address !== PROGRAMME || !operator.test(v.validator_address))
      throw Error('Invalid unbonding identity.');
    return { source: v.validator_address, entries: entries(v.entries) };
  });
  return {
    activeCount: members.size,
    liquidRaw: balance.balance.amount,
    maxEntries: params.params.max_entries,
    unbondingTime: params.params.unbonding_time,
    positions,
    validators: nodes,
    redelegations: reds,
    unbondings: unbonds
  };
}
export async function checkRebalanceSource(get, review, height, blockTime) {
  const [account, info, code, admin, paused, withdraw, state] = await Promise.all([
    get('/cosmos/auth/v1beta1/module_accounts/gov'),
    get(`/cosmwasm/wasm/v1/contract/${PROGRAMME}`),
    get('/cosmwasm/wasm/v1/code/4047'),
    get(`/cosmwasm/wasm/v1/contract/${PROGRAMME}/smart/${btoa('{"admin":{}}')}`),
    get(`/cosmwasm/wasm/v1/contract/${PROGRAMME}/smart/${btoa('{"pause_info":{}}')}`),
    get(`/cosmos/distribution/v1beta1/delegators/${PROGRAMME}/withdraw_address`),
    stakingState(get, height)
  ]);
  verifyProgrammeAuthority({ account, info, code, admin, paused, withdraw });
  state.blockTime = blockTime;
  const calculation = review.value.calculation;
  const blockers = checkMovementState(
    review.value.plan,
    state,
    fixedByValidator(calculation.rule, calculation.snapshot.blockTime)
  );
  if (blockers.length) throw Error(blockers.join(' '));
  checkCurrentAllocation(review.value.calculation, review.value.plan, state);
  return {
    unbondingTime: state.unbondingTime,
    maxEntries: state.maxEntries,
    activeCount: state.activeCount,
    positions: state.positions
      .filter((p) => BigInt(p.currentRaw) > 0n)
      .sort((a, b) => a.address.localeCompare(b.address))
  };
}
export async function checkCurrentApproval(review, options = {}) {
  const { currentApprovedRules } = await import('./juno-approved-rules.mjs');
  const approved = await currentApprovedRules({
      ...options,
      requireHeight: true,
      rejectPendingProgramme: true
    }),
    parent = review.value.calculation.parent;
  if (
    !approved.current ||
    parent.proposalId !== approved.current.proposalId ||
    parent.hash !== approved.current.hash
  )
    throw Error('The approved rulebook changed. Return to Rebalance and simulate again.');
}
export async function checkRebalance(review, { endpoints = REBALANCE_SOURCES, ...options } = {}) {
  await checkCurrentApproval(review, { ...options, endpoints });
  return quorum(
    endpoints,
    async (endpoint) => {
      const r = await reader(endpoint, 'juno-1', { ...options, requireHeight: true });
      return {
        state: await checkRebalanceSource(r.get, review, r.height, r.blockTime),
        endpoint,
        height: r.height
      };
    },
    (p) => canonical(p.state),
    'Rebalance'
  );
}
export async function verifyRebalanceValues(values, options = {}) {
  const review = await readExecutionReview(values);
  if (review) await checkRebalance(review, options);
  return review;
}
