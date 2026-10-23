// One reviewed, bounded template. URL parameters never supply transaction fields.
export const COMMUNITY_POOL_TEMPLATE = 'axldai-usdc';
export const COMMUNITY_POOL_KIND = 'COMMUNITY_POOL_DAI';
export const COMMUNITY_POOL_SPEND = '/cosmos.distribution.v1beta1.MsgCommunityPoolSpend';
export const DAI_DENOM = 'ibc/171E8F6687D290D378678310F9F15D367DCD245BF06184532B703A92054A8A4F';
export const DAI_AMOUNT = '460900000000000000000';
export const DAI_RECIPIENT = 'juno14juhdqftm8zd9n9pv4shjf92jzrm8ey4422jky';
const authority = 'juno10d07y265gmmuvt4z0w9aw880jnsr700jvss730';
export const DAI_DENOM_PATH = '/ibc/apps/transfer/v1/denoms/' + DAI_DENOM.slice(4);
export const COMMUNITY_POOL_PATH = '/cosmos/distribution/v1beta1/community_pool';
export const COMMUNITY_POOL_URL = '/?chain=juno&dao=juno&proposalTemplate=axldai-usdc#governance';
const canonical = (v) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]])
        )
      : x
  );
export function communityPoolMessages() {
  return [
    {
      '@type': COMMUNITY_POOL_SPEND,
      authority,
      recipient: DAI_RECIPIENT,
      amount: [{ denom: DAI_DENOM, amount: DAI_AMOUNT }]
    }
  ];
}
export const isCommunityPoolSpend = (messages) =>
  Array.isArray(messages) && messages.some((m) => m?.['@type'] === COMMUNITY_POOL_SPEND);
export function assertCommunityPoolSpend(messages) {
  if (canonical(messages) !== canonical(communityPoolMessages()))
    throw Error(
      'This template only authorizes 460.9 axlDAI from the Juno Community Pool to the recipient in proposal #382. Prepare a new DAI conversion draft.'
    );
}
export function verifyCommunityPoolState({ account, pool, denom }, messages) {
  assertCommunityPoolSpend(messages);
  if (account?.account?.name !== 'gov' || account.account.base_account?.address !== authority)
    throw Error('Juno governance authority could not be verified.');
  if (
    canonical(denom?.denom) !==
    canonical({ base: 'dai-wei', trace: [{ port_id: 'transfer', channel_id: 'channel-71' }] })
  )
    throw Error('The axlDAI denomination could not be verified.');
  const coins = pool?.pool?.filter((c) => c.denom === DAI_DENOM);
  if (!coins || coins.length !== 1 || !/^\d+(?:\.\d{1,18})?$/.test(coins[0].amount))
    throw Error('The Community Pool axlDAI balance is unavailable.');
  const raw = coins[0].amount.split('.')[0];
  if (BigInt(raw) < BigInt(DAI_AMOUNT))
    throw Error(
      'The Community Pool no longer holds the reviewed 460.9 axlDAI. Do not publish or submit this draft.'
    );
  return { balance: coins[0].amount, denom: DAI_DENOM };
}
export function communityPoolProposal() {
  return {
    schema: 2,
    governanceDaoId: 'juno',
    daoId: 'juno',
    chainId: 'juno-1',
    kind: COMMUNITY_POOL_KIND,
    createdAt: new Date().toISOString(),
    values: {
      title: 'Community Pool: convert remaining axlDAI to USDC via Injective',
      summary:
        'Convert 460.9 axlDAI from the Juno Community Pool into USDC via Injective and return the proceeds to the Community Pool, following the approach of proposal #382.',
      body: `With DAI liquidity becoming thinner, the objective is to consolidate these funds into a more accessible stablecoin and reduce dependence on limited DAI trading routes.\n\nThis proposal transfers 460.9 axlDAI to Dimi at:\n${DAI_RECIPIENT}\n\nDimi is authorized to:\n1. Transfer the axlDAI through an available bridge or IBC route and convert it into USDC on Injective, minimizing fees and slippage.\n2. Return the entire resulting USDC balance, after necessary transaction and conversion costs, to the Juno Community Pool through IBC and MsgFundCommunityPool.\n3. Publish the transaction hashes and a brief reconciliation of the amount received, costs incurred and amount returned.\n\nNo compensation or personal allocation is authorized. Any unconverted funds must also be returned to the Community Pool.\n\nThe on-chain action transfers the specified axlDAI amount after an accepted vote. Dimi performs the conversion and return separately; these subsequent steps are not automated by this proposal.\n\nThis proposal was created on cosmoot.com.`,
      actions_json: JSON.stringify(communityPoolMessages(), null, 2)
    }
  };
}
