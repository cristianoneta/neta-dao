import { PROGRAMME } from '../../juno-delegation-core.mjs';
import { rewardMessages } from '../../juno-governance-core.mjs';

// Reconstruct old saved drafts for read-only compatibility tests. This fixture
// deliberately contains the rejected message format; it is not a claim builder.
export function legacyClaimDraft(snapshot) {
  const addresses = snapshot.validators
    .filter((v) => BigInt(v.currentRaw) > 0n)
    .map((v) => v.address);
  return {
    schema: 2,
    daoId: 'juno-delegation',
    governanceDaoId: 'juno',
    chainId: 'juno-1',
    programme: PROGRAMME,
    kind: 'CLAIM_REWARDS',
    createdAt: snapshot.collectedAt,
    values: {
      title: 'Juno Delegation Programme — claim staking rewards',
      summary: `This proposal claims the accrued staking rewards from the Juno Delegation Programme’s ${addresses.length} listed validator positions and makes them available in the programme treasury.`,
      body: 'Existing delegations remain unchanged. No tokens are delegated, redelegated or transferred to another recipient.\n\nThis proposal was created on cosmoot.com.',
      actions_json: JSON.stringify(rewardMessages(addresses), null, 2)
    }
  };
}
