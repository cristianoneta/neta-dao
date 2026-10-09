import { PROGRAMME } from './juno-delegation-core.mjs';

export const GOV = 'juno10d07y265gmmuvt4z0w9aw880jnsr700jvss730';
export const EXECUTE = '/cosmwasm.wasm.v1.MsgExecuteContract';
export const SUBMIT = '/cosmos.gov.v1.MsgSubmitProposal';
export const RESTS = [
  'https://juno-api.polkachu.com',
  'https://juno-api.lavenderfive.com',
  'https://juno.api.m.stavr.tech'
];
export function claimMessages(validators) {
  if (
    !Array.isArray(validators) ||
    !validators.length ||
    validators.length > 500 ||
    new Set(validators).size !== validators.length ||
    validators.some((v) => !/^junovaloper1[023456789acdefghjklmnpqrstuvwxyz]{38}$/.test(v))
  )
    throw Error('Invalid claim validators.');
  return [
    {
      '@type': EXECUTE,
      sender: GOV,
      contract: PROGRAMME,
      msg: {
        execute_admin_msgs: {
          msgs: [...validators]
            .sort()
            .map((validator) => ({ distribution: { withdraw_delegator_reward: { validator } } }))
        }
      },
      funds: []
    }
  ];
}
export function proposalContent(kind, values) {
  const title = values.title?.trim(),
    summary = `${values.summary?.trim() || ''}\n\n${values.body?.trim() || ''}`;
  if (
    !title ||
    title.length > 120 ||
    !values.summary?.trim() ||
    !values.body?.trim() ||
    new TextEncoder().encode(summary).length > 10000
  )
    throw Error('Provide a title, summary and body (combined maximum 10,000 UTF-8 bytes).');
  const messages = JSON.parse(values.actions_json);
  if (kind === 'CLAIM_REWARDS') {
    const validators = messages?.[0]?.msg?.execute_admin_msgs?.msgs?.map(
      (m) => m.distribution?.withdraw_delegator_reward?.validator
    );
    if (JSON.stringify(messages) !== JSON.stringify(claimMessages(validators)))
      throw Error('Claim actions changed. Return to the planner to prepare a new claim.');
  } else if (kind !== 'RULE_APPROVAL' || !Array.isArray(messages) || messages.length)
    throw Error('Rule approval must not execute any actions.');
  return { title, summary, messages, metadata: '' };
}
export function validateEvidence(evidence, kind, content, now = Date.now()) {
  const { header, info, admin, paused, gov, withdraw, params, delegations } = evidence;
  const age = now - Date.parse(header?.time);
  if (header?.chain_id !== 'juno-1' || !Number.isFinite(age) || age < -300000 || age > 120000)
    throw Error('Fresh Juno mainnet evidence is required.');
  if (gov?.name !== 'gov' || gov?.base_account?.address !== GOV)
    throw Error('Juno governance authority could not be verified.');
  if (
    String(info?.code_id) !== '4047' ||
    admin !== GOV ||
    Object.keys(paused || {}).join() !== 'unpaused'
  )
    throw Error('Programme code, internal admin or unpaused state changed.');
  const minimum = params?.min_deposit;
  if (
    !Array.isArray(minimum) ||
    minimum.length !== 1 ||
    minimum[0].denom !== 'ujuno' ||
    !/^[1-9]\d{0,18}$/.test(minimum[0].amount)
  )
    throw Error('Unsupported governance deposit parameters.');
  if (kind === 'CLAIM_REWARDS') {
    if (withdraw !== PROGRAMME)
      throw Error('Rewards withdrawal destination is not the programme treasury.');
    const validators = delegations.map((d) => {
      if (
        d.delegation?.delegator_address !== PROGRAMME ||
        d.balance?.denom !== 'ujuno' ||
        !/^[1-9]\d*$/.test(d.balance.amount)
      )
        throw Error('Invalid programme delegation evidence.');
      return d.delegation.validator_address;
    });
    if (JSON.stringify(content.messages) !== JSON.stringify(claimMessages(validators)))
      throw Error('Programme delegations changed. Prepare a new claim in the planner.');
  }
  return {
    initialDeposit: structuredClone(minimum),
    votingPeriod: params.voting_period,
    maxDepositPeriod: params.max_deposit_period
  };
}
const encoded = (value) => btoa(JSON.stringify(value));
export async function readEvidence(base, kind, get) {
  const smart = (q) =>
    get(base + `/cosmwasm/wasm/v1/contract/${PROGRAMME}/smart/${encoded(q)}`).then((r) => r.data);
  const [block, info, admin, paused, gov, parameters, withdraw] = await Promise.all([
    get(base + '/cosmos/base/tendermint/v1beta1/blocks/latest'),
    get(base + `/cosmwasm/wasm/v1/contract/${PROGRAMME}`),
    smart({ admin: {} }),
    smart({ pause_info: {} }),
    get(base + '/cosmos/auth/v1beta1/module_accounts/gov'),
    get(base + '/cosmos/gov/v1/params/deposit'),
    kind === 'CLAIM_REWARDS'
      ? get(base + `/cosmos/distribution/v1beta1/delegators/${PROGRAMME}/withdraw_address`)
      : null
  ]);
  const delegations = [];
  if (kind === 'CLAIM_REWARDS') {
    let key = '',
      seen = new Set();
    do {
      if (seen.has(key) || seen.size >= 10) throw Error('Incomplete delegation pagination.');
      seen.add(key);
      const page = await get(
        base +
          `/cosmos/staking/v1beta1/delegations/${PROGRAMME}?pagination.limit=100&pagination.key=${encodeURIComponent(key)}`
      );
      if (!Array.isArray(page.delegation_responses)) throw Error('Delegations unavailable.');
      delegations.push(...page.delegation_responses);
      key = page.pagination?.next_key || '';
    } while (key);
  }
  return {
    header: block.block?.header || block.sdk_block?.header,
    info: info.contract_info,
    admin,
    paused,
    gov: gov.account,
    params: parameters.params,
    withdraw: withdraw?.withdraw_address,
    delegations
  };
}
export async function verifyGovernance(kind, content, get, now = Date.now()) {
  const results = await Promise.allSettled(
    RESTS.map((base) =>
      readEvidence(base, kind, get).then((e) => validateEvidence(e, kind, content, now))
    )
  );
  const good = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (good.length < 2)
    throw Error(
      'Two independent Juno sources must verify authority, withdrawal destination and current deposit. ' +
        results
          .filter((r) => r.status === 'rejected')
          .map((r) => r.reason.message)
          .join(' · ')
    );
  if (good.some((r) => JSON.stringify(r) !== JSON.stringify(good[0])))
    throw Error('Juno sources disagree on governance parameters.');
  return good[0];
}
