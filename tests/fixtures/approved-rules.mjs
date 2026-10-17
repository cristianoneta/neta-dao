import { legacyPolicy as defaultPolicy, fingerprint, simulate, amount } from '../../juno-delegation-core.mjs';
import { ruleProposal } from '../../planner-proposal-draft.mjs';
import { fixture, observed } from './delegation-planner.mjs';
export async function approvedProposal(overrides = {}, rule = defaultPolicy()) {
  const snapshot = fixture();
  const draft = ruleProposal({
    proposalType: 'RULE_APPROVAL',
    approval: null,
    rule,
    snapshot,
    simulation: simulate(rule, snapshot, amount('3000'), observed(snapshot)),
    policyHash: await fingerprint(rule),
    snapshotHash: 'b'.repeat(64),
    evidenceHash: 'c'.repeat(64)
  });
  return {
    id: '950',
    title: draft.values.title,
    summary: draft.values.summary + '\n\n' + draft.values.body,
    status: 'PROPOSAL_STATUS_PASSED',
    messages: [],
    expedited: false,
    voting_end_time: new Date(Date.now() - 3600000).toISOString(),
    ...overrides
  };
}
